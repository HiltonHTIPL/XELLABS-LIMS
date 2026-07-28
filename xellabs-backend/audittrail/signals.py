import json
import logging
from decimal import Decimal
from datetime import datetime, date

from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType

from .middleware import get_current_request

logger = logging.getLogger(__name__)

# Models that trigger audit + versioning
TRACKED_MODELS = []  # populated in apps.py after all apps load


def _serialize_value(val):
    if val is None:
        return None
    if isinstance(val, Decimal):
        return str(val)
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    return str(val)


def _instance_snapshot(instance):
    data = {}
    for field in instance._meta.concrete_fields:
        data[field.attname] = _serialize_value(getattr(instance, field.attname, None))
    return data


def _get_ip(request):
    if request is None:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    return xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR")


def _get_reason(request):
    if request is None:
        return ""
    if hasattr(request, "data"):
        return request.data.get("reason_for_change", "")
    return request.GET.get("reason_for_change", "")


def _get_user(request):
    if request and hasattr(request, "user") and request.user.is_authenticated:
        return request.user
    return None


def wire_signals(model):
    """Attach pre_save / post_save / post_delete to a model at startup."""

    @receiver(pre_save, sender=model, weak=False)
    def capture_old(sender, instance, **kwargs):
        if instance.pk:
            try:
                instance._pre_save_old = sender.objects.get(pk=instance.pk)
            except sender.DoesNotExist:
                instance._pre_save_old = None
        else:
            instance._pre_save_old = None

    @receiver(post_save, sender=model, weak=False)
    def on_save(sender, instance, created, **kwargs):
        from .models import AuditEvent, DataChangeLog, RecordVersion
        request = get_current_request()
        user = _get_user(request)
        ip = _get_ip(request)
        reason = getattr(instance, "_audit_reason", None) or _get_reason(request)
        source = getattr(instance, "_audit_source", None) or (request.META.get("HTTP_X_AUDIT_SOURCE") if request and hasattr(request, 'META') else None) or "manual"
        ct = ContentType.objects.get_for_model(sender)
        action = getattr(instance, "_audit_action", None) or ("create" if created else "update")

        event = AuditEvent.objects.create(
            user=user,
            action=action,
            source=source,
            content_type=ct,
            object_id=instance.pk,
            object_repr=str(instance)[:300],
            ip_address=ip,
            extra_data=None,
        )

        IGNORED_AUDIT_FIELDS = {"last_synced_from_senaite", "senaite_uid", "updated_at"}
        if not created:
            old = getattr(instance, "_pre_save_old", None)
            if old:
                field_reasons = {}
                if reason and isinstance(reason, str) and reason.strip().startswith("{"):
                    try:
                        import json
                        field_reasons = json.loads(reason)
                    except Exception:
                        pass

                for field in sender._meta.concrete_fields:
                    if field.name in IGNORED_AUDIT_FIELDS or field.attname in IGNORED_AUDIT_FIELDS:
                        continue
                    old_val = _serialize_value(getattr(old, field.attname, None))
                    new_val = _serialize_value(getattr(instance, field.attname, None))
                    if old_val != new_val:
                        f_reason = field_reasons.get(field.name) or field_reasons.get(field.attname) or reason
                        DataChangeLog.objects.create(
                            audit_event=event,
                            field_name=field.name,
                            old_value=old_val,
                            new_value=new_val,
                            reason=f_reason,
                        )

        # Create immutable version snapshot
        last_version = (
            RecordVersion.objects.filter(content_type=ct, object_id=instance.pk)
            .order_by("-version_number")
            .values_list("version_number", flat=True)
            .first()
        ) or 0
        RecordVersion.objects.create(
            content_type=ct,
            object_id=instance.pk,
            version_number=last_version + 1,
            data=_instance_snapshot(instance),
            changed_by=user,
            reason=reason,
        )

    @receiver(post_delete, sender=model, weak=False)
    def on_delete(sender, instance, **kwargs):
        from .models import AuditEvent
        request = get_current_request()
        AuditEvent.objects.create(
            user=_get_user(request),
            action="delete",
            content_type=ContentType.objects.get_for_model(sender),
            object_id=instance.pk,
            object_repr=str(instance)[:300],
            ip_address=_get_ip(request),
        )

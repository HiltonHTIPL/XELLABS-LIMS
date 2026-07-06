from django.db.models import Sum, F, DecimalField, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import StorageLocation, Reagent, Standard, Solvent, Lot, InventoryTransaction, ExpiryAlert
from .serializers import (
    StorageLocationSerializer, ReagentSerializer, StandardSerializer,
    SolventSerializer, LotSerializer, InventoryTransactionSerializer, ExpiryAlertSerializer,
)


class StorageLocationViewSet(viewsets.ModelViewSet):
    queryset = StorageLocation.objects.all()
    serializer_class = StorageLocationSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["location_type", "parent", "is_occupied", "assigned_sample_id"]
    search_fields = ["name"]
    pagination_class = None  # return all locations in one response — client builds the tree

    @action(detail=False, methods=["get"], url_path="chain-of-custody")
    def chain_of_custody(self, request):
        """Full custody trail for a sample — from registration through storage."""
        sample_id = (request.query_params.get("sample_id") or "").strip()
        if not sample_id:
            return Response({"error": "sample_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        from audittrail.models import AuditEvent
        from django.contrib.contenttypes.models import ContentType
        from lims.models import Sample

        # ── 1. Look up the Sample object ──────────────────────────────────────
        try:
            sample = Sample.objects.select_related(
                "sample_type", "client", "received_by", "created_by"
            ).get(sample_id=sample_id)
        except Sample.DoesNotExist:
            sample = None

        # ── 2. Current storage slot ───────────────────────────────────────────
        slot = StorageLocation.objects.filter(
            location_type="box_location", assigned_sample_id=sample_id
        ).select_related("parent__parent__parent__parent").first()

        current_location = None
        if slot:
            path_parts, node = [], slot
            while node:
                path_parts.insert(0, node.name)
                node = node.parent

            box = slot.parent  # immediate parent is the box
            capacity = None
            if box and box.location_type == "box":
                total = (box.rows or 0) * (box.columns or 0)
                occupied = StorageLocation.objects.filter(
                    parent=box, location_type="box_location", is_occupied=True
                ).count()
                capacity = {
                    "total": total,
                    "occupied": occupied,
                    "free": total - occupied,
                }

            current_location = {
                "slot_id": slot.slot_id,
                "slot_name": slot.name,
                "storage_path": " / ".join(path_parts),
                "temperature": box.temperature if box else "",
                "capacity": capacity,
            }

        # ── 3. Build full history ─────────────────────────────────────────────
        events = []
        STATUS_MAP = dict(Sample.STATUS)

        # 3a. Sample model audit events (create / update with field changes)
        if sample:
            sample_ct = ContentType.objects.get_for_model(Sample)
            sample_events = (
                AuditEvent.objects
                .filter(content_type=sample_ct, object_id=sample.pk)
                .prefetch_related("changes")
                .select_related("user")
                .order_by("timestamp")
            )
            for ev in sample_events:
                changes = list(ev.changes.all())
                status_change = next((c for c in changes if c.field_name == "status"), None)

                if ev.action == "create":
                    event_type = "sample_registered"
                    label = "Sample Registered"
                elif status_change:
                    old_lbl = STATUS_MAP.get(status_change.old_value, status_change.old_value or "—")
                    new_lbl = STATUS_MAP.get(status_change.new_value, status_change.new_value or "—")
                    if status_change.new_value == "received":
                        event_type = "sample_received"
                        label = "Sample Received"
                    else:
                        event_type = "status_change"
                        label = f"Status: {old_lbl} → {new_lbl}"
                else:
                    changed_fields = [c.field_name for c in changes]
                    visible_fields = [f for f in changed_fields if f not in
                                      ("updated_at", "last_synced_from_senaite", "senaite_uid", "senaite_ar_id")]
                    if not visible_fields:
                        continue  # skip internal-only updates
                    event_type = "update"
                    label = f"Sample Updated ({', '.join(visible_fields[:3])}{'…' if len(visible_fields) > 3 else ''})"

                events.append({
                    "id": ev.pk,
                    "timestamp": ev.timestamp.isoformat(),
                    "user": ev.user.get_full_name() or ev.user.username if ev.user else "System",
                    "event_type": event_type,
                    "label": label,
                    "details": {
                        "changes": [
                            {"field": c.field_name, "old": c.old_value, "new": c.new_value}
                            for c in changes if c.field_name not in ("updated_at", "senaite_uid", "senaite_ar_id")
                        ],
                    },
                })

        # 3b. Storage assign events
        for ev in AuditEvent.objects.filter(
            action="store", object_repr__icontains=sample_id
        ).select_related("user").order_by("timestamp"):
            extra = ev.extra_data or {}
            events.append({
                "id": ev.pk,
                "timestamp": ev.timestamp.isoformat(),
                "user": ev.user.get_full_name() or ev.user.username if ev.user else "System",
                "event_type": "stored",
                "label": f"Stored — {extra.get('storage_path', 'Storage')}",
                "details": extra,
            })

        # 3c. Storage release events
        for ev in AuditEvent.objects.filter(
            action="update", extra_data__released_sample_id=sample_id
        ).select_related("user").order_by("timestamp"):
            extra = ev.extra_data or {}
            events.append({
                "id": ev.pk,
                "timestamp": ev.timestamp.isoformat(),
                "user": ev.user.get_full_name() or ev.user.username if ev.user else "System",
                "event_type": "released",
                "label": f"Released from Storage — Slot {extra.get('slot_id', '?')}",
                "details": extra,
            })

        # Sort combined history chronologically
        events.sort(key=lambda e: e["timestamp"])

        # ── 4. Sample info snapshot ───────────────────────────────────────────
        sample_data = None
        if sample:
            sample_data = {
                "sample_id": sample.sample_id,
                "status": sample.status,
                "status_display": sample.get_status_display(),
                "sample_type": str(sample.sample_type),
                "client": str(sample.client),
                "barcode": sample.barcode,
                "collection_date": sample.collection_date.isoformat() if sample.collection_date else None,
                "received_date": sample.received_date.isoformat() if sample.received_date else None,
                "expiry_date": sample.expiry_date.isoformat() if sample.expiry_date else None,
                "condition": sample.get_condition_display() if sample.condition else "",
                "seal_condition": sample.get_seal_condition_display() if sample.seal_condition else "",
                "priority": sample.get_priority_display() if sample.priority else "",
                "storage_requirement": sample.get_storage_requirement_display() if sample.storage_requirement else "",
                "sampling_deviation": sample.get_sampling_deviation_display() if sample.sampling_deviation else "",
                "quantity_received": str(sample.quantity_received) if sample.quantity_received else "",
                "quantity_unit": sample.quantity_unit,
                "hold_for_qa": sample.hold_for_qa,
                "received_by": (
                    sample.received_by.get_full_name() or sample.received_by.username
                ) if sample.received_by else "",
                "receipt_notes": sample.receipt_notes,
            }

        return Response({
            "sample_id": sample_id,
            "sample": sample_data,
            "current_location": current_location,
            "history": events,
        })

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        """Assign a sample to a box_location slot."""
        slot = self.get_object()

        allowed_roles = {'admin', 'lab_manager', 'analyst', 'receptionist'}
        if not hasattr(request.user, 'role') or request.user.role not in allowed_roles:
            return Response({"error": "You do not have permission to assign samples to storage."}, status=status.HTTP_403_FORBIDDEN)

        if slot.location_type != 'box_location':
            return Response({"error": "Only box_location slots can be assigned."}, status=status.HTTP_400_BAD_REQUEST)

        sample_id = (request.data.get("sample_id") or "").strip()
        if not sample_id:
            return Response({"error": "sample_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        if slot.is_occupied:
            return Response({"error": f"Slot {slot.slot_id} is already occupied."}, status=status.HTTP_400_BAD_REQUEST)

        # Atomic update — only succeeds if currently free (prevents race condition)
        updated = StorageLocation.objects.filter(id=slot.pk, is_occupied=False).update(
            is_occupied=True, assigned_sample_id=sample_id
        )
        if updated == 0:
            return Response({"error": f"Slot {slot.slot_id} was just occupied by another request."}, status=status.HTTP_409_CONFLICT)

        # Refresh from DB so serializer returns correct state
        slot.refresh_from_db()

        from core.senaite_service import _build_storage_path
        storage_path = _build_storage_path(slot)

        from django.contrib.contenttypes.models import ContentType
        from audittrail.models import AuditEvent
        AuditEvent.objects.create(
            user=request.user,
            action="store",
            content_type=ContentType.objects.get_for_model(slot),
            object_id=slot.pk,
            object_repr=f"Sample {sample_id} -> {storage_path}",
            extra_data={
                "sample_id": sample_id,
                "storage_path": storage_path,
                "slot_id": slot.slot_id,
                "storage_location_id": slot.pk,
                # senaite_uid intentionally excluded — internal field
            },
        )

        return Response(self.get_serializer(slot).data)

    @action(detail=True, methods=["post"], url_path="unassign")
    def unassign(self, request, pk=None):
        """Release a box_location slot — marks it as free."""
        slot = self.get_object()

        allowed_roles = {'admin', 'lab_manager', 'analyst', 'receptionist'}
        if not hasattr(request.user, 'role') or request.user.role not in allowed_roles:
            return Response({"error": "You do not have permission to unassign slots."}, status=status.HTTP_403_FORBIDDEN)

        if slot.location_type != 'box_location':
            return Response({"error": "Only box_location slots can be unassigned."}, status=status.HTTP_400_BAD_REQUEST)

        if not slot.is_occupied:
            return Response({"error": "Slot is already free."}, status=status.HTTP_400_BAD_REQUEST)

        released_sample_id = slot.assigned_sample_id  # capture before clearing

        updated = StorageLocation.objects.filter(id=slot.pk, is_occupied=True).update(
            is_occupied=False, assigned_sample_id=''
        )
        if updated == 0:
            return Response({"error": "Slot was already freed by another request."}, status=status.HTTP_409_CONFLICT)

        slot.refresh_from_db()

        from django.contrib.contenttypes.models import ContentType
        from audittrail.models import AuditEvent
        AuditEvent.objects.create(
            user=request.user,
            action="update",
            content_type=ContentType.objects.get_for_model(slot),
            object_id=slot.pk,
            object_repr=f"Slot {slot.slot_id} unassigned — {slot.name}",
            extra_data={
                "slot_id": slot.slot_id,
                "storage_location_id": slot.pk,
                "released_sample_id": released_sample_id,
            },
        )

        return Response(self.get_serializer(slot).data)

    @action(detail=True, methods=["post"], url_path="regenerate-slots")
    def regenerate_slots(self, request, pk=None):
        """Create any missing box_location slots for a box (idempotent)."""
        box = self.get_object()
        if box.location_type != 'box':
            return Response({"error": "Only boxes can have slots regenerated."}, status=status.HTTP_400_BAD_REQUEST)

        rows = box.rows or 0
        cols = box.columns or 0
        if rows < 1 or cols < 1:
            return Response({"error": "Box has no rows/columns defined."}, status=status.HTTP_400_BAD_REQUEST)

        existing_ids = set(
            StorageLocation.objects.filter(parent=box, location_type='box_location')
            .values_list('slot_id', flat=True)
        )
        to_create = []
        for r in range(rows):
            row_letter = chr(65 + r)
            for c in range(1, cols + 1):
                slot_id = f"{row_letter}{c}"
                if slot_id not in existing_ids:
                    to_create.append(StorageLocation(
                        name=f"{box.name} — {slot_id}",
                        location_type='box_location',
                        parent=box,
                        slot_id=slot_id,
                        is_occupied=False,
                    ))
        if to_create:
            StorageLocation.objects.bulk_create(to_create)

        return Response({"created": len(to_create), "total": rows * cols})

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        # Prevent deleting a location that has occupied slots
        occupied_count = StorageLocation.objects.filter(
            parent=instance, location_type='box_location', is_occupied=True
        ).count()
        if occupied_count > 0:
            return Response(
                {"error": f"Cannot delete: {occupied_count} occupied slot(s) exist. Unassign all samples first."},
                status=status.HTTP_409_CONFLICT,
            )

        # Cascade-delete box_location children before deleting the box
        if instance.location_type == 'box':
            StorageLocation.objects.filter(parent=instance, location_type='box_location').delete()

        return super().destroy(request, *args, **kwargs)


class ReagentViewSet(viewsets.ModelViewSet):
    queryset = Reagent.objects.all()
    serializer_class = ReagentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["is_active"]
    search_fields = ["name", "catalog_number", "cas_number"]


class StandardViewSet(viewsets.ModelViewSet):
    queryset = Standard.objects.all()
    serializer_class = StandardSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["is_active"]
    search_fields = ["name", "catalog_number"]


class SolventViewSet(viewsets.ModelViewSet):
    queryset = Solvent.objects.all()
    serializer_class = SolventSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["is_active"]
    search_fields = ["name", "catalog_number"]


class LotViewSet(viewsets.ModelViewSet):
    queryset = Lot.objects.select_related("storage_location", "created_by").all()
    serializer_class = LotSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["storage_location", "content_type"]
    ordering_fields = ["received_date", "expiry_date"]

    @action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request):
        """Return lots whose current quantity is below their item's min_stock_level."""
        from django.contrib.contenttypes.models import ContentType
        from decimal import Decimal
        from collections import defaultdict

        results = []
        for ct in ContentType.objects.filter(app_label="inventory", model__in=["reagent", "standard", "solvent"]):
            model_cls = ct.model_class()
            if model_cls is None:
                continue
            items = list(model_cls.objects.filter(is_active=True))
            if not items:
                continue

            # One query for all lots of this item type, one query for all their
            # transactions — instead of 2 queries per item.
            lot_to_object = dict(
                Lot.objects.filter(content_type=ct, object_id__in=[i.pk for i in items])
                .values_list("pk", "object_id")
            )
            net_by_object = defaultdict(Decimal)
            if lot_to_object:
                txns = (
                    InventoryTransaction.objects
                    .filter(lot_id__in=lot_to_object.keys())
                    .values("lot_id", "transaction_type")
                    .annotate(total=Coalesce(Sum("quantity"), Decimal("0")))
                )
                for row in txns:
                    object_id = lot_to_object[row["lot_id"]]
                    sign = 1 if row["transaction_type"] == "in" else (-1 if row["transaction_type"] in ("out", "dispose") else 0)
                    net_by_object[object_id] += sign * row["total"]

            for item in items:
                current = net_by_object.get(item.pk, Decimal("0"))
                if current < item.min_stock_level:
                    results.append({
                        "item_type": ct.model,
                        "item_id": item.pk,
                        "name": item.name,
                        "current_quantity": float(current),
                        "min_stock_level": float(item.min_stock_level),
                        "unit": item.unit,
                    })
        return Response(results)


class InventoryTransactionViewSet(viewsets.ModelViewSet):
    queryset = InventoryTransaction.objects.select_related("lot", "created_by").all()
    serializer_class = InventoryTransactionSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["transaction_type", "lot"]
    ordering_fields = ["created_at"]

    def perform_create(self, serializer):
        from django.contrib.contenttypes.models import ContentType
        from audittrail.models import AuditEvent
        txn = serializer.save()
        AuditEvent.objects.create(
            user=self.request.user,
            action="create",
            content_type=ContentType.objects.get_for_model(txn),
            object_id=txn.pk,
            object_repr=str(txn),
            extra_data={"transaction_type": txn.transaction_type, "quantity": float(txn.quantity), "lot_id": txn.lot_id},
        )


class ExpiryAlertViewSet(viewsets.ModelViewSet):
    queryset = ExpiryAlert.objects.select_related("lot", "acknowledged_by").all()
    serializer_class = ExpiryAlertSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["is_acknowledged"]

    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        alert = self.get_object()
        if alert.is_acknowledged:
            return Response({"detail": "Already acknowledged."}, status=status.HTTP_400_BAD_REQUEST)
        alert.is_acknowledged = True
        alert.acknowledged_by = request.user
        alert.save(update_fields=["is_acknowledged", "acknowledged_by"])

        from django.contrib.contenttypes.models import ContentType
        from audittrail.models import AuditEvent
        AuditEvent.objects.create(
            user=request.user,
            action="update",
            content_type=ContentType.objects.get_for_model(alert),
            object_id=alert.pk,
            object_repr=str(alert),
            extra_data={"acknowledged": True},
        )
        return Response(ExpiryAlertSerializer(alert).data)

    @action(detail=False, methods=["get"], url_path="upcoming")
    def upcoming(self, request):
        """Return unacknowledged alerts for lots expiring within 30 days."""
        cutoff = timezone.now().date() + timezone.timedelta(days=30)
        qs = self.get_queryset().filter(is_acknowledged=False, alert_date__lte=cutoff)
        return Response(ExpiryAlertSerializer(qs, many=True).data)

"""
Pure business logic for the LIMS workflow.
No HTTP concerns here — called from views and serializers.
"""
import re
from django.db import transaction
from django.utils import timezone

# NOTE: Sample, Result, AnalysisRequest, and Worksheet already get automatic
# AuditEvent + field-level DataChangeLog + RecordVersion logging on every
# save()/delete() via the generic post_save/post_delete signals wired in
# audittrail/apps.py (see audittrail/signals.py: wire_signals). Do not add
# manual audit calls here for those models — it just duplicates that trail.


# ── ID generation ────────────────────────────────────────────────────────────

def _next_seq(model, field, prefix):
    from django.db.models import Max
    last = (
        model.objects
        .filter(**{f"{field}__startswith": prefix})
        .aggregate(m=Max(field))["m"]
    )
    if not last:
        return 1
    m = re.search(r"(\d+)$", last)
    return (int(m.group(1)) + 1) if m else 1


def generate_sample_id(sample_type):
    from .models import Sample
    prefix = (sample_type.prefix or "SMP").upper()
    date = timezone.now().strftime("%Y%m%d")
    base = f"{prefix}-{date}-"
    return f"{base}{_next_seq(Sample, 'sample_id', base):04d}"


def generate_ar_id():
    from .models import AnalysisRequest
    date = timezone.now().strftime("%Y%m%d")
    base = f"AR-{date}-"
    return f"{base}{_next_seq(AnalysisRequest, 'ar_id', base):04d}"


def generate_ws_id():
    from .models import Worksheet
    date = timezone.now().strftime("%Y%m%d")
    base = f"WS-{date}-"
    return f"{base}{_next_seq(Worksheet, 'ws_id', base):04d}"


def generate_qc_id():
    from .models import QCSample
    date = timezone.now().strftime("%Y%m%d")
    base = f"QC-{date}-"
    return f"{base}{_next_seq(QCSample, 'qc_id', base):04d}"


# ── Spec / range check ────────────────────────────────────────────────────────

def check_result_against_spec(result):
    """Return True if result value is out of range vs its Specification."""
    from .models import Specification
    try:
        value = float(result.value)
    except (ValueError, TypeError):
        return False  # non-numeric — cannot range-check

    wa = result.worksheet_assignment
    spec = Specification.objects.filter(
        test=wa.test,
        sample_type=wa.analysis_request.sample.sample_type,
        is_active=True,
    ).first()

    if not spec:
        return False

    out = False
    if spec.min_value is not None:
        out = out or (
            value < float(spec.min_value) if spec.min_operator == ">="
            else value <= float(spec.min_value)
        )
    if spec.max_value is not None:
        out = out or (
            value > float(spec.max_value) if spec.max_operator == "<="
            else value >= float(spec.max_value)
        )
    return out


# ── Sample workflow ───────────────────────────────────────────────────────────

@transaction.atomic
def receive_sample(sample, user, location="", notes="", **receipt_fields):
    """Transition sample registered → received, save intake fields, record chain of custody."""
    from .models import ChainOfCustody
    if sample.status not in ("registered",):
        raise ValueError(f"Cannot receive a sample with status '{sample.status}'.")

    sample.status = "received"
    sample.received_date = timezone.now()
    sample.received_by = user
    if location:
        sample.storage_location = location
    if notes:
        sample.receipt_notes = notes

    intake_fields = [
        "condition", "seal_condition", "seal_number",
        "quantity_received", "quantity_unit", "sampling_deviation",
        "storage_requirement", "priority", "hold_for_qa", "collector",
    ]
    update_fields = ["status", "received_date", "received_by_id", "storage_location", "receipt_notes", "updated_at"]
    for field in intake_fields:
        if field in receipt_fields and receipt_fields[field] not in (None, ""):
            setattr(sample, field, receipt_fields[field])
            update_fields.append(field)

    sample.save(update_fields=list(set(update_fields)))

    ChainOfCustody.objects.create(
        sample=sample,
        action="received",
        to_location=location,
        transferred_by=user,
        notes=notes,
    )
    return sample


# Disposal-eligible statuses mirror lab dispatch exit-transitions:
# received / to_be_verified / verified / published (Django names below).
DISPOSAL_ELIGIBLE_STATUSES = frozenset({
    "received",
    "results_pending",   # to_be_verified
    "reviewed",          # verified
    "published",
})


@transaction.atomic
def dispose_sample(sample, user, basis, notes="", certificate=None):
    """
    Transition sample → disposed with required regulatory basis.
    Stamps description, optional certificate attachment, ChainOfCustody row.
    AuditEvent/DataChangeLog fire automatically via audittrail post_save.
    """
    from .models import ChainOfCustody

    basis = (basis or "").strip()
    if not basis:
        raise ValueError("Regulatory basis is required (e.g. 40 CFR / state disposal rule).")

    if sample.status not in DISPOSAL_ELIGIBLE_STATUSES:
        raise ValueError(
            f"Cannot dispose a sample with status '{sample.status}'. "
            "Dispose is allowed from received, to be verified, reviewed, or published."
        )

    extra_notes = (notes or "").strip()
    stamp = f"[Disposed] {basis}"
    if extra_notes:
        stamp = f"{stamp} — {extra_notes}"

    sample.description = (
        f"{sample.description}\n{stamp}".strip() if sample.description else stamp
    )
    update_fields = ["status", "description", "updated_at"]
    if certificate is not None:
        if sample.attachment:
            sample.attachment.delete(save=False)
        sample.attachment = certificate
        update_fields.append("attachment")

    sample.status = "disposed"
    sample.save(update_fields=update_fields)

    ChainOfCustody.objects.create(
        sample=sample,
        action="disposed",
        from_location=sample.storage_location or "",
        to_location="Disposed",
        transferred_by=user,
        notes=stamp,
    )
    return sample


# ── Result workflow ───────────────────────────────────────────────────────────

@transaction.atomic
def submit_result(result, user):
    """Analyst submits a result value — checks spec and marks submitted."""
    if result.status != "pending":
        raise ValueError(f"Result is already '{result.status}', cannot submit.")
    if not result.value:
        raise ValueError("Result value cannot be empty.")

    result.is_out_of_range = check_result_against_spec(result)
    result.status = "submitted"
    result.submitted_by = user
    result.submitted_at = timezone.now()
    result.save(update_fields=[
        "status", "submitted_by", "submitted_at", "is_out_of_range"
    ])
    return result


@transaction.atomic
def verify_result(result, user):
    """Reviewer verifies a submitted result — auto-locks it."""
    if result.status != "submitted":
        raise ValueError(f"Result must be 'submitted' to verify (current: '{result.status}').")

    result.status = "verified"
    result.verified_by = user
    result.verified_at = timezone.now()
    result.is_locked = True
    result.save(update_fields=[
        "status", "verified_by", "verified_at", "is_locked"
    ])
    return result


@transaction.atomic
def reject_result(result, user, remarks=""):
    """Reviewer rejects a submitted result — sends it back to pending."""
    if result.status not in ("submitted",):
        raise ValueError(f"Only submitted results can be rejected (current: '{result.status}').")

    result.status = "rejected"
    result.remarks = remarks or result.remarks
    result.save(update_fields=["status", "remarks"])
    return result


# ── Worksheet workflow ────────────────────────────────────────────────────────

@transaction.atomic
def submit_worksheet_for_review(worksheet, user):
    if worksheet.status not in ("open", "in_progress"):
        raise ValueError(f"Worksheet status '{worksheet.status}' cannot be submitted for review.")
    worksheet.status = "to_be_verified"
    worksheet.save(update_fields=["status", "updated_at"])
    return worksheet


@transaction.atomic
def verify_worksheet(worksheet, user):
    if worksheet.status != "to_be_verified":
        raise ValueError("Worksheet must be in 'to_be_verified' status.")
    worksheet.status = "verified"
    worksheet.save(update_fields=["status", "updated_at"])
    return worksheet


@transaction.atomic
def reject_worksheet(worksheet, user):
    if worksheet.status not in ("to_be_verified",):
        raise ValueError("Only worksheets pending review can be rejected.")
    worksheet.status = "rejected"
    worksheet.save(update_fields=["status", "updated_at"])
    return worksheet


# ── Analysis Request workflow ─────────────────────────────────────────────────

@transaction.atomic
def complete_analysis_request(ar):
    """Mark an AR complete when all its results are verified."""
    from .models import Result, WorksheetAssignment
    assignments = WorksheetAssignment.objects.filter(analysis_request=ar)
    total = assignments.count()
    if total == 0:
        return ar
    verified = Result.objects.filter(
        worksheet_assignment__in=assignments, status="verified"
    ).count()
    if verified == total:
        ar.status = "completed"
        ar.save(update_fields=["status", "updated_at"])
    return ar


# ── Sample dispose → lab system dispatch (OPTIONAL — not wired; see tc9 plan §6) ─

def schedule_lab_dispatch_after_dispose(sample, regulatory_basis: str, schema_name: str) -> str:
    """
    After Django dispose: resolve/link senaite_uid, set sync status, enqueue Celery dispatch.
    Returns senaite_sync_status for the API response.
    """
    from django.db import transaction

    from core.senaite_service import resolve_analysis_request_uid_by_client_sample_id
    from lims.tasks import dispatch_sample_to_lab

    uid = (sample.senaite_uid or "").strip()
    update_fields = ["senaite_sync_status", "senaite_sync_error"]

    if not uid:
        resolved = resolve_analysis_request_uid_by_client_sample_id(sample.sample_id)
        if resolved:
            uid = resolved
            sample.senaite_uid = uid
            update_fields.append("senaite_uid")

    if not uid:
        sample.senaite_sync_status = "not_linked"
        sample.senaite_sync_error = ""
        sample.save(update_fields=update_fields)
        return "not_linked"

    sample.senaite_sync_status = "pending"
    sample.senaite_sync_error = ""
    sample.save(update_fields=update_fields)

    sample_pk = sample.pk
    transaction.on_commit(
        lambda: dispatch_sample_to_lab.apply_async(
            args=[schema_name, sample_pk, regulatory_basis],
            countdown=1,
        )
    )
    return "pending"

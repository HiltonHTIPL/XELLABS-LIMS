"""
Pure business logic for the LIMS workflow.
No HTTP concerns here — called from views and serializers.
"""
import logging
import re
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

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
        # Non-numeric values should be rejected, not silently accepted
        raise ValueError(
            f"Result value '{result.value}' is not numeric. "
            "Only numeric values can be checked against specifications."
        )

    wa = result.worksheet_assignment
    sample = wa.analysis_request.sample

    # Honor the specific Analysis Specification chosen at sample registration
    # first — two specs can share a sample_type but carry different limits
    # (e.g. "Drinking Water" vs "Irrigation Water"), so guessing by sample_type
    # alone can silently check a result against the wrong thresholds. Only fall
    # back to a sample_type-wide guess when no specification was selected.
    spec = None
    if sample.analysis_specification_id:
        spec = Specification.objects.filter(
            senaite_service_uid=wa.senaite_service_uid,
            specification_id=sample.analysis_specification_id,
            specification__is_active=True,
            is_active=True,
        ).first()
    if not spec:
        spec = Specification.objects.filter(
            senaite_service_uid=wa.senaite_service_uid,
            specification__sample_type=sample.sample_type,
            specification__is_active=True,
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

    # Drive SENAITE's native `receive` so the sample's analyses become
    # assignable to Worksheets (SENAITE cascades registered -> unassigned on
    # receive; without this they stay `registered` forever and no Worksheet can
    # ever pull them). Best-effort: a lab-system hiccup must not roll back the
    # Django receipt — matches the forward-only sync philosophy used elsewhere.
    if sample.senaite_uid:
        try:
            from core.senaite_service import receive_analysis_request
            result = receive_analysis_request(sample.senaite_uid)
            if not result.get("ok"):
                logger.warning(
                    "SENAITE receive not completed for sample %s: %s",
                    sample.pk, result.get("error"),
                )
        except Exception as exc:  # noqa: BLE001 - never block Django receipt
            logger.warning("SENAITE receive call errored for sample %s: %s", sample.pk, exc)

    return sample


# A registered sample has not entered physical custody; rejected and already
# disposed samples are terminal. All other retained samples may be disposed
# once their retention date has passed.
DISPOSAL_ELIGIBLE_STATUSES = frozenset({
    "received",
    "in_progress",
    "results_pending",
    "reviewed",
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

    if not sample.expiry_date or sample.expiry_date >= timezone.now():
        raise ValueError("Sample cannot be disposed before its retention date has passed.")

    if sample.status not in DISPOSAL_ELIGIBLE_STATUSES:
        raise ValueError(
            f"Cannot dispose a sample with status '{sample.status}'. "
            "Only retained samples in an active or completed laboratory state can be disposed."
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
    """Analyst submits a result value — checks spec and marks submitted.
    Rejected results may be corrected and re-submitted."""
    if result.status not in ("pending", "rejected"):
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
    _refresh_samples_for_result(result)
    return result


@transaction.atomic
def verify_result(result, user):
    """Reviewer verifies a submitted result — auto-locks it and completes the
    parent AnalysisRequest if this was its last unverified result."""
    if result.status != "submitted":
        raise ValueError(f"Result must be 'submitted' to verify (current: '{result.status}').")

    result.status = "verified"
    result.verified_by = user
    result.verified_at = timezone.now()
    result.is_locked = True
    result.save(update_fields=[
        "status", "verified_by", "verified_at", "is_locked"
    ])
    complete_analysis_request(result.worksheet_assignment.analysis_request)
    _refresh_samples_for_result(result)
    return result


@transaction.atomic
def reject_result(result, user, remarks=""):
    """Reviewer rejects a submitted result — marks it 'rejected'. The analyst
    can then correct the value and re-submit (submit_result accepts rejected)."""
    if result.status not in ("submitted",):
        raise ValueError(f"Only submitted results can be rejected (current: '{result.status}').")

    result.status = "rejected"
    if remarks:
        result.remarks = f"Rejected by {user.username}: {remarks}"
    result.save(update_fields=["status", "remarks"])
    _refresh_samples_for_result(result)
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
    """Reviewer rejects a worksheet pending review — mirrors SENAITE's rejection
    flow: unfinished (non-verified) analyses are carried forward onto a fresh
    worksheet for the analyst to redo, while already-verified analyses stay on
    the original worksheet, which is marked 'rejected' for the audit trail."""
    from .models import Worksheet, Result

    if worksheet.status not in ("to_be_verified",):
        raise ValueError("Only worksheets pending review can be rejected.")

    unfinished = worksheet.assignments.exclude(result__status="verified")
    new_worksheet = None
    if unfinished.exists():
        new_worksheet = Worksheet.objects.create(
            ws_id=generate_ws_id(),
            analyst=worksheet.analyst,
            instrument=worksheet.instrument,
            method=worksheet.method,
            status="open",
        )
        unfinished_ids = list(unfinished.values_list("id", flat=True))
        WorksheetAssignmentModel = worksheet.assignments.model
        WorksheetAssignmentModel.objects.filter(id__in=unfinished_ids).update(worksheet=new_worksheet)
        Result.objects.filter(worksheet_assignment_id__in=unfinished_ids).exclude(status="verified").update(
            status="pending", is_out_of_range=False,
            submitted_by=None, submitted_at=None,
        )

    worksheet.status = "rejected"
    worksheet.save(update_fields=["status", "updated_at"])
    return worksheet, new_worksheet


# ── Sample workflow status derivation ────────────────────────────────────────

@transaction.atomic
def refresh_sample_workflow_status(sample):
    """Derive the sample's status from its lab-worksheet progress.

    Lab worksheets are Django-owned (assignment/results/verification never touch
    the SENAITE mirror), so the sample status for these stages must be derived
    here: any assignment -> in_progress; all results submitted -> results_pending;
    all results verified -> reviewed. Only moves the status forward from
    'received' onward — registration/receipt and terminal states are untouched.
    """
    from .models import Result, WorksheetAssignment

    if sample.status not in ("received", "in_progress", "results_pending", "reviewed"):
        return sample

    assignments = WorksheetAssignment.objects.filter(analysis_request__sample=sample)
    total = assignments.count()
    if total == 0:
        return sample

    results = Result.objects.filter(worksheet_assignment__in=assignments)
    verified = results.filter(status="verified").count()
    submitted_or_verified = results.filter(status__in=("submitted", "verified")).count()

    if verified == total:
        new_status = "reviewed"
    elif submitted_or_verified == total:
        new_status = "results_pending"
    else:
        new_status = "in_progress"

    if new_status != sample.status:
        sample.status = new_status
        # instance.save() (not queryset.update) so audit signals fire
        sample.save(update_fields=["status", "updated_at"])
    return sample


def _refresh_samples_for_result(result):
    samples = set()
    ar = result.worksheet_assignment.analysis_request
    if ar and ar.sample_id:
        samples.add(ar.sample)
    for s in samples:
        refresh_sample_workflow_status(s)


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

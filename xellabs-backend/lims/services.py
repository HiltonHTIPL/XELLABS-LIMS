"""
Pure business logic for the LIMS workflow.
No HTTP concerns here — called from views and serializers.
"""
import re
from django.db import transaction
from django.utils import timezone


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
def receive_sample(sample, user, location="", notes=""):
    """Transition sample registered → received and record chain of custody."""
    from .models import ChainOfCustody
    if sample.status not in ("registered",):
        raise ValueError(f"Cannot receive a sample with status '{sample.status}'.")

    sample.status = "received"
    sample.received_date = timezone.now()
    if location:
        sample.storage_location = location
    sample.save(update_fields=["status", "received_date", "storage_location", "updated_at"])

    ChainOfCustody.objects.create(
        sample=sample,
        action="received",
        to_location=location,
        transferred_by=user,
        notes=notes,
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

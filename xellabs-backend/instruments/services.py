"""
Pure business logic for instrument workflow.
No HTTP concerns — called from views. Mirrors lims/services.py style.
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

# Instrument, Calibration, Certification, Validation auto-audit via
# audittrail post_save wiring — do not add manual audit calls here.


def compute_usability(instrument) -> str:
    """
    Derive usability from workflow status + latest calibration/cert/validation.
    Returns: valid | expired | out_of_service
    """
    today = timezone.now().date()
    status = instrument.status

    if status in ("out_of_service", "retired", "inactive"):
        return "out_of_service"
    if status == "under_maintenance":
        return "out_of_service"

    if instrument.dispose_until_next_calibration:
        return "expired"

    # Active validation downtime window
    for v in instrument.validations.all()[:5]:
        if v.down_from and today >= v.down_from and (not v.down_to or today <= v.down_to):
            return "out_of_service"

    # Latest calibration overdue or failed
    latest_cal = instrument.calibrations.order_by("-calibration_date").first()
    if latest_cal:
        if latest_cal.status == "failed":
            return "expired"
        due = latest_cal.next_due or instrument.next_calibration
        if due and due < today:
            return "expired"

    if instrument.next_calibration and instrument.next_calibration < today:
        return "expired"

    # Latest certification validity
    latest_cert = instrument.certifications.order_by("-valid_from").first()
    if latest_cert and latest_cert.valid_from:
        if not latest_cert.is_valid:
            return "expired"

    return "valid"


@transaction.atomic
def refresh_usability(instrument) -> str:
    """Recompute and persist usability. Returns the new value."""
    value = compute_usability(instrument)
    if instrument.usability != value:
        instrument.usability = value
        instrument.save(update_fields=["usability"])
    return value


def _set_status(instrument, new_status: str, *, allowed_from: set[str], action: str):
    if instrument.status not in allowed_from:
        raise ValueError(
            f"Cannot {action} an instrument with status '{instrument.status}'."
        )
    instrument.status = new_status
    instrument.save(update_fields=["status"])
    refresh_usability(instrument)
    return instrument


@transaction.atomic
def activate(instrument):
    """inactive | under_maintenance | out_of_service → active."""
    return _set_status(
        instrument,
        "active",
        allowed_from={"inactive", "under_maintenance", "out_of_service"},
        action="activate",
    )


@transaction.atomic
def deactivate(instrument):
    """active → inactive."""
    return _set_status(
        instrument,
        "inactive",
        allowed_from={"active"},
        action="deactivate",
    )


@transaction.atomic
def set_under_maintenance(instrument):
    """active → under_maintenance."""
    return _set_status(
        instrument,
        "under_maintenance",
        allowed_from={"active"},
        action="set under maintenance",
    )


@transaction.atomic
def set_out_of_service(instrument):
    """active | under_maintenance → out_of_service."""
    return _set_status(
        instrument,
        "out_of_service",
        allowed_from={"active", "under_maintenance"},
        action="set out of service",
    )


@transaction.atomic
def return_to_service(instrument):
    """under_maintenance | out_of_service → active."""
    return _set_status(
        instrument,
        "active",
        allowed_from={"under_maintenance", "out_of_service"},
        action="return to service",
    )


@transaction.atomic
def retire(instrument):
    """Any non-retired → retired."""
    return _set_status(
        instrument,
        "retired",
        allowed_from={"active", "inactive", "under_maintenance", "out_of_service"},
        action="retire",
    )

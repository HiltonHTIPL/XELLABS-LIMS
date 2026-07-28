"""
Instrument usability cascade signals.

Whenever a calibration / certification / validation is saved or deleted,
recompute Instrument.usability so list/detail/picker all read one field.
"""
from django.db.models.signals import post_delete, post_save

from .models import Calibration, Certification, Validation
from .services import refresh_usability


def _refresh_from_child(instance, **kwargs):
    instrument = getattr(instance, "instrument", None)
    if instrument is not None:
        refresh_usability(instrument)


def connect_usability_signals():
    for model in (Calibration, Certification, Validation):
        post_save.connect(_refresh_from_child, sender=model, dispatch_uid=f"inst_usability_save_{model.__name__}")
        post_delete.connect(_refresh_from_child, sender=model, dispatch_uid=f"inst_usability_del_{model.__name__}")

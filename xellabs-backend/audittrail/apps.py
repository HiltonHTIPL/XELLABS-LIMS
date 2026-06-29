from django.apps import AppConfig


class AudittrailConfig(AppConfig):
    name = "audittrail"

    def ready(self):
        from .signals import wire_signals
        from lims.models import Sample, Result, AnalysisRequest, Worksheet
        from instruments.models import Instrument, Calibration

        for model in (Sample, Result, AnalysisRequest, Worksheet, Instrument, Calibration):
            wire_signals(model)

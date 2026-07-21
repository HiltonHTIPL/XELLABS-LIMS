from django.apps import AppConfig


class AudittrailConfig(AppConfig):
    name = "audittrail"

    def ready(self):
        from .signals import wire_signals
        from lims.models import Sample, Result, AnalysisRequest, Worksheet, SampleTemplate, AnalysisProfile, SampleType, Method, AnalysisSpecification, Specification, DynamicAnalysisSpecification
        from instruments.models import (
            Instrument, Calibration, Certification, Validation,
            InstrumentType, InstrumentLocation, ScheduledTask, InstrumentResultImport,
            InstrumentManufacturer, InstrumentSupplier,
        )

        for model in (
            Sample, Result, AnalysisRequest, Worksheet, SampleTemplate, AnalysisProfile,
            SampleType, Method, AnalysisSpecification, Specification, DynamicAnalysisSpecification,
            Instrument, Calibration, Certification, Validation,
            InstrumentType, InstrumentLocation, ScheduledTask, InstrumentResultImport,
            InstrumentManufacturer, InstrumentSupplier,
        ):
            wire_signals(model)

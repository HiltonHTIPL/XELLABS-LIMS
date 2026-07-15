from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    InstrumentViewSet, InstrumentMethodViewSet, CalibrationViewSet,
    MaintenanceViewSet, InstrumentRunViewSet, InstrumentResultImportViewSet,
    SampleInstrumentReportView,
    InstrumentTypeViewSet, InstrumentLocationViewSet, CertificationViewSet,
    ScheduledTaskViewSet, ValidationViewSet,
)

router = DefaultRouter()
router.register("instruments", InstrumentViewSet)
router.register("instrument-methods", InstrumentMethodViewSet)
router.register("calibrations", CalibrationViewSet)
router.register("maintenances", MaintenanceViewSet)
router.register("runs", InstrumentRunViewSet)
router.register("result-imports", InstrumentResultImportViewSet)
router.register("instrument-types", InstrumentTypeViewSet)
router.register("instrument-locations", InstrumentLocationViewSet)
router.register("certifications", CertificationViewSet)
router.register("scheduled-tasks", ScheduledTaskViewSet)
router.register("validations", ValidationViewSet)

urlpatterns = [
    path("sample-report/", SampleInstrumentReportView.as_view(), name="instrument-sample-report"),
] + router.urls

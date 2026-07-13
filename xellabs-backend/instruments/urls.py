from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    InstrumentViewSet, InstrumentMethodViewSet, CalibrationViewSet,
    MaintenanceViewSet, InstrumentRunViewSet, InstrumentResultImportViewSet,
    SampleInstrumentReportView,
)

router = DefaultRouter()
router.register("instruments", InstrumentViewSet)
router.register("instrument-methods", InstrumentMethodViewSet)
router.register("calibrations", CalibrationViewSet)
router.register("maintenances", MaintenanceViewSet)
router.register("runs", InstrumentRunViewSet)
router.register("result-imports", InstrumentResultImportViewSet)

urlpatterns = [
    path("sample-report/", SampleInstrumentReportView.as_view(), name="instrument-sample-report"),
] + router.urls

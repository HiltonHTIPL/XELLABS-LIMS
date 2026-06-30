from rest_framework.routers import DefaultRouter
from .views import (
    InstrumentViewSet, InstrumentMethodViewSet, CalibrationViewSet,
    MaintenanceViewSet, InstrumentRunViewSet, InstrumentResultImportViewSet,
)

router = DefaultRouter()
router.register("instruments", InstrumentViewSet)
router.register("instrument-methods", InstrumentMethodViewSet)
router.register("calibrations", CalibrationViewSet)
router.register("maintenances", MaintenanceViewSet)
router.register("runs", InstrumentRunViewSet)
router.register("result-imports", InstrumentResultImportViewSet)

urlpatterns = router.urls

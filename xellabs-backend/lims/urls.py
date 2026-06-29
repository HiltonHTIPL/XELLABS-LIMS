from rest_framework.routers import DefaultRouter
from .views import (
    SampleTypeViewSet, MethodViewSet, TestViewSet, SpecificationViewSet,
    SampleViewSet, AnalysisRequestViewSet, WorksheetViewSet,
    WorksheetAssignmentViewSet, ResultViewSet, QCSampleViewSet,
    ChainOfCustodyViewSet,
)

router = DefaultRouter()
router.register("sample-types", SampleTypeViewSet)
router.register("methods", MethodViewSet)
router.register("tests", TestViewSet)
router.register("specifications", SpecificationViewSet)
router.register("samples", SampleViewSet)
router.register("analysis-requests", AnalysisRequestViewSet)
router.register("worksheets", WorksheetViewSet)
router.register("worksheet-assignments", WorksheetAssignmentViewSet)
router.register("results", ResultViewSet)
router.register("qc-samples", QCSampleViewSet)
router.register("chain-of-custody", ChainOfCustodyViewSet)

urlpatterns = router.urls

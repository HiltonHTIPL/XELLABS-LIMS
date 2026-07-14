from rest_framework.routers import DefaultRouter
from .views import (
    SampleTypeViewSet, SampleTemplateViewSet, AnalysisProfileViewSet, MethodViewSet, CalculationViewSet, TestViewSet, SpecificationViewSet,
    SampleViewSet, AnalysisRequestViewSet, WorksheetViewSet,
    WorksheetAssignmentViewSet, ResultViewSet, QCSampleViewSet,
    ChainOfCustodyViewSet,
)

router = DefaultRouter()
router.register("sample-types", SampleTypeViewSet)
router.register("sample-templates", SampleTemplateViewSet)
router.register("analysis-profiles", AnalysisProfileViewSet)
router.register("methods", MethodViewSet)
router.register("calculations", CalculationViewSet)
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

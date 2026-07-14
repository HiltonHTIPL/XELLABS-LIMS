from rest_framework.routers import DefaultRouter
from .views import (
    SampleTypeViewSet, SampleTemplateViewSet, AnalysisProfileViewSet, MethodViewSet, CalculationViewSet, TestViewSet, SpecificationViewSet,
    DynamicAnalysisSpecificationViewSet, AnalysisSpecificationViewSet,
    SampleViewSet, AnalysisRequestViewSet, WorksheetViewSet,
    WorksheetAssignmentViewSet, ResultViewSet, QCSampleViewSet,
    ChainOfCustodyViewSet,
)

router = DefaultRouter()
router.register("dynamic-analysis-specifications", DynamicAnalysisSpecificationViewSet)
router.register("analysis-specifications", AnalysisSpecificationViewSet)
router.register("sample-types", SampleTypeViewSet)
router.register("sample-templates", SampleTemplateViewSet)
router.register("analysis-profiles", AnalysisProfileViewSet)
router.register("methods", MethodViewSet)
router.register("calculations", CalculationViewSet)
router.register("tests", TestViewSet)
# specification-rows: read-only-in-practice per-test rows, primarily for
# internal consumers (services.py check_result_against_spec) — the frontend
# creates/edits rows exclusively through analysis-specifications' nested
# `rows` payload (one grid, one Save), not this endpoint directly.
router.register("specification-rows", SpecificationViewSet)
router.register("samples", SampleViewSet)
router.register("analysis-requests", AnalysisRequestViewSet)
router.register("worksheets", WorksheetViewSet)
router.register("worksheet-assignments", WorksheetAssignmentViewSet)
router.register("results", ResultViewSet)
router.register("qc-samples", QCSampleViewSet)
router.register("chain-of-custody", ChainOfCustodyViewSet)

urlpatterns = router.urls

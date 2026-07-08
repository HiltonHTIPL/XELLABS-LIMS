from rest_framework.routers import DefaultRouter
from .views import ReportViewSet, ReportTemplateViewSet

router = DefaultRouter()
router.register(r"templates", ReportTemplateViewSet, basename="report-template")
router.register(r"", ReportViewSet, basename="report")

urlpatterns = router.urls

from rest_framework.routers import DefaultRouter
from .views import AuditEventViewSet, LoginEventViewSet, SecurityEventViewSet, RecordVersionViewSet

router = DefaultRouter()
router.register("events", AuditEventViewSet)
router.register("login-events", LoginEventViewSet)
router.register("security-events", SecurityEventViewSet)
router.register("versions", RecordVersionViewSet)

urlpatterns = router.urls

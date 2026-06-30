from rest_framework.routers import DefaultRouter
from .views import (
    WorkflowStateViewSet, WorkflowTransitionViewSet,
    TaskViewSet, TaskAssignmentViewSet,
    ApprovalViewSet, ElectronicSignatureViewSet,
)

router = DefaultRouter()
router.register("states", WorkflowStateViewSet)
router.register("transitions", WorkflowTransitionViewSet)
router.register("tasks", TaskViewSet)
router.register("task-assignments", TaskAssignmentViewSet)
router.register("approvals", ApprovalViewSet)
router.register("signatures", ElectronicSignatureViewSet)

urlpatterns = router.urls

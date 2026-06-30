from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from core.permissions import IsReviewerOrAbove, IsLabManagerOrAbove, IsAnalystOrAbove
from audittrail.models import AuditEvent
from audittrail.middleware import get_current_request
from .models import WorkflowState, WorkflowTransition, Task, TaskAssignment, Approval, ElectronicSignature
from .serializers import (
    WorkflowStateSerializer, WorkflowTransitionSerializer,
    TaskSerializer, TaskAssignmentSerializer,
    ApprovalSerializer, ApprovalActionSerializer,
    ElectronicSignatureSerializer, SignRequestSerializer,
)


class WorkflowStateViewSet(viewsets.ModelViewSet):
    queryset = WorkflowState.objects.all()
    serializer_class = WorkflowStateSerializer
    permission_classes = [IsLabManagerOrAbove]


class WorkflowTransitionViewSet(viewsets.ModelViewSet):
    queryset = WorkflowTransition.objects.select_related("from_state", "to_state").all()
    serializer_class = WorkflowTransitionSerializer
    permission_classes = [IsLabManagerOrAbove]


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.select_related("created_by").all()
    serializer_class = TaskSerializer
    permission_classes = [IsAnalystOrAbove]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["status", "priority", "created_by"]

    @action(detail=False, methods=["get"], url_path="my-tasks")
    def my_tasks(self, request):
        """Tasks assigned to the current user."""
        task_ids = TaskAssignment.objects.filter(assigned_to=request.user).values_list("task_id", flat=True)
        qs = Task.objects.filter(pk__in=task_ids).select_related("created_by")
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(TaskSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        """Assign a user to a task. Body: {assigned_to: <user_id>}"""
        task = self.get_object()
        user_id = request.data.get("assigned_to")
        if not user_id:
            return Response({"detail": "assigned_to is required."}, status=status.HTTP_400_BAD_REQUEST)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            assignee = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        assignment, created = TaskAssignment.objects.get_or_create(
            task=task, assigned_to=assignee,
            defaults={"assigned_by": request.user},
        )
        return Response(TaskAssignmentSerializer(assignment).data,
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def update_status(self, request, pk=None):
        """Update task status. Body: {status: open|in_progress|done|cancelled}"""
        task = self.get_object()
        new_status = request.data.get("status")
        valid = [s[0] for s in Task.STATUS]
        if new_status not in valid:
            return Response({"detail": f"Invalid status. Choices: {valid}"}, status=status.HTTP_400_BAD_REQUEST)
        task.status = new_status
        task.save(update_fields=["status", "updated_at"])
        return Response(TaskSerializer(task).data)


class TaskAssignmentViewSet(viewsets.ModelViewSet):
    queryset = TaskAssignment.objects.select_related("task", "assigned_to", "assigned_by").all()
    serializer_class = TaskAssignmentSerializer
    permission_classes = [IsLabManagerOrAbove]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["task", "assigned_to"]


class ApprovalViewSet(viewsets.ModelViewSet):
    queryset = Approval.objects.select_related("requested_by", "reviewed_by", "content_type").all()
    serializer_class = ApprovalSerializer
    permission_classes = [IsReviewerOrAbove]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["status", "content_type"]

    @action(detail=True, methods=["post"], permission_classes=[IsReviewerOrAbove])
    def decide(self, request, pk=None):
        approval = self.get_object()
        if approval.status != "pending":
            return Response({"detail": "Approval already decided."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action_choice = serializer.validated_data["action"]

        approval.status = "approved" if action_choice == "approve" else "rejected"
        approval.reviewed_by = request.user
        approval.reviewed_at = timezone.now()
        approval.comments = serializer.validated_data.get("comments", "")
        approval.save()

        AuditEvent.objects.create(
            user=request.user,
            action=action_choice,
            content_type=approval.content_type,
            object_id=approval.object_id,
            object_repr=f"Approval #{approval.pk}",
        )
        return Response(ApprovalSerializer(approval).data)


class ElectronicSignatureViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ElectronicSignature.objects.select_related("signed_by", "content_type").all()
    serializer_class = ElectronicSignatureSerializer
    permission_classes = [IsReviewerOrAbove]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["content_type", "object_id", "signed_by"]

    @action(detail=False, methods=["post"], url_path="sign")
    def sign(self, request):
        """Verify user password and create an electronic signature."""
        serializer = SignRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data

        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        ip = xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR")

        sig = ElectronicSignature.objects.create(
            content_type=vd["content_type"],
            object_id=vd["object_id"],
            signed_by=request.user,
            reason=vd["reason"],
            ip_address=ip,
        )
        AuditEvent.objects.create(
            user=request.user,
            action="sign",
            content_type=vd["content_type"],
            object_id=vd["object_id"],
            object_repr=f"{vd['app_label']}.{vd['model']} #{vd['object_id']}",
            ip_address=ip,
        )
        return Response(ElectronicSignatureSerializer(sig).data, status=status.HTTP_201_CREATED)

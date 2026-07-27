from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from rest_framework.permissions import BasePermission
from core.permissions import IsLabManagerOrAbove, IsAnalystOrAbove, CAN_RECEIVE_OR_STORE_ROLES, requires
from audittrail.models import AuditEvent, SecurityEvent
from audittrail.middleware import get_current_request
from .models import WorkflowState, WorkflowTransition, Task, TaskAssignment, Approval, ElectronicSignature
from .serializers import (
    WorkflowStateSerializer, WorkflowTransitionSerializer,
    TaskSerializer, TaskAssignmentSerializer,
    ApprovalSerializer, ApprovalActionSerializer, SampleApprovalRequestSerializer,
    ElectronicSignatureSerializer, SignRequestSerializer,
)


def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    return xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR")


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
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(TaskSerializer(page, many=True).data)
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
    # Listing the queue is open to any authenticated user; deciding is gated to
    # the roles allowed to approve results (see decide()).
    permission_classes = [requires("approve_results")]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["status", "content_type"]

    @action(detail=True, methods=["post"], permission_classes=[requires("approve_results", allow_read=False)])
    def decide(self, request, pk=None):
        approval = self.get_object()
        if approval.status != "pending":
            return Response({"detail": "Approval already decided."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action_choice = serializer.validated_data["action"]
        comments = serializer.validated_data.get("comments", "")
        password = serializer.validated_data["password"]
        ip = _client_ip(request)

        # Electronic signature (CLAUDE.md §6): the deciding user must re-enter
        # their own password. This is the signature — verified here, not merely
        # collected. A wrong password blocks the decision and is logged.
        if not request.user.check_password(password):
            SecurityEvent.objects.create(
                user=request.user,
                event_type="esignature_failed",
                severity="medium",
                description=(
                    f"Failed e-signature on approval #{approval.pk} "
                    f"(sample {approval.sample_id or approval.senaite_uid or '—'}) — incorrect password."
                ),
                ip_address=ip,
            )
            return Response(
                {"password": ["Incorrect password. Your decision was not applied."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Record the signature (both approve and reject are signed decisions).
        ElectronicSignature.objects.create(
            content_type=approval.content_type,
            object_id=approval.object_id,
            senaite_uid=approval.senaite_uid,
            signed_by=request.user,
            reason=comments or f"{action_choice.capitalize()} approval #{approval.pk}",
            ip_address=ip,
        )

        approval.status = "approved" if action_choice == "approve" else "rejected"
        approval.reviewed_by = request.user
        approval.reviewed_at = timezone.now()
        approval.comments = comments
        approval.save()

        AuditEvent.objects.create(
            user=request.user,
            action=action_choice,
            content_type=approval.content_type,
            object_id=approval.object_id,
            object_repr=f"Approval #{approval.pk} — sample {approval.sample_id or approval.senaite_uid or '—'}",
            ip_address=ip,
        )
        return Response(ApprovalSerializer(approval).data)

    @action(detail=False, methods=["post"], url_path="request-sample",
            permission_classes=[IsAnalystOrAbove])
    def request_sample(self, request):
        """Create a pending approval for a verified SENAITE sample (by UID).
        Idempotent — if a pending approval already exists for this UID it is
        returned unchanged, so a re-verify never produces duplicates."""
        serializer = SampleApprovalRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data

        existing = Approval.objects.filter(senaite_uid=vd["senaite_uid"], status="pending").first()
        if existing:
            return Response(ApprovalSerializer(existing).data, status=status.HTTP_200_OK)

        approval = Approval.objects.create(
            senaite_uid=vd["senaite_uid"],
            sample_id=vd.get("sample_id", ""),
            client_name=vd.get("client_name", ""),
            title=vd.get("title", ""),
            priority=vd.get("priority", ""),
            requested_by=request.user,
        )
        AuditEvent.objects.create(
            user=request.user,
            action="submit",
            object_repr=f"Approval #{approval.pk} requested — sample {approval.sample_id or approval.senaite_uid}",
            ip_address=_client_ip(request),
        )
        return Response(ApprovalSerializer(approval).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="reconcile-samples",
            permission_classes=[IsAnalystOrAbove])
    def reconcile_samples(self, request):
        """Ensure every currently-verified SENAITE sample has an approval row.
        The frontend passes the set of samples at review_state="verified"; any
        UID with no approval (in ANY status — so a rejected/approved sample is
        never re-created) gets a fresh pending approval. This is the single,
        path-agnostic trigger: it fires no matter how the sample got verified
        (worksheet, sample detail, bulk, or SENAITE's own UI)."""
        serializer = SampleApprovalRequestSerializer(data=request.data.get("samples", []), many=True)
        serializer.is_valid(raise_exception=True)
        samples = serializer.validated_data
        uids = [s["senaite_uid"] for s in samples]
        existing_by_uid = {a.senaite_uid: a for a in Approval.objects.filter(senaite_uid__in=uids)}

        to_create = [
            Approval(
                senaite_uid=s["senaite_uid"], sample_id=s.get("sample_id", ""),
                client_name=s.get("client_name", ""), title=s.get("title", ""),
                priority=s.get("priority", ""), requested_by=None,
            )
            for s in samples if s["senaite_uid"] not in existing_by_uid
        ]
        if to_create:
            Approval.objects.bulk_create(to_create)

        # Self-heal: a still-pending approval created before a SENAITE
        # data-mapping fix (e.g. client title resolution) can be left holding
        # blank display fields forever, since this endpoint only ever created
        # new rows — never revisited existing ones. Refresh blanks on pending
        # rows only; decided approvals are a historical record and left as-is.
        updated = 0
        for s in samples:
            approval = existing_by_uid.get(s["senaite_uid"])
            if not approval or approval.status != "pending":
                continue
            changed = []
            for field in ("sample_id", "client_name", "title", "priority"):
                incoming = s.get(field, "")
                if incoming and not getattr(approval, field):
                    setattr(approval, field, incoming)
                    changed.append(field)
            if changed:
                approval.save(update_fields=changed)
                updated += 1

        return Response({"created": len(to_create), "updated": updated})


class IsAnalystOrSampleHandler(BasePermission):
    """analyst-or-above (IsAnalystOrAbove), OR any role permitted to log a
    Chain of Custody handoff (ReadOnlyOrSampleHandler's write_roles) — a
    lab_clerk can create a custody event but sits below "analyst" in
    ROLE_HIERARCHY, so gating /sign/ on IsAnalystOrAbove alone would let them
    log the handoff and then be refused when signing it."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and (IsAnalystOrAbove().has_permission(request, view)
                 or getattr(request.user, "role", None) in CAN_RECEIVE_OR_STORE_ROLES)
        )


class ElectronicSignatureViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ElectronicSignature.objects.select_related("signed_by", "content_type").all()
    serializer_class = ElectronicSignatureSerializer
    # A signature can only ever be created for the signer themselves (the sign
    # action re-verifies request.user's own password), so this stays open to any
    # lab analyst-or-above, or a role that can log a Chain of Custody handoff;
    # identity is enforced by the password, not the role.
    permission_classes = [IsAnalystOrSampleHandler]
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

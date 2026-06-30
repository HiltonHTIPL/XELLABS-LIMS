"""
Dashboard / backlog summary endpoint.
Returns counts for the lab manager's operational overview.
"""
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from lims.models import Sample, AnalysisRequest, Worksheet, Result
        from workflow.models import Task
        from inventory.models import ExpiryAlert

        now = timezone.now()

        sample_status_counts = {}
        for status_code, _ in Sample.STATUS:
            sample_status_counts[status_code] = Sample.objects.filter(status=status_code).count()

        expiring_samples = Sample.objects.filter(
            expiry_date__isnull=False,
            expiry_date__lte=now + timezone.timedelta(days=7),
            status__in=["registered", "received", "in_progress", "results_pending"],
        ).count()

        return Response({
            "samples": {
                "by_status": sample_status_counts,
                "expiring_within_7_days": expiring_samples,
            },
            "analysis_requests": {
                "pending": AnalysisRequest.objects.filter(status="pending").count(),
                "in_progress": AnalysisRequest.objects.filter(status="in_progress").count(),
                "overdue": AnalysisRequest.objects.filter(
                    due_date__lt=now, status__in=["pending", "in_progress"]
                ).count(),
            },
            "worksheets": {
                "open": Worksheet.objects.filter(status="open").count(),
                "in_progress": Worksheet.objects.filter(status="in_progress").count(),
                "to_be_verified": Worksheet.objects.filter(status="to_be_verified").count(),
            },
            "results": {
                "pending": Result.objects.filter(status="pending").count(),
                "submitted": Result.objects.filter(status="submitted").count(),
                "out_of_range": Result.objects.filter(status="submitted", is_out_of_range=True).count(),
            },
            "tasks": {
                "open": Task.objects.filter(status="open").count(),
                "overdue": Task.objects.filter(due_date__lt=now, status__in=["open", "in_progress"]).count(),
                "my_open": Task.objects.filter(
                    assignments__assigned_to=request.user, status__in=["open", "in_progress"]
                ).count(),
            },
            "inventory": {
                "unacknowledged_expiry_alerts": ExpiryAlert.objects.filter(is_acknowledged=False).count(),
                "expiry_alerts_this_week": ExpiryAlert.objects.filter(
                    is_acknowledged=False,
                    alert_date__lte=(now + timezone.timedelta(days=7)).date(),
                ).count(),
            },
        })

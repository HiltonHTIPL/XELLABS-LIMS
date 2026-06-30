"""
Functional tests for reporting — COA generation and dashboard.
"""
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

User = get_user_model()


def make_user(username, role="analyst"):
    u = User.objects.create_user(username=username, password="testpass123", role=role)
    token, _ = Token.objects.get_or_create(user=u)
    return u, token.key


class DashboardTest(APITestCase):
    def setUp(self):
        _, key = make_user("dash_analyst")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {key}")

    def test_dashboard_returns_all_sections(self):
        r = self.client.get("/api/dashboard/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        for key in ("samples", "analysis_requests", "worksheets", "results", "tasks", "inventory"):
            self.assertIn(key, r.data)

    def test_dashboard_sample_statuses_present(self):
        r = self.client.get("/api/dashboard/")
        self.assertIn("by_status", r.data["samples"])
        self.assertIn("registered", r.data["samples"]["by_status"])

    def test_dashboard_unauthenticated_blocked(self):
        self.client.credentials()
        r = self.client.get("/api/dashboard/")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)


class ReportCRUDTest(APITestCase):
    def setUp(self):
        self.manager, self.key = make_user("rpt_manager", "lab_manager")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.key}")
        from core.models import Client
        from lims.models import SampleType, Sample
        client_obj = Client.objects.create(name="Report Client")
        st = SampleType.objects.create(name="RptST", prefix="RPT")
        self.sample = Sample.objects.create(
            sample_id="RPT-001", client=client_obj, sample_type=st, created_by=self.manager
        )

    def test_create_report_record(self):
        from reporting.models import Report
        r = self.client.post("/api/reports/reports/", {
            "report_type": "coa",
            "title": "COA for RPT-001",
            "sample": self.sample.pk,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertIn("report_id", r.data)

    def test_list_reports(self):
        r = self.client.get("/api/reports/reports/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

"""
Functional tests for the Core LIMS workflow.
Covers: sample registration, analysis request, worksheet, result entry, review/approval, ID generation.
"""
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.authtoken.models import Token
from core.test_utils import TenantAPITestCase

from core.models import Client
from lims.models import (
    SampleType, Method, Test,
    Sample, AnalysisRequest, Worksheet, WorksheetAssignment, Result,
)

User = get_user_model()


def make_user(username, role="analyst"):
    u = User.objects.create_user(username=username, password="testpass123", role=role)
    token, _ = Token.objects.get_or_create(user=u)
    return u, token.key


class SampleRegistrationTest(TenantAPITestCase):
    def setUp(self):
        self.analyst, self.key = make_user("lims_analyst", "analyst")
        self.client_obj = Client.objects.create(name="Test Client")
        self.st = SampleType.objects.create(name="Blood", prefix="BLD")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.key}")

    def test_create_sample_auto_generates_id(self):
        r = self.client.post("/api/lims/samples/", {
            "client": self.client_obj.pk,
            "sample_type": self.st.pk,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertTrue(r.data["sample_id"].startswith("BLD-"))

    def test_duplicate_sample_id_rejected(self):
        Sample.objects.create(
            sample_id="BLD-DUP", client=self.client_obj, sample_type=self.st, created_by=self.analyst
        )
        r = self.client.post("/api/lims/samples/", {
            "client": self.client_obj.pk,
            "sample_type": self.st.pk,
            "sample_id": "BLD-DUP",
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_receive_sample_transitions_status(self):
        sample = Sample.objects.create(
            sample_id="BLD-RCV", client=self.client_obj, sample_type=self.st, created_by=self.analyst
        )
        r = self.client.post(f"/api/lims/samples/{sample.pk}/receive/", {
            "location": "Fridge A", "notes": "Received on time"
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["status"], "received")

    def test_receive_already_received_returns_400(self):
        sample = Sample.objects.create(
            sample_id="BLD-RCV2", client=self.client_obj, sample_type=self.st,
            created_by=self.analyst, status="received"
        )
        r = self.client.post(f"/api/lims/samples/{sample.pk}/receive/")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)


class ResultWorkflowTest(TenantAPITestCase):
    def setUp(self):
        self.analyst, self.analyst_key = make_user("res_analyst", "analyst")
        self.reviewer, self.reviewer_key = make_user("res_reviewer", "reviewer")
        self.client_obj = Client.objects.create(name="Result Client")
        st = SampleType.objects.create(name="Urine", prefix="URN")
        method = Method.objects.create(name="Titration", code="TITR")
        self.test_obj = Test.objects.create(name="pH", code="PH01", method=method)
        sample = Sample.objects.create(
            sample_id="URN-001", client=self.client_obj, sample_type=st, created_by=self.analyst
        )
        ar = AnalysisRequest.objects.create(ar_id="AR-URN-001", sample=sample, created_by=self.analyst)
        ar.tests.add(self.test_obj)
        ws = Worksheet.objects.create(ws_id="WS-URN-001", analyst=self.analyst)
        self.wa = WorksheetAssignment.objects.create(worksheet=ws, analysis_request=ar, test=self.test_obj)
        self.result = Result.objects.create(worksheet_assignment=self.wa, value="7.4")

    def _auth(self, key):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {key}")

    def test_analyst_submits_result(self):
        self._auth(self.analyst_key)
        r = self.client.post(f"/api/lims/results/{self.result.pk}/submit/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["status"], "submitted")

    def test_submit_empty_value_fails(self):
        self.result.value = ""
        self.result.save()
        self._auth(self.analyst_key)
        r = self.client.post(f"/api/lims/results/{self.result.pk}/submit/")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reviewer_verifies_submitted_result(self):
        self.result.status = "submitted"
        self.result.save()
        self._auth(self.reviewer_key)
        r = self.client.post(f"/api/lims/results/{self.result.pk}/verify/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["status"], "verified")
        self.assertTrue(r.data["is_locked"])

    def test_reviewer_rejects_submitted_result(self):
        self.result.status = "submitted"
        self.result.save()
        self._auth(self.reviewer_key)
        r = self.client.post(f"/api/lims/results/{self.result.pk}/reject/", {"remarks": "Value out of expected range"})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["status"], "rejected")

    def test_locked_result_blocked_for_analyst(self):
        self.result.status = "verified"
        self.result.is_locked = True
        self.result.save()
        self._auth(self.analyst_key)
        r = self.client.patch(f"/api/lims/results/{self.result.pk}/", {"value": "9.9"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)


class WorksheetWorkflowTest(TenantAPITestCase):
    def setUp(self):
        self.analyst, self.analyst_key = make_user("ws_analyst", "analyst")
        self.manager, self.manager_key = make_user("ws_manager", "lab_manager")
        self.ws = Worksheet.objects.create(ws_id="WS-TEST-001", analyst=self.analyst, status="open")

    def _auth(self, key):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {key}")

    def test_submit_for_review(self):
        self._auth(self.analyst_key)
        r = self.client.post(f"/api/lims/worksheets/{self.ws.pk}/submit_for_review/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["status"], "to_be_verified")

    def test_manager_verifies_worksheet(self):
        self.ws.status = "to_be_verified"
        self.ws.save()
        self._auth(self.manager_key)
        r = self.client.post(f"/api/lims/worksheets/{self.ws.pk}/verify/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["status"], "verified")

    def test_analyst_cannot_verify_worksheet(self):
        self.ws.status = "to_be_verified"
        self.ws.save()
        self._auth(self.analyst_key)
        r = self.client.post(f"/api/lims/worksheets/{self.ws.pk}/verify/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)


class IDGenerationTest(TenantAPITestCase):
    """Verify sequential auto-ID generation."""

    def setUp(self):
        self.user, key = make_user("id_analyst", "analyst")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {key}")
        self.client_obj = Client.objects.create(name="ID Client")
        self.st = SampleType.objects.create(name="Serum", prefix="SRM")

    def test_sequential_ids_same_day(self):
        r1 = self.client.post("/api/lims/samples/", {"client": self.client_obj.pk, "sample_type": self.st.pk}, format="json")
        r2 = self.client.post("/api/lims/samples/", {"client": self.client_obj.pk, "sample_type": self.st.pk}, format="json")
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)
        seq1 = int(r1.data["sample_id"].split("-")[-1])
        seq2 = int(r2.data["sample_id"].split("-")[-1])
        self.assertEqual(seq2, seq1 + 1)


class SampleDisposeWorkflowTest(TenantAPITestCase):
    def setUp(self):
        self.manager, self.key = make_user("dispose_mgr", "lab_manager")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.key}")
        self.client_obj = Client.objects.create(name="Dispose Client")
        self.st = SampleType.objects.create(name="Water", prefix="GW")
        self.sample = Sample.objects.create(
            sample_id="GW-DISP-001",
            client=self.client_obj,
            sample_type=self.st,
            created_by=self.manager,
            status="reviewed",
            description="Past retention sample",
            analysis_specification=0,
        )

    def test_dispose_from_eligible_state(self):
        from lims.models import ChainOfCustody
        from audittrail.models import AuditEvent

        r = self.client.post(
            f"/api/lims/samples/{self.sample.pk}/dispose/",
            {"regulatory_basis": "40 CFR Part 261 — retention exceeded"},
            format="multipart",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["status"], "disposed")
        self.assertIn("[Disposed] 40 CFR Part 261", r.data["description"])

        self.sample.refresh_from_db()
        self.assertEqual(self.sample.status, "disposed")
        self.assertTrue(
            ChainOfCustody.objects.filter(sample=self.sample, action="disposed").exists()
        )
        self.assertTrue(
            AuditEvent.objects.filter(
                object_id=str(self.sample.pk),
                content_type__model="sample",
            ).exists()
        )

    def test_dispose_ineligible_status_returns_400(self):
        self.sample.status = "registered"
        self.sample.save(update_fields=["status"])
        r = self.client.post(
            f"/api/lims/samples/{self.sample.pk}/dispose/",
            {"regulatory_basis": "40 CFR Part 261"},
            format="multipart",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.sample.refresh_from_db()
        self.assertEqual(self.sample.status, "registered")

    def test_dispose_already_disposed_returns_400(self):
        self.sample.status = "disposed"
        self.sample.save(update_fields=["status"])
        r = self.client.post(
            f"/api/lims/samples/{self.sample.pk}/dispose/",
            {"regulatory_basis": "40 CFR Part 261"},
            format="multipart",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_disposed_sample_leaves_analysis_active_list(self):
        from lims.models import AnalysisRequest

        ar = AnalysisRequest.objects.create(
            ar_id="AR-DISP-001", sample=self.sample, created_by=self.manager, status="completed",
        )
        r = self.client.post(
            f"/api/lims/samples/{self.sample.pk}/dispose/",
            {"regulatory_basis": "40 CFR Part 261 — retention exceeded"},
            format="multipart",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)

        active = self.client.get("/api/lims/analysis-requests/")
        self.assertEqual(active.status_code, status.HTTP_200_OK)
        rows = active.data if isinstance(active.data, list) else active.data.get("results", [])
        ids = [row["id"] for row in rows]
        self.assertNotIn(ar.id, ids)

        disposed_filter = self.client.get("/api/lims/samples/?status=disposed")
        self.assertEqual(disposed_filter.status_code, status.HTTP_200_OK)
        samples = disposed_filter.data if isinstance(disposed_filter.data, list) else disposed_filter.data.get("results", [])
        self.assertIn("GW-DISP-001", [s["sample_id"] for s in samples])

    def test_missing_basis_returns_400(self):
        r = self.client.post(
            f"/api/lims/samples/{self.sample.pk}/dispose/",
            {},
            format="multipart",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

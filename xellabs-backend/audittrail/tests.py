"""
Functional tests for audit trail — verifies that compliance events are logged automatically.
"""
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from audittrail.models import AuditEvent, DataChangeLog, RecordVersion
from core.models import Client
from lims.models import SampleType, Sample

User = get_user_model()


def make_user(username, role="analyst"):
    u = User.objects.create_user(username=username, password="testpass123", role=role)
    token, _ = Token.objects.get_or_create(user=u)
    return u, token.key


class AuditEventCreationTest(APITestCase):
    def setUp(self):
        self.user, self.key = make_user("audit_analyst")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.key}")
        self.client_obj = Client.objects.create(name="Audit Client")
        self.st = SampleType.objects.create(name="AuditST", prefix="AUD")

    def test_sample_create_logs_audit_event(self):
        before = AuditEvent.objects.count()
        self.client.post("/api/samples/", {
            "client": self.client_obj.pk,
            "sample_type": self.st.pk,
        }, format="json")
        self.assertGreater(AuditEvent.objects.count(), before)

    def test_sample_update_logs_data_change(self):
        sample = Sample.objects.create(
            sample_id="AUD-001", client=self.client_obj, sample_type=self.st,
            created_by=self.user, description="Original"
        )
        before = DataChangeLog.objects.count()
        self.client.patch(f"/api/samples/{sample.pk}/", {"description": "Updated"}, format="json")
        self.assertGreater(DataChangeLog.objects.count(), before)

    def test_sample_update_creates_record_version(self):
        sample = Sample.objects.create(
            sample_id="AUD-002", client=self.client_obj, sample_type=self.st,
            created_by=self.user, description="v1"
        )
        before = RecordVersion.objects.count()
        self.client.patch(f"/api/samples/{sample.pk}/", {"description": "v2"}, format="json")
        self.assertGreater(RecordVersion.objects.count(), before)


class AuditReadOnlyTest(APITestCase):
    """Audit events must not be writable via API."""

    def setUp(self):
        # AuditReadOnly permission requires admin/lab_manager — use admin role
        _, key = make_user("audit_ro", role="admin")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {key}")

    def test_cannot_create_audit_event_via_api(self):
        r = self.client.post("/api/compliance/audit/events/", {
            "action": "create", "object_repr": "forged"
        }, format="json")
        # AuditReadOnly blocks writes with 403 before method dispatch — both 403 and 405 prove immutability
        self.assertIn(r.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED])

    def test_cannot_delete_audit_event_via_api(self):
        user, _ = make_user("audit_del_user", role="admin")
        event = AuditEvent.objects.create(user=user, action="create", object_repr="test")
        r = self.client.delete(f"/api/compliance/audit/events/{event.pk}/")
        self.assertIn(r.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED])

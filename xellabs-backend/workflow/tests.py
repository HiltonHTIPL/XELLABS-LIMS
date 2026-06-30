"""
Functional tests for workflow: tasks, approvals, electronic signatures.
"""
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from workflow.models import Task, TaskAssignment

User = get_user_model()


def make_user(username, role="analyst"):
    u = User.objects.create_user(username=username, password="testpass123", role=role)
    token, _ = Token.objects.get_or_create(user=u)
    return u, token.key


class TaskAssignmentTest(APITestCase):
    def setUp(self):
        self.manager, self.manager_key = make_user("wf_manager", "lab_manager")
        self.analyst, self.analyst_key = make_user("wf_analyst", "analyst")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.manager_key}")
        self.task = Task.objects.create(
            title="Run pH tests", priority="high", created_by=self.manager
        )

    def test_manager_assigns_task_to_analyst(self):
        r = self.client.post(f"/api/compliance/workflow/tasks/{self.task.pk}/assign/",
                             {"assigned_to": self.analyst.pk}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["assigned_to"], self.analyst.pk)

    def test_assign_twice_returns_200_not_duplicate(self):
        self.client.post(f"/api/compliance/workflow/tasks/{self.task.pk}/assign/",
                         {"assigned_to": self.analyst.pk}, format="json")
        r = self.client.post(f"/api/compliance/workflow/tasks/{self.task.pk}/assign/",
                             {"assigned_to": self.analyst.pk}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_analyst_sees_my_tasks(self):
        TaskAssignment.objects.create(task=self.task, assigned_to=self.analyst, assigned_by=self.manager)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.analyst_key}")
        r = self.client.get("/api/compliance/workflow/tasks/my-tasks/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [t["id"] for t in r.data]
        self.assertIn(self.task.pk, ids)

    def test_update_task_status(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.analyst_key}")
        r = self.client.post(f"/api/compliance/workflow/tasks/{self.task.pk}/update_status/",
                             {"status": "in_progress"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["status"], "in_progress")

    def test_invalid_task_status_rejected(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.analyst_key}")
        r = self.client.post(f"/api/compliance/workflow/tasks/{self.task.pk}/update_status/",
                             {"status": "flying"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)


class ElectronicSignatureTest(APITestCase):
    def setUp(self):
        self.reviewer, self.key = make_user("wf_reviewer", "reviewer")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.key}")
        from core.models import Client
        from lims.models import SampleType, Sample
        client_obj = Client.objects.create(name="Sig Client")
        st = SampleType.objects.create(name="SigST", prefix="SG")
        self.sample = Sample.objects.create(
            sample_id="SG-001", client=client_obj, sample_type=st, created_by=self.reviewer
        )

    def test_sign_with_correct_password(self):
        r = self.client.post("/api/compliance/workflow/signatures/sign/", {
            "app_label": "lims",
            "model": "sample",
            "object_id": self.sample.pk,
            "reason": "Verified result",
            "password": "testpass123",
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertIn("signed_at", r.data)

    def test_sign_with_wrong_password_rejected(self):
        r = self.client.post("/api/compliance/workflow/signatures/sign/", {
            "app_label": "lims",
            "model": "sample",
            "object_id": self.sample.pk,
            "reason": "Forged signature",
            "password": "wrongpassword",
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

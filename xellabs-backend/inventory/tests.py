"""
Functional tests for inventory management.
"""
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from inventory.models import StorageLocation, Reagent, Lot, InventoryTransaction, ExpiryAlert

User = get_user_model()


def make_user(username, role="analyst"):
    u = User.objects.create_user(username=username, password="testpass123", role=role)
    token, _ = Token.objects.get_or_create(user=u)
    return u, token.key


class InventoryTransactionTest(APITestCase):
    def setUp(self):
        self.user, key = make_user("inv_analyst")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {key}")
        self.location = StorageLocation.objects.create(name="Fridge 1")
        self.reagent = Reagent.objects.create(name="HCl", unit="L", min_stock_level=5)
        ct = ContentType.objects.get_for_model(Reagent)
        self.lot = Lot.objects.create(
            content_type=ct, object_id=self.reagent.pk,
            lot_number="LOT001", quantity=10,
            storage_location=self.location, created_by=self.user,
        )

    def test_create_transaction_in(self):
        r = self.client.post("/api/inventory/transactions/", {
            "lot": self.lot.pk,
            "transaction_type": "in",
            "quantity": "5.0",
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_transaction_out(self):
        r = self.client.post("/api/inventory/transactions/", {
            "lot": self.lot.pk,
            "transaction_type": "out",
            "quantity": "2.0",
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_low_stock_endpoint_returns_item_below_minimum(self):
        # min_stock_level=5, no in-transactions → current=0 < 5
        r = self.client.get("/api/inventory/lots/low-stock/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        names = [item["name"] for item in r.data]
        self.assertIn("HCl", names)

    def test_low_stock_excludes_sufficient_stock(self):
        # Add enough in-transactions to go above min_stock_level
        InventoryTransaction.objects.create(
            lot=self.lot, transaction_type="in", quantity=10, created_by=self.user
        )
        r = self.client.get("/api/inventory/lots/low-stock/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        names = [item["name"] for item in r.data]
        self.assertNotIn("HCl", names)


class ExpiryAlertTest(APITestCase):
    def setUp(self):
        self.user, key = make_user("exp_analyst")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {key}")
        self.location = StorageLocation.objects.create(name="Freezer 1")
        self.reagent = Reagent.objects.create(name="PBS", unit="L")
        ct = ContentType.objects.get_for_model(Reagent)
        self.lot = Lot.objects.create(
            content_type=ct, object_id=self.reagent.pk,
            lot_number="EXPLOT001", quantity=3,
            expiry_date=timezone.now().date() + timezone.timedelta(days=10),
            storage_location=self.location, created_by=self.user,
        )
        self.alert = ExpiryAlert.objects.create(
            lot=self.lot,
            alert_date=self.lot.expiry_date,
        )

    def test_upcoming_expiry_alerts_includes_near_expiry(self):
        r = self.client.get("/api/inventory/expiry-alerts/upcoming/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertGreater(len(r.data), 0)

    def test_acknowledge_alert(self):
        r = self.client.post(f"/api/inventory/expiry-alerts/{self.alert.pk}/acknowledge/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data["is_acknowledged"])

    def test_acknowledge_twice_fails(self):
        self.alert.is_acknowledged = True
        self.alert.acknowledged_by = self.user
        self.alert.save()
        r = self.client.post(f"/api/inventory/expiry-alerts/{self.alert.pk}/acknowledge/")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

"""
Functional tests for instrument management and file imports.
"""
import io
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from instruments.models import Instrument
from instruments.importers import parse_csv, parse_xml, map_results

User = get_user_model()


def make_user(username, role="analyst"):
    u = User.objects.create_user(username=username, password="testpass123", role=role)
    token, _ = Token.objects.get_or_create(user=u)
    return u, token.key


class InstrumentDueAlertsTest(APITestCase):
    def setUp(self):
        _, key = make_user("inst_analyst")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {key}")
        today = timezone.now().date()
        Instrument.objects.create(
            name="HPLC-1", instrument_id="HPLC-001", status="active",
            next_calibration=today + timezone.timedelta(days=15),
            next_maintenance=today + timezone.timedelta(days=50),
        )
        Instrument.objects.create(
            name="GC-1", instrument_id="GC-001", status="active",
            next_calibration=today + timezone.timedelta(days=60),
        )

    def test_calibration_due_within_30_days(self):
        r = self.client.get("/api/instruments/instruments/calibration-due/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [i["instrument_id"] for i in r.data]
        self.assertIn("HPLC-001", ids)
        self.assertNotIn("GC-001", ids)

    def test_maintenance_due_custom_window(self):
        r = self.client.get("/api/instruments/instruments/maintenance-due/?days=60")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [i["instrument_id"] for i in r.data]
        self.assertIn("HPLC-001", ids)

    def test_inactive_instrument_excluded(self):
        Instrument.objects.create(
            name="OLD-1", instrument_id="OLD-001", status="retired",
            next_calibration=timezone.now().date() + timezone.timedelta(days=5),
        )
        r = self.client.get("/api/instruments/instruments/calibration-due/")
        ids = [i["instrument_id"] for i in r.data]
        self.assertNotIn("OLD-001", ids)


class CSVParserTest(APITestCase):
    def test_valid_csv_parsed(self):
        csv_data = b"sample_id,test_code,value,unit,flags\nS-001,PH01,7.4,pH,\nS-002,PH01,8.1,pH,H\n"
        rows, errors = parse_csv(csv_data)
        self.assertEqual(len(rows), 2)
        self.assertEqual(len(errors), 0)
        self.assertEqual(rows[0]["sample_id"], "S-001")
        self.assertEqual(rows[1]["flags"], "H")

    def test_missing_required_column_returns_error(self):
        csv_data = b"sample_id,value\nS-001,7.4\n"
        rows, errors = parse_csv(csv_data)
        self.assertEqual(len(rows), 0)
        self.assertGreater(len(errors), 0)

    def test_row_missing_sample_id_skipped_with_error(self):
        csv_data = b"sample_id,test_code,value\n,PH01,7.4\n"
        rows, errors = parse_csv(csv_data)
        self.assertEqual(len(rows), 0)
        self.assertEqual(len(errors), 1)


class XMLParserTest(APITestCase):
    def test_valid_xml_parsed(self):
        xml_data = b"""<Results>
            <Result><SampleId>S-001</SampleId><TestCode>PH01</TestCode><Value>7.4</Value><Unit>pH</Unit><Flags></Flags></Result>
            <Result><SampleId>S-002</SampleId><TestCode>PH01</TestCode><Value>8.1</Value><Unit>pH</Unit><Flags>H</Flags></Result>
        </Results>"""
        rows, errors = parse_xml(xml_data)
        self.assertEqual(len(rows), 2)
        self.assertEqual(len(errors), 0)

    def test_malformed_xml_returns_error(self):
        rows, errors = parse_xml(b"<Results><Result>broken")
        self.assertEqual(len(rows), 0)
        self.assertGreater(len(errors), 0)

    def test_empty_result_element_skipped(self):
        xml_data = b"<Results><Result><SampleId></SampleId><TestCode></TestCode></Result></Results>"
        rows, errors = parse_xml(xml_data)
        self.assertEqual(len(rows), 0)
        self.assertEqual(len(errors), 1)

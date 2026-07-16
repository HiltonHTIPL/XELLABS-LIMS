"""
Functional tests for instrument management and file imports.
"""
import io
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token

from core.test_utils import TenantAPITestCase

from instruments.models import Instrument, Calibration
from instruments import services as instrument_services
from instruments.importers import (
    parse_csv, parse_xml, map_results, resolve_parser, parse_instrument_file, build_preview,
)

User = get_user_model()


def make_user(username, role="analyst"):
    u = User.objects.create_user(username=username, password="testpass123", role=role)
    token, _ = Token.objects.get_or_create(user=u)
    return u, token.key


class InstrumentWorkflowTest(TenantAPITestCase):
    def setUp(self):
        self.manager, key = make_user("inst_mgr", role="lab_manager")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {key}")
        self.instrument = Instrument.objects.create(
            name="Workflow HPLC", instrument_id="WF-HPLC-001", status="active", usability="valid",
        )

    def test_deactivate_then_activate(self):
        r = self.client.post(f"/api/instruments/instruments/{self.instrument.id}/deactivate/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["status"], "inactive")
        self.assertEqual(r.data["usability"], "out_of_service")

        r = self.client.post(f"/api/instruments/instruments/{self.instrument.id}/activate/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["status"], "active")

    def test_illegal_transition_returns_400(self):
        r = self.client.post(f"/api/instruments/instruments/{self.instrument.id}/return-to-service/")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

        instrument_services.retire(self.instrument)
        r = self.client.post(f"/api/instruments/instruments/{self.instrument.id}/activate/")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_expired_calibration_flips_usability(self):
        today = timezone.now().date()
        Calibration.objects.create(
            instrument=self.instrument,
            calibration_date=today - timezone.timedelta(days=40),
            next_due=today - timezone.timedelta(days=10),
            status="passed",
            performed_by=self.manager,
        )
        self.instrument.refresh_from_db()
        self.assertEqual(self.instrument.usability, "expired")

        r = self.client.get("/api/instruments/instruments/?usability=expired")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        rows = r.data if isinstance(r.data, list) else r.data.get("results", [])
        ids = [i["instrument_id"] for i in rows]
        self.assertIn("WF-HPLC-001", ids)

    def test_out_of_service_excluded_from_usable_filter(self):
        instrument_services.set_out_of_service(self.instrument)
        r = self.client.get("/api/instruments/instruments/?usability=valid&status=active")
        rows = r.data if isinstance(r.data, list) else r.data.get("results", [])
        ids = [i["instrument_id"] for i in rows]
        self.assertNotIn("WF-HPLC-001", ids)


class InstrumentDueAlertsTest(TenantAPITestCase):
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


class CSVParserTest(TenantAPITestCase):
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


class XMLParserTest(TenantAPITestCase):
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


class ParserRegistryTest(TenantAPITestCase):
    def test_empty_interface_resolves_generic_csv(self):
        self.assertIs(resolve_parser("", "csv"), parse_csv)
        self.assertIs(resolve_parser(None, "csv"), parse_csv)

    def test_unknown_vendor_falls_back_to_generic(self):
        self.assertIs(resolve_parser("shimadzu", "csv"), parse_csv)
        self.assertIs(resolve_parser("agilent,generic", "csv"), parse_csv)

    def test_parse_instrument_file_generic_csv(self):
        csv_data = b"sample_id,test_code,value,unit,flags\nS-001,PH01,7.4,pH,\n"
        rows, errors = parse_instrument_file(csv_data, file_format="csv", interface_code="generic")
        self.assertEqual(len(rows), 1)
        self.assertEqual(len(errors), 0)


class InstrumentImportApplyTest(TenantAPITestCase):
    def setUp(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from lims.models import (
            SampleType, Method, Test, Sample, AnalysisRequest, Worksheet, WorksheetAssignment, Result,
        )
        from instruments.models import InstrumentResultImport
        from core.models import Client

        self.SimpleUploadedFile = SimpleUploadedFile
        self.Result = Result
        self.InstrumentResultImport = InstrumentResultImport

        self.analyst, key = make_user("imp_analyst", "analyst")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {key}")
        client_obj = Client.objects.create(name="Import Client")
        st = SampleType.objects.create(name="Water", prefix="W")
        method = Method.objects.create(name="ICP", code="ICP")
        self.test = Test.objects.create(name="Arsenic", code="AS-ICPMS", method=method)
        self.sample = Sample.objects.create(
            sample_id="DEMO-RES-MULTI-002",
            client=client_obj,
            sample_type=st,
            created_by=self.analyst,
            status="in_progress",
            analysis_specification=0,
        )
        ar = AnalysisRequest.objects.create(
            ar_id="AR-IMP-001", sample=self.sample, created_by=self.analyst, status="in_progress",
        )
        ws = Worksheet.objects.create(ws_id="WS-IMP-001", analyst=self.analyst, status="open")
        self.wa = WorksheetAssignment.objects.create(worksheet=ws, analysis_request=ar, test=self.test)
        self.instrument = Instrument.objects.create(
            name="Demo ICP-MS",
            instrument_id="INST-IMP-01",
            status="active",
            usability="valid",
            import_data_interface="generic",
        )

    def test_apply_import_submits_result_for_review(self):
        from instruments.tasks import apply_import

        csv_bytes = b"sample_id,test_code,value,unit,flags\nDEMO-RES-MULTI-002,AS-ICPMS,12.5,ug/L,\n"
        imp = self.InstrumentResultImport.objects.create(
            instrument=self.instrument,
            file=self.SimpleUploadedFile("demo.csv", csv_bytes, content_type="text/csv"),
            file_format="csv",
            imported_by=self.analyst,
            status="pending",
        )
        summary = apply_import(imp)
        self.assertEqual(summary["created"], 1)
        self.assertEqual(summary["status"], "processed")
        result = self.Result.objects.get(worksheet_assignment=self.wa)
        self.assertEqual(result.value, "12.5")
        self.assertEqual(result.status, "submitted")

    def test_apply_import_skips_verified_result(self):
        from instruments.tasks import apply_import

        self.Result.objects.create(
            worksheet_assignment=self.wa, value="1.0", unit="ug/L", status="verified",
        )
        csv_bytes = b"sample_id,test_code,value,unit,flags\nDEMO-RES-MULTI-002,AS-ICPMS,99.0,ug/L,\n"
        imp = self.InstrumentResultImport.objects.create(
            instrument=self.instrument,
            file=self.SimpleUploadedFile("skip.csv", csv_bytes, content_type="text/csv"),
            file_format="csv",
            imported_by=self.analyst,
            status="pending",
        )
        summary = apply_import(imp)
        self.assertEqual(summary["skipped"], 1)
        self.assertEqual(summary["created"], 0)
        result = self.Result.objects.get(worksheet_assignment=self.wa)
        self.assertEqual(result.value, "1.0")
        self.assertEqual(result.status, "verified")

    def test_preview_surfaces_verified_as_skip(self):
        self.Result.objects.create(
            worksheet_assignment=self.wa, value="1.0", unit="ug/L", status="verified",
        )
        rows = [{
            "sample_id": "DEMO-RES-MULTI-002", "test_code": "AS-ICPMS",
            "value": "99.0", "unit": "ug/L", "flags": "",
        }]
        preview, summary = build_preview(rows, [])
        self.assertEqual(summary["skipped"], 1)
        self.assertEqual(preview[0]["status"], "skip")
        self.assertIn("verified", preview[0]["detail"])


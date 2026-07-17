"""
Seed domain-realistic demo data for RFP dry-runs (TC-5 / TC-6 / TC-9).

Idempotent: re-running updates keyed records rather than duplicating them.

Usage:
  docker compose exec django python manage.py seed_demo_rfp --schema demo
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils import timezone
from django_tenants.utils import schema_context


class Command(BaseCommand):
    help = "Seed RFP demo data (clients, types, instruments, samples, QC) into a tenant schema."

    def add_arguments(self, parser):
        parser.add_argument("--schema", default="demo", help="Tenant schema name (default: demo)")
        parser.add_argument(
            "--reset-tagged",
            action="store_true",
            help="Delete previously seeded DEMO-* / RFP-* keyed rows before seeding.",
        )

    def handle(self, *args, **options):
        schema = options["schema"]
        from core.models import Tenant

        if not Tenant.objects.filter(schema_name=schema).exists():
            self.stderr.write(self.style.ERROR(f"Tenant schema '{schema}' not found."))
            return

        with schema_context(schema):
            if options["reset_tagged"]:
                self._reset_tagged()
            summary = self._seed(schema)

        self.stdout.write(self.style.SUCCESS("RFP demo seed complete."))
        for k, v in summary.items():
            self.stdout.write(f"  {k}: {v}")

    def _reset_tagged(self):
        from lims.models import Sample, QCSample, AnalysisRequest, Worksheet, Result, WorksheetAssignment
        from instruments.models import Instrument

        Sample.objects.filter(sample_id__startswith="DEMO-").delete()
        QCSample.objects.filter(qc_id__startswith="QC-DEMO-").delete()
        Worksheet.objects.filter(ws_id__startswith="WS-DEMO-").delete()
        AnalysisRequest.objects.filter(ar_id__startswith="AR-DEMO-").delete()
        Instrument.objects.filter(instrument_id__startswith="INST-DEMO-").delete()
        # orphan assignments/results cascade via FKs when parents deleted
        _ = (Result, WorksheetAssignment)

    def _seed(self, schema: str) -> dict:
        from core.models import Client, Tenant, User
        from lims.models import (
            SampleType, Method, Sample, AnalysisRequest, AnalysisRequestAnalysis,
            Worksheet, WorksheetAssignment, QCSample, ChainOfCustody,
        )
        from instruments.models import (
            Instrument, InstrumentType, InstrumentLocation,
            InstrumentManufacturer, InstrumentSupplier, InstrumentMethod,
        )

        tenant = Tenant.objects.get(schema_name=schema)
        admin = User.objects.filter(role="admin").first() or User.objects.first()
        if not admin:
            raise RuntimeError("No user in demo schema — create an admin first.")

        now = timezone.now()

        # ── Clients (public schema, scoped by tenant FK) ─────────────────────
        clients = []
        for spec in [
            {
                "client_id": "CLI-IDOA-01",
                "name": "Iowa Dept. of Agriculture — Residue Unit",
                "contact_first_name": "Maria",
                "contact_last_name": "Chen",
                "contact_email": "maria.chen@idals.demo",
                "email": "labs@idals.demo",
                "phone": "515-555-0140",
                "physical_address": {
                    "address": "502 E 9th St", "city": "Des Moines",
                    "state": "IA", "zip": "50319", "country": "US",
                },
                "remarks": "Primary agency client for pesticide residue screens.",
                "cc_emails": "",
                "organization_type": "government",
            },
            {
                "client_id": "CLI-GW-02",
                "name": "Cedar Valley Water Authority",
                "contact_first_name": "James",
                "contact_last_name": "Okoye",
                "contact_email": "j.okoye@cvwa.demo",
                "email": "sampling@cvwa.demo",
                "phone": "319-555-0188",
                "physical_address": {
                    "address": "1200 River Rd", "city": "Cedar Rapids",
                    "state": "IA", "zip": "52401", "country": "US",
                },
                "remarks": "Groundwater and drinking-water compliance samples.",
                "cc_emails": "",
                "organization_type": "utility",
            },
            {
                "client_id": "CLI-FORM-03",
                "name": "Prairie Ag Formulations LLC",
                "contact_first_name": "Anita",
                "contact_last_name": "Patel",
                "contact_email": "a.patel@prairieag.demo",
                "email": "qc@prairieag.demo",
                "phone": "641-555-0162",
                "physical_address": {
                    "address": "88 Industrial Blvd", "city": "Ames",
                    "state": "IA", "zip": "50010", "country": "US",
                },
                "remarks": "Formulation and finished-product assay submissions.",
                "cc_emails": "",
                "organization_type": "commercial",
            },
        ]:
            c, _ = Client.objects.update_or_create(
                client_id=spec["client_id"],
                defaults={**spec, "tenant": tenant, "is_active": True, "address": "", "contact_person": ""},
            )
            clients.append(c)

        # ── Sample types + retention (TC-9) ──────────────────────────────────
        type_specs = [
            ("Groundwater", "GW", 30, "Well / aquifer water for inorganic + VOC screens"),
            ("Crop Residue", "RES", 14, "Plant tissue / produce for pesticide residues"),
            ("Formulation", "FRM", 60, "Agrochemical formulation concentrates"),
        ]
        sample_types = {}
        for name, prefix, retention, desc in type_specs:
            st, _ = SampleType.objects.update_or_create(
                name=name,
                defaults={
                    "prefix": prefix,
                    "retention_days": retention,
                    "description": desc,
                    "is_active": True,
                },
            )
            sample_types[name] = st

        # Sample Types admin page lists SENAITE as source of truth — mirror demo types there.
        senaite_types = self._ensure_senaite_sample_types(
            [(name, prefix, desc) for name, prefix, _ret, desc in type_specs]
        )

        # ── Methods + tests (TC-6 import codes) ───────────────────────────────
        method_specs = [
            ("EPA 200.8", "EPA-200.8", "ICP-MS metals in water"),
            ("AOAC 2007.01", "AOAC-2007.01", "QuEChERS pesticide residues"),
            ("CIPAC MT 184", "CIPAC-MT184", "Active ingredient assay — formulations"),
        ]
        methods = {}
        for name, code, desc in method_specs:
            m, _ = Method.objects.update_or_create(
                code=code,
                defaults={
                    "name": name,
                    "description": desc,
                    "is_active": True,
                    "accredited": True,
                    "instructions": f"Standard procedure for {name}.",
                },
            )
            methods[code] = m

        service_specs = [
            ("AS-ICPMS", "Arsenic (ICP-MS)", "µg/L", "EPA-200.8"),
            ("PB-ICPMS", "Lead (ICP-MS)", "µg/L", "EPA-200.8"),
            ("GLY-RES", "Glyphosate Residue", "mg/kg", "AOAC-2007.01"),
            ("ATZ-RES", "Atrazine Residue", "mg/kg", "AOAC-2007.01"),
            ("AI-ASSAY", "Active Ingredient Assay", "%", "CIPAC-MT184"),
            ("PH-FORM", "Formulation pH", "pH", "CIPAC-MT184"),
        ]
        services = self._ensure_senaite_analysis_services(service_specs)
        for code, name, _unit, method_code in service_specs:
            if code not in services:
                services[code] = {"uid": f"demo-svc-{code}", "name": name}
                self.stderr.write(
                    self.style.WARNING(f"SENAITE service '{code}' missing — using local fallback UID.")
                )

        # ── Instruments (TC-6 multi-instrument) ───────────────────────────────
        itype_icp, _ = InstrumentType.objects.get_or_create(name="ICP-MS", defaults={"description": "Inductively coupled plasma mass spectrometry"})
        itype_gc, _ = InstrumentType.objects.get_or_create(name="GC-MS/MS", defaults={"description": "Gas chromatography tandem MS"})
        itype_hplc, _ = InstrumentType.objects.get_or_create(name="HPLC", defaults={"description": "High-performance liquid chromatography"})
        loc_metals, _ = InstrumentLocation.objects.get_or_create(name="Metals Lab — Bench 3")
        loc_org, _ = InstrumentLocation.objects.get_or_create(name="Organics Lab — Room B12")
        mfr_ag, _ = InstrumentManufacturer.objects.get_or_create(name="Agilent Technologies")
        mfr_thermo, _ = InstrumentManufacturer.objects.get_or_create(name="Thermo Fisher Scientific")
        sup_vwr, _ = InstrumentSupplier.objects.get_or_create(name="VWR International")

        inst_a, _ = Instrument.objects.update_or_create(
            instrument_id="INST-DEMO-ICPMS-01",
            defaults={
                "name": "Agilent 7900 ICP-MS",
                "model": "7900",
                "manufacturer": "Agilent Technologies",
                "manufacturer_org": mfr_ag,
                "supplier": "VWR International",
                "supplier_org": sup_vwr,
                "serial_number": "JP-7900-44821",
                "asset_number": "AST-ICP-221",
                "instrument_type": itype_icp,
                "instrument_location": loc_metals,
                "location": "Metals Lab — Bench 3",
                "status": "active",
                "installation_date": date(2022, 3, 15),
                "import_data_interface": "GenericCSV",
                "data_interface": "GenericCSV",
                "result_files_folder": "GenericCSV|/data/instruments/icpms/inbox",
                "next_calibration": date.today() + timedelta(days=45),
                "notes": "Primary metals instrument for groundwater screens (TC-6 instrument A).",
            },
        )
        inst_b, _ = Instrument.objects.update_or_create(
            instrument_id="INST-DEMO-GCMS-02",
            defaults={
                "name": "Thermo TSQ 9610 GC-MS/MS",
                "model": "TSQ 9610",
                "manufacturer": "Thermo Fisher Scientific",
                "manufacturer_org": mfr_thermo,
                "supplier": "VWR International",
                "supplier_org": sup_vwr,
                "serial_number": "TF-9610-77301",
                "asset_number": "AST-GC-118",
                "instrument_type": itype_gc,
                "instrument_location": loc_org,
                "location": "Organics Lab — Room B12",
                "status": "active",
                "installation_date": date(2023, 6, 1),
                "import_data_interface": "GenericCSV",
                "data_interface": "GenericCSV",
                "result_files_folder": "GenericCSV|/data/instruments/gcms/inbox",
                "next_calibration": date.today() + timedelta(days=20),
                "notes": "Residue organics instrument (TC-6 instrument B).",
            },
        )
        Instrument.objects.update_or_create(
            instrument_id="INST-DEMO-HPLC-03",
            defaults={
                "name": "Agilent 1260 Infinity II HPLC",
                "model": "1260 Infinity II",
                "manufacturer": "Agilent Technologies",
                "manufacturer_org": mfr_ag,
                "supplier": "VWR International",
                "supplier_org": sup_vwr,
                "serial_number": "DE-1260-99214",
                "asset_number": "AST-HPLC-055",
                "instrument_type": itype_hplc,
                "instrument_location": loc_org,
                "location": "Organics Lab — Room B12",
                "status": "active",
                "installation_date": date(2021, 11, 8),
                "import_data_interface": "GenericCSV",
                "next_calibration": date.today() + timedelta(days=90),
                "notes": "Formulation assay HPLC.",
            },
        )

        InstrumentMethod.objects.get_or_create(instrument=inst_a, method=methods["EPA-200.8"])
        InstrumentMethod.objects.get_or_create(instrument=inst_b, method=methods["AOAC-2007.01"])

        # ── Samples across lifecycle (incl. past retention for TC-9) ─────────
        def upsert_sample(**kwargs):
            sid = kwargs.pop("sample_id")
            obj, _ = Sample.objects.update_or_create(sample_id=sid, defaults={**kwargs, "created_by": admin})
            return obj

        past_due = now - timedelta(days=10)
        soon = now + timedelta(days=12)

        s_past = upsert_sample(
            sample_id="DEMO-GW-PAST-001",
            client=clients[1],
            sample_type=sample_types["Groundwater"],
            description="Metal screen complete; past retention — ready for disposal demo (TC-9).",
            collection_date=now - timedelta(days=45),
            received_date=now - timedelta(days=44),
            expiry_date=past_due,
            status="reviewed",  # past due but not terminal — appears in Past Retention
            condition="good",
            priority="medium",
            barcode="BC-DEMO-GW-001",
            contact_name="James Okoye",
            sample_point="Well CV-12 North",
            preservation="HNO3 to pH < 2",
            container_type="HDPE 500 mL",
            storage_location="Freezer F2 / Shelf B / Slot 04",
        )
        s_multi = upsert_sample(
            sample_id="DEMO-RES-MULTI-002",
            client=clients[0],
            sample_type=sample_types["Crop Residue"],
            description="Corn leaf composite for multi-instrument residue + metals confirm (TC-6).",
            collection_date=now - timedelta(days=3),
            received_date=now - timedelta(days=2),
            expiry_date=soon,
            status="in_progress",
            condition="good",
            priority="high",
            barcode="BC-DEMO-RES-002",
            contact_name="Maria Chen",
            sample_point="Field Block 7 — composite",
            preservation="Frozen −20 °C",
            container_type="Whirl-Pak bag",
            storage_location="Freezer F1 / Shelf A / Slot 12",
        )
        s_open = upsert_sample(
            sample_id="DEMO-FRM-OPEN-003",
            client=clients[2],
            sample_type=sample_types["Formulation"],
            description="Herbicide concentrate lot PA-8841 — assay + pH (open worksheet).",
            collection_date=now - timedelta(days=1),
            received_date=now - timedelta(hours=20),
            expiry_date=now + timedelta(days=55),
            status="received",
            condition="good",
            priority="medium",
            barcode="BC-DEMO-FRM-003",
            contact_name="Anita Patel",
            sample_point="Production Tank T-3",
            preservation="Ambient",
            container_type="Amber glass 100 mL",
        )
        s_logged = upsert_sample(
            sample_id="DEMO-GW-LOG-004",
            client=clients[1],
            sample_type=sample_types["Groundwater"],
            description="Routine quarterly well screen — logged, awaiting receipt.",
            collection_date=now - timedelta(hours=6),
            received_date=None,
            expiry_date=now + timedelta(days=30),
            status="registered",
            condition="good",
            priority="low",
            barcode="BC-DEMO-GW-004",
            contact_name="James Okoye",
            sample_point="Well CV-19 East",
            preservation="HNO3 to pH < 2",
            container_type="HDPE 500 mL",
        )

        # CoC events
        for action, sample, notes in [
            ("collected", s_past, "Field collection by CVWA crew"),
            ("received", s_past, "Logged into LIMS"),
            ("analysed", s_past, "ICP-MS metals completed"),
            ("collected", s_multi, "IDOA field team"),
            ("received", s_multi, "Received cold chain intact"),
            ("collected", s_open, "Batch retain from tank T-3"),
            ("received", s_open, "Received at receiving dock"),
        ]:
            if not ChainOfCustody.objects.filter(sample=sample, action=action, notes=notes).exists():
                ChainOfCustody.objects.create(
                    sample=sample, action=action, notes=notes,
                    transferred_by=admin, condition="intact",
                    from_location="", to_location=sample.storage_location or "Lab receiving",
                )

        # ── Analysis requests + worksheet assignments (TC-6 import needs these) ─
        def upsert_ar(ar_id, sample, service_codes, status="in_progress"):
            ar, _ = AnalysisRequest.objects.update_or_create(
                ar_id=ar_id,
                defaults={
                    "sample": sample,
                    "status": status,
                    "priority": "high" if sample.priority == "high" else "normal",
                    "due_date": sample.expiry_date,
                    "notes": "Demo AR for RFP dry-run",
                    "created_by": admin,
                },
            )
            wanted_uids = {services[c]["uid"] for c in service_codes}
            AnalysisRequestAnalysis.objects.filter(analysis_request=ar).exclude(
                senaite_service_uid__in=wanted_uids,
            ).delete()
            for code in service_codes:
                svc = services[code]
                AnalysisRequestAnalysis.objects.get_or_create(
                    analysis_request=ar,
                    senaite_service_uid=svc["uid"],
                    defaults={"senaite_service_name": svc["name"]},
                )
            return ar

        ar_multi = upsert_ar("AR-DEMO-MULTI-002", s_multi, ["AS-ICPMS", "PB-ICPMS", "GLY-RES", "ATZ-RES"])
        ar_open = upsert_ar("AR-DEMO-FRM-003", s_open, ["AI-ASSAY", "PH-FORM"], status="pending")
        ar_past = upsert_ar("AR-DEMO-GW-001", s_past, ["AS-ICPMS", "PB-ICPMS"], status="completed")

        ws, _ = Worksheet.objects.update_or_create(
            ws_id="WS-DEMO-RFP-001",
            defaults={"analyst": admin, "status": "in_progress"},
        )

        for ar, codes in [(ar_multi, ["AS-ICPMS", "PB-ICPMS", "GLY-RES", "ATZ-RES"]),
                          (ar_open, ["AI-ASSAY", "PH-FORM"])]:
            for code in codes:
                svc = services[code]
                WorksheetAssignment.objects.get_or_create(
                    worksheet=ws,
                    analysis_request=ar,
                    senaite_service_uid=svc["uid"],
                    defaults={"senaite_service_name": svc["name"]},
                )

        # ── QC samples (TC-5) ────────────────────────────────────────────────
        qc_fail, _ = QCSample.objects.update_or_create(
            qc_id="QC-DEMO-CTRL-FAIL",
            defaults={
                "qc_type": "control",
                "senaite_service_uid": services["AS-ICPMS"]["uid"],
                "senaite_service_name": services["AS-ICPMS"]["name"],
                "worksheet": ws,
                "lot_number": "CTRL-AS-2409",
                "expiry_date": date.today() + timedelta(days=180),
                "target_value": Decimal("100.0000"),
                "tolerance_percent": Decimal("5.00"),
                "actual_value": Decimal("120.0000"),  # fails ±5%
                "notes": "Control breach for admin review demo (TC-5).",
                "run_by": admin,
                "run_at": now,
                "is_reviewed": False,
            },
        )
        QCSample.objects.update_or_create(
            qc_id="QC-DEMO-CTRL-PASS",
            defaults={
                "qc_type": "control",
                "senaite_service_uid": services["PB-ICPMS"]["uid"],
                "senaite_service_name": services["PB-ICPMS"]["name"],
                "worksheet": ws,
                "lot_number": "CTRL-PB-2409",
                "expiry_date": date.today() + timedelta(days=180),
                "target_value": Decimal("50.0000"),
                "tolerance_percent": Decimal("10.00"),
                "actual_value": Decimal("48.5000"),
                "notes": "In-control lead standard.",
                "run_by": admin,
                "run_at": now,
                "is_reviewed": False,
            },
        )
        QCSample.objects.update_or_create(
            qc_id="QC-DEMO-BLANK-01",
            defaults={
                "qc_type": "blank",
                "senaite_service_uid": services["AS-ICPMS"]["uid"],
                "senaite_service_name": services["AS-ICPMS"]["name"],
                "worksheet": ws,
                "lot_number": "BLK-REAG-01",
                "target_value": Decimal("0.0000"),
                "tolerance_percent": Decimal("0.00"),
                "actual_value": Decimal("0.02"),
                "notes": "Method blank — near LOD.",
                "run_by": admin,
                "run_at": now,
            },
        )

        # Force save so status auto-evaluates for fail row if update_or_create skipped save logic
        qc_fail.actual_value = Decimal("120.0000")
        qc_fail.target_value = Decimal("100.0000")
        qc_fail.tolerance_percent = Decimal("5.00")
        qc_fail.save()

        # ── Demo CSV templates with real IDs for TC-6 ────────────────────────
        self._write_import_csvs(s_multi.sample_id)

        return {
            "schema": schema,
            "clients": len(clients),
            "sample_types": len(sample_types),
            "senaite_sample_types": senaite_types,
            "tests": len(services),
            "instruments": Instrument.objects.filter(instrument_id__startswith="INST-DEMO-").count(),
            "samples": Sample.objects.filter(sample_id__startswith="DEMO-").count(),
            "qc_failed": qc_fail.qc_id,
            "past_retention_sample": s_past.sample_id,
            "tc6_sample": s_multi.sample_id,
            "import_csv": "xellabs-frontend/public/demo/tc6-instrument-{a,b}.csv",
        }

    def _ensure_senaite_sample_types(self, specs: list[tuple[str, str, str]]) -> int:
        """Create missing SampleType objects in SENAITE (Admin UI source of truth)."""
        import base64
        import os

        import requests as http_requests
        from django.conf import settings

        base = getattr(settings, "SENAITE_URL", os.getenv("SENAITE_URL", "http://senaite:8080/senaite")).rstrip("/")
        user = os.getenv("SENAITE_ADMIN_USER", "admin")
        password = os.getenv("SENAITE_ADMIN_PASS", "admin")
        auth = base64.b64encode(f"{user}:{password}".encode()).decode()
        headers = {"Authorization": f"Basic {auth}", "Accept": "application/json", "Content-Type": "application/json"}

        try:
            existing_res = http_requests.get(
                f"{base}/@@API/senaite/v1/SampleType",
                headers=headers,
                params={"complete": "true", "limit": 1000},
                timeout=15,
            )
            existing_res.raise_for_status()
            existing_titles = {
                (item.get("title") or "").strip().lower()
                for item in (existing_res.json().get("items") or [])
            }
        except Exception as exc:
            self.stderr.write(self.style.WARNING(f"SENAITE sample types list failed: {exc}"))
            return 0

        created = 0
        for name, prefix, desc in specs:
            if name.strip().lower() in existing_titles:
                continue
            try:
                res = http_requests.post(
                    f"{base}/@@API/senaite/v1/create",
                    headers=headers,
                    json={
                        "portal_type": "SampleType",
                        "parent_path": "/senaite/setup/sampletypes",
                        "title": name,
                        "Prefix": prefix,
                        "min_volume": "1 ml",
                        "description": desc,
                    },
                    timeout=15,
                )
                if res.ok:
                    created += 1
                    existing_titles.add(name.strip().lower())
                else:
                    self.stderr.write(
                        self.style.WARNING(f"SENAITE create '{name}' failed: {res.status_code} {res.text[:200]}")
                    )
            except Exception as exc:
                self.stderr.write(self.style.WARNING(f"SENAITE create '{name}' error: {exc}"))
        return created

    def _ensure_senaite_analysis_services(
        self, specs: list[tuple[str, str, str, str]]
    ) -> dict[str, dict[str, str]]:
        """Ensure demo AnalysisServices exist in SENAITE; return keyword → {uid, name}."""
        import base64
        import os

        import requests as http_requests
        from django.conf import settings

        base = getattr(settings, "SENAITE_URL", os.getenv("SENAITE_URL", "http://senaite:8080/senaite")).rstrip("/")
        user = os.getenv("SENAITE_ADMIN_USER", "admin")
        password = os.getenv("SENAITE_ADMIN_PASS", "admin")
        auth = base64.b64encode(f"{user}:{password}".encode()).decode()
        headers = {"Authorization": f"Basic {auth}", "Accept": "application/json", "Content-Type": "application/json"}
        site_path = "/senaite" if settings.DEBUG else ""

        try:
            existing_res = http_requests.get(
                f"{base}/@@API/senaite/v1/AnalysisService",
                headers=headers,
                params={"complete": "true", "limit": 1000},
                timeout=15,
            )
            existing_res.raise_for_status()
            by_keyword: dict[str, dict[str, str]] = {}
            for item in existing_res.json().get("items") or []:
                keyword = (item.get("Keyword") or "").strip()
                if keyword:
                    by_keyword[keyword] = {
                        "uid": item.get("uid") or item.get("UID") or "",
                        "name": (item.get("title") or "").strip(),
                    }
        except Exception as exc:
            self.stderr.write(self.style.WARNING(f"SENAITE analysis services list failed: {exc}"))
            return {}

        for code, name, unit, _method_code in specs:
            if code in by_keyword and by_keyword[code]["uid"]:
                continue
            try:
                res = http_requests.post(
                    f"{base}/@@API/senaite/v1/create",
                    headers=headers,
                    json={
                        "portal_type": "AnalysisService",
                        "parent_path": f"{site_path}/bika_setup/bika_analysisservices",
                        "title": name,
                        "Keyword": code,
                        "Unit": unit,
                        "description": f"Demo analysis for {name}",
                    },
                    timeout=15,
                )
                if not res.ok:
                    self.stderr.write(
                        self.style.WARNING(f"SENAITE create service '{code}' failed: {res.status_code} {res.text[:200]}")
                    )
            except Exception as exc:
                self.stderr.write(self.style.WARNING(f"SENAITE create service '{code}' error: {exc}"))

            # Re-fetch — create may succeed even when response body errors (SENAITE quirk).
            try:
                verify = http_requests.get(
                    f"{base}/@@API/senaite/v1/AnalysisService",
                    headers=headers,
                    params={"complete": "true", "limit": 1000},
                    timeout=15,
                )
                verify.raise_for_status()
                for item in verify.json().get("items") or []:
                    keyword = (item.get("Keyword") or "").strip()
                    if keyword == code:
                        by_keyword[code] = {
                            "uid": item.get("uid") or item.get("UID") or "",
                            "name": (item.get("title") or name).strip(),
                        }
                        break
            except Exception as exc:
                self.stderr.write(self.style.WARNING(f"SENAITE verify service '{code}' failed: {exc}"))

        return by_keyword

    def _write_import_csvs(self, sample_id: str):
        """Overwrite frontend demo CSVs with live sample_id + test codes."""
        root = Path(__file__).resolve().parents[4] / "xellabs-frontend" / "public" / "demo"
        # In Docker the app lives at /app — public demo may not be mounted there.
        # Prefer repo path via env or write both candidates.
        candidates = [
            root,
            Path("/workspace/xellabs-frontend/public/demo"),
            Path("/app/../xellabs-frontend/public/demo"),
        ]
        # Host bind: compose usually mounts backend only; write under media/demo as fallback
        media_fallback = Path("/app/media/demo")
        written = False
        a_rows = (
            "sample_id,test_code,value,unit,flags\n"
            f"{sample_id},AS-ICPMS,3.2,µg/L,\n"
            f"{sample_id},PB-ICPMS,1.1,µg/L,\n"
        )
        b_rows = (
            "sample_id,test_code,value,unit,flags\n"
            f"{sample_id},GLY-RES,0.042,mg/kg,\n"
            f"{sample_id},ATZ-RES,0.018,mg/kg,\n"
        )
        for base in candidates + [media_fallback]:
            try:
                base.mkdir(parents=True, exist_ok=True)
                (base / "tc6-instrument-a.csv").write_text(a_rows, encoding="utf-8")
                (base / "tc6-instrument-b.csv").write_text(b_rows, encoding="utf-8")
                self.stdout.write(f"  Wrote TC-6 CSVs under {base}")
                written = True
                break
            except OSError:
                continue
        if not written:
            self.stdout.write(self.style.WARNING("Could not write TC-6 CSV files to a writable path."))

"""
Instrument file parsers and result mappers.
Supports CSV and XML file formats.

Each parser returns a list of dicts:
  [{"sample_id": str, "test_code": str, "value": str, "unit": str, "flags": str}, ...]

Exceptions are collected per-row and returned alongside successes — no silent failure.
"""
import csv
import io
import logging
import xml.etree.ElementTree as ET

logger = logging.getLogger(__name__)


class ParseError(Exception):
    """A non-fatal per-row parse error — collected and reported in the audit log."""
    def __init__(self, row_number, detail):
        self.row_number = row_number
        self.detail = detail
        super().__init__(f"Row {row_number}: {detail}")


def _build_sample_cache(sample_ids: set) -> dict:
    """Resolve samples by sample_id, senaite_ar_id, or barcode — the UI displays
    the SENAITE-style id as "the" Sample ID (see app/lib/sampleDisplay.ts), so an
    instrument's own export (or a user typing what's on screen) will routinely
    reference that one, not Django's own internal sample_id. Confirmed live: a
    real instrument export used the SENAITE id ("SO-0002") and every row failed
    with "Sample not found" under a sample_id-only lookup. Same 3-way resolution
    chain_of_custody's lookup and inventory/views.py's
    _resolve_canonical_sample_id() already use."""
    from django.db.models import Q
    from lims.models import Sample

    cache: dict = {}
    matches = Sample.objects.filter(
        Q(sample_id__in=sample_ids) | Q(senaite_ar_id__in=sample_ids) | Q(barcode__in=sample_ids)
    )
    for s in matches:
        for key in (s.sample_id, s.senaite_ar_id, s.barcode):
            if key:
                cache[key] = s
    return cache


def parse_csv(file_content: bytes) -> tuple[list[dict], list[dict]]:
    """
    Parse a CSV instrument export.
    Expected columns (case-insensitive): sample_id, test_code, value, unit, flags
    Returns (rows, errors) where errors = [{"row": int, "detail": str}]
    """
    rows, errors = [], []
    try:
        text = file_content.decode("utf-8-sig")  # handle BOM
    except UnicodeDecodeError:
        text = file_content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return [], [{"row": 0, "detail": "Empty or unreadable CSV file."}]

    # Normalize header names
    header_map = {h.strip().lower(): h for h in reader.fieldnames}
    required = {"sample_id", "test_code", "value"}
    missing = required - set(header_map.keys())
    if missing:
        return [], [{"row": 0, "detail": f"Missing required columns: {missing}"}]

    for i, raw_row in enumerate(reader, start=2):
        row = {k.strip().lower(): (v or "").strip() for k, v in raw_row.items()}
        if not row.get("sample_id") or not row.get("test_code"):
            errors.append({"row": i, "detail": "sample_id and test_code are required."})
            continue
        rows.append({
            "sample_id": row["sample_id"],
            "test_code": row["test_code"],
            "value": row.get("value", ""),
            "unit": row.get("unit", ""),
            "flags": row.get("flags", ""),
        })

    return rows, errors


def parse_xml(file_content: bytes) -> tuple[list[dict], list[dict]]:
    """
    Parse an XML instrument export.
    Expected schema:
      <Results>
        <Result>
          <SampleId>...</SampleId>
          <TestCode>...</TestCode>
          <Value>...</Value>
          <Unit>...</Unit>
          <Flags>...</Flags>
        </Result>
      </Results>
    """
    rows, errors = [], []
    try:
        root = ET.fromstring(file_content)
    except ET.ParseError as e:
        return [], [{"row": 0, "detail": f"XML parse error: {e}"}]

    result_elements = root.findall(".//Result")
    if not result_elements:
        return [], [{"row": 0, "detail": "No <Result> elements found in XML."}]

    for i, elem in enumerate(result_elements, start=1):
        def get(tag):
            child = elem.find(tag)
            return (child.text or "").strip() if child is not None else ""

        sample_id = get("SampleId")
        test_code = get("TestCode")
        if not sample_id or not test_code:
            errors.append({"row": i, "detail": "SampleId and TestCode are required."})
            continue
        rows.append({
            "sample_id": sample_id,
            "test_code": test_code,
            "value": get("Value"),
            "unit": get("Unit"),
            "flags": get("Flags"),
        })

    return rows, errors


# ── Parser registry (Strategy / Adapter) ──────────────────────────────────────
# Keyed by Instrument.import_data_interface. Vendor parsers (Shimadzu / Agilent /
# Thermo per IDOA B.4) register here without touching the view layer.

ParserFn = callable  # (bytes) -> tuple[list[dict], list[dict]]

_PARSER_REGISTRY: dict[str, dict[str, ParserFn]] = {
    # interface_code → {file_format → parser}
    "generic": {"csv": parse_csv, "xml": parse_xml},
    # Placeholders: until vendor parsers land, fall through to generic via resolve.
    "shimadzu": {},
    "agilent": {},
    "thermo": {},
}


def register_parser(interface_code: str, file_format: str, parser: ParserFn) -> None:
    """Register or replace a vendor parser. Safe to call from AppConfig.ready()."""
    code = (interface_code or "generic").strip().lower()
    fmt = (file_format or "csv").strip().lower()
    _PARSER_REGISTRY.setdefault(code, {})[fmt] = parser


def resolve_parser(interface_code: str | None, file_format: str = "csv") -> ParserFn:
    """
    Resolve the parser for an instrument's import_data_interface.
    Unknown / empty interface → generic. Missing format for a vendor → generic same format.
    """
    code = (interface_code or "").strip().lower() or "generic"
    # Allow comma-separated interfaces (Instrument.import_data_interface stores that);
    # use the first known code.
    for part in code.split(","):
        part = part.strip()
        if not part:
            continue
        parsers = _PARSER_REGISTRY.get(part)
        if parsers and file_format in parsers:
            return parsers[file_format]
        if parsers:
            break
    generic = _PARSER_REGISTRY["generic"]
    return generic.get(file_format, parse_csv)


def parse_instrument_file(
    file_content: bytes,
    *,
    file_format: str = "csv",
    interface_code: str | None = None,
) -> tuple[list[dict], list[dict]]:
    """Single entrypoint used by preview + apply_import."""
    parser = resolve_parser(interface_code, file_format)
    return parser(file_content)


def _fetch_senaite_services_by_keyword() -> dict:
    """Live SENAITE AnalysisServices keyed by Keyword (the instrument-file
    test code) — replaces the old Django Test.code lookup now that SENAITE
    is the sole source of truth for analyses."""
    import base64
    import requests as http_requests
    from django.conf import settings

    token = base64.b64encode(f"{settings.SENAITE_USER}:{settings.SENAITE_PASSWORD}".encode()).decode()
    try:
        resp = http_requests.get(
            f"{settings.SENAITE_URL}/@@API/senaite/v1/AnalysisService",
            headers={"Authorization": f"Basic {token}"},
            params={"complete": "yes", "b_size": 1000},
            timeout=8,
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])
    except Exception:
        logger.exception("Could not reach SENAITE to resolve analysis services for instrument import.")
        return {}
    return {
        (svc.get("Keyword") or "").strip(): {"uid": svc.get("uid", ""), "title": (svc.get("title") or "").strip()}
        for svc in items if svc.get("Keyword")
    }


def map_results(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """
    Map parsed rows to existing Sample database objects and live SENAITE
    analysis services (matched by Keyword/test_code). Samples resolved by
    sample_id, senaite_ar_id, or barcode — see _build_sample_cache().
    Returns (mapped, errors) where mapped rows have sample_pk,
    senaite_service_uid, senaite_service_name added.
    """
    mapped, errors = [], []
    sample_cache = _build_sample_cache({r["sample_id"] for r in rows})
    service_cache = _fetch_senaite_services_by_keyword()

    for i, row in enumerate(rows, start=1):
        sample = sample_cache.get(row["sample_id"])
        if not sample:
            errors.append({"row": i, "detail": f"Sample '{row['sample_id']}' not found."})
            continue
        service = service_cache.get(row["test_code"])
        if not service:
            errors.append({"row": i, "detail": f"Test code '{row['test_code']}' not found."})
            continue
        mapped.append({
            **row, "sample_pk": sample.pk,
            "senaite_service_uid": service["uid"], "senaite_service_name": service["title"],
        })

    return mapped, errors


def build_preview(rows: list[dict], parse_errors: list[dict]) -> tuple[list[dict], dict]:
    """
    Validate parsed rows against the database without writing anything.

    A row is "valid" (it will create or refresh a Result on commit) when its
    sample and test both exist, an open worksheet assignment links them, and
    any existing Result is still pending (or absent).

    Rows with an already submitted/verified/rejected Result are status "skip"
    so the analyst sees the no-overwrite guard before confirming.

    Returns (preview_rows, summary) where summary = {total, valid, invalid, skipped}.
    """
    from lims.models import WorksheetAssignment, Result

    sample_ids = {r["sample_id"] for r in rows}
    sample_cache = _build_sample_cache(sample_ids)
    service_cache = _fetch_senaite_services_by_keyword()
    # Resolved to canonical sample_id here (not the raw CSV/XML id, which may be
    # a senaite_ar_id/barcode) so the membership check below lines up correctly.
    canonical_ids = {s.sample_id for s in sample_cache.values()}
    assignments = list(
        WorksheetAssignment.objects.filter(
            analysis_request__sample__sample_id__in=canonical_ids,
        ).select_related("analysis_request__sample")
    )
    assignment_pairs = {
        (a.analysis_request.sample.sample_id, a.senaite_service_uid): a for a in assignments
    }
    existing_by_wa = {
        r.worksheet_assignment_id: r
        for r in Result.objects.filter(worksheet_assignment__in=assignments)
    }

    preview: list[dict] = []

    for err in parse_errors:
        preview.append({
            "row": err.get("row", 0),
            "sample_id": "", "test_code": "", "value": "", "unit": "", "flags": "",
            "test_name": "", "sample_status": "",
            "status": "error", "detail": err.get("detail", "Could not parse row."),
        })

    for i, row in enumerate(rows, start=1):
        base = {
            "row": i,
            "sample_id": row["sample_id"], "test_code": row["test_code"],
            "value": row["value"], "unit": row["unit"], "flags": row["flags"],
            "test_name": "", "sample_status": "",
        }
        sample = sample_cache.get(row["sample_id"])
        if not sample:
            preview.append({**base, "status": "error", "detail": f"Sample '{row['sample_id']}' not found."})
            continue
        service = service_cache.get(row["test_code"])
        if not service:
            preview.append({**base, "status": "error", "detail": f"Test code '{row['test_code']}' not found."})
            continue
        base["test_name"] = service["title"]
        base["sample_status"] = sample.status
        wa = assignment_pairs.get((sample.sample_id, service["uid"]))
        if not wa:
            preview.append({**base, "status": "error",
                            "detail": "No open worksheet assignment for this sample and test."})
            continue
        existing = existing_by_wa.get(wa.pk)
        if existing and existing.status != "pending":
            preview.append({
                **base,
                "status": "skip",
                "detail": f"Result already {existing.status}, will not overwrite.",
            })
            continue
        preview.append({**base, "status": "valid", "detail": ""})

    valid = sum(1 for p in preview if p["status"] == "valid")
    skipped = sum(1 for p in preview if p["status"] == "skip")
    invalid = sum(1 for p in preview if p["status"] == "error")
    summary = {
        "total": len(preview),
        "valid": valid,
        "invalid": invalid,
        "skipped": skipped,
    }
    return preview, summary


def build_provenance_map(sample_id: str) -> dict:
    """
    Reconstruct per-test instrument provenance for one sample from the backed-up
    original import files. The most recent processed import wins for a given test,
    matching the "latest value applied" behaviour of the commit step.

    Keyed by senaite_service_uid (not the raw CSV/XML test_code keyword) so it
    lines up with WorksheetAssignment.senaite_service_uid — the only test
    identifier stored on that model since the Django Test model was removed.

    Returns {senaite_service_uid: {instrument_name, instrument_code, import_date,
    file_format, import_id}}.
    """
    from .models import InstrumentResultImport

    service_cache = _fetch_senaite_services_by_keyword()
    provenance: dict[str, dict] = {}
    imports = (
        InstrumentResultImport.objects
        .filter(status="processed")
        .select_related("instrument")
        .order_by("created_at")
    )
    for imp in imports:
        try:
            content = imp.file.read()
            imp.file.close()
        except (FileNotFoundError, ValueError, OSError):
            continue
        rows, _ = parse_xml(content) if imp.file_format == "xml" else parse_csv(content)
        for row in rows:
            if row["sample_id"] != sample_id:
                continue
            service = service_cache.get(row["test_code"])
            if not service:
                continue
            provenance[service["uid"]] = {
                "instrument_name": imp.instrument.name,
                "instrument_code": imp.instrument.instrument_id,
                "import_date": imp.created_at.isoformat(),
                "file_format": imp.file_format,
                "import_id": imp.pk,
            }
    return provenance

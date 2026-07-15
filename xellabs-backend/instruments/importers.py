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
    analysis services (matched by Keyword/test_code).
    Returns (mapped, errors) where mapped rows have sample_pk,
    senaite_service_uid, senaite_service_name added.
    """
    from lims.models import Sample

    mapped, errors = [], []
    # Build lookup caches
    sample_cache = {s.sample_id: s for s in Sample.objects.filter(
        sample_id__in={r["sample_id"] for r in rows}
    )}
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

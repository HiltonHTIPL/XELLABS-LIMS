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


def map_results(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """
    Map parsed rows to existing Sample + Test database objects.
    Returns (mapped, errors) where mapped rows have sample_pk, test_pk added.
    """
    from lims.models import Sample, Test

    mapped, errors = [], []
    # Build lookup caches
    sample_cache = {s.sample_id: s for s in Sample.objects.filter(
        sample_id__in={r["sample_id"] for r in rows}
    )}
    test_cache = {t.code: t for t in Test.objects.filter(
        code__in={r["test_code"] for r in rows}
    )}

    for i, row in enumerate(rows, start=1):
        sample = sample_cache.get(row["sample_id"])
        if not sample:
            errors.append({"row": i, "detail": f"Sample '{row['sample_id']}' not found."})
            continue
        test = test_cache.get(row["test_code"])
        if not test:
            errors.append({"row": i, "detail": f"Test code '{row['test_code']}' not found."})
            continue
        mapped.append({**row, "sample_pk": sample.pk, "test_pk": test.pk})

    return mapped, errors

"""
Shared file-parsing helper for master-data import (management commands + API view).
Supports both .xlsx and .csv.
"""
import csv
import io

import openpyxl


def _normalize_rows(header_row: list, data_rows: list, required_columns: set) -> list[tuple[int, dict]]:
    header = [str(c).strip().lower() if c else "" for c in header_row]
    if not required_columns.issubset(set(header)):
        raise ValueError(f"Missing required column(s). Header row must include: {required_columns}")

    col_idx = {name: i for i, name in enumerate(header)}
    result = []
    for row_num, row in enumerate(data_rows, start=2):
        row_dict = {}
        for col, idx in col_idx.items():
            if not col:
                continue
            val = row[idx] if idx < len(row) else None
            row_dict[col] = str(val).strip() if val is not None and str(val).strip() != "" else None
        result.append((row_num, row_dict))
    return result


def _read_xlsx_rows(file_obj, required_columns: set) -> list[tuple[int, dict]]:
    try:
        wb = openpyxl.load_workbook(file_obj, data_only=True)
    except Exception as exc:
        raise ValueError(f"Could not open Excel file: {exc}")

    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise ValueError("Excel file is empty.")

    return _normalize_rows(list(rows[0]), [list(r) for r in rows[1:]], required_columns)


def _read_csv_rows(file_obj, required_columns: set) -> list[tuple[int, dict]]:
    raw = file_obj.read()
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8-sig")
    reader = list(csv.reader(io.StringIO(raw)))
    if not reader:
        raise ValueError("CSV file is empty.")

    return _normalize_rows(reader[0], reader[1:], required_columns)


def read_excel_rows(file_obj, required_columns: set, filename: str | None = None) -> list[tuple[int, dict]]:
    """
    Read an .xlsx or .csv file-like object and return a list of (row_number, row_dict)
    tuples. row_dict keys are lower-cased header names; values are stripped strings
    (or None). Raises ValueError if the file is empty or missing a required column.

    File type is detected from `filename`'s extension when given (API uploads carry
    their original name); falls back to sniffing the file_obj's own `.name` attribute
    (management commands open a real file path), then defaults to xlsx.
    """
    name = filename or getattr(file_obj, "name", "") or ""
    if name.lower().endswith(".csv"):
        return _read_csv_rows(file_obj, required_columns)
    return _read_xlsx_rows(file_obj, required_columns)

"""
Shared Excel-parsing helper for master-data import (management commands + API view).
"""
import openpyxl


def read_excel_rows(file_obj, required_columns: set) -> list[tuple[int, dict]]:
    """
    Read an .xlsx file-like object and return a list of (row_number, row_dict) tuples.
    row_dict keys are lower-cased header names; values are stripped strings (or None).
    Raises ValueError if the file is empty or missing a required column.
    """
    try:
        wb = openpyxl.load_workbook(file_obj, data_only=True)
    except Exception as exc:
        raise ValueError(f"Could not open Excel file: {exc}")

    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise ValueError("Excel file is empty.")

    header = [str(c).strip().lower() if c else "" for c in rows[0]]
    if not required_columns.issubset(set(header)):
        raise ValueError(f"Missing required column(s). Header row must include: {required_columns}")

    col_idx = {name: i for i, name in enumerate(header)}
    result = []
    for row_num, row in enumerate(rows[1:], start=2):
        row_dict = {}
        for col, idx in col_idx.items():
            if not col:
                continue
            val = row[idx] if idx < len(row) else None
            row_dict[col] = str(val).strip() if val is not None else None
        result.append((row_num, row_dict))
    return result

"""
Bulk-import Storage Locations into SENAITE from an Excel (.xlsx) file.

Usage:
    python manage.py import_senaite_storage_locations path/to/storage_locations.xlsx

Expected columns (header row, case-insensitive, order doesn't matter):
    Title       (required) - Storage Location name/title
    Description (optional)
"""
from django.core.management.base import BaseCommand, CommandError

from core.senaite_service import import_storage_location_row
from core.excel_import import read_excel_rows

REQUIRED_COLUMNS = {"title"}


class Command(BaseCommand):
    help = "Bulk-import Storage Locations into SENAITE from an Excel file."

    def add_arguments(self, parser):
        parser.add_argument("excel_file", type=str, help="Path to the .xlsx file")

    def handle(self, *args, **options):
        path = options["excel_file"]
        try:
            with open(path, "rb") as fh:
                rows = read_excel_rows(fh, REQUIRED_COLUMNS)
        except FileNotFoundError:
            raise CommandError(f"File not found: {path}")
        except ValueError as exc:
            raise CommandError(str(exc))

        created, failed, skipped = 0, 0, 0
        for row_num, row in rows:
            if not (row.get("title") or "").strip():
                self.stdout.write(self.style.WARNING(f"Row {row_num}: skipped (no Title)"))
                skipped += 1
                continue

            result = import_storage_location_row(row)
            if result["ok"] is True:
                self.stdout.write(self.style.SUCCESS(
                    f"Row {row_num}: created '{result['title']}' -> uid={result['uid']}"
                ))
                created += 1
            elif result["ok"] is None:
                self.stdout.write(self.style.WARNING(
                    f"Row {row_num}: {result['error']}"
                ))
                skipped += 1
            else:
                self.stdout.write(self.style.ERROR(
                    f"Row {row_num}: failed '{result['title']}' — {result['error']}"
                ))
                failed += 1

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. Created: {created}, Failed: {failed}, Skipped: {skipped}"
        ))

# TC-6 Instrument Data Import + Multi-Instrument Report — Implementation Plan

Status: IMPLEMENTED (gaps closed). Branch: Vinod. Demo task: TC-6 (owner: Vinod).
Decisions locked: engine/pattern = **Django service-layer** matching the team; imported results
flow into the existing analysis/review workflow (not a silent overwrite); full parity with
SENAITE's result-import concept.

Related: mirrors `docs/instruments-workflow-plan.md`. Instrument entity + import UI already built
on branch Vinod.

---

## 1. What TC-6 must demonstrate (RFP)
"Demonstrate how instrument data is backed up and integrated into the sample record, including
pulling results from multiple instruments into one report." Also feeds Data Capture (~22 pts):
capture from acquisition instruments, user-definable import, review of auto-entered results.

## 2. Current state (grounded)
- Parse: `instruments/importers.py` `parse_csv` / `parse_xml` → rows
  `{sample_id, test_code, value, unit, flags}`.
- Apply: `instruments/tasks.py` `apply_import(imp)` — for each row finds the open
  `WorksheetAssignment` (`analysis_request__sample__pk=row["sample_pk"]` + test_code) and does
  `Result.objects.get_or_create(...)`. Guards: "No open worksheet assignment" error; existing
  result → "already {status}, skipped".
- Flow: upload CSV/XML → preview (per-row mapping + validation) → commit → results attach to the
  sample's analyses → import history with **original-file download** (the "backup of record").
- Multi-instrument report: reconstructs per-result instrument provenance from the retained import
  files (Result has no instrument FK, deliberately).

## 3. SENAITE parity (what SENAITE actually does)
- `exportimport/instruments/` — a large tree of **vendor-specific parsers** (Shimadzu GC-MS/ICPE/
  Nexera, Agilent-style, Thermo, etc. — several match IDOA's B.4 equipment).
- `resultsimport.py` `AnalysisResultsImporter.process()` — maps parsed data to the sample's
  analyses, sets results, and moves them into the review path (imported results are not auto-
  verified; they await verification).
- `AutoImportLog` content type — an audit log of every import (which file, which instrument, how
  many results, errors). `InstrumentMultifile` supports multi-file imports.
- Import interface is selected per **Instrument** (`ImportDataInterface` field).

## 4. The gaps vs SENAITE
1. **Generic vs vendor parsers**: we have one generic CSV/XML parser; SENAITE has per-vendor
   parsers keyed to the instrument's selected interface. For the demo, generic + a matched sample
   file is fine; for production, add the interfaces for IDOA's named instruments.
2. **Import log**: we keep the file + an `InstrumentResultImport` row; SENAITE has a first-class
   `AutoImportLog`. Our import history is close; make sure it is auditable (audittrail).
3. **Review workflow**: confirm imported results land in the same review/verification path as
   manually entered results (not a terminal state).
4. **Multi-instrument aggregation**: we reconstruct provenance from files; SENAITE links results to
   the instrument/analysis directly. Our report is acceptable; note the design choice.

## 5. Plan (Django service-layer, matching the team)
1. **Service boundary**: keep the parse→map→apply pipeline in `instruments/tasks.py`
   `apply_import` (already the single choke point used by both the interactive and Celery paths —
   good). Treat it as the service function; do not duplicate the logic in the view.
2. **Instrument interface selection**: use the instrument's `import_data_interface` field to choose
   the parser (generic today). Structure so vendor parsers can register later without touching the
   view (Adapter/Strategy).
3. **Results flow into review**: imported `Result` rows must enter the same status/verification
   workflow as manual results (submit → verify), so they are reviewable — mirror SENAITE. Confirm
   the created Result's initial status routes to review, and that a reviewer can verify/reject.
4. **Import log = audit + backup**: retain the original file (backup of record) + the
   `InstrumentResultImport` row; ensure audittrail logs the import. This is the "backed up" story.
5. **Multi-instrument one report**: the sample report aggregates every analyte result across
   instruments with per-result instrument + method + import date. Keep the file-provenance
   reconstruction; document why (Result has no instrument FK by design).
6. **Guards**: an import cannot overwrite an already-verified result silently (current behavior
   skips + logs — keep and surface it in the preview).

## 6. Execution order
1. Confirm imported results enter the review workflow (not terminal); fix if they don't.
2. Wire parser selection to the instrument's `import_data_interface` (generic default; pluggable).
3. Confirm audittrail logs each import; keep original-file download.
4. Polish the multi-instrument report (instrument/method/import-date columns).
5. Add one IDOA-vendor sample file for a live demo import (optional, for authenticity).

## 7. Definition of done
- Upload a CSV/XML instrument export → preview shows per-row sample/test mapping + skip reasons →
  commit → results attach to the sample's analyses and are **reviewable**.
- Import history lists every import with original-file download (backup).
- One sample's report pulls results from ≥2 instruments into a single printable report.
- Every import is audited. `npx tsc --noEmit` + `python manage.py check` pass.

## 8. Anti-patterns (do NOT do)
- WRONG: import writes results as terminal/verified, bypassing review; silent overwrite of an
  existing verified result; duplicating parse logic in the view.
- RIGHT: results enter the review workflow; existing results are skipped + logged; one
  `apply_import` service is the single path; original file retained + audited.

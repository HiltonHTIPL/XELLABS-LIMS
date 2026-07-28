# Import Buttons — Plan (Phase 2 of Import/Export)

Status: PLAN (awaiting approval per CLAUDE.md §0 before coding)
Follows: Export (done 2026-07-17) — Import reuses the same headers, so an exported CSV is a valid import template.

## Goal
A blue **Import** button **beside New** (top toolbar) on every suitable admin list page.
Upload a CSV/XLSX, bulk-create records through each page's existing create path, report
per-row results. Reuse the existing importer where one already exists; do not duplicate it.

## What already exists (reuse, don't rebuild)
- `master-data-import` page + `useStreamingImport` — already imports **Instruments** and
  **Storage Locations** (auto-creates Instrument Type / Manufacturer / Supplier by name).
  Israel: don't duplicate this. Instruments/Storage Import buttons route here.
- Each `AdminRefShell` page has a `createAction` (per-type create with validation).
- The 4 custom shells (Sample Types, Sample Containers, Container Types, Analyses) have
  their own create actions.
- Export headers already match SENAITE, so import column mapping keys off those same headers.

## Design
1. **Shared import component** — `<ImportButton>` + a drawer:
   file picker → parse (CSV; XLSX if we keep the existing xlsx dep) → map columns by header
   → validate → create each row via a passed `importRow(row)` callback → results panel
   (created / skipped / errors with row numbers). One component, reused everywhere.
2. **AdminRefShell prop** — add optional `importFields` / `onImportRow` (or reuse `fields` +
   `createAction`). Import button appears beside New; on upload, map CSV columns to fields by
   header (same headers Export writes) and call `createAction` per row. Covers ~20 pages at once.
3. **Custom shells** — same `<ImportButton>` wired to each shell's own create.
4. **Master-data resolution (Israel's caveat)** — for reference fields (Department, Category,
   Container Type, Preservation, Sample Matrix), resolve the imported *name* to a uid using the
   option lists already in scope. No match → mark that row as an error and skip it; never
   silently drop or create with a blank ref.
5. **Instruments / Storage** — Import button routes to the existing `master-data-import` flow
   (no new logic).
6. **Template** — "Download template" = the empty Export (headers only), already available.

## Principles (CLAUDE.md §11)
DRY (one `<ImportButton>` + one AdminRefShell prop covers ~20 pages; reuse `createAction`),
Adapter (reuse the existing importer for Instruments/Storage), SoC (parse/validate/resolve in
a helper, UI separate), KISS (CSV first, no new heavy dep), YAGNI (no new import endpoints
where `createAction` already works).

## Build order (testable incrementally)
1. Shared `<ImportButton>` + parser + AdminRefShell wiring → enable Import on the simple
   Title/Description reference pages first (clean export→import round-trip).
2. Master-data name→uid resolution for pages with reference fields.
3. The 4 custom shells.
4. Route Instruments / Storage to the existing importer.

## Confirm before building
- **File formats:** CSV only, or CSV + XLSX? (existing importer takes .xlsx/.csv.)
- **Failure handling:** per-row skip + report (recommended) vs abort whole import.
- **Preview step:** show a parsed preview to confirm before creating (recommended) vs import directly.
- **Duplicates:** skip rows whose name already exists, or attempt create and let the server reject?

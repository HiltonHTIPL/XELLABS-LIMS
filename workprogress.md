# Xellabs LIMS — Work Progress Log

> Entries older than 7 days are automatically removed.
> Format: date → task list. Ask Claude "what did we do today?" to get a summary.

---

## 2026-07-20

- **Completed all 6 deferred worksheet backlog items** ("do all"):
  1. **Blank/Control QC** — new Administration modules: **Suppliers**, **Reference Definitions** (with expected result/min/max grid + Blank/Hazardous), **Reference Samples** (picks a definition → copies its results; ExpiryDate required). Wired the worksheet detail's "Add Blank/Control QC" picker to the baked `@@add-worksheet-reference` view. No custom Zope views / no rebuild needed for the 3 types (Supplier is DX now; RefDef/RefSample write via restapi — RefSample via create-then-PATCH to dodge a response-serializer 500). See CLAUDE.md §16e.
  2. **Reviewer test user** — documented in `docs/worksheet-testing.md` (self-verification off → enable it for testing or add a reviewer user).
  3. **Analyst picker** — worksheet analyst is now a dropdown of lab members via new `@@lab-analysts` SENAITE view (empty in dev until real lab users exist; falls back to Unassigned + preserves current value).
  4. **Clear Instrument/Method to None** — `@@update-worksheet` view now clears via `getField().set(ws, None)` (setInstrument("") crashed in api.get_object); frontend always sends the fields.
  5. **Instrument results import** — worksheet detail "Import results" (CSV, matches Export format by Position) pre-fills result inputs → "Submit all". Frontend-only.
  6. **Retired orphaned Django worksheet code** — deleted `LabWorksheetsShell.tsx`, `LabWorksheetDetail.tsx`, `app/actions/django-worksheets.ts`.
- SENAITE image rebuilt (2 new views + 1 changed) and recreated. Verified end-to-end in a real browser (Playwright): supplier → definition → sample → QC picker → Control row added. `tsc` clean, no console errors. Test records deactivated (one blank test worksheet WS-014 has no clean REST delete — harmless dev leftover).

## 2026-07-17

- Client → New Sample client pre-fill: clicking "Client ID" on a Client row now carries the client through to Samples Overview's "New Sample" button (`?client=<senaite_uid>`), which pre-selects that same Client on the New Sample form (mirrors the existing `?batch=` pre-fill pattern) — also cascades contact name + CC emails via the existing `handleClientChange()` logic. Verified live via Playwright (Client select pre-filled with real client name, not blank).
- Fixed Laboratory Information page's large empty right-hand gutter — content was a fixed `maxWidth: 880` form left-aligned inside a full-width page container; wrapped the whole page body (header + toasts + form) in one centered container.
- Rebuilt Laboratory Information as a **4-tab layout** matching SENAITE's own Laboratory edit page exactly (confirmed via live HTML inspection of SENAITE's `base_edit` tab markup — Default, Address, Bank details, Accreditation) instead of one long stacked form.
- Added **View/Edit mode toggle** to Laboratory Information, matching SENAITE's own view/edit pattern — page opens read-only (labels + values, no inputs) with an Edit button; Edit switches to the editable form with Save/Cancel; Cancel discards in-progress changes and reverts to view; a successful save auto-returns to view mode.
- All changes verified with `tsc --noEmit` (clean) and a full frontend rebuild/restart each time; not yet committed or pushed (pending explicit user go-ahead per §13b).

## 2026-07-16

- Built the **Administration setup matrix** — 11 new SENAITE-backed reference-data sections mirroring SENAITE's own setup grid (Administration group only, no new top-level nav): Analysis Categories, Attachment Types, Batch Labels, Instrument Locations, Instrument Types, Interpretation Templates, Lab Contacts, Lab Departments, Lab Products, Labels, Laboratory Information.
- Every field mapped 1:1 with SENAITE's schema (verified by source/schema introspection), mandatory fields enforced client- and server-side.
- DRY infra: one config-driven `AdminRefShell` renders 9 of 11 pages from field config; one `admin-crud.ts` owns CRUD glue; one `senaite-setup.ts` isolates SENAITE REST quirks.
- Discovered + documented (CLAUDE.md §16d): SENAITE setup writes must go through **plone.restapi**, not the v1 create/update API — v1 rejects UIDReferenceField uid strings (department/manager) and chokes on LabProduct's computed fields; restapi handles both. Reads stay on v1 (restapi @search doesn't index SETUP_CATALOG). Also caught the `ARTemplate`→`SampleTemplate` rename inconsistency breaking `analysis_templates`.
- Lab Contacts + Laboratory (Archetypes) reuse the §16c custom-Zope-view address-validator bypass via 3 new views (`@@create-labcontact-safe`/`@@update-labcontact-safe`/`@@update-laboratory-safe`) baked into the SENAITE image, plus base64 image upload (Signature / Accreditation logo) and Laboratory banking fields.
- Fixed the Methods "Choose File" button (was an unstyled raw browser file input).
- Verified: tsc clean, production build ok, all 11 routes render (307), every SENAITE write path (single/multi refs, float sort_key, string price, addresses incl. country, base64 images, banking) tested live against the running instance.

## 2026-07-15

- Fixed Sample ID display mismatch on Samples Overview and Sample Detail pages — both now show the real SENAITE-assigned ID (`senaite_ar_id`) instead of Django's own internal date-stamped `sample_id`.
- Removed the Django `Test` catalog model entirely (present since the repo's initial commit) — it was a Django-native table for analysis catalog data, only loosely/manually synced to SENAITE.
- Re-keyed `Specification`, `WorksheetAssignment`, `QCSample`, and `AnalysisRequest` to reference live SENAITE analysis services directly (uid + name) instead of the old Django `Test` foreign key/M2M.
- Rewired 5 frontend features to match: Specifications, Worksheet assignment, Quality (QC samples), Analysis Requests, and New Sample creation.
- Wrote a data migration preserving existing rows' display names before dropping the old columns; verified via Django test suite (24/24 passed) and a full frontend production build (53/53 pages).
- Built a new **Calculations** admin grid (`/dashboard/calculations`) matching SENAITE's own Calculation flow exactly — Interim Fields, Formula, auto-derived Dependent Services.
- Root-caused (by reading SENAITE's actual source inside the container) a bug where SENAITE's own Formula validator can never accept interim-keyword formulas via any REST API path — fixed with two new custom Zope views baked into the SENAITE Docker image, rebuilt and redeployed.
- Completed the Calculations feature with the remaining confirmed SENAITE fields: Additional Python Libraries editor and a Test Calculation panel (enter values, run, see computed result) — required a third custom Zope view since SENAITE's own auto-compute subscriber never fires for direct API writes. Verified live (3+4=7, correct).
- Fixed production Sample Template create bug ("Wrong contained type") — split into scalars-POST + partitions/services-PATCH; rebuilt local SENAITE image (had gone stale).
- Built Sampling Deviations admin feature (reference-data list wired into New Sample + Sample Receipt).
- Upgraded `ReferenceListShell` to full CRUD (edit, activate/deactivate, refresh) shared by Preservations/Sample Points/Sampling Deviations.
- Rebuilt New/Edit Analysis as a full 7-tab form matching SENAITE's native Add Analysis Service; fixed a multi-tab FormData-unmounting bug found via user screenshot.
- Fixed Test price/VAT sync (per-test VAT, not a hardcoded 15%) for tests created via the Analyses page — later reconciled with the Test-model removal above by porting the same per-test-VAT logic onto `SenaiteAnalysisService.Price`/`.VAT` directly.
- Fixed Sample Point (real reference data), Batch dropdown (strict client filtering), and expanded Chain of Custody with real lifecycle events (status changes, result submit/verify/reject, AR completion, batch info) — found and fixed a genuinely dead `status_change` code branch along the way.
- Root-caused and fixed "could not convert string to float" sample-creation crash — empty-string duration subfields on Analysis Service `MaxTimeAllowed`/`MaxHoldingTime`.
- Root-caused and fixed Storage "Not Stored" false state — `_assign_sample_to_slot` was keying `assigned_sample_id` on whatever identifier format a caller passed, not the canonical Django `sample_id`; added `_resolve_canonical_sample_id()`.
- Added SENAITE `PositionsLayout` sync — storing/releasing a sample in a XelLabs box slot now writes/clears the sample's AR uid in the box's own SENAITE storage layout, not just the AR workflow transition. Verified live via the real assign/unassign endpoints.
- Confirmed (not yet fixed): HP-0004 has no Django `Sample` row — created directly in SENAITE's native UI, bypassing the Next.js mirroring flow (one-way sync architecture gap).
- Root-caused and fixed a duplicate-AnalysisRequest bug (one Django sample created two SENAITE ARs) — `push_analysis_request()` had no idempotency check against a Celery retry; added a ClientSampleID lookup guard. Cleaned up the one already-broken pair (cancelled the orphan, corrected the mismatched `Sample.senaite_uid`/`senaite_ar_id`).
- Coordinated with a second concurrently-running Claude Code instance touching the same repo — confirmed no file overlap before proceeding; merged in its Test-model-removal/Calculations work from `hephzibah/staging-development` via stash/pull/merge/pop, resolving the resulting conflicts (Test model, NewSampleShell pricing, this log, CLAUDE.md, migration numbering).

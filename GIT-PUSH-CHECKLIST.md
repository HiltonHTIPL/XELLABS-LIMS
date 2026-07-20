# Git Push Checklist — Unpushed Local Work

> Everything listed here is sitting on THIS machine only, unpushed.
> An empty checklist (just this header) means everything local is pushed.

### Standing note — not tracked by this checklist (can't be, by design)
`.env` is gitignored and will never travel with any `git push`. If this
project is ever set up on another machine or deploy target, these values must
be manually replicated there:
- `DEFAULT_TENANT_SCHEMA` (single-tenant demo-mode login fallback)
- `SENAITE_ADMIN_USER` / `SENAITE_ADMIN_PASS` (must match `SENAITE_ADMIN_PASSWORD`)

---

## Uncommitted local work (not yet committed)

- **SENAITE-native Worksheet flow — Phase 1** (new):
  - SENAITE image: `senaite-rebrand/worksheet_views.py` +
    `patch_worksheet_zcml.py` + `senaite-rebrand/Dockerfile` (baked in). **The
    SENAITE image must be rebuilt on any other machine** (`docker compose build
    senaite`) for the worksheet views to exist there.
  - Backend: `xellabs-backend/core/senaite_service.py` (new
    `receive_analysis_request`), `xellabs-backend/lims/services.py`
    (receive_sample now fires SENAITE receive + module logger).
  - Frontend: `app/lib/senaite-worksheets.ts` (new — incl. Phase 3 result-entry
    helpers), `app/actions/senaite-worksheets.ts` (new — incl.
    submitWorksheetResult/verifyWorksheetAnalysis),
    `app/dashboard/worksheets/_components/WorksheetsShell.tsx` (new),
    `app/dashboard/worksheets/[id]/_components/WorksheetDetailShell.tsx` (new —
    interactive results grid + workflow buttons),
    `worksheets/page.tsx` + `[id]/page.tsx` (re-pointed to SENAITE),
    `app/lib/senaite-setup.ts` (deactivateSetupItem + fetchSetupList extraQuery).
  - Phase 3 (results entry) done: enter result → Submit → to_be_verified;
    SENAITE auto-submits the worksheet; Verify gated to a reviewer (four-eyes).
  - Phase 2+4 done: 5 more Zope views (add/remove analyses, add-duplicate,
    add-reference, update-worksheet) in `senaite-rebrand/worksheet_views.py` +
    `patch_worksheet_zcml.py` (SENAITE image rebuilt — rebuild on other
    machines). Frontend: full manual-build detail (add-analyses panel,
    duplicate/remove, analyst/instrument/method/remarks editing), CSV export,
    and new `[id]/print/page.tsx` + `PrintTrigger.tsx` COA route.
  - Remaining: Blank/Control QC needs Suppliers + Reference Definitions +
    Reference Samples modules (worksheet `@@add-worksheet-reference` view is
    ready) — not yet built, awaiting user decision.
- **Worksheet Templates Administration module** (new):
  - `xellabs-frontend/app/actions/worksheet-templates.ts` (new)
  - `xellabs-frontend/app/dashboard/worksheet-templates/page.tsx` +
    `_components/WorksheetTemplatesShell.tsx` (new)
  - `xellabs-frontend/app/lib/senaite-setup.ts` (extended: `fetchSetupList`
    `extraQuery` param + new `deactivateSetupItem`)
  - `xellabs-frontend/app/dashboard/_components/adminNav.ts` (new nav entry)
- **Worksheet detail — removed "+ Add new instrument"**:
  - `xellabs-frontend/app/dashboard/worksheets/[id]/_components/LabWorksheetDetail.tsx`
  - `xellabs-frontend/app/dashboard/worksheets/[id]/page.tsx` (dropped dead fetches/props)
- **Topbar/sidebar UI fixes** (earlier this session):
  - `xellabs-frontend/app/dashboard/_components/DashboardShell.tsx` (search-bar
    overflow + user-menu center alignment)
  - `xellabs-frontend/app/dashboard/_components/Sidebar.tsx` (`monitoring` →
    `insert_chart` icon)
- Tracking files updated: `Codetrackbypriciple.txt`, `pending-changes.md`.
- All verified end-to-end in a real browser; no SENAITE test records left active.

## Before pushing
1. Commit everything (or explicitly decide what NOT to commit, e.g. secrets).
2. Confirm the target remote/branch with the user first. `origin` currently
   points at the shared `hephzibahtechnologies/XELLABS-LIMS` repo,
   branch `staging-development`.
3. Once pushed, **delete every entry above and reset this file to just this
   template** — an empty checklist means "everything local is pushed."

## 2026-07-20 — Suppliers: field-revert fix + full SENAITE field set [UNCOMMITTED]
- `xellabs-frontend/app/lib/senaite-setup.ts` (new `fetchRestapiOverlay`),
  `xellabs-frontend/app/actions/suppliers.ts` (full field set + overlay read),
  `xellabs-frontend/app/dashboard/suppliers/_components/SuppliersShell.tsx`
  (all new fields, sectioned), `xellabs-frontend/app/dashboard/_components/
  AdminRefShell.tsx` (new optional `section` field-grouping — backward
  compatible with every other admin page using this shared component).
- Docs: `CLAUDE.md` §16e (Supplier row updated), `pending-changes.md`.
- Verified end-to-end via Playwright + direct SENAITE calls: every field
  (incl. all 3 addresses) round-trips through create → close → reopen;
  server-side data confirmed via restapi. Test suppliers deactivated.

## 2026-07-20 — New-Sample SENAITE attachment + dropped-field fix [UNCOMMITTED]
- Backend: `xellabs-backend/core/senaite_service.py` (new `push_sample_attachment`,
  new `SENAITE_ORIGIN`), `xellabs-backend/core/tasks.py` (new
  `sync_sample_attachment_to_senaite`), `xellabs-backend/lims/views.py`
  (`upload_attachment` dispatches the task), `xellabs-backend/lims/models.py`
  (new `Sample.senaite_attachment_uid`) + migration
  `xellabs-backend/lims/migrations/0028_add_sample_senaite_attachment_uid.py`
  (**already applied to the local DB** — must run `migrate` on any other machine/deploy).
- Frontend: `xellabs-frontend/app/lib/senaite.ts` (`createSenaiteSample`
  reworked into create-then-update + new `resolveOrCreateContactUid`),
  `xellabs-frontend/app/actions/lab-samples.ts` (payload passthrough),
  `xellabs-frontend/app/dashboard/samples-overview/new/_components/NewSampleShell.tsx`
  (title→UID resolution for Preservation/SamplePoint/SamplingDeviation).
- Docs: `CLAUDE.md` §16f (new — silent-drop pattern confirmed on
  AnalysisRequest + Attachment recipe), `pending-changes.md`.
- Verified end-to-end via Playwright against the real running app + SENAITE
  (two full passes — first caught 2 real bugs, both fixed and re-verified).
  No test records left active; 3 harmless duplicate Attachment objects remain
  under SENAITE client-13 from the pre-fix retry bug (historical, not cleaned).

## 2026-07-20 — Worksheet backlog complete (all 6 items) [UNCOMMITTED]
- **SENAITE image rebuilt** — `senaite-rebrand/worksheet_views.py` + `patch_worksheet_zcml.py` (new `@@lab-analysts`, `@@update-worksheet` clear-to-None). **Other machines must `docker compose build senaite`.**
- New QC admin modules (Suppliers / Reference Definitions / Reference Samples): `app/actions/{suppliers,reference-definitions,reference-samples}.ts`, `app/dashboard/{suppliers,reference-definitions,reference-samples}/**`, `app/dashboard/_components/ReferenceResultsGrid.tsx`, `adminNav.ts` (3 nav entries).
- Worksheet detail: Blank/Control QC picker, analyst dropdown, clear instrument/method, CSV results import + Submit all (`senaite-worksheets.ts` adapter+actions, `[id]/page.tsx`, `WorksheetDetailShell.tsx`).
- Deleted orphans: `LabWorksheetDetail.tsx`, `LabWorksheetsShell.tsx`, `app/actions/django-worksheets.ts`.
- Docs/tracking: `docs/worksheet-testing.md`, `CLAUDE.md` §16e, `Codetrackbypriciple.txt`, `workprogress.md`.
- Verified end-to-end in a real browser; `tsc --noEmit` clean; test records deactivated (blank WS-014 leftover has no REST delete).

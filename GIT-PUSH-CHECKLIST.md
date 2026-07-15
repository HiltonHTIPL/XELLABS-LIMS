# Git Push Checklist

Tracks local work (commits + uncommitted changes) that hasn't been pushed to a
shared remote yet. Update this on every commit; **delete this file's contents
back to the template below once everything on it has actually been pushed.**

Purpose: local commit history is invisible to anyone but this machine. This
file is the visible, in-repo record of "what's sitting here unpushed" so nothing
gets lost, forgotten, or silently overwritten by a future `git pull`/merge.

---

## Status as of 2026-07-15

**Uncommitted local work — not yet committed or pushed.** Last push was
commit `5b576ae` (2026-07-14).

Since then: removed the Django `Test` catalog model entirely, re-keyed
`Specification`/`WorksheetAssignment`/`QCSample`/`AnalysisRequest` onto live
SENAITE analysis services instead (see `Codetrackbypriciple.txt` entry
2026-07-15 for full detail). Touches:
- Backend: `lims/models.py`, `lims/serializers.py`, `lims/views.py`,
  `lims/urls.py`, `lims/admin.py`, `lims/services.py`, `lims/senaite_sync.py`,
  `lims/tests.py`, `core/tests.py`, `core/tasks.py`, `core/senaite_service.py`,
  `instruments/importers.py`, `instruments/tasks.py`, `reporting/tasks.py`,
  `reporting/templates/reporting/coa.html`, new migration
  `lims/migrations/0023_remove_test_model_use_senaite_services.py`.
- Frontend: deleted `app/actions/tests.ts` + `app/dashboard/tests/`; rewired
  `app/dashboard/specifications`, `app/dashboard/worksheets/[id]`,
  `app/dashboard/quality`, `app/dashboard/analysis-requests`,
  `app/dashboard/samples-overview/new`, plus `app/actions/analysis-requests.ts`,
  `app/actions/quality.ts`, `app/actions/django-worksheets.ts`,
  `app/actions/results.ts`, `app/actions/lab-samples.ts`,
  `app/dashboard/_components/adminNav.ts`,
  `app/dashboard/samples-overview/[id]/_components/SampleOverviewDetail.tsx`.

Verified: `tsc --noEmit` clean, frontend production build succeeded (53/53
pages), Django `test lims core` — 24/24 passed, migration applied cleanly to
both `public` and `demo` schemas.

Not yet asked to commit/push — awaiting explicit go-ahead per Section 13b.
(Local-only, not pushed by design: `.orphaned-migrations-backup/` — gitignored.)

### Standing note — not tracked by this checklist (can't be, by design)
`.env` is gitignored and will never travel with any `git push`. If this
project is ever set up on another machine or deploy target, these values must
be manually replicated there:
- `DEFAULT_TENANT_SCHEMA` (single-tenant demo-mode login fallback)
- `SENAITE_ADMIN_USER` / `SENAITE_ADMIN_PASS` (must match `SENAITE_ADMIN_PASSWORD`)

---

## When you push

1. Commit everything (or explicitly decide what NOT to commit, e.g. secrets).
2. Confirm the target remote/branch with the user first. `origin` currently
   points at the shared `hephzibahtechnologies/XELLABS-LIMS` repo,
   branch `staging-development`.
3. Once pushed, **delete every entry above and reset this file to just this
   template** — an empty checklist means "everything local is pushed."

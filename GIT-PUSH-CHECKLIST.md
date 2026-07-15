# Git Push Checklist

Tracks local work (commits + uncommitted changes) that hasn't been pushed to a
shared remote yet. Update this on every commit; **delete this file's contents
back to the template below once everything on it has actually been pushed.**

Purpose: local commit history is invisible to anyone but this machine. This
file is the visible, in-repo record of "what's sitting here unpushed" so nothing
gets lost, forgotten, or silently overwritten by a future `git pull`/merge.

---

## Status as of 2026-07-15 (later)

**Uncommitted local work — not yet committed or pushed.** Last push was
commit `7066bc8`.

Since then: new fully SENAITE-backed **Calculations** admin grid at
`/dashboard/calculations`, matching SENAITE's own Calculation flow (Interim
Fields, Formula, auto-derived Dependent Services). Required a genuine SENAITE-
side fix — two new custom Zope browser views baked into the SENAITE Docker
image (`senaite-rebrand/calculation_views.py` + `patch_calculation_zcml.py`)
to bypass a broken validator that rejects interim-keyword formulas via every
REST path. Touches:
- `senaite-rebrand/calculation_views.py` (new), `senaite-rebrand/patch_calculation_zcml.py` (new), `senaite-rebrand/Dockerfile` (new COPY/RUN steps) — **SENAITE image already rebuilt and redeployed** (`docker compose build senaite` + `up -d senaite`), not just source changes.
- `xellabs-frontend/app/lib/senaite.ts` (new Calculation types + adapters), new `app/actions/calculations-senaite.ts`, new `app/dashboard/calculations/page.tsx` + `_components/CalculationsShell.tsx`, `app/dashboard/_components/adminNav.ts` (new nav entry).

The pre-existing Django-only `Calculation` model (used by Method's M2M
picker) was deliberately left untouched — out of scope for this request.

Follow-up: completed remaining schema fields the user flagged as missing —
Additional Python Libraries editor + a Test Calculation panel (TestParameters/
TestResult). Required a third custom Zope view (`@@test-calculation`) since
SENAITE's own objectmodified subscriber that computes these never fires for
direct API calls — SENAITE image rebuilt/redeployed a second time.

Verified: live create/update/mixed-formula round trip via curl, a live
test-calculation run (3+4=7, correct), `tsc --noEmit` clean, frontend prod
build succeeded, all test orphan objects deactivated.

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

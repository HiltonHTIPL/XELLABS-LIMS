# Git Push Checklist

Tracks local work (commits + uncommitted changes) that hasn't been pushed to a
shared remote yet. Update this on every commit; **delete this file's contents
back to the template below once everything on it has actually been pushed.**

Purpose: local commit history is invisible to anyone but this machine. This
file is the visible, in-repo record of "what's sitting here unpushed" so nothing
gets lost, forgotten, or silently overwritten by a future `git pull`/merge.

---

## Status as of 2026-07-13

**Remote:** `origin` -> `https://github.com/Lijishwilson-HTIPL/xelMigration.git`
**Ahead of `origin/main` by:** 42 commits (mostly from merging in
`staging-development` from the `hephzibahtechnologies/XELLABS-LIMS` repo, plus
local fixes made directly in this working copy — see `Codetrackbypriciple.txt`
for the feature-level detail on the latter).

### Uncommitted local changes (not yet in any commit)
- `CLAUDE.md` — session-learning updates (env-var fallback bugs, tenant gotchas, Git Push Checklist rule, etc.)
- `Codetrackbypriciple.txt` — feature/principle log entries
- `GIT-PUSH-CHECKLIST.md` — this file (new)
- `docker-compose.yml` — credential env vars hardened to required (`:?` instead of `:-default`)
- `xellabs-backend/core/senaite_service.py` — Client activate/deactivate sync, staff-user SENAITE sync, Users/Roles matrix (`list_senaite_users`, `set_senaite_user_role`)
- `xellabs-backend/core/signals.py` — Client activate/deactivate signal wiring
- `xellabs-backend/core/tasks.py` — new Celery tasks (activate/deactivate/staff-user sync)
- `xellabs-backend/core/views.py` — staff-user SENAITE sync wired into `UserViewSet.perform_create`; new `senaite-roles` action + list-merge for the Users/Roles matrix
- `xellabs-frontend/app/actions/auth.ts` — `DEFAULT_TENANT_SCHEMA` login fallback (single-tenant demo mode)
- `xellabs-frontend/app/actions/users.ts` — `senaite_roles` field, `toggleSenaiteRole` action
- `xellabs-frontend/app/dashboard/_components/Sidebar.tsx` — Tenant Management nav hidden (demo phase)
- `xellabs-frontend/app/dashboard/admin/_components/AdminShell.tsx` — SENAITE role checkbox matrix (11 columns) on the Users page
- `xellabs-frontend/app/dashboard/clients/_components/ClientsShell.tsx` — Reset Password removed
- `xellabs-frontend/app/lib/roles.ts` — `SENAITE_USER_ROLES` constant
- `xellabs-frontend/app/lib/django.ts` — `DEFAULT_TENANT_SCHEMA` fallback added to `djangoFetch` itself (fixes non-superuser login from plain localhost)
- `xellabs-frontend/app/lib/senaite.ts` — Batch adapters (`fetchSenaiteBatches`, `createSenaiteBatch`, `setSenaiteBatchState`); `Batch` field added to `createSenaiteSample`
- `xellabs-frontend/app/actions/batches.ts` — new file, Batches CRUD actions
- `xellabs-frontend/app/actions/lab-samples.ts` — `batch_senaite_uid` threaded through sample creation
- `xellabs-frontend/app/dashboard/batches/page.tsx` + `_components/BatchesShell.tsx` — real Batches page (was a placeholder)
- `xellabs-frontend/app/dashboard/samples-overview/new/page.tsx` + `_components/NewSampleShell.tsx` — Batch dropdown wired into sample registration

**Not yet committed** — do not lose these. Also not in `.env` (gitignored, tracked
separately): `DEFAULT_TENANT_SCHEMA`, `SENAITE_ADMIN_USER`, `SENAITE_ADMIN_PASS`
additions — these must be manually replicated on any other machine/deploy target,
they will NOT come along with a `git push`.

### Local commits ahead of `origin/main` (42)
Mostly merge commits pulling `staging-development` (external repo) forward,
interleaved with commits made directly on this machine. Run
`git log origin/main..HEAD --oneline` for the live list — not duplicated here
since it changes every merge; this file tracks the *uncommitted* work above,
which is the part actually at risk of being lost.

---

## When you push

1. Commit everything above (or explicitly decide what NOT to commit, e.g. secrets).
2. `git push origin main` (or wherever this actually needs to land — confirm
   with the user first, since `origin` here is a personal fork, not the shared
   `hephzibahtechnologies/XELLABS-LIMS` repo this session has been merging from).
3. Once pushed, **delete every entry above and reset this file to just the
   template header** — an empty checklist means "everything local is pushed."

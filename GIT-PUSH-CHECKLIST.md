# Git Push Checklist

Tracks local work (commits + uncommitted changes) that hasn't been pushed to a
shared remote yet. Update this on every commit; **delete this file's contents
back to the template below once everything on it has actually been pushed.**

Purpose: local commit history is invisible to anyone but this machine. This
file is the visible, in-repo record of "what's sitting here unpushed" so nothing
gets lost, forgotten, or silently overwritten by a future `git pull`/merge.

---

## Status as of 2026-07-16

**Uncommitted/unpushed local work.** Last push was commit `95fe4e3` → `hephzibah/staging-development`.

Since then: merged `hephzibah/Vinod` into local `main` (commit `f0329c5`) — a long-diverged branch, 24 conflicts resolved with explicit user sign-off on the real judgment calls (see `Codetrackbypriciple.txt` and `pending-changes.md` for full detail). Notably: took Vinod's more-complete Instruments feature and adapted it to this session's Test-model removal (3 files fixed: `instruments/tasks.py`, `importers.py`, `views.py`); kept main's SENAITE-native Clients pages over Vinod's older Django-Client-based versions; rebuilt the Django image for new dependencies (`whitenoise`, `weasyprint`, `django-weasyprint`, `openpyxl`); deleted a duplicate `lims` migration. Verified: Django tests 57/57, `tsc` clean, frontend build 59/59 pages, all containers healthy.

Not yet asked to push — awaiting explicit go-ahead per Section 13b.

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

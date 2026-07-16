# Git Push Checklist — Unpushed Local Work

> Everything listed here is sitting on THIS machine only, unpushed.
> An empty checklist (just this header) means everything local is pushed.

Tracks local work (commits + uncommitted changes) that hasn't been pushed to a
shared remote yet. Update this on every commit; **delete this file's contents
back to the template below once everything on it has actually been pushed.**

Purpose: local commit history is invisible to anyone but this machine. This
file is the visible, in-repo record of "what's sitting here unpushed" so nothing
gets lost, forgotten, or silently overwritten by a future `git pull`/merge.

---

## Status

- `hephzibah/staging-development`: up to date (fast-forwarded 2026-07-16, no local commits ahead).
- `origin/main` (personal fork, `Lijishwilson-HTIPL/xelMigration`): 106 commits ahead — not yet pushed.
- Local working tree also has uncommitted changes pending commit (post-merge stash-pop conflict resolution).

### Standing note — not tracked by this checklist (can't be, by design)
`.env` is gitignored and will never travel with any `git push`. If this
project is ever set up on another machine or deploy target, these values must
be manually replicated there:
- `DEFAULT_TENANT_SCHEMA` (single-tenant demo-mode login fallback)
- `SENAITE_ADMIN_USER` / `SENAITE_ADMIN_PASS` (must match `SENAITE_ADMIN_PASSWORD`)

---

## Before pushing
1. Commit everything (or explicitly decide what NOT to commit, e.g. secrets).
2. Confirm the target remote/branch with the user first. `origin` currently
   points at the shared `hephzibahtechnologies/XELLABS-LIMS` repo,
   branch `staging-development`.
3. Once pushed, **delete every entry above and reset this file to just this
   template** — an empty checklist means "everything local is pushed."

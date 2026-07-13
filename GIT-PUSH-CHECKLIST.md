# Git Push Checklist

Tracks local work (commits + uncommitted changes) that hasn't been pushed to a
shared remote yet. Update this on every commit; **delete this file's contents
back to the template below once everything on it has actually been pushed.**

Purpose: local commit history is invisible to anyone but this machine. This
file is the visible, in-repo record of "what's sitting here unpushed" so nothing
gets lost, forgotten, or silently overwritten by a future `git pull`/merge.

---

## Status as of 2026-07-13

**Everything pushed.** Last push: commit `7dee070` to
`https://github.com/hephzibahtechnologies/XELLABS-LIMS.git` branch
`staging-development` (confirmed no new upstream commits existed before
pushing, so this was a clean fast-forward — `b84e5b7..7dee070`).

No uncommitted or unpushed local work outstanding.

### Standing note — not tracked by this checklist (can't be, by design)
`.env` is gitignored and will never travel with any `git push`. If this
project is ever set up on another machine or deploy target, these values must
be manually replicated there:
- `DEFAULT_TENANT_SCHEMA` (single-tenant demo-mode login fallback)
- `SENAITE_ADMIN_USER` / `SENAITE_ADMIN_PASS` (must match `SENAITE_ADMIN_PASSWORD`)

---

## When you push

1. Commit everything (or explicitly decide what NOT to commit, e.g. secrets).
2. Confirm the target remote/branch with the user first — `origin` in this
   repo points to a personal fork (`Lijishwilson-HTIPL/xelMigration.git`), not
   the shared `hephzibahtechnologies/XELLABS-LIMS` repo most work in this
   project actually targets.
3. Once pushed, **delete every entry above and reset this file to just this
   template** — an empty checklist means "everything local is pushed."

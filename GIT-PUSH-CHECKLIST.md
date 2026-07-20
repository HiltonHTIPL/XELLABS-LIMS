# Git Push Checklist — Unpushed Local Work

> Everything listed here is sitting on THIS machine only, unpushed.
> An empty checklist (just this header) means everything local is pushed.

### Standing note — not tracked by this checklist (can't be, by design)
`.env` is gitignored and will never travel with any `git push`. If this
project is ever set up on another machine or deploy target, these values must
be manually replicated there:
- `DEFAULT_TENANT_SCHEMA` (single-tenant demo-mode login fallback)
- `SENAITE_ADMIN_USER` / `SENAITE_ADMIN_PASS` (must match `SENAITE_ADMIN_PASSWORD`)

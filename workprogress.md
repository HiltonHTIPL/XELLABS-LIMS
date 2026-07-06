# Xellabs LIMS — Work Progress Log

> Entries older than 7 days are automatically removed.
> Format: date → task list. Ask Claude "what did we do today?" to get a summary.

---

## 2026-06-30

- Identified Django Admin superuser username: `admin` (email: `admin@xellabs.com`)
- Diagnosed that `changepassword` fails non-interactively in Docker; used Django shell `set_password()` workaround instead
- Reset Django Admin superuser password to `admin123` via shell
- Explained how to create a Sample Type via REST API and Django Admin
- Diagnosed "Not available for global schema" issue in Django Admin — caused by multi-tenant setup with only the `public` schema existing
- Guided tenant creation: schema `liji_groups`, name `Lijish wilson group of companies`
- Explained full tenant onboarding flow: create tenant → add domain → update Windows hosts file → access tenant admin at `http://liji-groups.localhost:8001/admin/`

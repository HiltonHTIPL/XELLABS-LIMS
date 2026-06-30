# XelLabs LIMS — SENAITE Fit/Gap Analysis

## Purpose
Documents which SENAITE v2.6.0 capabilities are used as-is, which are replaced by the custom Django backend, and which gaps exist.

---

## Fit — Used As-Is (SENAITE)

| Capability | SENAITE Feature | Notes |
|---|---|---|
| Reference LIMS engine | SENAITE core | White-labeled as XelLabs |
| Sample workflow engine | AT workflow | Used as reference model |
| COA templates | senaite.impress | Reference only |
| QC charting | senaite.core | Reference only |

---

## Gap — Replaced by Django Backend

| Capability | SENAITE Limitation | XelLabs Solution |
|---|---|---|
| REST API | No production-grade DRF API | Django + DRF — full CRUD + workflow actions |
| Role-based access | Plone roles — hard to extend | Custom RBAC in `core/permissions.py` |
| Audit trail | Plone history — not queryable | `audittrail` app — SQL, field-level diffs |
| Electronic signatures | Not natively supported | `workflow.ElectronicSignature` — password verified |
| Instrument file import | Manual only | Celery task + CSV/XML parser |
| Inventory management | Not in SENAITE core | Full `inventory` app |
| Task assignment | Not in SENAITE | `workflow.Task` + `TaskAssignment` |
| Backlog dashboard | Not available | `core.DashboardView` |
| Record locking | Not enforced | `is_locked` + `RecordLockMixin` |
| Record versioning | Not queryable | `audittrail.RecordVersion` |

---

## Remaining SENAITE Usage

SENAITE runs as a separate container (`xellabs-lims-senaite-1`) for:
- Reference implementation of lab workflows
- COA layout reference

It is **not** the primary data store — all production data lives in PostgreSQL via the Django backend.

---

## Known SENAITE Constraints

| Constraint | Impact |
|---|---|
| Python 2.7 / Plone 5 | Cannot extend with modern Python packages |
| `Products.ATContentTypes` — Python 2 only | Blocked buildout on Python 3.8 |
| Template cache (`.pyc`) | After any `.pt` change, `docker restart senaite` required |
| CSRF token required for all form POSTs | Site title changes need all form fields + `_authenticator` token |

# Xellabs LIMS — Work Progress Log

> Entries older than 7 days are automatically removed.
> Format: date → task list. Ask Claude "what did we do today?" to get a summary.

---

## 2026-07-15

- Fixed Sample ID display mismatch on Samples Overview and Sample Detail pages — both now show the real SENAITE-assigned ID (`senaite_ar_id`) instead of Django's own internal date-stamped `sample_id`.
- Removed the Django `Test` catalog model entirely (present since the repo's initial commit) — it was a Django-native table for analysis catalog data, only loosely/manually synced to SENAITE.
- Re-keyed `Specification`, `WorksheetAssignment`, `QCSample`, and `AnalysisRequest` to reference live SENAITE analysis services directly (uid + name) instead of the old Django `Test` foreign key/M2M.
- Rewired 5 frontend features to match: Specifications, Worksheet assignment, Quality (QC samples), Analysis Requests, and New Sample creation.
- Wrote a data migration preserving existing rows' display names before dropping the old columns; verified via Django test suite (24/24 passed) and a full frontend production build (53/53 pages).

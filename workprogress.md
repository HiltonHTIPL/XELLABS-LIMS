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
- Built a new **Calculations** admin grid (`/dashboard/calculations`) matching SENAITE's own Calculation flow exactly — Interim Fields, Formula, auto-derived Dependent Services.
- Root-caused (by reading SENAITE's actual source inside the container) a bug where SENAITE's own Formula validator can never accept interim-keyword formulas via any REST API path — fixed with two new custom Zope views baked into the SENAITE Docker image, rebuilt and redeployed.
- Completed the Calculations feature with the remaining confirmed SENAITE fields: Additional Python Libraries editor and a Test Calculation panel (enter values, run, see computed result) — required a third custom Zope view since SENAITE's own auto-compute subscriber never fires for direct API writes. Verified live (3+4=7, correct).

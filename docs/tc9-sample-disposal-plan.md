# TC-9 Sample Disposal — Plan

Status: **IMPLEMENTED** on branch `Vinod` (Django service-layer only).
Owner: Vinod. Source: RFP TC-9 + 2026-07 stand-up feedback (Israel / Lijish / team).

---

## 1. What the RFP expects

> Demonstrate how the system manages sample disposal and documents compliance with state and federal regulations.

Plus: disposal must be auditable end to end (who, when, before/after, basis).

### Demo path (what reviewers click)

1. Sample Type has retention days → sample gets `expiry_date`.
2. Samples Overview → **Overdue** shows past-retention samples.
3. Dispose with required **regulatory basis**, optional **notes** + **certificate**.
4. Sample disappears from **All Samples** and other active lists.
5. Still findable under **Status → Disposed**.
6. **Chain of Custody** + **Audit Trail** (Postgres) show the dispose event and status change.

---

## 2. Meeting clarifications (binding)

| Said in stand-up | Plan rule |
|---|---|
| “Past retention / dispose — where else should the sample be removed?” | Soft-remove from **All Samples**, analysis requests, worksheet assignments, results. Never hard-delete. |
| “Retention is different — that is Sample Type. Overdue samples is what you use.” | Queue = Samples Overview **Overdue** (`expiry_date` past). Do **not** rework Sample Type retention UI for TC-9. |
| “Don’t touch the sample page Lijish already tested.” | No Sample Type / shared-sample redesign. Dispose only via Overdue + existing detail Dispose when past retention. |
| “Notes and a certificate.” | Modal: basis required; notes + certificate optional. |
| “Audit trail is in Postgres. Sync with Lijish. Before/after values.” | Use existing `AuditEvent` + `DataChangeLog`; CoC row on dispose. No ZODB write. |
| “CoC comes from Postgres.” | `ChainOfCustody(action="disposed")` only. |

### What TC-9 is **not**

- Not SENAITE **Dispatch → Dispatched** (that is book-out / transfer).
- Not SENAITE **Dispose** on Reference Samples (QC controls/blanks).
- Not dual-write to SENAITE for this demo.
- Not adding retention fields onto Sample Type–owned sample screens without team discussion.

---

## 3. Implementation (done)

| Item | Where |
|---|---|
| Service + guards (basis, past retention, eligible status) | `lims/services.py` → `dispose_sample` |
| API action (lab manager+) | `lims/views.py` → `SampleViewSet.dispose` |
| Default list excludes disposed; `?status=disposed` still works | `SampleViewSet.get_queryset` |
| AR / worksheet / results exclude disposed | existing viewset `get_queryset` filters |
| Overdue includes published past-due; excludes registered/disposed/rejected | stats + FE `isOverdueSample` |
| Dispose UI only when overdue | Samples Overview menu + Sample Detail button |
| CoC + audit before/after status | CoC create + `audittrail` signals |
| Removed wrong SENAITE dispatch path | deleted unused dispatch helpers/tasks |
| Tests | `lims.tests.SampleDisposeWorkflowTest` (6 passing) |
| Demo seed | `DEMO-GW-PAST-001` via `seed_demo_rfp` |

---

## 4. Still open (coordination, not code blockers)

- Confirm with Lijish that sample-level audit visibility for lab managers (vs admin-only) matches their privilege plan.
- Optional: Slack note listing CoC + audit fields written on dispose (Israel asked for a Postgres field inventory).

---

## 5. Definition of done checklist

- [x] Overdue = past retention queue (not Sample Type page edits).
- [x] Dispose requires regulatory basis; notes + certificate optional.
- [x] Cannot dispose before retention date / from terminal or registered-only states.
- [x] Disposed sample gone from All Samples + active work lists; visible under Disposed.
- [x] CoC + AuditEvent/DataChangeLog (`status`: before → `disposed`).
- [x] No SENAITE Dispatch dual-write; demo language does not claim SENAITE dispose.

## 6. Anti-patterns

- Do not equate dispose with SENAITE dispatch.
- Do not edit Sample Type / Lijish sample screens “to show retention.”
- Do not hard-delete samples.
- Do not flip status in the UI without service guards.

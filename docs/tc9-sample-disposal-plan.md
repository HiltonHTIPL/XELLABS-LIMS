# TC-9 Sample Disposal — Full-Workflow Implementation Plan

Status: IMPLEMENTED (Django service-layer). Branch: Vinod. Demo task: TC-9 (owner: Vinod).
Decisions locked: engine = **Django service-layer** (match the team, do NOT drive SENAITE
as the primary path); enforcement = warn/guard, not silent; full workflow, not a one-screen flip.
Section 6 (SENAITE dual-write) remains optional / not wired.

Related: verified by `stages/04_demo/output/kpop_tc9_disposal_verification.md` and mirrors
`docs/instruments-workflow-plan.md` (same service-layer pattern).

---

## 1. What TC-9 must demonstrate (RFP)
"Demonstrate how the system manages sample disposal and documents compliance with state and
federal regulations." Plus the audit-trail task: disposal must be traceable end to end.

## 2. Current state (grounded)
- Retention: `SampleType.retention_days` (`lims/models.py:9`) → `Sample.expiry_date`
  (`lims/models.py:156`). Past-retention list filters `expiry_date__lt=now` (`lims/views.py:132`).
- Dispose: `SampleViewSet.dispose` (`lims/views.py:175`) — requires `regulatory_basis` (400 if
  empty), appends `[Disposed] {basis}` to description, optional certificate → `Sample.attachment`,
  sets `status="disposed"`, writes `ChainOfCustody(action="disposed")`.
- **It is Django-only** — no SENAITE call (KPOP confirmed). Front-end `DisposeSampleModal.tsx`
  requires the basis.

## 3. SENAITE parity (what SENAITE actually does)
- Disposal = workflow transition **`dispatch` → state `dispatched`**
  (`senaite_sample_workflow/definition.xml`; `dispatch` is an exit-transition from received,
  to_be_verified, verified, published — 4+ states).
- `DispatchSamplesView` **requires a comment** ("Please specify a reason") =
  `portal_workflow.doActionFor(sample, "dispatch", comment=comment)`. Compliance basis goes in
  the comment; certificate = Attachments. Retention = `SampleType.RetentionPeriod`.
- Key behaviors we currently only do partially: **guards** (dispatch only from eligible states),
  **list membership** (dispatched samples leave active lists), **audit** (immutable record).

## 4. The gap = partial workflow
Today dispose is a status flip in one screen (plus a CoC row). It does not enforce which states
can be disposed from, and does not cleanly move the sample out of the active work lists into a
disposed view the way SENAITE's dispatch does. It also never reaches SENAITE, so the two can drift.

## 5. Plan (Django service-layer, matching the team)
1. **Service function** `dispose_sample(sample, user, basis, notes, certificate)` in
   `lims/services.py` (already the home of receive/verify/reject). Move the dispose logic out of
   the view into this service.
2. **From-state guard**: raise `ValueError` if `sample.status` is not a disposal-eligible state
   (mirror SENAITE's dispatch exit-transitions: received / to_be_verified / verified / published;
   NOT already disposed/rejected). View returns 400.
3. **Role guard**: `permission_classes` on the dispose `@action` (lab_manager or the disposal role).
4. **Cascade / list membership** (the "full workflow" part): setting `status="disposed"` must make
   the sample leave every active list and appear in a disposed view. Confirm `filterset_fields`
   includes `status` and that active-list querysets exclude `disposed` (the samples-overview stat
   already excludes it — extend consistently to worksheet/analysis lists).
5. **Audit**: automatic via `audittrail` signals (AuditEvent on the status change). The CoC row +
   the `[Disposed] {basis}` stamp stay as the compliance record.
6. **Retention drives the queue**: keep `retention_days → expiry_date → Past Retention` as the
   entry point (matches SENAITE's RetentionPeriod intent).
7. **Enforcement**: cannot dispose an ineligible/already-disposed sample (400 + clear message).

## 6. Optional enhancement (do NOT build now) — SENAITE dual-write
To make disposal reach the system of record (the "better than partial" version from the KPOP):
after the Django transition, fire SENAITE's `dispatch` for the sample's `senaite_uid` with
`comment=basis` via `core/senaite_service.py` (Adapter), async through Celery
(`schema_context`-wrapped), with a retry + a "pending sync" state. Handle failure so Django is not
left falsely "disposed" while SENAITE is not dispatched. This is the one architectural upgrade
that removes drift; flag for Israel, build only if approved.

## 7. Execution order
1. Extract dispose → `lims/services.py` with from-state + role guards.
2. Ensure active-list querysets exclude `disposed`; add a disposed view/filter.
3. Confirm audit fires; keep CoC + stamp.
4. (Later, if approved) SENAITE dispatch dual-write.

## 8. Definition of done
- Dispose only works from eligible states; ineligible → 400.
- A disposed sample disappears from active lists and appears in the disposed view app-wide.
- Every disposal writes an AuditEvent + CoC + the `[Disposed] {basis}` stamp + optional certificate.
- Demo script: retention → Past Retention → Dispose with 40 CFR basis (+ optional PDF); one line of
  SENAITE parity narration ("equivalent is Dispatch → Dispatched"); do NOT claim it writes to
  SENAITE unless the dual-write is built.

## 9. Anti-patterns (do NOT do)
- WRONG: flip `status` in the modal only, with no from-state guard and no list-membership change.
- RIGHT: transition via the service function, guarded, cascading out of active lists, audited.

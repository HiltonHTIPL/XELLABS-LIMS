# Instruments: Full SENAITE Field/Tab Parity + Workflow Engine — Implementation Plan

Status: PLAN ONLY (approved approach, not yet built). Owner: Vinod. Module: `instruments`.
Decisions locked: engine = **Django service-layer** (match the team, do NOT drive SENAITE);
states = `active / inactive / under_maintenance / out_of_service / retired`;
enforcement = **warn** (not hard-block); scope = **instruments now** (design to generalize).

---

## 0. Why this plan exists

Two requirements:
1. **Total field/tab parity** with SENAITE's instrument page — every tab (Description /
   Additional Information / Procedures) and **every field**, nothing dropped.
2. **Full workflow, not partial** — when an instrument transition fires, all dependent
   effects cascade across the whole app (a status change is reflected everywhere the
   instrument appears; it moves between filtered lists; it is audited), exactly like
   SENAITE. The opposite of a status flipped in one screen that drifts.

---

## 1. The team's workflow pattern (the contract to match)

Verified in the codebase. Every module (samples, worksheets, clients) uses this:

| Concern | How the team does it | Reference |
|---|---|---|
| State | a `status` CharField (choices) on the model | `lims/models.py` |
| Transition | one DRF `@action(detail=True, methods=["post"])` per action, delegating to a service function | `lims/views.py` `SampleViewSet.receive/verify/reject/dispose` |
| Service layer | `<app>/services.py` holds the state change + cascades (15 fns in `lims/services.py`) | `lims/services.py` |
| Role guard | `permission_classes=[IsLabManagerOrAbove / CanReceiveOrStoreSamples / …]` | `core/permissions.py` |
| From-state guard | service raises `ValueError` if the transition is illegal → view returns 400 | `lims/services.py` |
| Cascade / side-effects | inside the service function | `lims/services.py` |
| Audit + notifications | **automatic** — `audittrail` wires `pre_save/post_save/post_delete` to every model | `audittrail/signals.py` |
| List membership | `filterset_fields = ["status", …]`; objects move between lists by status value | `lims/views.py` |
| SENAITE sync | separate concern (signals in `core/signals.py` / Celery); most transitions are Django-only | `core/senaite_service.py` |

**Engine decision:** Django owns the workflow. This matches every other module. SENAITE is
NOT the workflow engine; its instrument workflow is minimal (active/inactive) and the rich
usability status is **derived** from calibration/certification/validation validity.

**Gap:** `instruments/services.py` does NOT exist. The instrument module is currently a plain
CRUD ViewSet with a `status` text field and **no transitions, guards, or cascades** — this is
the missing workflow.

---

## 2. Workstream A — Field + tab parity

### A1. Field proof (before any UI code) — technique: Chain-of-Table + Chain-of-Verification
Produce a table, one row per SENAITE instrument field, sourced from
`senaite-reference/senaite.core/src/bika/lims/content/instrument.py` (+ schema fieldsets)
and cross-checked against the live SENAITE edit form at `:8080`.
**Rule: no row marked "present" without a `file:line`.** Then add any missing field to the
`Instrument` model + serializer.

Known SENAITE Instrument fields to account for (verify, do not trust this list):
InstrumentType, Manufacturer, Supplier, Model, SerialNo, AssetNumber, InstrumentLocation,
Method/Methods, InstallationDate, Photo, InstallationCertificate, DataInterface,
ImportDataInterface, ResultFilesFolder, DataInterfaceOptions, DisposeUntilNextCalibrationTest,
InlabCalibrationProcedure, PreventiveMaintenanceProcedure, Valid (computed), plus
title(name)/description.

Most are already on the Django model (manufacturer_org, supplier_org, instrument_type,
instrument_location, installation_date, data_interface, import_data_interface,
result_files_folder, dispose_until_next_calibration, inlab_calibration_procedure,
preventive_maintenance_procedure, photo). The proof confirms completeness.

### A2. Tab reorganize
Split the instrument edit drawer (`xellabs-frontend/app/dashboard/instruments/_components/InstrumentsShell.tsx`)
into SENAITE's tabs, each field in its SENAITE tab:
- **Description**: name, instrument_id, type, manufacturer, supplier, model, serial_number,
  asset_number, location/instrument_location, installation_date, photo, status.
- **Additional Information**: methods, data_interface, import_data_interface,
  result_files_folder, data_interface_options, dispose_until_next_calibration.
- **Procedures**: inlab_calibration_procedure, preventive_maintenance_procedure.

(Confirm the exact tab-to-field grouping from SENAITE's schema fieldsets during A1.)

---

## 3. Workstream B — Workflow engine (Django service-layer)

### B1. States + derived usability
- `Instrument.status` choices: `active, inactive, under_maintenance, out_of_service, retired`.
- Derived `usability` (property or computed field): `valid / expired / out_of_service`,
  computed from the latest Calibration + Certification + Validation validity + downtime.
  This is what "out of calibration" means without a manual state.

### B2. `instruments/services.py` (new)
Transition functions, mirroring `lims/services.py`:
`activate`, `deactivate`, `set_under_maintenance`, `set_out_of_service`,
`return_to_service`, `retire`. Each:
- guards the from-state (raise `ValueError` if illegal, e.g. can't `return_to_service`
  from `retired`);
- performs the state change;
- runs cascades (see B4).

### B3. Transition endpoints
On `InstrumentViewSet`: one `@action(detail=True, methods=["post"], permission_classes=[IsLabManagerOrAbove])`
per transition, each calling its service function and returning 400 on `ValueError`.
Registration + transitions are admin/lab_manager only (Israel: registration = admin task).

### B4. Cascade = single source of truth ("change once, everywhere")
- Every surface reads the ONE `status` / `usability` field — never a copy.
- A signal recomputes `usability` whenever a Calibration/Certification/Validation is
  added, edited, or lapses, so the instrument's effective status flips **app-wide**
  automatically.
- The worksheet/analysis instrument picker filters to usable instruments; selecting a
  bad-status instrument **warns** (frontend), does not block.

### B5. List membership
Add `status` to `InstrumentViewSet.filterset_fields`. Instruments move between
active / out-of-service / retired lists by status value (no badge-only duplication).

### B6. Audit
Confirm `Instrument`, `InstrumentType`, `InstrumentLocation`, `Certification`,
`ScheduledTask`, `Validation` are registered with `audittrail`'s signal wiring so every
transition logs an `AuditEvent` + `DataChangeLog` automatically. If not registered, add them.

### B7. Enforcement
Warn-only in the frontend when a non-usable instrument is chosen for a test. Hard-block is a
business rule to confirm with the client later — do NOT enforce now.

---

## 4. Execution order

1. A1 field proof (Chain-of-Table) → close any field gaps + migration.
2. B1 states + derived usability (model + migration).
3. B2 `instruments/services.py` transition functions with guards + cascades.
4. B3 transition `@action` endpoints with role guards.
5. B4 usability-recompute signal + worksheet picker filter.
6. B5 status filterset.
7. B6 verify/extend audittrail registration.
8. A2 tab reorganize in the drawer + B7 warn UI.
9. Verify (section 5), then push to branch `Vinod` → PR (Daniel/Raju review).

---

## 5. Definition of done / verification

- Every SENAITE instrument field present (Chain-of-Table proof has no gaps).
- Edit drawer shows Description / Additional Information / Procedures tabs.
- Each transition works; illegal transitions return 400.
- An expiring calibration flips `usability` **everywhere** (list, detail, worksheet picker)
  with no manual edit.
- Every transition produces an `AuditEvent` automatically.
- Worksheet instrument picker drops an out-of-service instrument (warns, not blocks).
- `npx tsc --noEmit` and `python manage.py check` pass.

---

## 6. Anti-patterns (do NOT do)

- WRONG: flip a status field in one screen only; copy status into other tables; put
  transition logic inline in the view. → partial workflow that drifts (the New-UI
  dispose problem).
- RIGHT: one status/usability field read everywhere; transitions ONLY via service
  functions; cascades via signals; audit automatic; list membership via status filter.

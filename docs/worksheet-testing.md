# Worksheet — Testing Guide & Remaining Work

The Worksheet flow is **SENAITE-native** (SENAITE is the engine; the app drives it
through custom Zope views baked into the SENAITE image + plain REST). This doc
explains how to exercise it end to end and what is still left to build.

---

## Prerequisites

- Stack running: `docker compose up -d` (from the project root).
- Frontend: `http://127.0.0.1:3000` (use `127.0.0.1`, **not** `localhost` — see
  CLAUDE.md §10). Login: `admin` / `admin`.
- A worksheet pulls in analyses from **received** samples whose analyses are still
  pending (not yet on any worksheet). So you must register + receive a sample
  first, or there will be nothing to add.

> **Why receiving matters:** receiving a sample now fires SENAITE's native
> `receive` transition, which moves its analyses `registered → unassigned`
> (assignable). Without a received sample, "Add analyses" shows "0 available".

---

## Step 0 — Create test data (samples with analyses)

1. **Samples → New Sample.** Register a sample for a client, choose a Sample Type,
   and add 1–2 analysis services (e.g. *pH Level*, *Total Dissolved Solids*). Save.
2. **Samples Overview →** open that sample **→ Receive** it.
   - Repeat for a couple of samples so you have several pending analyses.

---

## Test A — Worksheet from a template (auto-layout)

1. **Administration → Worksheet Templates → New Worksheet Template.**
   - Name it (e.g. *Water Panel*), set **Number of Positions** (e.g. 3).
   - Add the same **Analysis Services** as your samples.
   - In the layout grid set, e.g., position 1 = Analysis, 2 = Analysis,
     3 = **Duplicate** of position 1. Save.
2. **Worksheet → New Worksheet →** pick that template **→ Create Worksheet.**
3. **Expected:** the detail page opens with routine analyses auto-filled from the
   pending pool **plus** a Duplicate QC row — no manual layout needed.

---

## Test B — Build a worksheet manually (blank)

1. **Worksheet → New Worksheet →** template = **None — blank worksheet →** Create.
2. On the detail, expand **"Add analyses"**, tick the pending analyses, **Add selected**.
3. **"Add Duplicate QC of position" →** choose a position **→ Add Duplicate**.
4. Edit **Analyst / Instrument / Method / Remarks →** **Save details**.
5. Remove a row with the **×** button (open state only).

---

## Test C — Results, workflow, output

1. Type a result in each row **→ Submit** (row → `to_be_verified`).
2. When the **last** analysis is submitted, the worksheet auto-moves to
   **To be verified** (SENAITE does this automatically — there is deliberately no
   manual "Submit worksheet" button).
3. **Verify** must be done by a **different user** than the submitter
   (self-verification is disabled — four-eyes compliance). Log in as a second user
   with a reviewer role to test Verify. **Retract / Reject** are also here.
4. Header **Export CSV** downloads the layout; **Print** opens a clean XelLabs COA
   (with analyst/reviewer signature lines).

**Troubleshooting:** "Add analyses" empty ⇒ no received-sample pending analyses —
redo Step 0. Frontend edits not showing ⇒ `docker restart xellabs-lims-frontend-1`
(Windows/Docker file-watch lag).

---

---

## Test D — Blank / Control QC (reference samples)

1. **Administration → Suppliers → New Supplier** (e.g. *Sigma-Aldrich*). Save.
2. **Administration → Reference Definitions → New Definition** (e.g. *pH 7 QC*).
   Add each analysis service with its expected **Result** (and optional Min/Max).
   Save. *(Set the **Blank** flag for a blank definition — expected ~0.)*
3. **Administration → Reference Samples → New Reference Sample.** Pick the
   supplier, name it, choose the **Reference Definition** (this copies its
   expected results — editable), set an expiry, Save.
4. **Worksheet → open one (Open state) → Add analyses panel → "Add Blank/Control
   QC" →** pick the reference sample **→ Add QC.** A Control (or Blank) row
   appears in the layout for every service the QC sample covers.

---

## Test E — Analyst picker, clear instrument/method, results import

- **Analyst** is now a dropdown of lab members (SENAITE users holding a lab
  role). Reassign it, **Save details**.
- **Instrument / Method** can now be set **and cleared** back to *None* —
  choose "None", **Save details**.
- **Import results:** **Export CSV**, fill in the **Result** column, then
  **Import results** (top-right) → the editable rows pre-fill → review →
  **Submit all** (or Submit per row). Matches rows by **Position**.

---

## What's implemented

- Create worksheet (blank or from template); template auto-fills routine + QC +
  duplicate positions.
- Add / remove routine analyses manually; add Duplicate QC; **add Blank/Control
  QC from reference samples**.
- **Suppliers / Reference Definitions / Reference Samples** admin modules.
- **Analyst dropdown** (lab members); Instrument / Method reassignment **and
  clear-to-None**; Remarks.
- Per-analysis result entry + Submit; **CSV results import + Submit all**;
  worksheet auto-submit; Verify / Retract / Reject (workflow).
- CSV export; COA print view.

Backend: `senaite-rebrand/worksheet_views.py` (9 custom views incl.
`@@add-worksheet-reference`, `@@update-worksheet` clear-to-None, and
`@@lab-analysts`), baked into the SENAITE image via `patch_worksheet_zcml.py` +
the Dockerfile. Suppliers/Reference Definitions/Reference Samples use plain
read-v1 / write-restapi (no custom view). Frontend:
`app/lib/senaite-worksheets.ts`, `app/actions/senaite-worksheets.ts`,
`app/actions/{suppliers,reference-definitions,reference-samples}.ts`,
`app/dashboard/{worksheets,suppliers,reference-definitions,reference-samples}/**`.

---

## Testing Verify (four-eyes) — reviewer user

Self-verification is disabled (submitter ≠ verifier). To exercise **Verify**,
either:
- **Enable self-verification for testing:** SENAITE setup → *Analyses* →
  turn on *Self-verification of results* (revert afterwards); or
- **Create a reviewer:** Administration → Users → add a user with the
  **reviewer** role, log in as them, and Verify a worksheet whose results were
  submitted by someone else.

The app operates against SENAITE with a shared service account, so in practice
Verify is available once self-verification is enabled or a distinct reviewer
identity submits vs. verifies.

---

## Remaining work — all cleared

All previously-deferred items are now done:

| # | Item | Status |
|---|---|---|
| 1 | Blank/Control QC — Suppliers + Reference Definitions + Reference Samples | ✅ Built (admin modules + worksheet wiring) |
| 2 | Reviewer test user | ✅ Documented above (Testing Verify) |
| 3 | Analyst picker | ✅ Dropdown of lab members (`@@lab-analysts`) |
| 4 | Clear Instrument/Method to None | ✅ `@@update-worksheet` clears the field directly |
| 5 | Instrument results import | ✅ CSV import → pre-fill → Submit all |
| 6 | Retire orphaned Django worksheet code | ✅ Deleted `LabWorksheetsShell`/`LabWorksheetDetail`/`django-worksheets.ts` |

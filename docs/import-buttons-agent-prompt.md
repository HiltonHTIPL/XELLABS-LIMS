# Import Buttons — Agent Prompt

Paste the block below to an AI coding agent that has access to this repo. It pairs with
`docs/import-buttons-plan.md`. Prompt design: Few-Shot (points at the finished Export work
as the exemplar), Structured CoT (explicit build order), a confirm-before-coding gate
(matches CLAUDE.md §0), and a fixed report format for a verifiable result.

---

You are a senior full-stack engineer in the **XELLABS-LIMS** repo (Next.js 16 + Django + SENAITE, all in Docker). Implement the **Import buttons** feature for the Administration list pages.

**Read these first (they are in the repo):**
- `CLAUDE.md` (root) — all rules apply. Especially: §0 (read code → present plan + name which design principles apply → wait for my "ok" **before writing any UI code**), §0e (don't add top-level nav), §11a (never show "SENAITE" in the UI), §11b (use Docker service names, not localhost, in server code), §13b (never `git push` without my go-ahead), §15 (don't stop until it's done and verified).
- `docs/import-buttons-plan.md` — the plan for exactly this feature. Follow it.

**Environment / how to run + verify:**
- Docker containers: `xellabs-lims-frontend-1` (Next.js, production build), `xellabs-lims-django-1`, `xellabs-lims-senaite-1`.
- After any `.ts/.tsx` change: `docker compose stop frontend && docker compose rm -f frontend && docker compose up -d frontend`, then wait for `✓ Ready in` in `docker logs xellabs-lims-frontend-1` before testing.
- Test at `http://127.0.0.1:3000` (NOT localhost), login `admin`/`admin`, tenant schema `demo`.
- Typecheck: `docker exec xellabs-lims-frontend-1 npx tsc --noEmit` (must exit 0).
- Work on branch `Vinod`. Do NOT commit or push.

**Pattern to mirror — the Export feature, already built (study it, copy its structure):**
- Shared helper `app/lib/exportCsv.ts`.
- `app/dashboard/_components/AdminRefShell.tsx` renders ~20 reference pages from a `columns`/`fields`/`createAction` config and has an optional `exportColumns` prop. Each reference page is a `<Type>Shell.tsx` that passes config to AdminRefShell.
- 4 custom shells with their own toolbars/tables: `SampleTypesShell`, `SampleContainersShell`, `ContainerTypesShell`, `AnalysesShell`.
- "New X" button is solid blue `#0154FC` in the top toolbar; Export is blue-outline at the bottom of the table.

**Task:** add a blue **Import** button **beside New** (top toolbar) on every suitable admin list page. Upload a CSV/XLSX → map columns by header (same headers Export writes, so an exported file re-imports) → create each row through the page's existing `createAction` → show a per-row results panel (created / skipped / errors). Build one shared `<ImportButton>` + drawer, add an import prop to `AdminRefShell` (covers ~20 pages), then wire the 4 custom shells.

**Hard rule (from Israel):** for reference fields (Department, Category, Container Type, Preservation, Sample Matrix), resolve the imported **name** to its UID using the option lists already in scope. No match → mark that row an error and skip it. Never create with a blank reference.

**Reuse, don't duplicate:** the `master-data-import` page (`useStreamingImport`) already imports Instruments + Storage Locations. Route those two Import buttons to it; do not rebuild that logic.

**Build order (make each step testable):** 1) shared `<ImportButton>` + parser + AdminRefShell wiring, enable on simple Title/Description pages first; 2) name→UID resolution for reference fields; 3) the 4 custom shells; 4) route Instruments/Storage to the existing importer.

**Before you write code, STOP and ask me these:**
1. CSV only, or CSV + XLSX?
2. Bad row: skip + report (my lean) or abort the whole file?
3. Show a parsed preview to confirm before creating, or import directly?
4. Duplicate names: skip, or attempt and let the server reject?

Then present your plan, name the design principles it uses (§0), and wait for my "ok" before coding.

**When done, report:** files changed; how Import is wired and how master-data names are resolved; `tsc` result; build result; which pages you drove live and what you observed (create a record via import and confirm it persists); and any SENAITE fields you could not map, stated honestly.

# Xellabs LIMS — Project Rules

> This file is auto-loaded by Claude Code on every session start.
> Read it fully before doing any work in this project.
> **This is the single source of truth. Keep it current.**

---

## 0d. Token Efficiency Rule — Accurate Answers, Minimal Tokens

- Investigate only what's needed to answer correctly — don't re-read files already in context, don't re-run commands whose output is already known, don't explore unrelated code paths "just in case."
- Prefer targeted reads (`Grep`, specific line ranges) over reading whole large files when only a section is relevant.
- Keep responses terse: state the finding/fix directly, skip restating the question, skip narrating steps that produced no useful signal.
- **Never trade accuracy for brevity** — verify root cause before answering; a short wrong answer costs more (rework, lost trust) than a longer correct one. Confirm file/command state before acting on it rather than assuming.

---

## 0e. Sidebar Lock Rule — Fixed Top-Level Nav, Ask Before Adding

The left sidebar's **top-level** entries are fixed to exactly: Dashboard, Clients, Samples, Methods, Batches, Worksheet, Quality, Storage Manager, Instruments, Reports, Administration (defined in `app/dashboard/_components/Sidebar.tsx`'s `NAV` array).

- **Never add a new top-level sidebar entry or group without asking the user first.** New admin-style sub-pages belong inside the Administration group (`app/dashboard/_components/adminNav.ts`'s `ADMIN_SECTIONS`, shared by the sidebar submenu and the `/dashboard/admin` grid) — not as a new top-level item.
- If a feature seems to need its own top-level nav slot, present that as an explicit question/plan (per Section 0) rather than adding it directly.
- Removing a route/backend entirely is not required when unlinking from nav — follow the existing pattern (e.g. Tenant Management, XELPulse, Compliance) of keeping the route/backend working but reachable only via Administration or direct URL.

---

## 0f. Model/Effort Escalation Rule — Ask Before Heavy Work, Don't Silently Guess

**When a task is heavy or high-stakes enough that a stronger model or higher reasoning effort would meaningfully improve correctness — large multi-file refactors, subtle root-cause debugging, security-sensitive logic, complex SENAITE/Archetypes quirks, anything where a wrong answer is costly to unwind — say so and ask the user before proceeding, rather than pushing ahead at the current model/effort and risking a less accurate answer.**

- Flag it plainly: what makes this task heavy, and what switching (model tier, e.g. Opus over Sonnet, and/or reasoning effort, e.g. high/xhigh) would likely buy in accuracy.
- Let the user decide whether to switch, stay as-is and proceed anyway, or scope the task down instead.
- This is not a blanket "ask before everything" rule — routine fixes, small edits, and tasks the current model/effort already handles reliably (per this session's own track record) don't need it. Reserve it for genuinely heavy/high-risk work.
- **Ask at ANY point, not only before starting.** If a task turns out to be harder than it first looked — the root cause is deeper than expected, an edit is fighting a subtle framework/SENAITE quirk, a "quick fix" is on its 2nd/3rd failed attempt, or new complexity surfaces mid-task — stop and offer the model/effort switch right then, mid-task, rather than grinding on at the current setting. Re-raising it partway through is expected and encouraged whenever staying at the current model/effort risks a less-than-perfect answer.
- **How to ask:** briefly say what changed / what's making it hard, name the switch that would help (e.g. "Opus + xhigh effort"), and let the user choose: switch, stay and proceed anyway, or scope down. Keep working at the current setting only if the user says to.
- **Why:** A silent best-effort attempt at a task that actually warranted more firepower risks a plausible-but-wrong answer — costlier to catch and fix later than a short upfront question. Difficulty is often only discovered partway in, so the offer to escalate must stay open for the whole task, not just its first moment.

---

## 0g. Right-Size Effort/Model to the Task — Don't Overspend Tokens on Light Work

**Match the amount of work (reading, reasoning, output) to the task's real difficulty. Heavy tasks get the care of Section 0f; light tasks must stay lean — over-investigating a trivial change wastes tokens without improving the answer.**

- **Important limitation — be honest about it:** Claude cannot silently switch its own model or reasoning-effort mid-turn; those are user-controlled (`/model`, `/fast`, `/config`, the effort toggle). So "auto-adjust" here means: (a) *behave* lean when a task is light, and (b) *proactively tell the user* when a lower (or higher) setting would fit, so they can switch. Never pretend a self-switch happened.
- **For low-complexity tasks** (one-line fixes, a single obvious edit, a color/label change, a clear-root-cause bug): go straight to the fix. Do minimal targeted reads (the one file/section involved), skip exploratory "just in case" reads, skip multi-step plans, and keep the reply to the finding + the change. This is Section 0d applied to effort, not just wording.
- **Proactively suggest downshifting** when a run of work is clearly light: e.g. "these are trivial edits — you can drop to `/fast` or a lower reasoning effort to save tokens; I'll still get them right." Mirror of 0f's escalate-*up* offer, in the other direction.
- **Still escalate up (per 0f)** the moment a task turns out heavy/high-stakes — right-sizing down never means under-powering genuinely hard work. When unsure which way a task leans, prefer accuracy: it's cheaper to spend a little more than to ship a plausible-but-wrong answer.
- **Net goal:** accuracy calibrated to difficulty, tokens minimized on everything that doesn't need them. A correct terse answer on a small task, a careful (or escalated) one on a hard task — never the reverse.
- **Why:** Spending deep-analysis effort on a trivial change burns tokens for no accuracy gain, while under-powering a hard change risks a wrong answer. Explicitly right-sizing both directions keeps answers accurate *and* cheap.

---

## 0. UI / Feature Design Rule — Read Code First, Present Plan, Wait for Approval

**Before writing any UI or feature code, follow this sequence — no exceptions:**

1. **Read** all relevant existing files (components, actions, types, models)
2. **Present** the proposed design/approach — layout, components to change, logic decisions
3. **State, inside the same plan, which Design Principles (Section 11) are being applied and how** — not just "SOLID" generically, name the specific mechanism (e.g. "shared permission class instead of duplicated inline role checks = DRY + SOLID/SRP")
4. **Wait for the user to say "ok" or give explicit approval** before writing a single line of code
5. Only after approval: implement, following the stated principles
6. After implementation, log the feature + principle(s) applied in `Codetrackbypriciple.txt` (project root)

**Why:** Prevents wasted rewrites when the approach doesn't match the user's vision, and ensures every plan is checked against the project's mandatory design principles before code is written — not retrofitted after.
**Applies to:** Any new page, component, redesign, new feature, or significant refactor.
**Does NOT apply to:** Bug fixes with a clear root cause (fix immediately), small one-line corrections.

**The Design Principles table (always in force — reference, do not duplicate):**

| Principle                    | Use?                   | Why                                                           |
| ---------------------------- | ---------------------- | ------------------------------------------------------------- |
| ✅ SOLID                      | Yes                    | Keeps code maintainable and extensible                        |
| ✅ Clean Architecture         | Yes                    | Separates UI, business logic, and infrastructure              |
| ✅ Separation of Concerns     | Yes                    | Makes features easier to develop and test                     |
| ✅ DRY                        | Yes                    | Avoids duplicated code                                        |
| ✅ KISS                       | Yes                    | Prevents unnecessary complexity                               |
| ✅ YAGNI                      | Yes                    | Avoids building features before they're needed                |
| ✅ Feature-Based Architecture | **Highly recommended** | Organizes code around business features instead of file types |
| ✅ Dependency Injection       | Yes                    | Makes testing and implementation swapping easier               |
| ✅ Adapter Pattern            | Yes                    | Isolates communication with SENAITE APIs                      |
| ✅ Factory Pattern            | Yes                    | Useful for tenant-specific UI and branding                    |
| ✅ Strategy Pattern           | Yes                    | Enables tenant-specific behavior without `if/else` chains     |

See Section 11 for the full rule. The running log of features vs. principles applied lives in `Codetrackbypriciple.txt` (project root).

---

## 0. Self-Learning Rule — Update This File on Every New Discovery

**Every mistake, correction, failed command, or new pattern must be recorded here before reporting the task done. No exceptions.**

| Trigger | Action |
|---|---|
| User corrects your approach | Add the rule here + save to memory immediately |
| A command fails and you find a workaround | Document root cause + fix here |
| You discover a new path, tool, or env fact | Add to Section 10 (Environment Facts) |
| An assumption about the environment is wrong | Correct it in this file immediately |
| Installation steps change | Update Section 0a startup commands |
| A new "always" or "never" pattern is found | Add to the relevant section |
| User says "update claude.md" | Rewrite all stale sections, add all missing rules |

---

## 0a. On Every Session Start

1. Read this file completely — all rules apply immediately.
2. Read `start-commands.txt` — full startup reference.
3. Check `xellabs-backend/.env` exists before running Django.
4. Run all commands in the **IDE integrated terminal** — never open external windows.

---

## 0b. When the User Says "Start the Project"

**Before starting containers, ensure WSL2 has at least 12GB memory.** Read `C:\Users\HILTON\.wslconfig`; if `memory=` is below `12GB` (or unset), raise it to `12GB`, then apply with `wsl --shutdown` + Docker Desktop restart before `docker compose up -d` — do this automatically, without asking, whenever the user says to start/run the project. If it is already ≥12GB, leave it and start directly. (Host has only ~15.7GB total — never set the WSL cap so high it starves Windows; 12GB is the floor, not a target to exceed without reason.)

**Floor raised from 8GB → 12GB (2026-07-20):** the full stack (SENAITE + Django + Celery×3 + Postgres + Redis + a dev-mode Next.js frontend, which spikes memory hard while webpack-compiling routes) hit a real `ENOMEM: not enough memory, write` crash at 8GB — frontend container alone was using 2.3GB with only ~173MB truly free in the VM. `docker stats --no-stream` is the fast way to confirm current usage per-container if this recurs; `free -h` inside a container shows the WSL2 VM's own memory state.

**Everything runs in Docker Desktop — one command starts all services:**

```powershell
# PowerShell (IDE integrated terminal)
cd c:\Hilton\Projects\XELLABS-LIMS
docker compose up -d
```

This starts all 5 containers: PostgreSQL → Redis → Django → Celery → SENAITE.  
Django auto-runs `migrate` on startup.

### Service URLs
| Service | URL | Login |
|---|---|---|
| Django API | http://127.0.0.1:8001 | Token auth |
| Django Admin | http://127.0.0.1:8001/admin | superuser |
| SENAITE | http://localhost:8080/senaite | admin / admin |

### After code changes — rebuild Django/Celery image:
```powershell
cd c:\Hilton\Projects\XELLABS-LIMS
docker compose up -d --build
```

### Check status:
```powershell
docker ps --filter "name=xellabs" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Check logs:
```powershell
docker logs xellabs-lims-django-1 --tail 50
docker logs xellabs-lims-celery-1 --tail 50
docker logs xellabs-lims-senaite-1 --tail 20
```

### Stop everything
```powershell
# Django: Ctrl+C in terminal
sudo service postgresql stop
sudo service redis-server stop
docker stop senaite
```
**Never run `docker-compose down -v` — it deletes the Postgres data volume.**

---

## 0c. Key Paths Reference

| What | Path / Value |
|---|---|
| Project root | `c:\Hilton\Projects\XELLABS-LIMS` |
| Django backend | `c:\Hilton\Projects\XELLABS-LIMS\xellabs-backend` |
| Django .env | `c:\Hilton\Projects\XELLABS-LIMS\xellabs-backend\.env` |
| Django settings module | `config.settings` |
| Django root urls | `config.urls` |
| Celery app module | `config.celery:app` |
| Docker Compose file | `c:\Hilton\Projects\XELLABS-LIMS\docker-compose.yml` |
| Django container | `xellabs-lims-django-1` — port 8001 |
| Celery container | `xellabs-lims-celery-1` |
| PostgreSQL container | `xellabs-lims-postgres-1` — port 5432 |
| Redis container | `xellabs-lims-redis-1` — port 6379 |
| SENAITE container | `xellabs-lims-senaite-1` — port 8080 |
| SENAITE image | `senaite/senaite:v2.6.0` |
| Broken SENAITE buildout | `~/senaite-dev/senaite.core` — **DO NOT USE** |
| start-commands.txt | `c:\Hilton\Projects\XELLABS-LIMS\start-commands.txt` |

---

## 1. Project Overview

**Xellabs LIMS** is a Laboratory Information Management System — healthcare/lab compliance software. Every change must be correct, traceable, and compliant. No shortcuts.

### Stack
| Layer | Technology |
|---|---|
| Backend | Django 6 + Django REST Framework 3.17 |
| Database | PostgreSQL 16 (Docker container) |
| Cache / Queue broker | Redis 7 (Docker container) |
| Task queue | Celery 5 (Docker container) |
| Auth | DRF Token + Session Authentication |
| CORS | django-cors-headers |
| Filtering | django-filter + DRF SearchFilter + OrderingFilter |
| Pagination | PageNumberPagination — 50 items/page |
| Reference LIMS | SENAITE v2.6.0 (Docker container) |
| Container orchestration | Docker Compose (`docker-compose.yml` in project root) |

### DB credentials (from `.env`)
```
DB_NAME=xellabs_lims
DB_USER=xellabs_user
DB_PASSWORD=3333
DB_HOST=postgres
DB_PORT=5432
```

---

## 2. Apps and Their Domains

| App | Models |
|---|---|
| `core` | User (roles: admin, lab_manager, analyst, reviewer, client, receptionist), Client |
| `lims` | SampleType, Method, Test, Specification, Sample, AnalysisRequest, Worksheet, WorksheetAssignment, Result |
| `inventory` | StorageLocation, Reagent, Standard, Solvent (abstract base: InventoryItem), Lot (GenericFK), InventoryTransaction, ExpiryAlert |
| `instruments` | Instrument, InstrumentMethod, Calibration, Maintenance, InstrumentRun, InstrumentResultImport |
| `workflow` | WorkflowState, WorkflowTransition, Task, TaskAssignment, Approval, ElectronicSignature |
| `audittrail` | AuditEvent, DataChangeLog, LoginEvent, SecurityEvent |
| `reporting` | Report (COA, Worksheet, QC, Inventory, Instrument, Custom) |

---

## 3. API Development Rules

### Pattern for every new endpoint:
1. Serializer → `<app>/serializers.py`
2. ViewSet → `<app>/views.py` (use `ModelViewSet` or specific generic view)
3. Router → `<app>/urls.py`
4. Include → `config/urls.py`

### DRF already configured — do not override without reason:
- Auth: TokenAuthentication + SessionAuthentication
- Permission: IsAuthenticated (all endpoints require login by default)
- Filter backends: DjangoFilterBackend, SearchFilter, OrderingFilter
- Pagination: PageNumberPagination, page_size=50

### Never in serializers:
- Never include `password` in output
- Never expose raw tokens or encryption keys

### Role-based access:
- Use `request.user.role` for role checks
- Put permission classes in `core/permissions.py` — never inline in views
- Roles: `admin`, `lab_manager`, `analyst`, `reviewer`, `client`, `receptionist`

---

## 4. Model & Migration Rules

### Always:
- `python manage.py makemigrations <app> --name <description>` after model changes
- `python manage.py migrate` before testing
- Commit migration files to git

### Never:
- Never edit migration files manually (except merge conflicts)
- Never `migrate --fake` without understanding the reason
- Never delete migration files — squash instead
- Never modify the DB directly with SQL

### Custom User model — always import as:
```python
from django.contrib.auth import get_user_model
User = get_user_model()
```
Never use `django.contrib.auth.models.User` directly.

---

## 5. Audit Trail Rules — Non-Negotiable

This is healthcare/lab compliance software. Every sensitive action must be logged.

| Model | When to log |
|---|---|
| `AuditEvent` | Sample status changes, result verification/rejection, approvals, e-signatures, inventory transactions, calibration pass/fail |
| `DataChangeLog` | Field-level updates on Sample, Result, AnalysisRequest, Instrument |
| `LoginEvent` | Every login attempt — success AND failure |
| `SecurityEvent` | Permission denied, unauthorized access attempts |

**Never skip audit logging on compliance-sensitive operations.**

---

## 6. Workflow & E-Signature Rules

- E-signatures (`workflow.ElectronicSignature`) are required before any `Approval` → `approved`
- Approvals use `GenericForeignKey` — always pass both `content_type` and `object_id`
- Always validate `request.user.role` against `WorkflowTransition.required_role` before changing status

---

## 7. Environment & Secrets Rules

### .env location: `xellabs-backend/.env`
```
DEBUG=True
SECRET_KEY=your-secure-django-secret-key
DB_NAME=xellabs_lims
DB_USER=xellabs_user
DB_PASSWORD=3333
DB_HOST=localhost
DB_PORT=5432
```

### Never commit:
- `.env`
- Any file with `SECRET_KEY`, `DB_PASSWORD`, API credentials
- `.pyc` / `__pycache__`
- `db.sqlite3`

### Before every git commit:
- Run `git diff --stat` — confirm `.env` is not staged
- Confirm no secrets in any changed file
- Run a commit checker before creating the commit: `git status` (catch unintended/untracked files) + `git diff` (review the actual content of every staged change, not just the file list) — read the full diff, don't just skim filenames
- If anything unexpected, suspicious, or secret-looking turns up, stop and resolve it before running `git commit`

---

## 8. Testing Rules

- Tests go in `<app>/tests.py` using `TestCase` or `APITestCase`
- Use `APIClient` from `rest_framework.test` for endpoint tests
- Never mock the database — run against real PostgreSQL
- Use `--keepdb` flag for speed on repeated runs
- Run all: `python manage.py test`
- Run one app: `python manage.py test <app>`

---

## 9. Celery Rules

- Broker: `redis://localhost:6379/0`
- App module: `config` (initialized in `config/celery.py`)
- Start worker: `celery -A config worker --loglevel=info`
- Never run long-running tasks synchronously in views — always dispatch to Celery

---

## 10. Infrastructure & Environment Facts

### PostgreSQL + Redis — run as Docker containers (NOT in WSL)
- **There is no standalone WSL Ubuntu distro on this machine** — `wsl -l -v` shows only `docker-desktop`. Any older instruction using `wsl -d Ubuntu-22.04 -- sudo ...` or host `apt-get` is obsolete and will fail (`WSL_E_DISTRO_NOT_FOUND`).
- Postgres and Redis are Docker containers started by `docker compose up -d`:
  - `xellabs-lims-postgres-1` (host port `127.0.0.1:15432` → 5432)
  - `xellabs-lims-redis-1` (host port `127.0.0.1:6380` → 6379)
- Start/stop with compose, not `service`: `docker compose start postgres redis` / `docker compose stop postgres redis`.
- The `xellabs_user`/`xellabs_lims` DB is created automatically by the Postgres container's env/init — no manual `sudo -u postgres psql` step.
- WSL2 memory is capped in `C:\Users\HILTON\.wslconfig` (`memory=8GB`, `processors=6`). Changing it needs `wsl --shutdown` + Docker Desktop restart to take effect.

### SENAITE — runs in Docker container (WSL)
- Container: `senaite`, image: `senaite/senaite:v2.6.0`
- Start: `docker start senaite`
- Logs: `docker logs -f senaite`
- **Never use** `~/senaite-dev/senaite.core` — buildout is broken (Python 2-only `Products.ATContentTypes` and `plone.app.referenceablebehavior` packages block install on Python 3.8)

### Environment facts — things that went wrong and were corrected
| Fact | Detail |
|---|---|
| Django runs via **gunicorn with no `--reload`** | `docker-compose.yml`'s django/celery commands never pass `--reload`/watchmedo for Django itself (only Celery uses `watchmedo auto-restart`). Even though `./xellabs-backend:/app` is volume-mounted, gunicorn workers cache imported Python modules in memory — editing `models.py`/`serializers.py`/`views.py` and hitting the API again silently keeps serving the OLD code (e.g. new serializer fields just don't appear in the response, no error). **After any backend code change, `docker restart xellabs-lims-django-1`** (no rebuild needed for pure `.py` changes) before testing — this cost real debugging time twice in one session (looked like a routing 404, then looked like missing serializer fields, both were just stale gunicorn workers). |
| `lims`/`inventory`/`instruments`/`workflow`/`audittrail`/`reporting` are **TENANT_APPS**, not shared | Their tables/API routes only exist inside a real tenant schema (e.g. `demo`), never in `public`. A fresh dev env's one-time setup only creates the `public` tenant — hitting `/api/lims/*` (or any tenant-app endpoint) via `public` 404s even though the model/serializer/view/urls.py are all correctly wired, while `core` (SHARED_APPS: users, clients) endpoints work fine. Fix: set `DEFAULT_TENANT_SCHEMA=<real-tenant-schema>` (e.g. `demo`) in the root `.env` and recreate the frontend container — `app/lib/django.ts` reads this env var and sends it as the `X-Tenant-Schema` header when no subdomain-based tenant is present. Check existing tenants first: `docker exec xellabs-lims-django-1 python manage.py shell -c "from core.models import Tenant; [print(t.schema_name) for t in Tenant.objects.all()]"`. |
| Git Bash ≠ WSL | The Bash tool runs in MINGW64 (Git Bash), NOT WSL. `sudo` does not work in Git Bash. There is no user Ubuntu distro here — only `docker-desktop`. Run infra commands against Docker containers (`docker exec ...`), not a WSL shell. |
| `winget` is blocked | Network policy returns 403 Forbidden on this machine. Never use winget. |
| No standalone WSL distro | `wsl -l -v` shows only `docker-desktop`. Any `wsl -d Ubuntu-22.04 -- ...` command fails with `WSL_E_DISTRO_NOT_FOUND`. Do host-level work through Docker containers instead. |
| Multiple background apt processes stack | Never spawn more than one `apt-get` background command. If one is running, wait for it — spawning more causes dpkg lock conflicts |
| Docker Desktop path | `C:\Program Files\Docker\Docker\Docker Desktop.exe` |
| SENAITE Docker tags | Use `v2.6.0` not `latest` — `latest` tag doesn't exist on Docker Hub |
| `TENANT_DOMAIN_MODEL` not `DOMAIN_MODEL` | django-tenants requires `TENANT_DOMAIN_MODEL = "core.Domain"` in settings. Using `DOMAIN_MODEL` causes `AttributeError` on every request — 500 on all endpoints |
| Public tenant + localhost domain required | django-tenants `TenantMainMiddleware` needs a `Tenant(schema_name='public')` and `Domain(domain='localhost')` row in the DB or all requests to `localhost` return 404. Create once after DB reset via `manage.py shell` |
| Django superuser lost on container rebuild | `docker compose up -d --build` recreates the image but **not** the volume, so the DB is preserved. Superuser survives. But first-ever build starts with empty DB — create superuser with: `docker exec xellabs-lims-django-1 python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.create_superuser('admin','admin@xellabs.com','admin')"` |
| Frontend now runs `next dev` locally, NOT production build (changed 2026-07-17) | `docker-compose.yml`'s frontend `command:` overrides the Dockerfile's default CMD with `npm run dev -- -H 0.0.0.0` for fast local iteration (hot-reload in seconds, no manual restart needed after a `.tsx/.ts` change — the dev server picks it up live). `NODE_ENV` default changed `production` → `development` in both `docker-compose.yml` and root `.env` (safe — `app/lib/session.ts` gates the `Secure` cookie flag on `FORCE_SECURE_COOKIES`, not `NODE_ENV`, per the fix documented further down this table). **The Dockerfile's own CMD (`npm run build && npm start`) is unchanged** — it still reflects real production behavior; run it manually (`docker exec xellabs-lims-frontend-1 sh -c "npm run build && npm start"`, or a separate compose override) before any push/deploy check that must mirror actual production, since `next dev` doesn't catch every build-time-only error. Frontend healthcheck `start_period` reduced 120s→60s to match the faster dev-server startup. If a change ever needs the real production container instead (e.g. debugging a `next build`-only failure), temporarily comment out the `command:` override and recreate. |
| **`docker restart xellabs-lims-frontend-1` silently breaks every already-open browser tab's HMR — new code never loads until a hard refresh, with zero visible error to Claude** (confirmed 2026-07-21) | Root cause: an open browser tab's HMR/Turbopack WebSocket connects once on page load; restarting the frontend container kills that socket, but the tab has no way to know the dev server came back, so it keeps rendering the OLD in-memory JS bundle indefinitely — no console error, no failed network request Claude can see from `docker logs`. Symptom: I edit a `.tsx` file, `docker logs` shows `✓ Compiled /route in Ns` (proof the SERVER has the new code), yet the user reports "no change happened" in the browser — this is not a compile failure, the new code simply never reached that tab. The only log-visible trace is indirect and **only appears if the user submits a form/action on the stale page**: `Error: Failed to find Server Action "<hash>". This request might be from an older or newer deployment.` (a stale Server Action ID baked into the old bundle no longer matches the restarted server's action manifest) — if that specific error is seen, it confirms the tab is running pre-restart code. **Rule: any time the frontend container is restarted (`docker restart`/`docker compose restart frontend`, whether by Claude or as a side effect of a rebuild) — before saying "please check the UI now", explicitly tell the user to hard-refresh the tab (`Ctrl+Shift+R` / `Ctrl+F5`), not just reload — a normal reload can still serve a cached stale bundle.** Do not diagnose "the code isn't there" from `docker logs`/`tsc`/file-contents alone when the user reports no visible change right after any container restart — check for a stale tab first, since the container-side code and TypeScript can both be 100% correct while the browser still shows the old page. |
| **Turbopack dev server can silently fail to hot-reload a plain inline-style edit (no import/logic change) — no error, no recompile log line, old style keeps rendering** (confirmed 2026-07-21) | Root cause, confirmed by direct evidence: after editing a `style={{...}}` object (adding a `maxWidth` constraint) in `SamplesOverviewShell.tsx` and saving, `docker logs xellabs-lims-frontend-1 \| grep "samples-overview"` showed **no new `○ Compiling` / `✓ Compiled` line at all** for that route after the edit — only repeated `GET .../samples-overview 200` responses reusing the prior compiled output. This is different from the HMR-tab-goes-stale gotcha above (that one is a *client/browser* problem after a container restart); this is the *dev server itself* not registering the file change as needing a recompile — Turbopack's Fast Refresh occasionally misses a pure-JSX-attribute-value change with no new imports/hooks/exports, especially several edits into the same file in one session. **Rule: after any edit that changes only inline JSX style values (not logic/imports/hook order), confirm a fresh `✓ Compiled /<route>` line actually appears in `docker logs` for that specific route post-edit before telling the user to test — if it's missing, don't just wait/hope; run `docker restart xellabs-lims-frontend-1` immediately to force a full rebuild, THEN tell the user to hard-refresh.** Also confirmed as a side effect of that restart: a transient `Error: ENOENT: no such file or directory, open '/app/.next/server/pages-manifest.json'` appeared once during the rebuild window (Turbopack regenerating its `.next` manifest mid-restart) — this self-resolved within the same restart cycle (a subsequent `✓ Compiled /_error` line followed and normal `GET ... 200` traffic resumed); it is not a code bug, don't chase it as one, just confirm normal 200 responses return afterward. Also expect the §10a vpnkit host↔container tunnel drop to recur immediately after this kind of restart (host `curl` returns empty/`000` for ~10-60s while `docker exec ... node -e "http.get(...)"` from inside the container already returns 200) — poll host-side `curl` per the existing §10a procedure rather than assuming the restart failed. |
| **A style/token edit can keep serving the OLD value even after `docker restart` + a partial `.next` cache clear — because Turbopack REUSES stale compiled chunks under `.next/server/chunks`** (confirmed 2026-07-22, cost ~5 failed "no change" round-trips) | Root cause, proven not guessed: after darkening two design tokens in `app/dashboard/_components/tokens.ts` (`faint '#9AA1B2'→'#6B7280'`, `muted '#6B7280'→'#4B5563'`) + mirroring in `globals.css`, the browser kept rendering the OLD light gray across multiple hard-refreshes and even a fresh tab. Verified the running container's **source** already had the new values (`docker exec … grep tokens.ts`) AND that `page.js` was freshly recompiled — yet `docker exec xellabs-lims-frontend-1 sh -c "grep -rl '9AA1B2' /app/.next"` still returned **multiple `/app/.next/server/chunks/ssr/app_*.js` files containing the old color** (`9AA1B2` only ever came from `tokens.ts`). So the *server itself* was serving pre-edit bytes: a plain `docker restart` does **not** force a full recompile, and an earlier partial clear that removed only `.next/cache` + `.next/static` **left `.next/server/chunks` intact**, which Turbopack happily reused. **Rule: when a token/theme/shared-module edit stubbornly "doesn't change" despite confirmed-correct source in the container, do NOT keep restarting or blaming the browser — grep the compiled output for the OLD value first (`docker exec xellabs-lims-frontend-1 sh -c "grep -rl '<OLD_HEX>' /app/.next/server 2>/dev/null"`). If old chunks exist, wipe the WHOLE build output, not just cache: `docker exec xellabs-lims-frontend-1 sh -c "find /app/.next -mindepth 1 -maxdepth 1 ! -name cache -exec rm -rf {} +; rm -rf /app/.next/cache/* 2>/dev/null"` then `docker restart xellabs-lims-frontend-1`.** Note `/app/.next/cache` is the mounted **named volume** (`frontend_next_cache`) and can't be `rm`'d whole while running (`Resource busy`) — delete its *contents* (`/app/.next/cache/*`) and everything else under `.next` by name, excluding the `cache` mount point itself. Shared-module edits (tokens, theme, a util imported everywhere) are far more prone to this than a single-component edit, because their chunks are cached under many route bundles at once. Confirm the fix the same way you found it — re-grep `.next/server` for the OLD hex and expect **zero** hits after the full wipe + recompile. |
| **Slow first-hit route compiles right after a frontend restart show LOW CPU% — that's expected, not a sign of a stuck/broken process** (confirmed 2026-07-21) | After `docker restart xellabs-lims-frontend-1` (or any fresh `docker compose up`), the first request to each route pays a real Turbopack cold-compile cost — confirmed live: `/dashboard` took 38.1s, `/dashboard/samples-overview` took 71s on first hit, while `docker stats` showed the frontend container at only ~22% CPU (on an 8-core/12GB WSL2 allocation) and Django/Postgres/Redis all near-idle. This is expected: Turbopack's dev-mode compile (module resolution, transform, `.next` cache I/O) is largely single-threaded/IO-bound, so it can take tens of seconds wall-clock while barely moving CPU%— roughly 1 core saturated reads as ~12% of an 8-core box. **Do not diagnose "why is it slow when CPU is low" as resource starvation or a hung process** — check `docker logs` for an active `○ Compiling ... / ✓ Compiled ... in Ns` line (proof it's actively working, not stuck) and `docker stats`/`free -h` only to rule out genuine memory pressure (which would show high MEM% or near-zero `available` in `free -h`, not low CPU%). Once a route compiles once, it's cached and subsequent loads are fast (`GET /login 200 in ~1.4s` after first compile) — the slowness is a one-time-per-route cold-start cost, not a persistent problem, and resolves itself as the user navigates the app. |
| Django backend now auto-reloads too (changed 2026-07-17) | `docker-compose.yml`'s django command gained a `--reload` flag on gunicorn — `.py` changes now take effect live, no more manual `docker restart xellabs-lims-django-1` after editing `models.py`/`serializers.py`/`views.py` (the old gunicorn-no-reload gotcha below is now fixed at the source; kept here for history/context). |
| (Historical, now fixed above) Next.js used to run in **production mode** (`npm run build && npm start`) | Frontend Dockerfile CMD is `npm run build && npm start` — this is what actually still runs in the Dockerfile itself and in any real deploy; local dev now overrides it with `next dev` per the row above. Do NOT use `/app/.next` anonymous volume in production (dev-only Turbopack workaround) — but `/app/.next/cache` (webpack/SWC compilation cache only, not build output) IS safe as a **named** volume (`frontend_next_cache`, added to `docker-compose.yml` 2026-07-16) and persists across every recreate. |
| TypeScript strict mode catches `unknown` in JSX | In production build, `ev.details?.someField` returns `unknown` and cannot be used directly in JSX or template literals. Always cast: `ev.details.field as string` or use `(ev.details?.field as string \| undefined)` in the condition. |
| Recharts `formatter` prop type mismatch | Recharts `Tooltip formatter` receives `ValueType | undefined`, not `number`. Do NOT type the parameter as `number`. Use `(v) => ...` and guard with `v ?? 0`. |
| `type` re-export from action files | If a component imports `type Foo` from an action file (`'use server'`), the action file must explicitly re-export it. Otherwise import directly from the source (e.g. `@/app/lib/senaite`). |
| Celery task missing `schema_context()` → silent per-tenant sync failure | `inventory/tasks.py`'s `sync_storage_location_to_senaite`/`sync_box_slots_to_senaite` queried `StorageLocation` (a tenant-app model) with no schema set. The Celery worker process has no request context, so it defaults to the `public` schema — where `storage_locations` doesn't exist — and the task crashes with `relation "storage_locations" does not exist` on every single run. Result: **every StorageLocation ever created silently never reached SENAITE**, even though `docker logs celery` showed the task in the registered `[tasks]` list (registration ≠ successful execution — always check for the task's own INFO/ERROR log line, not just that it's registered). Fixed by mirroring `core/signals.py`'s existing AR-sync pattern: capture `connection.schema_name` in the Django signal (which *does* have request/tenant context) and pass it as an explicit task arg, then wrap the task body in `with schema_context(schema_name):`. **Any new Celery task touching a tenant-app model must take `schema_name` as an argument and wrap its body in `schema_context()` — never assume the worker inherits the caller's schema.** Also caught: `bulk_create()` never fires `post_save`, so the `regenerate-slots` endpoint (which bulk-creates slots directly) needs its own explicit sync call — the auto-sync signal only fires for `.save()`/`.create()`. After changing a task's signature, `docker restart <celery-container>` — `watchmedo auto-restart` does not reliably reload Celery's registered task signatures on every `.py` save. |
| SENAITE Site/Location/Shelf Title columns showed blank | `StorageModal.tsx`'s `computeSenaiteDefaults()` only auto-fills these fields on a location's *descendants* by walking up the ancestor chain — it never defaults a location's own field for itself (a top-level `room` has no ancestor, so its own `site_title` stayed `''` forever unless someone manually typed it in), **and it never runs at all for auto-generated `box_location` slots**, since those are created via `bulk_create()` in `inventory/signals.py` and `regenerate_slots` — not through the create-location form. Fixed in two parts, both in `inventory/models.py`: (1) `StorageLocation.save()` defaults `site_title`/`location_title`/`shelf_title` to the location's own `name` when it's the owning type (`room`→site, `fridge/freezer/cabinet`→location, `shelf`→shelf); (2) `inherit_senaite_fields_from_ancestors()` walks up `self.parent` to fill any tier the location *doesn't* own (covers `box`, which inherits all three tiers from its ancestors). Since slots bypass `save()` via `bulk_create()`, added `StorageLocation.slot_inherited_fields(parent)` — a plain copy of the parent box's already-resolved tier fields (the box will have them populated by the time its `post_save` fires, since `save()` runs first) — and pass `**inherited` into every slot's constructor in both `inventory/signals.py` and the `regenerate-slots` action in `inventory/views.py`. Existing boxes/slots created before this fix needed a one-time backfill: re-save every `box`, then bulk-`.update(**StorageLocation.slot_inherited_fields(box))` its existing slots, then re-queue `sync_box_slots_to_senaite` for each box. |
| `'use server'` files can only export async functions | A `'use server'` action file (e.g. `app/actions/users.ts`) cannot export a plain object/const (e.g. a role-label lookup map) — Next.js build fails with `A "use server" file can only export async functions, found object`. Type exports are fine (erased at compile time); only runtime value exports are restricted. Fix: move shared constants/lookup maps into a plain module (e.g. `app/lib/roles.ts`) and import from there in both the action file and the client components — never define them inside the `'use server'` file itself. |
| Session cookie `secure: NODE_ENV === 'production'` breaks login over HTTP | Docker Compose always sets `NODE_ENV=production` for the frontend (needed for `npm run build && npm start`), so gating the `Secure` cookie flag on `NODE_ENV` makes the browser silently drop the session cookie on every plain-HTTP deployment — symptom: login succeeds, then any click "logs you out" (redirected to `/login`) because the cookie never actually got stored. Fixed in `app/lib/session.ts`: gate `secure` on `process.env.FORCE_SECURE_COOKIES === 'true'` instead. Only set `FORCE_SECURE_COOKIES=true` once real TLS/HTTPS is in front (e.g. a reverse proxy) — never based on `NODE_ENV` alone. |
| SENAITE `complete=true` on list endpoints is a hidden O(n) full-object-resolution cost | `fetchSenaiteStorageLocations()` (`app/lib/senaite.ts`) hung the Storage List page at 864 rows because `?complete=true` forces Plone/SENAITE to fully resolve (wake up) every matching object instead of reading cheap catalog-brain metadata. **Only pass `complete=true` when a field you render isn't already standard catalog metadata** (title/description/review_state/id/uid/created/modified usually are; custom AT/DX schema fields like `SerialNo`/`AssetNumber`/reference fields usually aren't — see `fetchSenaiteInstruments`, which legitimately needs it). Before adding a new SENAITE list fetcher, check whether the rendered fields need `complete=true` at all — default to leaving it off. Also added `app/dashboard/<route>/loading.tsx` as the standard pattern for any route awaiting a slow upstream (SENAITE) call in a server component — Next.js App Router auto-wraps it in Suspense so the shell renders instantly instead of blocking blank. |
| Deleting `Client`/`User` from the public schema crashes | Both live in the public schema, but their delete-cascade checks query `Sample` (a tenant-app model) → `relation "samples" does not exist`. Any shell/task deleting a Client or User must wrap in `schema_context('<a-tenant-schema>')`. To fully remove a test tenant: delete its users inside its own schema, then in `schema_context('public')` set `t.auto_drop_schema = True; t.delete(force_drop=True)`. |
| `http://localhost:3000` gives `ERR_CONNECTION_RESET` **OR silently serves a stale/old build**, `127.0.0.1:3000` works fine and is always current | On this machine, the browser resolves `localhost` to `::1` (IPv6) first. `netstat -ano \| grep :3000` shows **two different PIDs** listening: the real Docker-forwarded port on `0.0.0.0:3000`/`[::]:3000`, and a separate `wslrelay.exe` process listening specifically on `[::1]:3000` that does not reliably track the current container — sometimes it resets the connection outright (`ERR_CONNECTION_RESET`, `curl -6 http://[::1]:3000` also resets), other times (confirmed 2026-07-21) it serves a **stale page with none of the latest code changes, no error at all** — indistinguishable from a real "my code isn't reflected" bug just by looking at the page. **If a user reports a UI change "didn't happen" and the browser address bar shows `localhost:3000` (not `127.0.0.1:3000`), check that FIRST** — before assuming a stale HMR bundle, a compile error, or re-reading/re-editing the source file — by having them switch to `http://127.0.0.1:3000` and hard-refresh. IPv4 always works (`curl -4 http://127.0.0.1:3000` → 200) and reflects the real running container. **Always use `http://127.0.0.1:3000` in the browser on this machine**, not `localhost:3000`. Do not disable IPv6 system-wide to "fix" this — several adapters (OpenVPN, ZeroTier, WSL) may depend on it. |
| Adding a frontend npm package requires host lock-file update + `-V` rebuild | Frontend Dockerfile runs `npm ci`, which fails if `package-lock.json` doesn't list the new package. After editing `package.json`: run `npm install --package-lock-only --ignore-scripts` on the host in `xellabs-frontend/`, then `docker compose up -d --build -V frontend` — `-V` is required to renew the `/app/node_modules` **anonymous** volume, otherwise the container keeps the old modules from the previous image. |
| `Permissions-Policy` header in `next.config.ts` can silently block the camera | The frontend's security headers included `Permissions-Policy: camera=()`, which forbids `getUserMedia` on every page regardless of browser/OS permission settings — the error is indistinguishable from a user permission denial (NotAllowedError). Cost significant debugging time chasing Brave/Windows settings. Now `camera=(self)`. **When a browser API mysteriously fails despite correct browser permissions, check the app's own security headers (`next.config.ts headers()`, helmet, CSP/Permissions-Policy) first.** |
| Camera QR scanning needs a secure context | `navigator.mediaDevices.getUserMedia` only works over HTTPS or `localhost`. The storage-label QR scanner (`StorageLocationInput.tsx`) works on `localhost:3000` dev, but on a plain-HTTP LAN/server deployment the camera button will show "Camera not available" until TLS is put in front. Keyboard-wedge (USB) scanners are unaffected — they type into the focused input. |
| Sample list/detail pages read a stale denormalized field, not live storage state | `Sample.storage_location` (`lims/models.py`) is a plain text field, separate from the authoritative `StorageLocation.assigned_sample_id`/`is_occupied`. The QR-label assign flow updated only the storage side, so Samples Overview / Lab Samples kept showing blank location and stale occupied state after a sample was stored via scan. Fixed by syncing `Sample.storage_location` inside `_assign_sample_to_slot()` (write the resolved path) and in the `unassign` action (clear it) — the single choke point both entry paths already share, so no list page needs an extra per-row fetch (would be N+1). **Any future feature that changes where a sample physically sits must update through this one function, not touch `StorageLocation` directly, or the same staleness bug returns.** |
| Storage label codes are hidden + pk-derived | `StorageLocation.label_code` (boxes `BX-<pk>`, slots `BX-<pk>-A1`) is system-generated in `inventory/signals.py` (`_register_label_code_signal`, connected BEFORE the slot-autogenerate signal so slots can copy the box code during `bulk_create`). Never derived from the user-editable name (names can duplicate); unique constraint lives on the code. Resolve/assign endpoints: `GET /api/inventory/storage-locations/resolve-label/?code=` and `POST .../assign-by-label/`. |
| Superadmin ≠ `role='admin'` | Every tenant's lab admin also has `role='admin'`; platform-level gating (Tenant Management) must check `is_superuser` — exposed via `/api/auth/me/`, enforced by `core/permissions.py IsSuperAdmin`, carried in the frontend session as `session.isSuperuser` and in the Sidebar via the `superuserOnly` nav flag. |
| Fresh/wiped DB has zero `Tenant`/`Domain` rows → every API call 404s | `XelLabsTenantMiddleware` (`config/tenant_middleware.py`) needs a `Domain(domain='localhost')` (plus `127.0.0.1`, `django`) row pointing at the `public` `Tenant`, or django-tenants raises `No tenant for hostname "localhost"` and Django returns a plain 404 on **every** endpoint — including `/api/clients/` — with only a generic "Error 404" banner surfaced on the frontend, easy to miss. Symptom looked exactly like "client creation silently does nothing." Fix: run the "One-time setup after a full DB wipe" block below immediately after any DB reset. |
| Client deletion in Django does **not** propagate to SENAITE (accepted gap, not building sync) | `core/signals.py` only registers a `post_save` receiver for `Client` (`_register_client_signal`) — there is no `pre_delete`/`post_delete` handler. Deleting or deactivating a Client in XelLabs leaves an orphaned record in SENAITE forever; remove it manually inside SENAITE's own Clients UI. Also: deleting a `Client` via the normal Django ORM `.delete()` hits the cross-schema cascade crash (`relation "samples" does not exist`) in an install with no tenant schemas yet — use a raw `DELETE FROM clients WHERE ...` via `connection.cursor()` instead when that happens. |
| SENAITE `@groups` role PATCH silently no-ops on the dict-diff shape that works for `@users` | `PATCH @users/<username> {"roles": {"Analyst": true}}` is a genuine diff against the user's current roles (confirmed, used by `set_senaite_user_role`). The exact same shape sent to `PATCH @groups/<id>` returns 200/204 (looks successful) but **does not change the group's role list at all** — confirmed by toggling a role on then back off and re-fetching the group: still shows the stale list. Also, group creation needs `{"groupname": id, "title": ...}` — POSTing `{"id": ...}` 400s with "Property 'groupname' is required" (the field name differs from `@users`' own `{"username": ...}` POST shape). Fixed in `core/senaite_service.py`'s `set_senaite_group_role()`: GET the group first, mutate the roles set locally, then PATCH back the **full** `roles` list. Any future SENAITE group-role write must use this read-modify-write pattern, never the users-style dict diff. |
| SENAITE `Calculation.Formula` field can **never** be written via any REST API path when it references an Interim Field keyword | Root-caused by reading the actual source inside the running container (`bika/lims/content/calculation.py` + `validators.py`), not guessing. The registered `FormulaValidator` (`validators=('formulavalidator',)` on the AT `Formula` field) reads `request.form.get("InterimFields", [])` — raw classic Zope form-POST data, populated only by SENAITE's own browser form submission. `plone.restapi`'s JSON body parsing never touches `request.form`, so this validator sees `interim_fields=[]` on every REST call (legacy v1 create, restapi POST/PATCH, any field ordering, even PATCHing Formula in a separate request *after* InterimFields was already saved and confirmed present via GET) — a formula like `[Ca]+[Mg]` (real AnalysisService keywords) works fine via REST since those are checked against the live services catalog instead, but any interim/custom keyword is rejected forever, permanently, not fixable by request sequencing. `Calculation` is Archetypes-based (unlike Dexterity types such as `SampleTemplate`), so the existing `IFieldDeserializer` fix pattern doesn't apply. Fixed with two custom Zope `browser:page` views (`senaite-rebrand/calculation_views.py`, registered via `patch_calculation_zcml.py`, baked into the SENAITE Dockerfile) — `@@create-calculation` on the `bika_setup/bika_calculations` folder and `@@update-calculation` on the object itself — that call `bika.lims.api.create()`/`api.edit()`. Those SENAITE-blessed helpers set AT fields via `field.getMutator(obj)` directly, never `field.validate()`, so the broken validator is never invoked; `Calculation.setFormula()` itself is already safe to call unvalidated since it only extracts real-service keywords for `DependentServices` and silently ignores everything else. **Also confirmed**: Calculation object creation is unreliable the same way `AnalysisService` is — a failing/invalid v1 or restapi create call still leaves an untitled orphan shell object behind; the new custom views avoid this entirely by not going through either of those paths. |
| SENAITE `Calculation.TestParameters`/`TestResult` also never auto-populate via direct API calls | These two fields are normally computed by an `objectmodified` event subscriber (`Calculation.setTestParameters()`/`setTestResult()` in `calculation.py` — confirmed by reading the source) that fires only on the classic UI's form-processing publish path, never for direct `bika.lims.api.edit()` mutator calls (confirmed empirically: created/updated a Calculation via the custom views above, then re-fetched — both fields stayed empty/null). Fix: added a third custom view, `@@test-calculation` on the Calculation object, that explicitly replicates the subscriber's own logic — glom together every InterimField + DependentService keyword into a value list (`_refresh_test_parameters()` in `calculation_views.py`), then call `obj.setTestResult(None)` (the method ignores its argument and recomputes from `self.getTestParameters()` internally, per source). `UpdateCalculationView` also calls `_refresh_test_parameters()` whenever Formula/InterimFields change, preserving existing values for keywords that still exist, so the test-panel's parameter list stays in sync with the formula without a manual refresh. Verified live: `RESULT1=3, RESULT2=4` → formula `[RESULT1]+[RESULT2]` → `TestResult="7"`. |
| SENAITE's v1 API serializes an empty reference/records field as `{}`, not `[]` — a bare `?? []` doesn't catch it | `(c.DependentServices ?? []).map(...)` looks safe but only substitutes on `null`/`undefined` — when SENAITE returns `{}` for a zero-item reference field (confirmed: every `Calculation` with no dependent services), the expression evaluates to `{}` and `.map` throws `TypeError`. This crashed inside a broad `try/catch` in `fetchSenaiteCalculations` (`app/lib/senaite.ts`), which swallowed it and returned an empty array for the **entire list** — surfacing as "No calculations yet" even when calculations existed, and matching the identical shape of bug in `mapSenaiteSampleTemplate`'s `partitions`/`services` fields (fixed preemptively once the pattern was spotted). Root-caused via runtime `console.error` logging inside the live container, not guessed — a plain `node -e` fetch outside the Next.js server process did NOT reproduce it, only the real running server did (Next's request-scoped `DYNAMIC_SERVER_USAGE` control error was also visible in the same logs and was being incorrectly swallowed by the same catch block). Fixed with one shared `asArray(value)` helper (`Array.isArray(value) ? value : []`) used everywhere SENAITE's JSON gets mapped to a list — safer than a bare `?? []` for any field that might come back as an object instead of an array. **Any new SENAITE list-mapping code must use `asArray()`, never a bare `(x ?? []).map(...)`, for reference/records fields that can be empty.** |

### One-time setup after a full DB wipe:
```bash
# 1. Start containers
docker compose up -d

# 2. Create public tenant + localhost/127.0.0.1 domains
docker exec xellabs-lims-django-1 python manage.py shell -c "
from core.models import Tenant, Domain
t, _ = Tenant.objects.get_or_create(schema_name='public', defaults={'name':'Public','slug':'public'})
Domain.objects.get_or_create(domain='localhost', defaults={'tenant':t,'is_primary':True})
Domain.objects.get_or_create(domain='127.0.0.1', defaults={'tenant':t,'is_primary':False})
print('Done')
"

# 3. Create superuser
docker exec xellabs-lims-django-1 python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin','admin@xellabs.com','admin')
    print('Created')
"
```

---

## 10a. Frontend Reachability Rule — Diagnose Before Declaring Broken, Always Recover

**"Frontend not reachable" (`http://127.0.0.1:3000` / `http://localhost:3000` hangs, resets, or gives an empty reply) has recurred multiple times on this machine. Root cause confirmed empirically (2026-07-16): it is Docker Desktop's WSL2/Hyper-V port-forwarding proxy (`vpnkit`) periodically dropping the host↔container loopback tunnel — NOT the Next.js app crashing. Confirmed by `docker exec xellabs-lims-frontend-1 wget http://127.0.0.1:3000` succeeding from inside the container at the exact same moment the host `curl` got `000`/empty-reply.**

**Whenever the frontend seems unreachable, always follow this exact sequence — never just tell the user "it's down" without doing this first:**

1. Check the container is actually up: `docker ps --filter "name=xellabs-lims-frontend-1" --format "table {{.Names}}\t{{.Status}}"`.
2. Test **from inside the container** first: `docker exec xellabs-lims-frontend-1 wget -qO- --timeout=5 http://127.0.0.1:3000 -O /dev/null` (or curl if present). If this succeeds but the host-side `curl http://127.0.0.1:3000` fails/resets — it's the Docker Desktop proxy, not the app. Do not restart/rebuild the app in this case; that wastes a 30-60s rebuild for a networking-layer problem.
3. Fix: `docker compose restart frontend` — but this re-runs the FULL `npm run build && npm start` entrypoint (Dockerfile CMD), not a quick bounce. **Always wait for `✓ Ready in` in `docker logs xellabs-lims-frontend-1 --tail 5` (poll every ~10s) before re-testing** — testing too early just re-confirms "still broken" on a container that's mid-build.
4. If restarting the container doesn't fix it (proxy itself is wedged, not just this container's tunnel): `wsl --shutdown` then reopen Docker Desktop — this fully reinitializes vpnkit. Confirm with the user before `wsl --shutdown` since it stops every other container too (Postgres, Redis, Django, SENAITE) — they'll need `docker compose up -d` again afterward.
5. Always re-verify with a live `curl` (expect a `307` redirect to `/login` for the unauthenticated root, or `200`) before telling the user it's fixed — do not report success from log lines alone.

**Reducing recurrence (mitigation, not a full fix — this is inherent to Docker Desktop on Windows/WSL2, there is no code-level permanent fix):**
- Keep WSL2 memory capped sensibly (`C:\Users\HILTON\.wslconfig`, currently `memory=8GB`) — memory pressure makes vpnkit drop connections more often.
- Expect this to resurface after the host machine sleeps/hibernates with Docker running — a common vpnkit-staleness trigger. If reachability breaks right after a resume-from-sleep, jump straight to step 4 rather than looping through step 3 first.

---

## 11. Design Principles — Apply Whenever Relevant

1. Then, BEFORE making any code changes, tell the user:
   "We are planning to go via this principle: **<principle name(s)>**" — and briefly
   show what the principle means and how it will shape the change.
2. Wait for the user's confirmation ("okay" / approval). Only after approval,
   proceed to write the code.

This does not apply to pure analysis/read-only questions, doc-only edits, or when
the user explicitly says to proceed without asking.

Apply these principles whenever writing or refactoring code in this repo, wherever they are applicable (don't force a pattern where it adds no value — KISS/YAGNI win over ceremony):

| Principle                    | Use?                   | Why                                                            |
| ---------------------------- | ---------------------- | -------------------------------------------------------------- |
| ✅ SOLID                      | Yes                    | Keeps code maintainable and extensible                         |
| ✅ Clean Architecture         | Yes                    | Separates UI, business logic, and infrastructure               |
| ✅ Separation of Concerns     | Yes                    | Makes features easier to develop and test                      |
| ✅ DRY                        | Yes                    | Avoids duplicated code                                         |
| ✅ KISS                       | Yes                    | Prevents unnecessary complexity                                |
| ✅ YAGNI                      | Yes                    | Avoids building features before they're needed                 |
| ✅ Feature-Based Architecture | **Highly recommended** | Organizes code around business features instead of file types  |
| ✅ Dependency Injection       | Yes                    | Makes testing and implementation swapping easier               |
| ✅ Adapter Pattern            | Yes                    | Isolates communication with external APIs (e.g., the backend)  |
| ✅ Factory Pattern            | Yes                    | Useful for tenant-specific UI and branding                     |
| ✅ Strategy Pattern           | Yes                    | Enables tenant-specific behavior without `if/else` chains      |


**Rule: state the pattern applied, per feature.** When a plan is presented (per Section 0), name which principle(s) from the table above the design leans on and why — not just "SOLID" generically, but the specific mechanism (e.g. "shared permission class instead of duplicated inline role checks = DRY + SOLID/SRP").

**The running log of features vs. principles applied lives in `Codetrackbypriciple.txt` (project root) — NOT in this file.** After implementing any feature, append a row there (Feature | Pattern applied | How). Never add log entries back into CLAUDE.md.

---

## 11. Code Style Rules

- PEP 8 — max 119 characters per line
- No inline SQL — Django ORM only
- No `print()` — use `import logging; logger = logging.getLogger(__name__)`
- No hardcoded status strings — use model `choices` constants (e.g. `Sample.Status.IN_PROGRESS`)
- No business logic in serializers — use model methods or service functions
- No business logic in views — views are HTTP request/response only

---

## 11c. Form Interaction Rule — Test the Whole Form Before Declaring Done

**Any form (especially multi-step / wizard drawers) must be exercised end-to-end before it's considered working — not just "it renders."** Real bugs shipped because forms were only visually checked, never actually driven.

- **Multi-step wizards wrapped in a single `<form>`: block implicit Enter-submit.** A text `<input>` inside a `<form>` submits the whole form on Enter — so pressing Enter on an early step (or while typing e.g. CC emails on the last step) fires the action and creates the record prematurely. Add an `onKeyDown` on the `<form>` that calls `e.preventDefault()` for `Enter` unless the target is a `TEXTAREA`. Submission must happen ONLY via the explicit Submit/Create/Save button. (Fixed once in `ClientsShell.tsx` — apply the same guard to every wizard form.)
- **Every field must be reachable and editable before submit** — verify you can type in each input/textarea on each step without the form navigating away or submitting.
- **A "Next" button on a non-final step must be `type="button"`**, never `type="submit"`; only the final-step action button is `type="submit"`.
- **Textareas keep Enter for newlines** — never globally swallow Enter in a way that breaks multi-line notes fields.
- **A conditionally-rendered `<button type="button">` that swaps to `<button type="submit">` (e.g. "Next" becoming "Create" on the last wizard step) MUST have a distinct `key` on each branch.** Without it, React reuses the same DOM node across the swap and just patches its `type` attribute — and if that patch happens synchronously inside the SAME click handler that triggered the step change (e.g. `setStep` flipping `isLast` to `true`), the browser's native click default-action re-reads the now-`"submit"` attribute and submits the form immediately, on the very click that was only supposed to advance a step. This silently created records with earlier-step data and skipped every field after it (confirmed root cause in `ClientsShell.tsx` — the "can't type Notes" bug was actually this, not Enter-submit). Give the two branches distinct keys (e.g. `key="wizard-next"` / `key="wizard-submit"`) so React always mounts a fresh node instead of patching type in place.
- Before reporting a form feature done: create a record through it, edit one, and confirm the values actually persist (drive it per the `verify` skill / Section 15) — a passing `tsc`/build is NOT proof the form works.
- **When a user reports a bug a second time after you already "fixed" it, do not re-guess from code review alone — actually drive the app in a real browser** (Playwright via `npx playwright install chromium` + a driver script logging in with the dev credentials in `.env`) and reproduce the exact reported steps before proposing another fix. Code that "looks correct" was exactly how this bug was misdiagnosed twice in a row before a real browser test found the actual cause (a React DOM-node-reuse race, not the Enter key).

---

## 11d. UI Consistency Rule — Match Sibling Components' Established Patterns

**Before writing layout/positioning code for a new drawer, modal, or page section, check how existing sibling components (`_components/*.tsx` in other feature folders) already solve the same problem — copy their values, don't invent new ones.** A drawer overlay hardcoded to `top: 56, bottom: 40` (leaving uncovered strips at the screen edges where the sidebar footer/page footer visibly bled through) shipped in `ClientsShell.tsx` while every other drawer in the app (`AnalysesShell`, `BatchesShell`, `InstrumentsShell`, `MethodsShell`, `SampleTypesShell`, `StorageModal`, etc.) correctly uses `top: 0, bottom: 0` (full-viewport overlay). The same `56/40` inconsistency also exists in `ContainerTypesShell.tsx`, `SampleContainersShell.tsx`, and `SamplesShell.tsx` — not yet fixed, flagging here so the next touch on any of those catches it too.
- Before introducing a new numeric/style value for a pattern that clearly already exists elsewhere (drawer positioning, z-index, spacing, colors), grep for the pattern across `_components/` first.
- If sibling components disagree with each other, ask the user which is correct rather than picking one arbitrarily or inventing a third value.

---

## 11a. White-Label Rule — Never Expose SENAITE in the UI

**SENAITE is the backend reference LIMS. It must never appear in any user-facing UI.**

| Never show | Use instead |
|---|---|
| "SENAITE", "senaite", "Sync SENAITE" | No label, or internal-only terminology |
| SENAITE UIDs, sync status, "synced to SENAITE" | Remove entirely from all pages |
| Any SENAITE URL or branding in the frontend | XelLabs branding only |

**What this means in code:**
- No "Sync SENAITE" buttons in any page
- No "SENAITE Sync" cards or sections in detail pages
- `senaite_uid` is a backend-only field — never render it in JSX
- Backend sync logic (server actions, Django views) may reference SENAITE internally — that is fine
- Frontend must only show XelLabs-branded labels

## 11b. Docker Service Name Rule — Non-Negotiable

**Never use `localhost` as a fallback URL in any server-side code that runs inside a Docker container.**

| Wrong | Correct |
|---|---|
| `process.env.DJANGO_API_URL ?? 'http://localhost:8001'` | `process.env.DJANGO_API_URL ?? 'http://django:8001'` |
| `process.env.SENAITE_URL ?? 'http://localhost:8080/senaite'` | `process.env.SENAITE_URL ?? 'http://senaite:8080/senaite'` |

Inside Docker, `localhost` means the container itself — not the Django or SENAITE container. Always use the Docker Compose service name.

**All current fallbacks (confirmed fixed):**
- `app/actions/auth.ts` → `http://django:8001`
- `app/actions/clients.ts` → `http://django:8001`
- `app/actions/tenants.ts` → `http://django:8001`
- `app/lib/django.ts` → `http://django:8001`
- `app/lib/senaite.ts` → `http://senaite:8080/senaite`

**New colleague setup:**
```bash
# Backend: copy .env.example → .env (already has correct Docker service names)
cp xellabs-backend/.env.example xellabs-backend/.env

# Start everything
docker compose up -d
```

## 12. Terminal Rule — Always Use IDE Integrated Terminal

- **Never** open external terminal windows (`Start-Process powershell`, detached processes)
- Run all commands in the IDE's integrated terminal
- For blocking commands (`runserver`, `celery worker`) use `run_in_background: true` on the tool call
- For WSL sudo commands that need interactive input — ask the user to run them in their open WSL terminal

---

## 13. Background Process Rule — One at a Time

- **Never spawn multiple background commands for the same task** (e.g. multiple `apt-get install` calls)
- If a background command is running, poll it until it finishes before starting the next step
- If a command is stuck, kill it cleanly before retrying — never pile up parallel instances
- Use `run_in_background: true` only for genuinely independent parallel work

---

## 13a. Multiple Claude Instances Rule — Coordinate, Never Collide

If more than one Claude Code instance is running against this project at the same time (e.g. two IDE windows, two terminals), both instances **must actively communicate through `ACTIVE-CLAUDE-SESSIONS.md`** (project root, gitignored — local-machine coordination only, never committed) — not just infer state from side effects.

**`ACTIVE-CLAUDE-SESSIONS.md` protocol:**
1. **Before starting any new task** (not just risky ones — any task): read this file. If it doesn't exist, create it fresh.
2. **Check whether the task you're about to do is already claimed** by another live entry (same files, same feature area, same command). If it is, **do not duplicate it** — either pick a genuinely different task, or tell the user the other instance already has this in progress and ask how to proceed.
3. **Claim your task before starting work on it**: append an entry with a timestamp, a one-line description of the task, and the files/areas you expect to touch.
4. **Update your entry when you finish** (mark it done, or delete it) so the file always reflects only real in-progress work — stale entries defeat the whole point.
5. If an entry looks stale (no update in a long time, referenced containers/processes no longer running), it's likely abandoned — but confirm via the corroborating signals below before assuming it's safe to proceed, since the other session may just be slow, not gone.

**Corroborating signals** (use alongside the file, not instead of it — the file can go stale, these can't lie): running background commands/builds (`docker ps`, `docker compose logs -f` still tailing), uncommitted changes you didn't make, a lock file, a `.next` build in progress, or a container mid-restart. Treat any of these as evidence another instance is active even if `ACTIVE-CLAUDE-SESSIONS.md` hasn't been updated to reflect it yet.

**Still in force regardless of the file:**
- **Never run the same mutating command the other instance is already running** (e.g. both running `docker compose up -d --build`, both doing `npm install`, both applying migrations). If one is clearly mid-task, wait for it to finish before starting overlapping work.
- **Avoid touching the same files at the same time.** If both instances need to edit the same file, one must finish and save before the other starts — do not interleave edits.
- **Run independent, non-conflicting work in parallel freely** (e.g. one reviews backend code while the other investigates frontend), since that carries no collision risk — still log it in the file so the other instance doesn't have to guess.
- If it's unclear whether the other instance is still working, prefer waiting a short beat and re-checking over racing ahead.

---

## 13b. Git Push Rule — Never Push Without Explicit Permission

**Never run `git push` on your own initiative — only when the user explicitly says to push.** Committing locally and other git prep work (stash, pull, merge) is fine without asking each time, but the push itself always needs the user's go-ahead.

**This repo's remote:** `origin` → `https://github.com/hephzibahtechnologies/XELLABS-LIMS.git`, default working branch `staging-development` (confirm with the user if a different branch/remote is meant for a given push — this repo also historically references a personal fork, see README.md "Git Remotes").

When the user says to push the code, follow these steps in order — do not skip or reorder:

1. **Stash current changes** — `git stash -u` (include untracked files) so the working tree is clean.
2. **Ask the user which branch to pull from** (and which remote, if not obviously `origin`) — never assume unless they've already stated it in the same request.
3. **Pull that branch** — `git pull <remote> <branch>`.
4. **Merge the pulled code into the project** — resolve any conflicts with the user if they come up; never silently discard either side.
5. **Merge the stash back in** — `git stash pop` — resolve any stash-vs-pull conflicts the same way.
6. **Ask the user before running the pre-push checks** — never run `bash .githooks/pre-push` (or any of its individual checks) on your own initiative; confirm with the user first every time. Note this is separate from the checks `git push` itself auto-triggers via `core.hooksPath` at push time (see Section 15b) — that automatic run is unavoidable unless `--no-verify` is used, which still requires the user's explicit ask per the force-push-adjacent rule below. **Never push while any blocking check is failing** — fix the failure first.
7. **Ask the user which branch to push to** if not already stated, then push as a **single commit** — `git push <remote> <branch>`.

Never reorder this (e.g. never push before pulling/merging or before the pre-push checks pass), and never force-push (`--force`/`-f`) unless the user explicitly asks for it in that exact request.

**One-time per clone (does NOT carry over from another machine — the hook file being present in the repo is not enough on its own):** run `git config core.hooksPath .githooks` once so `git push` actually runs the pre-push checks. Without it, the hook is silently skipped. Pass this along to any colleague who hasn't set it up.

**Never add `Co-Authored-By: Claude ...` (or any AI attribution) to a commit message on this repo.** Commits go under the user's own name/identity (`git config user.name`/`user.email`) only — no exceptions, regardless of how much of the change Claude authored. This applies to every commit, not just ones the user explicitly reviews.

**Exactly ONE commit per push — no exceptions, even if a fix-for-my-own-mistake surfaces mid-push (e.g. a pre-push check failing because of something the same change caused).** Fold any such follow-up fix into the same not-yet-pushed commit via `git commit --amend` (safe here since it hasn't been pushed yet — this is not the "never amend published commits" case) rather than creating a second commit. Only make more than one commit if the user explicitly asks for separate commits in that request.

**Always ask the user before running the pre-push check suite** (`bash .githooks/pre-push`, or any of its individual steps run manually) — every time, not just the first time in a session. This is distinct from `git push` itself auto-triggering the same suite via `core.hooksPath` (Section 15b) — that automatic run cannot be skipped without `--no-verify`, and `--no-verify` still needs the user's explicit ask.

---

## 13b-i. Post-Pull Rebuild Rule — Non-Negotiable After Any `git pull`/Merge

**Confirmed root cause of a real incident (2026-07-16):** after pulling `staging-development` (which added `whitenoise`/`weasyprint`/`django-weasyprint`/`openpyxl` to `requirements.txt` and a new `InstrumentType` model), the running Django container was never rebuilt. Every single request then re-triggered `ModuleNotFoundError: No module named 'whitenoise'` during URL-conf import, crashing and respawning gunicorn workers in a tight loop — CPU pegged at 125%+, every dashboard page that touches the Django API hung or crawled. `docker ps` still showed the container "healthy" the whole time (the healthcheck had passed moments before the crash loop started) — **container health status is not proof the app is actually serving requests correctly; always check `docker logs` for a live crash loop when something is "slow", not just `docker ps`.**

**Rule: after ANY `git pull`, merge, or stash-pop that could have changed backend/frontend code, before declaring the stack working:**
1. Check whether `xellabs-backend/requirements.txt` or `xellabs-frontend/package.json` changed in the pulled/merged diff (`git diff <old>..<new> -- xellabs-backend/requirements.txt xellabs-frontend/package.json`). If either changed, a plain `docker restart` is NOT enough — rebuild the image: `docker compose up -d --build django celery celery-beat celery-reports` and/or `docker compose up -d --build frontend`.
2. Even if neither dependency file changed, still restart Django/Celery after any pulled `.py` change (per the existing gunicorn-no-reload gotcha in this section) — pulled code counts the same as locally-edited code for that rule.
3. After rebuilding/restarting, don't just check `docker ps`/healthy status — tail `docker logs <container> --tail 20` and confirm clean startup (migrations applied, gunicorn workers booted, no traceback), then hit a real endpoint and check `docker stats --no-stream` briefly to confirm CPU isn't pegged from a crash loop.
4. If the user reports the frontend/dashboard as "slow" or "broken" after any recent pull/merge, checking the Django container logs for an active crash loop is now a standard first diagnostic step — alongside the Docker Desktop vpnkit check in Section 10a.

---

## 13c. Change Tracking — `pending-changes.md`

**Every change made must be logged in `pending-changes.md` as it happens — do not miss any change.** This file is gitignored (never committed) and exists purely so nothing gets lost between pushes.

- Log each meaningful change (file created/edited, command run that altered state, config added, dependency changed, container rebuilt) with a one-line entry as you make it — don't batch it all up at the end and risk forgetting something.
- **Immediately after a successful `git push`** (per Section 13b's push workflow): delete the file's contents and start a fresh log for the next session/work period. Never let entries from before a push linger into the next one.
- If `pending-changes.md` doesn't exist, create it fresh.

## 13d. Work Progress Log — `workprogress.md` (7-Day Rolling Window)

`workprogress.md` (root) is a running log of work done, grouped by date — unlike `pending-changes.md`, this one **is** meant to persist across pushes as a short-term history.

- Append a new dated section for each day's work (what was done, diagnosed, or decided) — don't overwrite prior days.
- **Entries older than 7 days must be deleted** — check the oldest date in the file whenever you add a new entry, and remove any section older than 7 days from today.
- Keep entries terse (bullet list per day), matching the existing style already in the file.

---

## 14. "OK" Signal — Execute Without Confirmation

When the user ends a request with "ok", execute the full task without pausing for confirmations or yes/no questions. Make autonomous decisions using sensible defaults. Only stop for genuinely destructive actions that cannot be inferred.

---

## 15. Never Stop Until the Task is Fully Finished

**Keep running until every step is complete and verified. Never hand an incomplete task back to the user.**

### Rules:
- If a background process is running, keep polling it — run the next step immediately when it finishes
- If a command fails, diagnose it and fix it — do not report failure and stop
- Never write "I'll proceed when X is done" and then stop — that IS stopping
- Complete every step in a chain: model change → makemigrations → migrate → test
- The only valid stopping points:
  1. The full task is done and verified end-to-end
  2. A genuine user decision is required (e.g. which branch to push to)
  3. A destructive irreversible action needs explicit confirmation

### "Done" means:
- Every command ran successfully
- Every file that needed updating was updated (including this file and `start-commands.txt`)
- The feature/fix/setup works end-to-end and is verified
- All new learnings are recorded in CLAUDE.md

---

## 15b. Pre-Push Checks — `.githooks/pre-push`

**One-time setup per clone (this is a repo-local git config, it does not carry over automatically):**
```bash
git config core.hooksPath .githooks
```

Every `git push` then runs, in order: no `.env`/secrets staged → Django `check` → `makemigrations --check --dry-run` (no missing migrations) → Django test suite (`--noinput`, **no** `--parallel` — see below) → TypeScript `tsc --noEmit` → ESLint (**warns only**, does not block) → `npm run build` (the actual production build, the strongest real signal that deployment won't break).

**Requires `docker compose up -d` running first** — the checks run via `docker exec` against the live `xellabs-lims-django-1`/`xellabs-lims-frontend-1` containers, since that's where the real deps/DB connection live. The hook fails fast with a clear message if the containers aren't up rather than silently skipping.

**Known gotchas found while building this (2026-07-13):**
| Gotcha | Fix |
|---|---|
| `manage.py test --parallel` crashes with `TypeError: cannot pickle 'traceback' object` on ANY test failure/error (Python 3.12 quirk) — the runner itself dies instead of reporting the failure | Never use `--parallel` in this hook. Slower, but reports real failures correctly. |
| `manage.py test` prompts "Type 'yes' to delete test database" interactively if a stale `test_xellabs_lims` DB exists from an earlier interrupted run — hangs/EOFErrors with no TTY | Always pass `--noinput`. |
| ESLint has a large pre-existing backlog (~39 errors, 41 warnings) unrelated to any one change, and `next build` has succeeded repeatedly all session despite it | Lint is a **warning**, not a blocking check, in this hook — don't gate every future push on an unrelated historical backlog. Re-evaluate making it blocking once the backlog is actually cleaned up. |
| `InstrumentViewSet.calibration_due`/`maintenance_due` intermittently returned a paginated `{count, results: [...]}` envelope instead of a plain array, breaking any caller expecting a flat list (a real pre-existing bug the hook caught on its first real run) | Fixed — these two alert-style endpoints (bounded "due within N days" lists) are now deliberately unpaginated; see `instruments/views.py`. |

**To skip once, for a genuinely urgent push** (use sparingly — not a habit): `git push --no-verify`.

---

## 16. SENAITE White-Label — XelLabs Branding

SENAITE has been white-labeled to **XelLabs**. All visible "SENAITE" text has been replaced.

### What was changed (inside the egg, files backed up as `.bak`):

| File | Change |
|---|---|
| `browser/viewlets/templates/toolbar.pt` | **Navbar logo** `<img senaite.svg>` replaced with `<span class="xellabs-brand-text">XelLabs</span>` — THIS is the visible navbar logo |
| `browser/viewlets/templates/logo.pt` | Plone portal_logo macro `<img>` replaced with `<span class="xellabs-brand-text">XelLabs</span>` |
| `browser/viewlets/templates/footer.pt` | "SENAITE LIMS" + all senaite.com links removed → "XelLabs LIMS" |
| `browser/viewlets/templates/colophon.pt` | "SENAITE is powered by" → "XelLabs LIMS is powered by" |
| `browser/frontpage/templates/frontpage.pt` | All SENAITE text replaced with XelLabs |
| `browser/static/bundles/senaite.core.css` | XelLabs CSS overrides appended (`.xellabs-brand-text` styles) |

Base path (all files above are relative to):
`/home/senaite/senaitelims/eggs/cp27mu/senaite.core-2.6.0-py2.7.egg/senaite/core/`

### Site title:
Changed via Plone `@@site-controlpanel` form using `fix_title_full2.py` (Python 2.7).

**Critical**: The form requires:
1. `_authenticator` CSRF token — extracted from the GET response  
2. All `<select>` field values (icon_visibility, thumb_visibility, thumb_scale_*, toolbar_position)  
3. All checkbox `-empty-marker` fields  
Without all these, the form returns HTTP 200 but silently fails to save.

### Scripts saved in `senaite-rebrand/` directory:
| Script | Purpose |
|---|---|
| `logo.pt` | XelLabs text logo template |
| `footer.pt` | Footer with XelLabs LIMS text |
| `colophon.pt` | Colophon with XelLabs branding |
| `frontpage.pt` | Front page with XelLabs text |
| `xellabs_overrides.css` | CSS overrides (appended to senaite.core.css) |
| `apply_rebrand.sh` | Replaces logo.pt + appends CSS |
| `apply_templates.sh` | Replaces footer, colophon, frontpage |
| `fix_title_full2.py` | Sets site title via HTTP form submission |

### Re-apply procedure (after container recreation):
```bash
# 1. Copy scripts into container
for f in logo.pt footer.pt colophon.pt frontpage.pt xellabs_overrides.css apply_rebrand.sh apply_templates.sh fix_title_full2.py; do
  docker cp senaite-rebrand/$f senaite:/tmp/
done

# 2. Apply templates
docker exec --user root senaite bash /tmp/apply_rebrand.sh
docker exec --user root senaite bash /tmp/apply_templates.sh

# 3. Set site title
docker exec senaite python2.7 /tmp/fix_title_full2.py

# 4. Restart to flush template cache
docker restart senaite
```

### Key constraints discovered:
- **PowerShell heredoc breaks quotes**: Use `docker cp` to copy files into container, never inline complex heredocs through PowerShell
- **Zope caches templates as `.pyc`**: After modifying `.pt` files, always `docker restart senaite` to flush cache
- **CSS ZMI injection fails**: The `portal_skins/custom manage_edit` URL returns 404. Direct modification of the CSS bundle file works reliably
- **`bin/instance run` fails while running**: ZODB lock error — use HTTP POST approach for runtime config changes
- **Plone z3c.form requires CSRF token + all form fields**: GET the form first, extract `_authenticator` token and all `<select>` values, then POST everything back
- **Remaining SENAITE text**: 4 occurrences remain in `<meta name="generator">` and HTML comments — these are NOT visible to users

## 16b. SENAITE Custom Field Deserializer — SampleType Retention Period & Admitted Stickers

**Discovery (2026-07-14):** SENAITE v2.6.0's legacy `@@API/senaite/v1/create` and `/update`
endpoints **silently drop** `SampleType.retention_period` and
`SampleType.admitted_sticker_templates` — both are custom field types
(`DurationField`, `DataGridField`) with no adapter registered on that legacy
API path. The request returns `success: true` and HTTP 200, but the field is
never actually written (confirmed by reading the object back — always null).

**Fix applied:** `plone.restapi` (a separate, modern REST framework also
bundled in this SENAITE build, reachable at the object's own URL with
`Accept: application/json`) natively supports `retention_period` (as total
seconds — `DurationField` subclasses the standard `zope.schema.Timedelta`,
which restapi already has a serializer/deserializer for). But
`admitted_sticker_templates` still fails even via restapi (`Wrong contained
type` / `Object is of wrong type`) — no deserializer exists anywhere in this
install for the custom `DataGridField` type. Wrote one:
`senaite-rebrand/sampletype_stickers_deserializer.py` — a
`IFieldDeserializer` adapter for `(DataGridField, ISampleType,
IBrowserRequest)` that bypasses schema validation and writes straight through
the content object's own existing `setAdmittedStickerTemplates()` mutator.

**App-side wiring** (`xellabs-frontend/app/lib/senaite.ts`): `sampleTypeApiBody()`
no longer sends these two fields to the v1 create/update calls at all (dead
weight — confirmed never persists there). A separate `patchSampleTypeExtras()`
does a `PATCH` straight to the object's restapi URL for both fields, called
right after the v1 create/update succeeds. **Reading** is split the same way:
the v1 list read (`fetchSenaiteSampleTypes`) never returns these two fields
either (same broken serialization, both directions) — so after the v1 list
call, a per-object restapi GET (`fetchRestapiSampleTypeExtras`) fetches just
these two fields and overlays them onto the v1-sourced list.

**Also discovered:** `plone.restapi`'s own `@search`/folder-listing endpoints
return `items_total: 0` for `SampleType` (and presumably other setup-folder
content) — they query a catalog that doesn't index SENAITE's custom
`SETUP_CATALOG`. Direct object access by known path/URL works fine via
restapi; bulk listing does not. This is why the fix reads lists via the
legacy v1 API and only uses restapi for single-object GET/PATCH.

**Now baked permanently into the `senaite-rebrand/Dockerfile`** (same build that
produces the white-labeled image) — `docker compose build senaite` /
`docker compose up -d --build senaite` carries this fix forward automatically,
no manual re-apply needed. Verified: rebuilt the image from scratch and
confirmed retention_period + admitted_sticker_templates persist correctly with
zero manual steps afterward.

`senaite-rebrand/apply_sampletype_stickers_fix.sh` is kept only as a fallback
for patching an already-running container without a rebuild (e.g. a quick fix
before the next planned rebuild):
```bash
docker cp senaite-rebrand/sampletype_stickers_deserializer.py senaite:/tmp/
docker cp senaite-rebrand/apply_sampletype_stickers_fix.sh senaite:/tmp/
docker exec --user root senaite bash /tmp/apply_sampletype_stickers_fix.sh
docker restart senaite
```

## 16c. SENAITE Client Address Country/State/District — Broken on Every REST Path

**Discovery (2026-07-16):** Creating/editing a Client and filling in Country,
State, or District on ANY of the three Address blocks (Physical/Postal/
Billing) crashed every save with `'NoneType' object has no attribute 'get'`
— reproduced deterministically via direct API calls (not guessed): a blank
address always saves fine; the instant `country`/`state`/`district` gets a
non-empty value, the save fails 100% of the time, via **both** the legacy
`@@API/senaite/v1/create`/`update` endpoints **and** `plone.restapi`'s own
PATCH deserializer.

**Root cause (confirmed by reading source inside the running container):**
`Client` inherits `PhysicalAddress`/`PostalAddress`/`BillingAddress` from the
shared `Organisation` base class (`bika/lims/content/organisation.py`), where
each field declares `subfield_validators={"country": "inline_field_validator",
"state": "inline_field_validator", "district": "inline_field_validator"}`.
`InlineFieldValidator.__call__` (`bika/lims/validators.py`) does:
```python
request = kwargs['REQUEST']
data = request.get(field.getName())   # request is None → crash
```
Every REST path validates via `bika.lims.api.validate(obj)` →
`obj.validate(data=True)` (`Products.Archetypes.BaseObject.validate`), whose
signature is `validate(self, REQUEST=None, ...)` — **no caller ever passes a
real REQUEST**, so it's always `None` there. `street`/`city`/`zip` have no
subfield validator attached and are unaffected — same defect class already
fixed for `Calculation.Formula` (§16b), just a different field/content type.

**Fix:** Two new custom Zope browser views,
`senaite-rebrand/client_address_views.py` — `@@create-client-safe` (registered
`for="bika.lims.interfaces.IClientFolder"`, called on the `clients` folder)
and `@@update-client-safe` (`for="bika.lims.interfaces.IClient"`, called on
the object itself) — both call `bika.lims.api.create()`/`api.edit()`, which
set fields via mutators and never invoke `field.validate()` at all (same
bypass mechanism as the Calculation fix). Wired via
`senaite-rebrand/patch_client_address_zcml.py`, baked into
`senaite-rebrand/Dockerfile` (same pattern/marker as the other custom-view
patches — `docker compose build senaite` carries it forward automatically).

**Frontend (`app/lib/senaite.ts`):** `createSenaiteClientObj`/
`updateSenaiteClientObj` now POST to these custom views instead of the legacy
v1 endpoints. Added a `SENAITE_ORIGIN` constant (protocol+host only, no site
path) — object `path` values returned by SENAITE already include the site
path (e.g. `/senaite/clients/client-8`), so a custom view on an object's own
path must be built as `${SENAITE_ORIGIN}${path}/@@view-name`, **never**
`${SENAITE_URL}${path}/...` (`SENAITE_URL` already ends in `/senaite`,
doubling the segment and 404ing — confirmed by testing the doubled path
directly). Contact create/update stays on the legacy v1 API since Contact has
no Address fields and isn't affected.

**Verified:** reproduced the crash via raw API calls (blank address → 200
success; `country: "USA"` → 500/`success:false` with the exact reported
error) before touching any code; confirmed the new custom views handle the
same payload correctly; rebuilt+redeployed the SENAITE image; re-ran the
exact failing flow live through the actual UI (multi-step Client wizard,
Country + State filled on the Addresses tab) and confirmed no crash, save
succeeds, progresses to the next tab. All test/orphan Client objects created
during investigation deactivated.

## 16d. SENAITE Setup-Content Writes — Use plone.restapi, NOT the v1 create/update API

**Discovery (2026-07-16)** while building the 11-section Administration setup
matrix (Analysis Categories, Attachment Types, Batch Labels, Instrument
Locations/Types, Interpretation Templates, Lab Contacts, Lab Departments, Lab
Products, Labels, Laboratory). The legacy `@@API/senaite/v1/create` +
`/update` endpoints are unreliable for these Dexterity setup types:

| Symptom (via v1 API) | Cause |
|---|---|
| `{"department": ""}` / `{"manager": ""}` error when creating `AnalysisCategory`/`Department` | v1's `UIDReferenceField` deserializer rejects a bare uid string (and a `[uid]` list, and `{"uid":...}`) — it silently blanks the ref then fails "required". |
| `{"labproduct_vat_amount": "wrong type", "labproduct_total_price": "wrong type"}` creating `LabProduct` | v1 create tries to write LabProduct's **computed/readonly** fields from defaults and type-fails. |

**Fix / rule:** write SENAITE setup content via **plone.restapi** (the modern
framework bundled in the same build), not the v1 API — it is Dexterity-native:
accepts a plain uid string for single `UIDReferenceField`s and a uid array for
multi-valued ones, and skips computed/readonly fields entirely.
- CREATE: `POST ${SENAITE_ORIGIN}${SENAITE_SITE_PATH}/<parent-folder>` with body `{"@type": "<PortalType>", ...fields}`, `Accept: application/json`.
- UPDATE: `PATCH ${SENAITE_ORIGIN}${object_path}` with the changed fields (204 = success, no body).
- **`description` MUST be sent as a string** — restapi create fails with
  `description: Object is of wrong type` if the field exists on the type and you
  omit it (it applies a `None` default that fails validation). Send `""` when empty.
  (Types with no `description` field, e.g. `BatchLabel`, must NOT send it.)
- **Reads stay on the v1 list API** (`@@API/senaite/v1/<PortalType>?limit=…`) —
  restapi's `@search`/folder listing returns `items_total: 0` for setup content
  because it queries a catalog that doesn't index SENAITE's `SETUP_CATALOG`.
  This read-via-v1 / write-via-restapi split is the same one already documented
  for `SampleType` (§16b). Implemented generically in
  `app/lib/senaite-setup.ts` (`fetchSetupList` = v1 read; `createSetupItem`/
  `updateSetupItem` = restapi write) + `app/lib/admin-crud.ts`.

**Also confirmed — `ARTemplate` → `SampleTemplate` rename inconsistency:**
`InterpretationTemplate.analysis_templates` declares `allowed_types=("ARTemplate",)`,
but in this build sample templates are stored as portal_type **`SampleTemplate`**
(v1 `?portal_type=ARTemplate` returns 0; `SampleTemplate` returns them). So the
field's own validator rejects every real template ("Only the following types are
allowed: ARTemplate") — it is effectively unusable for SampleTemplates in this
version, matching SENAITE's own widget (which queries `ARTemplate` and shows
nothing). The frontend therefore sources that field's options from `ARTemplate`
(accurate empty set → never offers an un-saveable option); `sample_types`
(→ `SampleType`) works normally. **When wiring any SENAITE reference field,
verify the *actual* stored portal_type via the v1 API rather than trusting the
schema's `allowed_types` string — the 2.x renames left several stale.**

**Lab Contacts & Laboratory (Archetypes, address validator):** these two reuse
the §16c custom-Zope-view bypass — `@@create-labcontact-safe`,
`@@update-labcontact-safe`, `@@update-laboratory-safe` in
`senaite-rebrand/labcontact_lab_views.py` (baked into the SENAITE Dockerfile) —
because they inherit the same broken country/state/district
`inline_field_validator` from Person/Organisation. Those views also decode
base64 image payloads (LabContact `Signature`, Laboratory `AccreditationBodyLogo`)
since JSON can't carry binary. Laboratory is a **singleton** (edit-only, at
`bika_setup/laboratory`) and inherits banking fields (AccountName/AccountNumber/
BankName/BankBranch) from Organisation — all exposed in the frontend edit form.

## 16e. SENAITE QC Chain — Suppliers / Reference Definitions / Reference Samples + Worksheet Blank/Control

**Built 2026-07-20** (the Administration → Suppliers, Reference Definitions,
Reference Samples modules + worksheet Blank/Control QC wiring). Root-caused live
before building — key facts, all verified via raw REST against the running 2.6.0:

| Type | Framework / location | Write path |
|---|---|---|
| **Supplier** | **Dexterity**, at `setup/suppliers` | Plain plone.restapi create/update — **no custom view needed**. Unlike the AT `Client`, its address subfields do **not** trip the `inline_field_validator` crash (§16c); writes fine. **But** (found 2026-07-20, fixing the Suppliers admin page): SENAITE's **v1 list API silently omits** `email`/`phone`/`tax_number`/`fax`/`account_*`/`bank_*`/`address` for this type — restapi PATCH persists them correctly (confirmed via restapi's own per-object GET + `modified` timestamp), but v1 never returns them in the list, no matter what's stored. Same class as SampleType's retention_period (§16b) — fixed with a generic `fetchRestapiOverlay()` helper (`senaite-setup.ts`) that overlays a per-object restapi GET for exactly the fields v1 drops. Address sub-fields (`senaite/core/schema/addressfield.py`) are `address`/`city`/`subdivision1`(=State)/`subdivision2`(=District)/`zip`/`country`/`type` — **different key names from Client's AT Address widget**, don't copy those. `description` is a **confirmed dead write** on Supplier (PATCH/create both return success, value never persists) — don't add a UI field for it; `remarks` is the real working free-text field. `email` (`zope.schema.Email`) validates format even though optional — omit the key entirely when blank, sending `""` is rejected. |
| **ReferenceDefinition** | Archetypes, at `bika_setup/bika_referencedefinitions` | Plain restapi create/update. The `ReferenceResults` DataGrid (`[{uid,result,min,max}]`) and the `Blank`/`Hazardous` booleans persist cleanly in the create body — **no custom view**. |
| **ReferenceSample** | Archetypes, child of a **Supplier** (`setup/suppliers/<id>/<QC-id>`) | See two-step flow below. |

**ReferenceSample two-step create (both quirks confirmed live):**
1. Sending `ReferenceDefinition` in the restapi **create body → HTTP 500** `"No converter for making <ReferenceDefinition> JSON compatible"` — the UIDReferenceField **response** serializer crashes (the object may or may not be created; don't rely on it). So **CREATE without the ref** (201), then **PATCH** the ref (PATCH returns 204, no response body → no serializer crash).
2. SENAITE's auto-copy of `ReferenceResults` from the linked definition fires only on the classic-UI event path, **never via a restapi mutator** (same class as Calculation §16b). So the frontend **copies the chosen definition's `ReferenceResults` itself** and PATCHes them onto the sample alongside the ref.
3. **`ExpiryDate` is REQUIRED** on ReferenceSample — restapi create is rejected `ValidationError: Expiry Date is required` without it. The Reference Samples form enforces it (`*`).
- Implemented in `app/actions/{suppliers,reference-definitions,reference-samples}.ts` (read-v1 / write-restapi via the shared `senaite-setup.ts` helpers — §16d), UI in `app/dashboard/{suppliers,reference-definitions,reference-samples}/`, shared `app/dashboard/_components/ReferenceResultsGrid.tsx`. Nav entries in `adminNav.ts`.
- **Worksheet Blank/Control**: the worksheet detail's "Add Blank/Control QC" picker lists active reference samples (`getReferenceSampleOptions`) and calls the already-baked `@@add-worksheet-reference` view (`addReferenceAnalyses(reference, service_uids)`) — the sample's own `getBlank()` decides Blank vs Control. Works even on a blank worksheet (verified: added a Control row for the QC sample's covered service).

**Worksheet view additions (2026-07-20, baked into the SENAITE image — rebuild `docker compose build senaite` on other machines):**
- `@@update-worksheet` now **clears** Instrument/Method when sent empty: `setInstrument("")` crashes inside `api.get_object("")` before its own clear step, so the view sets `ws.getField("Instrument").set(ws, None)` directly (what setInstrument does internally when the resolved instrument is None). Frontend now always sends instrument/method (incl. empty) so clearing works.
- `@@lab-analysts` (GET, on `IWorksheetFolder`) returns lab members eligible as analyst (`api.get_users_by_roles(["Analyst","LabManager","LabClerk","Manager"])`) as `[{id,fullname}]`. **Returns `[]` in a fresh dev env** because the `admin` account is a Zope-**root** user, invisible to Plone's `searchForMembers` — real lab users created via Administration → Users (which sync into the Plone site with lab roles) will appear. The worksheet analyst field is now a dropdown of these (falls back to "Unassigned" + preserves any existing free-text/id value).

**Instrument results import (frontend-only, no SENAITE change):** the worksheet detail has an "Import results" button that parses a CSV matching the page's own "Export CSV" format (matches rows by **Position**, needs `Position` + `Result` columns), pre-fills the editable result inputs, then "Submit all" submits every entered result via the existing jsonapi `update` path. KISS — reuses the proven result-entry flow, no instrument-interface parser.

**Orphaned Django worksheet code removed:** `LabWorksheetsShell.tsx`, `LabWorksheetDetail.tsx`, `app/actions/django-worksheets.ts` (all dead after the SENAITE re-point; nothing else imported them — `schedule.ts` only referenced django-worksheets in a comment).

## 16f. AnalysisRequest (Sample) create silently drops every non-core field — and Attachment needs its own object

**Discovery (2026-07-20):** `createSenaiteSample()` (`app/lib/senaite.ts`) built one big `v1/create` body containing Contact, CCContact, CCEmails, ClientOrderNumber, ClientReference, Remarks, Preservation, SamplePoint, SamplingDeviation, Composite, InternalUse. SENAITE returned `success:true` for every one of these — but only **SampleType, DateSampled, Priority, Analyses** actually persisted; every other field in that create body was silently dropped. Confirmed by a real Playwright end-to-end test reading the AR back via v1, not by guessing. Same bug class as §16b/§16c/§16d, now confirmed for `AnalysisRequest` too — **assume `v1/create` only honors a small whitelist for any Archetypes content type in this build; verify empirically, never trust `success:true` alone.**

- **Fix**: split into a minimal `v1/create` (SampleType/DateSampled/Priority/Analyses only) followed immediately by a `v1/update` call carrying every other field, then re-fetch the AR for accurate return data. `v1/update` on AnalysisRequest IS reliable for these fields (confirmed by live probing + the end-to-end test) — restapi is NOT an option here (GET/PATCH on an AR crashes the restapi response serializer: `No converter for making <Client ...> JSON compatible`, because the AR's own reference fields can't be serialized back).
- **Reference-field UID gotchas confirmed live**: Container's real portal_type is `SampleContainer` (not "Container"); Preservation's is `SamplePreservation` (not "Preservation"). Always the object's real **UID**, never its id/slug. `ClientRemarks` does not exist on the AR schema at all — only `Remarks`.
- **Contact/CCContact have no UID in this app's UI** (`contact_name`/`cc_contact` are free-text inputs, not pickers) — resolved via a new `resolveOrCreateContactUid()` helper in `senaite.ts` that finds-or-creates a Contact under the client's path by name match, mirroring the backend's existing `_ensure_client_contact()` pattern in `core/senaite_service.py`. Any future free-text field that maps to a SENAITE reference type needs the same resolve-or-create treatment, not a raw string in the payload.
- **`v1/update`'s response is not trustworthy** — confirmed again here (already documented on `updateSenaiteSample`'s docstring): it can return **HTTP 400** on an AnalysisRequest update while the change is still applied server-side. **Never call `raise_for_status()`/treat non-2xx as failure on this endpoint** — always re-fetch the object afterward and check whether the value actually landed. A first version of the attachment-linking code below got this wrong and looped forever on retry, creating a duplicate object each time.
- **Attachments need a separate `Attachment` content object — SENAITE has no field on the AR that accepts a file directly.** `push_sample_attachment()` (`core/senaite_service.py`) creates it via **plone.restapi POST to the CLIENT folder** (POSTing to the AR's own path 403s), body `{"@type":"Attachment","AttachmentFile":{"data":<base64>,"encoding":"base64","filename":...,"content-type":...}}`, then links it via `v1/update {uid: <AR uid>, "Attachment": [...existing_uids, new_uid]}` — must read the AR's current `Attachment` list first and append, never blind-overwrite, or an earlier upload's attachment silently disappears. Verify the link by re-reading the AR (per the point above), not by trusting the update response. Before creating a new Attachment, check whether one with the same filename is already linked (idempotency) — otherwise a retried Celery task creates a duplicate every time it retries.
- Wired via a new Celery task `sync_sample_attachment_to_senaite` (`core/tasks.py`, standard `schema_context` tenant pattern) dispatched from `SampleViewSet.upload_attachment` (`lims/views.py`); new `Sample.senaite_attachment_uid` field (migration `lims/0028_add_sample_senaite_attachment_uid`) tracks the linked object.
- **Known gap, not fixed (needs a UI decision, flagged to user, not built without approval per §0):** the New Sample form's Container field is a hardcoded local preset list (`CONTAINER_OPTIONS`) unrelated to real SENAITE `SampleContainer` objects, and Batch Sub-group (`SubGroup` on the AR, folder `setup/subgroups`) is free text with no UID source in the UI — neither reaches SENAITE. Wiring them properly needs new data fetches / a picker UI, not just a payload change.

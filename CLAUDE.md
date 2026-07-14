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

**Everything runs in Docker Desktop — one command starts all services:**

```powershell
# PowerShell (IDE integrated terminal)
cd C:\Users\Lijish\Downloads\xellabs-lims\xellabs-lims
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
cd C:\Users\Lijish\Downloads\xellabs-lims\xellabs-lims
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
| Project root | `C:\Users\Lijish\Downloads\xellabs-lims\xellabs-lims` |
| Django backend | `C:\Users\Lijish\Downloads\xellabs-lims\xellabs-lims\xellabs-backend` |
| Django .env | `C:\Users\Lijish\Downloads\xellabs-lims\xellabs-lims\xellabs-backend\.env` |
| Django settings module | `config.settings` |
| Django root urls | `config.urls` |
| Celery app module | `config.celery:app` |
| Docker Compose file | `C:\Users\Lijish\Downloads\xellabs-lims\xellabs-lims\docker-compose.yml` |
| Django container | `xellabs-lims-django-1` — port 8001 |
| Celery container | `xellabs-lims-celery-1` |
| PostgreSQL container | `xellabs-lims-postgres-1` — port 5432 |
| Redis container | `xellabs-lims-redis-1` — port 6379 |
| SENAITE container | `xellabs-lims-senaite-1` — port 8080 |
| SENAITE image | `senaite/senaite:v2.6.0` |
| Broken SENAITE buildout | `~/senaite-dev/senaite.core` — **DO NOT USE** |
| start-commands.txt | `C:\Users\Lijish\Downloads\xellabs-lims\xellabs-lims\start-commands.txt` |

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

### PostgreSQL + Redis — installed in WSL Ubuntu (not Docker)
- WSL distro: `Ubuntu-22.04`
- Install command (run in WSL terminal): `sudo apt-get install -y postgresql postgresql-contrib redis-server`
- Start: `sudo service postgresql start` / `sudo service redis-server start`
- Stop: `sudo service postgresql stop` / `sudo service redis-server stop`
- DB setup (run once after install):
  ```bash
  sudo -u postgres psql -c "CREATE USER xellabs_user WITH PASSWORD '3333';"
  sudo -u postgres psql -c "CREATE DATABASE xellabs_lims OWNER xellabs_user;"
  ```

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
| Git Bash ≠ WSL Ubuntu | The Bash tool runs in MINGW64 (Git Bash), NOT WSL. `sudo` does not work in Git Bash. Always use PowerShell `wsl -d Ubuntu-22.04 --` prefix or run directly in WSL terminal |
| `winget` is blocked | Network policy returns 403 Forbidden on this machine. Never use winget. Install everything via WSL `apt` |
| `wsl -- sudo` needs TTY | Running `wsl -d Ubuntu-22.04 -- sudo <cmd>` from PowerShell silently fails if sudo needs a password. For sudo commands, ask user to run directly in WSL terminal |
| Multiple background apt processes stack | Never spawn more than one `apt-get` background command. If one is running, wait for it — spawning more causes dpkg lock conflicts |
| Docker Desktop path | `C:\Program Files\Docker\Docker\Docker Desktop.exe` |
| SENAITE Docker tags | Use `v2.6.0` not `latest` — `latest` tag doesn't exist on Docker Hub |
| `TENANT_DOMAIN_MODEL` not `DOMAIN_MODEL` | django-tenants requires `TENANT_DOMAIN_MODEL = "core.Domain"` in settings. Using `DOMAIN_MODEL` causes `AttributeError` on every request — 500 on all endpoints |
| Public tenant + localhost domain required | django-tenants `TenantMainMiddleware` needs a `Tenant(schema_name='public')` and `Domain(domain='localhost')` row in the DB or all requests to `localhost` return 404. Create once after DB reset via `manage.py shell` |
| Django superuser lost on container rebuild | `docker compose up -d --build` recreates the image but **not** the volume, so the DB is preserved. Superuser survives. But first-ever build starts with empty DB — create superuser with: `docker exec xellabs-lims-django-1 python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.create_superuser('admin','admin@xellabs.com','admin')"` |
| Next.js runs in **production mode** (`npm run build && npm start`) | Frontend Dockerfile CMD is `npm run build && npm start`. Source is volume-mounted so the build always uses latest host code. After any `.tsx/.ts` change: `docker compose stop frontend; docker compose rm -f frontend; docker compose up -d frontend` — no `--build` needed unless `package.json` or `Dockerfile` changes. Do NOT use `/app/.next` anonymous volume in production (dev-only Turbopack workaround). |
| TypeScript strict mode catches `unknown` in JSX | In production build, `ev.details?.someField` returns `unknown` and cannot be used directly in JSX or template literals. Always cast: `ev.details.field as string` or use `(ev.details?.field as string \| undefined)` in the condition. |
| Recharts `formatter` prop type mismatch | Recharts `Tooltip formatter` receives `ValueType | undefined`, not `number`. Do NOT type the parameter as `number`. Use `(v) => ...` and guard with `v ?? 0`. |
| `type` re-export from action files | If a component imports `type Foo` from an action file (`'use server'`), the action file must explicitly re-export it. Otherwise import directly from the source (e.g. `@/app/lib/senaite`). |
| Celery task missing `schema_context()` → silent per-tenant sync failure | `inventory/tasks.py`'s `sync_storage_location_to_senaite`/`sync_box_slots_to_senaite` queried `StorageLocation` (a tenant-app model) with no schema set. The Celery worker process has no request context, so it defaults to the `public` schema — where `storage_locations` doesn't exist — and the task crashes with `relation "storage_locations" does not exist` on every single run. Result: **every StorageLocation ever created silently never reached SENAITE**, even though `docker logs celery` showed the task in the registered `[tasks]` list (registration ≠ successful execution — always check for the task's own INFO/ERROR log line, not just that it's registered). Fixed by mirroring `core/signals.py`'s existing AR-sync pattern: capture `connection.schema_name` in the Django signal (which *does* have request/tenant context) and pass it as an explicit task arg, then wrap the task body in `with schema_context(schema_name):`. **Any new Celery task touching a tenant-app model must take `schema_name` as an argument and wrap its body in `schema_context()` — never assume the worker inherits the caller's schema.** Also caught: `bulk_create()` never fires `post_save`, so the `regenerate-slots` endpoint (which bulk-creates slots directly) needs its own explicit sync call — the auto-sync signal only fires for `.save()`/`.create()`. After changing a task's signature, `docker restart <celery-container>` — `watchmedo auto-restart` does not reliably reload Celery's registered task signatures on every `.py` save. |
| SENAITE Site/Location/Shelf Title columns showed blank | `StorageModal.tsx`'s `computeSenaiteDefaults()` only auto-fills these fields on a location's *descendants* by walking up the ancestor chain — it never defaults a location's own field for itself (a top-level `room` has no ancestor, so its own `site_title` stayed `''` forever unless someone manually typed it in), **and it never runs at all for auto-generated `box_location` slots**, since those are created via `bulk_create()` in `inventory/signals.py` and `regenerate_slots` — not through the create-location form. Fixed in two parts, both in `inventory/models.py`: (1) `StorageLocation.save()` defaults `site_title`/`location_title`/`shelf_title` to the location's own `name` when it's the owning type (`room`→site, `fridge/freezer/cabinet`→location, `shelf`→shelf); (2) `inherit_senaite_fields_from_ancestors()` walks up `self.parent` to fill any tier the location *doesn't* own (covers `box`, which inherits all three tiers from its ancestors). Since slots bypass `save()` via `bulk_create()`, added `StorageLocation.slot_inherited_fields(parent)` — a plain copy of the parent box's already-resolved tier fields (the box will have them populated by the time its `post_save` fires, since `save()` runs first) — and pass `**inherited` into every slot's constructor in both `inventory/signals.py` and the `regenerate-slots` action in `inventory/views.py`. Existing boxes/slots created before this fix needed a one-time backfill: re-save every `box`, then bulk-`.update(**StorageLocation.slot_inherited_fields(box))` its existing slots, then re-queue `sync_box_slots_to_senaite` for each box. |
| `'use server'` files can only export async functions | A `'use server'` action file (e.g. `app/actions/users.ts`) cannot export a plain object/const (e.g. a role-label lookup map) — Next.js build fails with `A "use server" file can only export async functions, found object`. Type exports are fine (erased at compile time); only runtime value exports are restricted. Fix: move shared constants/lookup maps into a plain module (e.g. `app/lib/roles.ts`) and import from there in both the action file and the client components — never define them inside the `'use server'` file itself. |
| Session cookie `secure: NODE_ENV === 'production'` breaks login over HTTP | Docker Compose always sets `NODE_ENV=production` for the frontend (needed for `npm run build && npm start`), so gating the `Secure` cookie flag on `NODE_ENV` makes the browser silently drop the session cookie on every plain-HTTP deployment — symptom: login succeeds, then any click "logs you out" (redirected to `/login`) because the cookie never actually got stored. Fixed in `app/lib/session.ts`: gate `secure` on `process.env.FORCE_SECURE_COOKIES === 'true'` instead. Only set `FORCE_SECURE_COOKIES=true` once real TLS/HTTPS is in front (e.g. a reverse proxy) — never based on `NODE_ENV` alone. |
| SENAITE `complete=true` on list endpoints is a hidden O(n) full-object-resolution cost | `fetchSenaiteStorageLocations()` (`app/lib/senaite.ts`) hung the Storage List page at 864 rows because `?complete=true` forces Plone/SENAITE to fully resolve (wake up) every matching object instead of reading cheap catalog-brain metadata. **Only pass `complete=true` when a field you render isn't already standard catalog metadata** (title/description/review_state/id/uid/created/modified usually are; custom AT/DX schema fields like `SerialNo`/`AssetNumber`/reference fields usually aren't — see `fetchSenaiteInstruments`, which legitimately needs it). Before adding a new SENAITE list fetcher, check whether the rendered fields need `complete=true` at all — default to leaving it off. Also added `app/dashboard/<route>/loading.tsx` as the standard pattern for any route awaiting a slow upstream (SENAITE) call in a server component — Next.js App Router auto-wraps it in Suspense so the shell renders instantly instead of blocking blank. |
| Deleting `Client`/`User` from the public schema crashes | Both live in the public schema, but their delete-cascade checks query `Sample` (a tenant-app model) → `relation "samples" does not exist`. Any shell/task deleting a Client or User must wrap in `schema_context('<a-tenant-schema>')`. To fully remove a test tenant: delete its users inside its own schema, then in `schema_context('public')` set `t.auto_drop_schema = True; t.delete(force_drop=True)`. |
| `http://localhost:3000` gives `ERR_CONNECTION_RESET`, `127.0.0.1:3000` works fine | On this machine, the browser resolves `localhost` to `::1` (IPv6) first, but Docker Desktop/WSL2 doesn't reliably forward the IPv6 loopback for the port-mapped frontend container (`curl -6 http://[::1]:3000` also resets) — this is a Docker Desktop networking quirk, not an app bug. IPv4 works (`curl -4 http://127.0.0.1:3000` → 200). **Always use `http://127.0.0.1:3000` in the browser on this machine**, not `localhost:3000`. Do not disable IPv6 system-wide to "fix" this — several adapters (OpenVPN, ZeroTier, WSL) may depend on it. |
| Adding a frontend npm package requires host lock-file update + `-V` rebuild | Frontend Dockerfile runs `npm ci`, which fails if `package-lock.json` doesn't list the new package. After editing `package.json`: run `npm install --package-lock-only --ignore-scripts` on the host in `xellabs-frontend/`, then `docker compose up -d --build -V frontend` — `-V` is required to renew the `/app/node_modules` **anonymous** volume, otherwise the container keeps the old modules from the previous image. |
| `Permissions-Policy` header in `next.config.ts` can silently block the camera | The frontend's security headers included `Permissions-Policy: camera=()`, which forbids `getUserMedia` on every page regardless of browser/OS permission settings — the error is indistinguishable from a user permission denial (NotAllowedError). Cost significant debugging time chasing Brave/Windows settings. Now `camera=(self)`. **When a browser API mysteriously fails despite correct browser permissions, check the app's own security headers (`next.config.ts headers()`, helmet, CSP/Permissions-Policy) first.** |
| Camera QR scanning needs a secure context | `navigator.mediaDevices.getUserMedia` only works over HTTPS or `localhost`. The storage-label QR scanner (`StorageLocationInput.tsx`) works on `localhost:3000` dev, but on a plain-HTTP LAN/server deployment the camera button will show "Camera not available" until TLS is put in front. Keyboard-wedge (USB) scanners are unaffected — they type into the focused input. |
| Sample list/detail pages read a stale denormalized field, not live storage state | `Sample.storage_location` (`lims/models.py`) is a plain text field, separate from the authoritative `StorageLocation.assigned_sample_id`/`is_occupied`. The QR-label assign flow updated only the storage side, so Samples Overview / Lab Samples kept showing blank location and stale occupied state after a sample was stored via scan. Fixed by syncing `Sample.storage_location` inside `_assign_sample_to_slot()` (write the resolved path) and in the `unassign` action (clear it) — the single choke point both entry paths already share, so no list page needs an extra per-row fetch (would be N+1). **Any future feature that changes where a sample physically sits must update through this one function, not touch `StorageLocation` directly, or the same staleness bug returns.** |
| Storage label codes are hidden + pk-derived | `StorageLocation.label_code` (boxes `BX-<pk>`, slots `BX-<pk>-A1`) is system-generated in `inventory/signals.py` (`_register_label_code_signal`, connected BEFORE the slot-autogenerate signal so slots can copy the box code during `bulk_create`). Never derived from the user-editable name (names can duplicate); unique constraint lives on the code. Resolve/assign endpoints: `GET /api/inventory/storage-locations/resolve-label/?code=` and `POST .../assign-by-label/`. |
| Superadmin ≠ `role='admin'` | Every tenant's lab admin also has `role='admin'`; platform-level gating (Tenant Management) must check `is_superuser` — exposed via `/api/auth/me/`, enforced by `core/permissions.py IsSuperAdmin`, carried in the frontend session as `session.isSuperuser` and in the Sidebar via the `superuserOnly` nav flag. |
| Fresh/wiped DB has zero `Tenant`/`Domain` rows → every API call 404s | `XelLabsTenantMiddleware` (`config/tenant_middleware.py`) needs a `Domain(domain='localhost')` (plus `127.0.0.1`, `django`) row pointing at the `public` `Tenant`, or django-tenants raises `No tenant for hostname "localhost"` and Django returns a plain 404 on **every** endpoint — including `/api/clients/` — with only a generic "Error 404" banner surfaced on the frontend, easy to miss. Symptom looked exactly like "client creation silently does nothing." Fix: run the "One-time setup after a full DB wipe" block below immediately after any DB reset. |
| Client deletion in Django does **not** propagate to SENAITE (accepted gap, not building sync) | `core/signals.py` only registers a `post_save` receiver for `Client` (`_register_client_signal`) — there is no `pre_delete`/`post_delete` handler. Deleting or deactivating a Client in XelLabs leaves an orphaned record in SENAITE forever; remove it manually inside SENAITE's own Clients UI. Also: deleting a `Client` via the normal Django ORM `.delete()` hits the cross-schema cascade crash (`relation "samples" does not exist`) in an install with no tenant schemas yet — use a raw `DELETE FROM clients WHERE ...` via `connection.cursor()` instead when that happens. |
| SENAITE `@groups` role PATCH silently no-ops on the dict-diff shape that works for `@users` | `PATCH @users/<username> {"roles": {"Analyst": true}}` is a genuine diff against the user's current roles (confirmed, used by `set_senaite_user_role`). The exact same shape sent to `PATCH @groups/<id>` returns 200/204 (looks successful) but **does not change the group's role list at all** — confirmed by toggling a role on then back off and re-fetching the group: still shows the stale list. Also, group creation needs `{"groupname": id, "title": ...}` — POSTing `{"id": ...}` 400s with "Property 'groupname' is required" (the field name differs from `@users`' own `{"username": ...}` POST shape). Fixed in `core/senaite_service.py`'s `set_senaite_group_role()`: GET the group first, mutate the roles set locally, then PATCH back the **full** `roles` list. Any future SENAITE group-role write must use this read-modify-write pattern, never the users-style dict diff. |

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

If more than one Claude Code instance is running against this project at the same time (e.g. two IDE windows, two terminals):

- **Check for signs of another instance's in-progress work first** — running background commands/builds (`docker ps`, `docker compose logs -f` still tailing), uncommitted changes you didn't make, a lock file, a `.next` build in progress, or a container mid-restart. Treat any of these as evidence another instance is active.
- **Communicate through the repo, not assumptions** — leave a short note of what you're doing/changed in the relevant section of this file (or a scratch note) so the other instance can see it on its next read of `CLAUDE.md`.
- **Never run the same mutating command the other instance is already running** (e.g. both running `docker compose up -d --build`, both doing `npm install`, both applying migrations). If one is clearly mid-task, wait for it to finish before starting overlapping work.
- **Avoid touching the same files at the same time.** If both instances need to edit the same file, one must finish and save before the other starts — do not interleave edits.
- **Run independent, non-conflicting work in parallel freely** (e.g. one reviews backend code while the other investigates frontend), since that carries no collision risk.
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
6. **Ask the user which branch to push to** if not already stated, then push — `git push <remote> <branch>`.

Never reorder this (e.g. never push before pulling/merging), and never force-push (`--force`/`-f`) unless the user explicitly asks for it in that exact request.

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

## 15a. Git Push Checklist — Track Unpushed Local Work

**`GIT-PUSH-CHECKLIST.md` (project root) is the visible, in-repo record of what's sitting on this machine unpushed.** Local commits and uncommitted changes are invisible to anyone but this machine — this file is what makes that state visible and prevents it from being silently lost or overwritten by a future `git pull`/merge.

### Rules:
- After every commit made during a session, add/update an entry in `GIT-PUSH-CHECKLIST.md` — what changed, which files, one line of why.
- Uncommitted changes that are meaningful (not yet committed but shouldn't be lost) also get listed there, clearly marked as uncommitted.
- Note any local-only config that `git push` will **not** carry along (e.g. `.env` values, since `.env` is gitignored) — these need manual replication on any other machine/deploy target.
- **Once the listed work is actually pushed**, delete those entries and reset the file back to just its template header. An empty checklist (just the header) means "everything local is pushed" — that is the file's steady state, not a growing log.
- This is NOT a duplicate of `Codetrackbypriciple.txt` (which is a permanent feature/principle history that never gets cleared) — this file is a transient "what's at risk right now" list.
- Before pushing to any remote, confirm with the user which remote/branch is the actual intended target — do not assume `origin` is the right destination without asking, since a fork/remote mismatch is easy to get wrong silently.

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

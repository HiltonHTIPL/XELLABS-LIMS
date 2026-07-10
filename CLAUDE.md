# Xellabs LIMS — Project Rules

> This file is auto-loaded by Claude Code on every session start.
> Read it fully before doing any work in this project.
> **This is the single source of truth. Keep it current.**

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

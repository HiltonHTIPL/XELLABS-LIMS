# XelLabs LIMS

A modern Laboratory Information Management System with a Next.js frontend, Django REST Framework backend, and SENAITE as the core LIMS engine — all running in Docker.

---

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript |
| Backend API | Django 6 + Django REST Framework 3.17 |
| Database | PostgreSQL 16 |
| Task Queue | Celery 5 + Redis 7 |
| Core LIMS Engine | SENAITE v2.6.0 (white-labeled as XelLabs) |
| Container Orchestration | Docker Compose |

### How the layers connect

```
Browser → Next.js frontend (port 3000)
              ↓ Server Actions
         Django API (port 8001)  ←→  PostgreSQL (port 5432)
              ↓
         SENAITE (port 8080)  ←→  Zope/ZODB
              ↑
         Celery workers (background tasks)  ←→  Redis (port 6379)
```

- The **frontend** talks to Django for auth, clients, tenants, and user management
- The **frontend** talks directly to SENAITE for samples, analyses, workflow transitions
- Django and SENAITE are kept in sync via server-side sync actions (e.g. Sync Clients)

---

## Git Remotes

This project has two remotes:

| Remote | URL | Purpose |
|---|---|---|
| `origin` | https://github.com/HiltonHTIPL/XELLABS-LIMS.git | Primary / personal fork |
| `hephzibah` | https://github.com/hephzibahtechnologies/XELLABS-LIMS.git | Team / organisation repo |

Always pull from the branch your team lead specifies before pushing.

---

## Running Locally (Developer Setup)

### Step 1 — Clone

```bash
# From the team repo
git clone https://github.com/hephzibahtechnologies/XELLABS-LIMS.git xellabs-lims
cd xellabs-lims

# OR from your personal fork
git clone https://github.com/HiltonHTIPL/XELLABS-LIMS.git xellabs-lims
cd xellabs-lims
```

### Step 2 — Create backend environment file

```bash
cp docs/deployment/env.production.template xellabs-backend/.env
```

Edit `xellabs-backend/.env` — minimum required for local dev:
```
DEBUG=True
SECRET_KEY=any-random-string-at-least-50-chars
DB_NAME=xellabs_lims
DB_USER=xellabs_user
DB_PASSWORD=3333
DB_HOST=postgres
DB_PORT=5432
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
```

> **Note:** The frontend env vars (`DJANGO_API_URL`, `SENAITE_URL`, `SESSION_SECRET`) are already set in `docker-compose.yml` — no `.env` file needed for the frontend in local Docker.

### Step 3 — Build and start all services

```bash
# First time (builds all 6 Docker images locally — no external downloads)
docker compose up -d --build

# Every subsequent start
docker compose up -d
```

This starts 6 containers:

| Container | Service | Port |
|---|---|---|
| `xellabs-lims-frontend-1` | Next.js frontend | 3000 |
| `xellabs-lims-django-1` | Django API | 8001 |
| `xellabs-lims-celery-1` | Celery worker | — |
| `xellabs-lims-celery-beat-1` | Celery beat scheduler | — |
| `xellabs-lims-postgres-1` | PostgreSQL | 5432 |
| `xellabs-lims-redis-1` | Redis | 6379 |
| `xellabs-lims-senaite-1` | SENAITE (XelLabs branded) | 8080 |

### Step 4 — Create Django superuser (first time only)

```bash
docker exec -it xellabs-lims-django-1 python manage.py createsuperuser
```

Set username: `admin`, password: `Admin@1234` (or your choice).

### Step 5 — Register public tenant (first time only, or on fresh database)

This is required for `django-tenants` routing to work. Without it every API call returns 404.

```bash
docker exec xellabs-lims-django-1 python manage.py shell -c "
from core.models import Tenant, Domain
public, _ = Tenant.objects.get_or_create(schema_name='public', defaults={'name':'XelLabs Public','slug':'public'})
for d in ['localhost','django','127.0.0.1']:
    Domain.objects.get_or_create(domain=d, defaults={'tenant':public,'is_primary':d=='localhost'})
print('Tenant setup complete')
"
```

### Step 6 — Access the system

| Service | URL | Login |
|---|---|---|
| **XelLabs Frontend** | http://localhost:3000 | admin / Admin@1234 |
| Django Admin | http://localhost:8001/admin/ | superuser |
| Django API | http://localhost:8001/api/ | Token auth |
| SENAITE | http://localhost:8080/senaite | admin / admin |

### Step 7 — Sync clients from SENAITE (first time)

1. Log in at http://localhost:3000
2. Go to **Clients**
3. Click **Sync SENAITE** — this pulls all SENAITE clients into Django

---

## After Pulling New Code

Whenever you pull from GitHub, always rebuild:

```bash
git pull hephzibah main        # or whichever branch
docker compose up -d --build   # always --build after a pull
```

> **Why `--build`?** A pull may include new Python packages (`requirements.txt`), new Node packages (`package.json`), new migrations, or Dockerfile changes. Without `--build`, containers run stale images.

---

## Project Structure

```
xellabs-lims/
├── xellabs-frontend/               Next.js 16 frontend
│   ├── app/
│   │   ├── actions/                Server actions
│   │   │   ├── auth.ts             Login / logout
│   │   │   ├── clients.ts          Client CRUD + SENAITE sync
│   │   │   ├── samples.ts          Sample CRUD + workflow (receive/verify/publish)
│   │   │   └── tenants.ts          Tenant management
│   │   ├── lib/
│   │   │   ├── session.ts          JWT session (8hr, httpOnly cookie)
│   │   │   ├── django.ts           Tenant-aware Django API fetch
│   │   │   ├── senaite.ts          Full SENAITE JSON API integration
│   │   │   └── definitions.ts      Zod validation schemas
│   │   └── dashboard/
│   │       ├── clients/            Client management + SENAITE sync
│   │       ├── samples/            Sample lifecycle (create, receive, verify, publish)
│   │       ├── sample-receipts/    Sample receipt workflow
│   │       └── chain-of-custody/   CoC tracking
│   └── .env.example                Frontend env reference (vars are set in docker-compose.yml)
├── xellabs-backend/                Django backend
│   ├── config/                     Settings, URLs, Celery config
│   ├── core/                       Users, Clients, Tenants, RBAC, multi-tenancy
│   ├── lims/                       Samples, Analysis Requests, Worksheets, Results
│   ├── inventory/                  Reagents, Lots, Transactions, Expiry Alerts
│   ├── instruments/                Instruments, Calibrations, File Imports
│   ├── workflow/                   Tasks, Approvals, Electronic Signatures
│   ├── audittrail/                 Audit Events, Data Change Logs, Record Versions
│   └── reporting/                  COA + report generation (WeasyPrint + Celery)
├── senaite-rebrand/                XelLabs white-label scripts + templates
├── senaite-reference/              SENAITE source (reference only — do not use)
├── docs/
│   ├── api-specs/                  API reference
│   ├── database-design/            Schema overview
│   ├── deployment/                 QA + production deployment guides
│   ├── senaite-fit-gap/            SENAITE vs custom build analysis
│   └── validation/                 UAT scenarios, performance testing
└── docker-compose.yml
```

---

## Frontend Features

### Clients (`/dashboard/clients`)
- List all clients synced from SENAITE
- **Sync SENAITE** button — pulls clients from SENAITE into Django
- Create, edit, activate/deactivate clients

### Samples (`/dashboard/samples`)
- Live sample list from SENAITE with KPI cards (Registered, Received, Verified, Published)
- Search by sample ID or client; filter by status and priority
- **New Sample** — creates an AnalysisRequest in SENAITE (client, sample type, date, priority, analyses)
- **Receive** — transitions sample from Registered → Received
- **Verify** / **Publish** — available on the sample detail page by current state

---

## SENAITE Integration

The frontend integrates with SENAITE via its JSON API v1 (`/@@API/senaite/v1/`):

| Operation | Endpoint |
|---|---|
| List samples | `GET /@@API/senaite/v1/AnalysisRequest` |
| Create sample | `POST /@@API/senaite/v1/create` |
| Workflow action (receive/verify/publish) | `POST /@@API/senaite/v1/AnalysisRequest/{uid}/workflow_action` |
| List clients | `GET /@@API/senaite/v1/client` |
| List sample types | `GET /@@API/senaite/v1/SampleType` |
| List analysis services | `GET /@@API/senaite/v1/AnalysisService` |

Auth: HTTP Basic (credentials from `SENAITE_ADMIN_USER` / `SENAITE_ADMIN_PASS`, default `admin/admin`).

---

## Django API Endpoints

| Endpoint | Description |
|---|---|
| `POST /api/auth/login/` | Get auth token |
| `GET /api/auth/me/` | Current user profile |
| `GET/POST /api/clients/` | Client list / create |
| `PATCH /api/clients/{id}/` | Update client |
| `GET/POST /api/samples/` | Sample list / register |
| `POST /api/samples/{id}/receive/` | Receive sample |
| `POST /api/results/{id}/verify/` | Verify result |
| `POST /api/reporting/reports/generate_coa/` | Generate COA PDF |
| `GET /api/compliance/audit/events/` | Audit trail |
| `GET /api/health/` | Health check |

---

## Useful Commands

```bash
# Check all containers
docker ps --filter "name=xellabs" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# View logs
docker logs xellabs-lims-frontend-1 --tail 50
docker logs xellabs-lims-django-1 --tail 50
docker logs xellabs-lims-celery-1 --tail 50
docker logs xellabs-lims-senaite-1 --tail 20

# Rebuild after code changes
docker compose up -d --build

# Run Django migrations manually (auto-runs on start)
docker exec xellabs-lims-django-1 python manage.py migrate

# Open Django shell
docker exec -it xellabs-lims-django-1 python manage.py shell

# NEVER run — deletes all data
# docker compose down -v
```

---

## Deploying to QA Server

See the full guide: [`docs/deployment/DEPLOYMENT.md`](docs/deployment/DEPLOYMENT.md)

Quick summary:
```bash
# On the QA server (Linux + Docker Engine)
git clone https://github.com/hephzibahtechnologies/XELLABS-LIMS.git xellabs-lims
cd xellabs-lims
cp docs/deployment/env.production.template xellabs-backend/.env
# Edit .env with real secrets
docker compose up -d --build
```

---

## Running Tests

```bash
docker exec xellabs-lims-django-1 python manage.py test --verbosity=2
```

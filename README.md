# XelLabs LIMS

A modern Laboratory Information Management System built on Django REST Framework + PostgreSQL, with SENAITE as a reference LIMS baseline.

## Architecture

| Layer | Technology |
|---|---|
| Backend API | Django 6 + Django REST Framework 3.17 |
| Database | PostgreSQL 16 |
| Task Queue | Celery 5 + Redis 7 |
| Reference LIMS | SENAITE v2.6.0 (white-labeled) |
| Container Orchestration | Docker Compose |

## Quick Start (Docker Desktop — Windows/Mac/Linux)

### 1. Clone
```bash
git clone https://github.com/hephzibahtechnologies/XELLABS-LIMS.git
cd XELLABS-LIMS
```

### 2. Create environment file
```bash
cp docs/deployment/env.production.template xellabs-backend/.env
```
Edit `xellabs-backend/.env` and set at minimum:
```
SECRET_KEY=any-random-string-for-dev
DB_HOST=postgres
```

### 3. Start all services
```bash
# First time (builds images locally — no external downloads needed)
docker compose up -d --build

# Every subsequent start
docker compose up -d
```

### 4. Create admin user
```bash
docker exec -it xellabs-lims-django-1 python manage.py createsuperuser
```

### 5. Access
| Service | URL | Credentials |
|---|---|---|
| Django API | http://localhost:8001/api/ | Token auth |
| Django Admin | http://localhost:8001/admin/ | superuser |
| SENAITE | http://localhost:8080/senaite | admin / admin |
| Health Check | http://localhost:8001/api/health/ | none |

---

## API Authentication

```bash
# Get token
curl -X POST http://localhost:8001/api/auth/token/ \
  -d '{"username":"admin","password":"yourpassword"}' \
  -H "Content-Type: application/json"

# Use token
curl http://localhost:8001/api/samples/ \
  -H "Authorization: Token <your-token>"
```

---

## Project Structure

```
xellabs-lims/
├── senaite-reference/        SENAITE source (reference only)
├── senaite-rebrand/          Docker image — white-labeled SENAITE
├── xellabs-backend/
│   ├── config/               Django settings, URLs, Celery
│   ├── core/                 Users, Clients, RBAC, Dashboard, Health
│   ├── lims/                 Samples, Analysis Requests, Worksheets, Results
│   ├── inventory/            Reagents, Lots, Transactions, Expiry Alerts
│   ├── instruments/          Instruments, Calibrations, File Imports
│   ├── workflow/             Tasks, Approvals, Electronic Signatures
│   ├── audittrail/           Audit Events, Data Change Logs, Record Versions
│   ├── reporting/            COA and report generation (WeasyPrint + Celery)
│   └── manage.py
├── xellabs-frontend/         Frontend (in progress)
├── docs/
│   ├── api-specs/            API reference
│   ├── database-design/      Schema overview
│   ├── deployment/           Production nginx, docker-compose.prod.yml
│   ├── senaite-fit-gap/      SENAITE vs custom build analysis
│   └── validation/           UAT scenarios, performance testing guide
└── docker-compose.yml
```

---

## Key API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/dashboard/` | Backlog summary |
| `GET/POST /api/samples/` | Sample registration |
| `POST /api/samples/{id}/receive/` | Receive sample |
| `POST /api/results/{id}/submit/` | Submit result |
| `POST /api/results/{id}/verify/` | Verify result (reviewer+) |
| `GET /api/inventory/lots/low-stock/` | Items below minimum |
| `GET /api/instruments/instruments/calibration-due/` | Calibration alerts |
| `POST /api/instruments/result-imports/{id}/process/` | Import CSV/XML results |
| `GET /api/compliance/audit/events/` | Audit trail |
| `POST /api/compliance/workflow/signatures/sign/` | Electronic signature |
| `GET /api/health/` | Health check |

Full API reference: [`docs/api-specs/API-REFERENCE.md`](docs/api-specs/API-REFERENCE.md)

---

## Running Tests

```bash
docker exec xellabs-lims-django-1 python manage.py test --verbosity=2
# 57 tests — all passing
```

---

## Production Deployment

See [`docs/deployment/DEPLOYMENT.md`](docs/deployment/DEPLOYMENT.md)

```bash
docker compose -f docker-compose.yml -f docs/deployment/docker-compose.prod.yml up -d --build
```

---

## Useful Commands

```bash
# Check container status
docker ps --filter "name=xellabs" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# View logs
docker logs xellabs-lims-django-1 --tail 50
docker logs xellabs-lims-celery-1 --tail 50

# Run migrations (auto-runs on start, but manual if needed)
docker exec xellabs-lims-django-1 python manage.py migrate

# NEVER run — deletes database
# docker compose down -v
```

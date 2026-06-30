# XelLabs LIMS — Deployment Guide

## Prerequisites
- Docker Desktop (Windows) or Docker Engine 24+ (Linux)
- Domain name with A record pointing to server
- TLS certificate (Let's Encrypt recommended)

---

## 1. First-Time Server Setup

```bash
# Clone the repo
git clone https://github.com/HiltonHTIPL/XELLABS-LIMS.git
cd xellabs-lims

# Copy and fill in production environment
cp docs/deployment/env.production.template xellabs-backend/.env
# Edit .env — set SECRET_KEY, DB_PASSWORD, DOMAIN, email settings

# Place TLS certificates
mkdir -p certs
cp your-cert.crt certs/xellabs.crt
cp your-key.key  certs/xellabs.key
```

## 2. Build and Start

```bash
# Full production stack (first time or after image changes)
docker compose -f docker-compose.yml -f docs/deployment/docker-compose.prod.yml up -d --build

# Create Django superuser
docker exec -it xellabs-lims-django-1 python manage.py createsuperuser
```

## 3. Verify Services

| Check | Command |
|---|---|
| All containers running | `docker ps --filter "name=xellabs"` |
| Django health | `curl https://your-domain/api/health/` |
| Readiness | `curl https://your-domain/api/health/ready/` |
| Django logs | `docker logs xellabs-lims-django-1 --tail 50` |
| Celery logs | `docker logs xellabs-lims-celery-1 --tail 50` |

## 4. Routine Updates

```bash
git pull origin main
docker compose -f docker-compose.yml -f docs/deployment/docker-compose.prod.yml up -d --build django celery celery-beat
```

## 5. Database Backup

```bash
# Backup
docker exec xellabs-lims-postgres-1 pg_dump -U xellabs_user xellabs_lims > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i xellabs-lims-postgres-1 psql -U xellabs_user xellabs_lims < backup_20260101.sql
```

## 6. NEVER Run
```bash
docker compose down -v   # DELETES the database volume — data loss
```

---

## Hypercare Checklist (First 30 Days Post Go-Live)

| Day | Check |
|---|---|
| 1 | Verify all 5 containers healthy after production deploy |
| 1 | Create all user accounts and assign roles |
| 1 | Run one full sample-to-COA workflow end-to-end |
| 2–7 | Monitor `docker logs` daily for errors |
| 7 | Verify Celery beat expiry alerts are firing (check audit log) |
| 14 | Review unacknowledged expiry alerts — acknowledge or escalate |
| 30 | Rotate `SECRET_KEY` and DB password (update .env, rebuild) |

# XelLabs LIMS — Deployment Guide

This guide covers deploying XelLabs LIMS to a QA or production server running Linux + Docker Engine.

---

## Prerequisites

| Requirement | Minimum |
|---|---|
| OS | Ubuntu 22.04 LTS (recommended) or any Linux with Docker |
| Docker Engine | 24+ |
| Docker Compose | v2 (bundled with Docker Engine 24+) |
| RAM | 4 GB minimum, 8 GB recommended |
| Disk | 20 GB free |
| Ports open | 80, 443 (or 3000 / 8001 / 8080 for internal QA) |
| Git | Any recent version |

---

## 1. Install Docker on the QA Server (Ubuntu)

```bash
# Update packages
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine + Compose plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Allow your user to run Docker without sudo
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

---

## 2. Clone the Repository

```bash
# Clone from team repo (main branch)
git clone https://github.com/hephzibahtechnologies/XELLABS-LIMS.git xellabs-lims
cd xellabs-lims

# OR clone a specific branch
git clone -b <branch-name> https://github.com/hephzibahtechnologies/XELLABS-LIMS.git xellabs-lims
cd xellabs-lims
```

---

## 3. Create Environment File

```bash
cp docs/deployment/env.production.template xellabs-backend/.env
nano xellabs-backend/.env
```

Fill in every value — never leave placeholders:

```bash
DEBUG=False
SECRET_KEY=<generate: python3 -c "import secrets; print(secrets.token_urlsafe(50))">

# Domain (use server IP for QA, domain for production)
DOMAIN=qa.yourdomain.com
ALLOWED_HOSTS=qa.yourdomain.com,<server-ip>

# Database — these match docker-compose.yml postgres service
DB_NAME=xellabs_lims
DB_USER=xellabs_user
DB_PASSWORD=<strong-random-password>
DB_HOST=postgres
DB_PORT=5432

# Redis / Celery
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# SENAITE admin credentials (must match ADMIN_PASSWORD in docker-compose.yml senaite service)
SENAITE_ADMIN_USER=admin
SENAITE_ADMIN_PASS=<senaite-admin-password>

# Email (optional for QA — leave blank to skip email alerts)
EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=noreply@yourdomain.com
EMAIL_HOST_PASSWORD=<email-password>
DEFAULT_FROM_EMAIL=XelLabs LIMS <noreply@yourdomain.com>

# Security (set True only if using HTTPS)
SECURE_SSL_REDIRECT=False
SESSION_COOKIE_SECURE=False
CSRF_COOKIE_SECURE=False
```

> **For QA without HTTPS:** keep all `SECURE_*` and `SESSION_COOKIE_SECURE` as `False`.
> **For production with HTTPS:** set all three to `True` and add TLS certificates.

---

## 4. Update docker-compose.yml for QA

For QA you need to update the **Postgres password** and **SESSION_SECRET** in `docker-compose.yml` to match your `.env`:

```bash
# Open and edit these values in docker-compose.yml:
# - postgres POSTGRES_PASSWORD → match DB_PASSWORD in .env
# - django/celery/celery-beat DB_PASSWORD → match DB_PASSWORD in .env
# - frontend SESSION_SECRET → set a strong 32+ char secret
nano docker-compose.yml
```

Or pass them as environment overrides — create a `docker-compose.qa.yml`:

```yaml
# docker-compose.qa.yml — QA overrides (do not commit secrets)
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: "<your-db-password>"

  django:
    environment:
      DEBUG: "False"
      SECRET_KEY: "<your-django-secret>"
      DB_PASSWORD: "<your-db-password>"

  celery:
    environment:
      SECRET_KEY: "<your-django-secret>"
      DB_PASSWORD: "<your-db-password>"

  celery-beat:
    environment:
      SECRET_KEY: "<your-django-secret>"
      DB_PASSWORD: "<your-db-password>"

  senaite:
    environment:
      - ADMIN_PASSWORD=<your-senaite-password>

  frontend:
    environment:
      - SESSION_SECRET=<strong-32-char-secret>
      - NODE_ENV=production
```

---

## 5. Build and Start All Services

```bash
# With default docker-compose.yml
docker compose up -d --build

# With QA overrides
docker compose -f docker-compose.yml -f docker-compose.qa.yml up -d --build
```

This builds 6 images and starts all containers. First build takes ~5–10 minutes.

Check all containers are healthy:
```bash
docker ps --filter "name=xellabs" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected output:
```
NAMES                          STATUS                    PORTS
xellabs-lims-frontend-1        Up X minutes              0.0.0.0:3000->3000/tcp
xellabs-lims-django-1          Up X minutes              0.0.0.0:8001->8001/tcp
xellabs-lims-celery-1          Up X minutes
xellabs-lims-celery-beat-1     Up X minutes
xellabs-lims-postgres-1        Up X minutes (healthy)    0.0.0.0:5432->5432/tcp
xellabs-lims-redis-1           Up X minutes (healthy)    0.0.0.0:6379->6379/tcp
xellabs-lims-senaite-1         Up X minutes              0.0.0.0:8080->8080/tcp
```

---

## 6. First-Time Database Setup

### 6a. Create Django superuser

```bash
docker exec -it xellabs-lims-django-1 python manage.py createsuperuser
```

Set a strong password. This account is used to log in to the frontend.

### 6b. Register public tenant (required — without this all API calls return 404)

```bash
docker exec xellabs-lims-django-1 python manage.py shell -c "
from core.models import Tenant, Domain
public, _ = Tenant.objects.get_or_create(schema_name='public', defaults={'name':'XelLabs Public','slug':'public'})
for d in ['localhost', 'django', '127.0.0.1', '<your-server-ip>', '<your-domain>']:
    Domain.objects.get_or_create(domain=d, defaults={'tenant': public, 'is_primary': d=='localhost'})
print('Tenant setup complete')
"
```

> Replace `<your-server-ip>` and `<your-domain>` with actual values, e.g. `10.0.0.5` and `qa.yourdomain.com`.

---

## 7. Verify the Deployment

```bash
# Django health check
curl http://<server-ip>:8001/api/health/

# Frontend (should return HTML)
curl http://<server-ip>:3000

# SENAITE
curl http://<server-ip>:8080/senaite
```

Then open in browser:

| Service | URL |
|---|---|
| XelLabs Frontend | http://\<server-ip\>:3000 |
| Django Admin | http://\<server-ip\>:8001/admin/ |
| SENAITE | http://\<server-ip\>:8080/senaite |

---

## 8. First Login and Sync

1. Open `http://<server-ip>:3000`
2. Log in with your superuser credentials
3. Go to **Clients → Sync SENAITE** to pull clients from SENAITE into Django
4. Go to **Samples** to see live sample data from SENAITE

---

## 9. Routine Update (Deploying New Code)

When a new version is pushed to GitHub:

```bash
cd xellabs-lims

# Step 1 — Stash any local changes
git stash

# Step 2 — Pull latest code
git fetch hephzibah main
git merge hephzibah/main

# Step 3 — Restore local changes (if any)
git stash pop

# Step 4 — Rebuild and restart
docker compose up -d --build
```

> Always use `--build` after a pull. New packages, migrations, or Dockerfile changes require a fresh image.

---

## 10. View Logs

```bash
# All containers
docker compose logs --tail 50

# Individual services
docker logs xellabs-lims-frontend-1 --tail 50
docker logs xellabs-lims-django-1 --tail 50
docker logs xellabs-lims-celery-1 --tail 50
docker logs xellabs-lims-senaite-1 --tail 20

# Follow live (Ctrl+C to stop)
docker logs xellabs-lims-django-1 -f
```

---

## 11. Database Backup and Restore

```bash
# Backup (creates a .sql file with today's date)
docker exec xellabs-lims-postgres-1 pg_dump -U xellabs_user xellabs_lims > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
docker exec -i xellabs-lims-postgres-1 psql -U xellabs_user xellabs_lims < backup_20260630_120000.sql
```

---

## 12. Stop and Restart Services

```bash
# Stop all (data is preserved in volumes)
docker compose stop

# Restart all
docker compose start

# Restart a single service
docker compose restart django

# NEVER run this — it deletes the database
# docker compose down -v
```

---

## 13. Troubleshooting

| Problem | Fix |
|---|---|
| Frontend shows "No clients yet" | Run the Sync SENAITE button, or check `/api/clients/` returns 200 |
| All API calls return 404 | Public tenant not registered — run Step 6b above |
| Login returns 400 | Check Django logs: `docker logs xellabs-lims-django-1 --tail 50` |
| `ModuleNotFoundError` on startup | Run `docker compose up -d --build` to rebuild images |
| SENAITE won't start | Check `docker logs xellabs-lims-senaite-1 --tail 30`; first start takes ~2–3 minutes |
| Port already in use | Find and stop the conflicting process: `sudo lsof -i :3000` |
| Celery tasks not running | Restart celery: `docker compose restart celery celery-beat` |

---

## QA Deployment Checklist

- [ ] Docker Engine 24+ installed
- [ ] Repository cloned from `hephzibahtechnologies/XELLABS-LIMS`
- [ ] `xellabs-backend/.env` created with real values (no placeholders)
- [ ] `docker compose up -d --build` completed with all 7 containers healthy
- [ ] Django superuser created
- [ ] Public tenant registered (Step 6b)
- [ ] Can log in at `http://<server>:3000`
- [ ] SENAITE accessible at `http://<server>:8080/senaite`
- [ ] Clients sync from SENAITE works
- [ ] Sample creation in SENAITE works from frontend
- [ ] Django health check returns 200: `curl http://<server>:8001/api/health/`

---

## Hypercare Checklist (First 30 Days Post Go-Live)

| Day | Check |
|---|---|
| 1 | Verify all 7 containers healthy after deploy |
| 1 | Create all user accounts and assign roles |
| 1 | Run one full sample-to-COA workflow end-to-end |
| 1 | Verify Sync SENAITE works for clients |
| 2–7 | Monitor `docker logs` daily for errors |
| 7 | Verify Celery beat expiry alerts are firing |
| 14 | Review unacknowledged expiry alerts |
| 30 | Rotate `SECRET_KEY`, `DB_PASSWORD`, and `SESSION_SECRET` (update `.env` and `docker-compose.yml`, rebuild) |

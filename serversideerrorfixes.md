# XelLabs LIMS — Server-Side Error Fixes & Deployment Guide

> **Who is this for?** Anyone deploying XelLabs LIMS to a staging or production server.
> Read this fully before running `docker compose up` on any non-local machine.

---

## Table of Contents

1. [What Was Fixed (Summary)](#1-what-was-fixed-summary)
2. [Files Changed](#2-files-changed)
3. [What You Must Set Before Deploying](#3-what-you-must-set-before-deploying)
4. [Production `.env` Template](#4-production-env-template)
5. [Step-by-Step Deployment Checklist](#5-step-by-step-deployment-checklist)
6. [Known Remaining Issues (Future Work)](#6-known-remaining-issues-future-work)
7. [Ports & Firewall Rules](#7-ports--firewall-rules)
8. [How to Add a New Server's IP/Domain](#8-how-to-add-a-new-servers-ipdomain)
9. [How to Reset a Client's Password (Until Email is Built)](#9-how-to-reset-a-clients-password-until-email-is-built)
10. [Emergency Rollback](#10-emergency-rollback)

---

## 1. What Was Fixed (Summary)

The following security and deployment issues were found and fixed in this session:

| # | Severity | What Was Wrong | What Was Fixed |
|---|----------|---------------|----------------|
| 1 | 🔴 Critical | `DEBUG=True` was the default for all services | Changed default to `False` in `docker-compose.yml` |
| 2 | 🔴 Critical | `SECRET_KEY` defaulted to a known public placeholder string | Removed fallback — app will crash at startup if not set |
| 3 | 🔴 Critical | `DB_PASSWORD` was hardcoded as `"3333"` in 4 places | Replaced with `${DB_PASSWORD:-3333}` env var |
| 4 | 🔴 Critical | `SESSION_SECRET` had a known public fallback value | Removed fallback — app will crash at startup if not set |
| 5 | 🔴 Critical | `DJANGO_SERVICE_TOKEN` had a committed default token | Removed fallback — must be set explicitly |
| 6 | 🟠 High | Django port `8001` was exposed on `0.0.0.0` (internet-visible) | Bound to `127.0.0.1:8001` — loopback only |
| 7 | 🟠 High | SENAITE port `8080` was exposed on `0.0.0.0` (internet-visible) | Bound to `127.0.0.1:8080` — loopback only |
| 8 | 🟠 High | `ALLOWED_HOSTS` defaulted to `"*"` when DEBUG=True | Now defaults to `localhost,127.0.0.1,django` |
| 9 | 🟠 High | `CORS_ALLOW_ALL_ORIGINS = True` when DEBUG=True (open CORS) | Set to `False` always; origins driven by env var |
| 10 | 🟠 High | GCP IP `34.30.6.247` hardcoded in `next.config.ts` | Removed; now driven by `NEXT_PUBLIC_ALLOWED_ORIGINS` env var |
| 11 | 🟠 High | Celery workers missing `SENAITE_*` env vars | Added `SENAITE_URL`, `SENAITE_USER`, `SENAITE_PASSWORD` to celery and celery-beat services |
| 12 | 🟡 Medium | Session cookie `sameSite: 'lax'` — insufficient for HIPAA | Changed to `sameSite: 'strict'` |
| 13 | 🟡 Medium | `POSTGRES_PASSWORD` hardcoded in docker-compose | Now uses `${DB_PASSWORD:-3333}` |

---

## 2. Files Changed

| File | What Changed |
|------|-------------|
| `docker-compose.yml` | `DEBUG` default → `False`; removed `SECRET_KEY` fallback; removed `SESSION_SECRET` and `DJANGO_SERVICE_TOKEN` fallbacks; added SENAITE env vars to celery services; DB password parameterised; ports 8001 and 8080 bound to `127.0.0.1` |
| `xellabs-backend/config/settings.py` | `ALLOWED_HOSTS` no longer defaults to `"*"`; `CORS_ALLOW_ALL_ORIGINS` always `False` |
| `xellabs-frontend/next.config.ts` | Removed hardcoded `34.30.6.247`; server action origins now driven by `NEXT_PUBLIC_ALLOWED_ORIGINS` env var |
| `xellabs-frontend/app/lib/session.ts` | Session cookie `sameSite` changed from `'lax'` to `'strict'` |
| `xellabs-backend/.env` | Added missing vars: `REDIS_PASSWORD`, `SENAITE_ADMIN_PASSWORD`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` |

---

## 3. What You Must Set Before Deploying

These variables have **no safe default** — the app will refuse to start without them on a production server:

| Variable | Where to set | How to generate |
|----------|-------------|-----------------|
| `SECRET_KEY` | `xellabs-backend/.env` on server | `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `SESSION_SECRET` | Root `.env` or server env | `python -c "import secrets; print(secrets.token_hex(32))"` (must be 32+ chars) |
| `DJANGO_SERVICE_TOKEN` | Root `.env` or server env | `python -c "import secrets; print(secrets.token_hex(20))"` |
| `DB_PASSWORD` | Root `.env` or server env | Use a strong password (not `3333`) |
| `REDIS_PASSWORD` | Root `.env` or server env | Use a strong password |
| `SENAITE_ADMIN_PASSWORD` | Root `.env` or server env | Change from `admin` immediately after first deploy |
| `ALLOWED_HOSTS` | `xellabs-backend/.env` on server | Your server's domain/IP, e.g. `xellabs.com,www.xellabs.com` |
| `CORS_ALLOWED_ORIGINS` | `xellabs-backend/.env` on server | `https://xellabs.com,https://www.xellabs.com` |
| `NEXT_PUBLIC_ALLOWED_ORIGINS` | Root `.env` or server env | `xellabs.com:3000` or your domain |

---

## 4. Production `.env` Template

Create this file at the **project root** (`c:\Users\Hilton\xellabs-lims\.env`) on your production server.  
**Never commit this file to git.**

```env
# ─────────────────────────────────────────────
# XelLabs LIMS — Production Environment Variables
# Copy this to the project root on the server.
# NEVER commit this file to git.
# ─────────────────────────────────────────────

# ── Django ──────────────────────────────────
DEBUG=False
SECRET_KEY=REPLACE_WITH_GENERATED_SECRET_KEY_50_CHARS
ALLOWED_HOSTS=xellabs.com,www.xellabs.com,your-server-ip
CORS_ALLOWED_ORIGINS=https://xellabs.com,https://www.xellabs.com

# ── Database ─────────────────────────────────
DB_NAME=xellabs_lims
DB_USER=xellabs_user
DB_PASSWORD=REPLACE_WITH_STRONG_PASSWORD

# ── Redis ─────────────────────────────────────
REDIS_PASSWORD=REPLACE_WITH_STRONG_REDIS_PASSWORD

# ── SENAITE ───────────────────────────────────
SENAITE_ADMIN_PASSWORD=REPLACE_WITH_STRONG_SENAITE_PASSWORD

# ── Frontend / Next.js ────────────────────────
SESSION_SECRET=REPLACE_WITH_32_PLUS_CHAR_RANDOM_STRING
DJANGO_SERVICE_TOKEN=REPLACE_WITH_40_CHAR_HEX_TOKEN
NEXT_PUBLIC_ALLOWED_ORIGINS=xellabs.com:3000

# ── Node environment ──────────────────────────
NODE_ENV=production
```

### How to generate each secret on Linux/Mac:
```bash
# SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(50))"

# SESSION_SECRET (must be 32+ chars)
python3 -c "import secrets; print(secrets.token_hex(32))"

# DJANGO_SERVICE_TOKEN
python3 -c "import secrets; print(secrets.token_hex(20))"

# DB_PASSWORD and REDIS_PASSWORD — use a password manager or:
python3 -c "import secrets; print(secrets.token_urlsafe(24))"
```

### How to generate on Windows PowerShell:
```powershell
# SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(50))"

# SESSION_SECRET
python -c "import secrets; print(secrets.token_hex(32))"

# DJANGO_SERVICE_TOKEN
python -c "import secrets; print(secrets.token_hex(20))"
```

---

## 5. Step-by-Step Deployment Checklist

Follow these steps **in order** every time you deploy to a new server or promote to production.

### Step 1 — Set up the server
- [ ] Ubuntu 22.04 LTS server with Docker + Docker Compose installed
- [ ] Firewall open on ports: `80`, `443`, `3000` (or `443` only if behind Nginx)
- [ ] Firewall **closed** on ports: `8001`, `8080`, `5432`, `6379` — these are internal only

### Step 2 — Clone the repo
```bash
git clone https://github.com/hephzibahtechnologies/XELLABS-LIMS.git
cd XELLABS-LIMS
```

### Step 3 — Create the `.env` file
```bash
# Create root .env from the template in section 4 above
nano .env

# Also create the backend .env
nano xellabs-backend/.env
```

Minimum required in `xellabs-backend/.env`:
```env
DEBUG=False
SECRET_KEY=<your generated key>
DB_NAME=xellabs_lims
DB_USER=xellabs_user
DB_PASSWORD=<same as root .env DB_PASSWORD>
DB_HOST=postgres
DB_PORT=5432
ALLOWED_HOSTS=<your domain or IP>
CORS_ALLOWED_ORIGINS=https://<your domain>
```

### Step 4 — Start all containers
```bash
docker compose up -d --build
```

### Step 5 — Verify all containers are healthy
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```
All containers should show `healthy` or `Up`. If any show `unhealthy`, check logs:
```bash
docker logs xellabs-lims-django-1 --tail 30
docker logs xellabs-lims-frontend-1 --tail 30
```

### Step 6 — Test the app
- [ ] Open `http://your-server-ip:3000` — login page appears
- [ ] Log in as `Admin` / `admin` → dashboard loads
- [ ] Go to Clients → "New Client" → create a test client → no errors
- [ ] Go to Sample Types → "New Sample Type" → create one → appears in list
- [ ] Check `docker logs xellabs-lims-django-1 --tail 20` — no Python errors

### Step 7 — Change default passwords
- [ ] Log into Django Admin (`http://127.0.0.1:8001/admin`) → change Admin password
- [ ] Change SENAITE admin password via `http://127.0.0.1:8080/senaite`
- [ ] Update `SENAITE_ADMIN_PASSWORD` in `.env` to match new SENAITE password
- [ ] Rebuild: `docker compose up -d --build`

---

## 6. Known Remaining Issues (Future Work)

These issues were identified but **not yet fixed** — they require larger features to be built:

### 🟠 Client password delivery (blocker for client login)
**Problem:** When a new client is created via "New Client" in the UI, the system creates a login account with a random password. That password is generated but **never sent to the client** — the email delivery system is not built yet.

**Impact:** Every new client account is inaccessible after creation until manually reset.

**Current workaround:** After creating a client, go to:
`http://127.0.0.1:8001/admin/core/users/` → find the client username → set a known password manually.

**Fix needed:** Build an email flow in `xellabs-backend/core/views.py` `perform_create` to send a password-reset link to the client contact email.

---

### 🟡 `runserver` in development mode
**Problem:** `docker-compose.yml` uses `python manage.py runserver` which is not production-safe. It is single-threaded and does not handle TLS.

**Fix:** The production-ready `docker-compose.prod.yml` uses gunicorn. Always use:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
for production deploys.

---

### 🟡 Source code volume-mounted in dev compose
**Problem:** `docker-compose.yml` mounts `./xellabs-backend:/app` so Django hot-reloads on file changes. This is correct for development but wrong for production — it means code changes on the host immediately affect the running container.

**Fix:** The prod compose removes the volume mount and bakes code into the image at build time.

---

### 🟡 SENAITE rebrand scripts have hardcoded `admin:admin`
**Files:** `senaite-rebrand/fix_title_full2.py`, `senaite-rebrand/rebrand.py`

**Problem:** These scripts hardcode `admin:admin` and `localhost:8080`. They are one-time setup tools and should be run manually, not automated.

**Fix needed:** Update scripts to read credentials from environment variables before running in production.

---

### 🟡 No Nginx reverse proxy yet
**Problem:** The app is served directly via Docker on ports `3000` (frontend) and `8001` (Django API). There is no TLS, no HTTPS, and no domain routing.

**Fix needed:** Add an Nginx container to `docker-compose.prod.yml` that:
- Serves frontend on port `443` with SSL
- Proxies `/api/` to Django on port `8001`
- Redirects HTTP → HTTPS

---

## 7. Ports & Firewall Rules

| Port | Service | Who can access | Notes |
|------|---------|---------------|-------|
| `3000` | Next.js frontend | Internet (users) | Open in firewall |
| `8001` | Django API | **Localhost only** | Bound to `127.0.0.1` — never open in firewall |
| `8080` | SENAITE | **Localhost only** | Bound to `127.0.0.1` — never open in firewall |
| `15432` | PostgreSQL | **Localhost only** | Bound to `127.0.0.1` — never open in firewall |
| `6379` | Redis | **Localhost only** | Bound to `127.0.0.1` — never open in firewall |

**Summary:** Only port `3000` (or `443` if behind Nginx) should be open to the internet.

---

## 8. How to Add a New Server's IP/Domain

When you deploy to a new server (e.g. QA, staging, production), you need to add its IP/domain in two places:

### Backend — `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS`
In the server's `xellabs-backend/.env`:
```env
ALLOWED_HOSTS=localhost,127.0.0.1,django,your-new-ip-or-domain
CORS_ALLOWED_ORIGINS=http://your-new-ip:3000,https://your-domain.com
```

### Frontend — Server Action Allowed Origins
In the server's root `.env`:
```env
NEXT_PUBLIC_ALLOWED_ORIGINS=your-new-ip:3000,your-domain.com:3000
```

Then rebuild:
```bash
docker compose up -d --build frontend
```

---

## 9. How to Reset a Client's Password (Until Email is Built)

When a new client is created, their login password is auto-generated but not shown. To set it manually:

1. Go to `http://127.0.0.1:8001/admin/core/users/`
2. Find the user by username (same as the Client ID, e.g. `HL-01`)
3. Click the user → scroll to "Password" → click "Change password"
4. Set a new password and save
5. Share the username and new password with the client directly

**OR via command line:**
```bash
docker exec -it xellabs-lims-django-1 python manage.py changepassword HL-01
```

---

## 10. Emergency Rollback

If a deployment breaks the app:

### Roll back to the previous Docker image:
```bash
# Stop everything
docker compose down

# Pull the previous git commit
git log --oneline -5   # find the last working commit hash
git checkout <commit-hash>

# Rebuild and restart
docker compose up -d --build
```

### If the database is corrupted:
```bash
# Restore from backup
cat xellabs-backups/backup_YYYYMMDD_HHMMSS.sql | docker exec -i xellabs-lims-postgres-1 psql -U xellabs_user -d xellabs_lims
```

### NEVER run:
```bash
docker compose down -v   # ← THIS DELETES ALL DATA — postgres_data volume is destroyed
```

---

*Last updated: 2026-07-03 | Maintained by Hephzibah Technologies*

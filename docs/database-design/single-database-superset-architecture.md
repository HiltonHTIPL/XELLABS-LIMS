# XELLABS LIMS: One Queryable Database Per Client (Superset Integration)

Prepared for: Israel Thavasikani, VP IT, Hephzibah Super Technologies / PM, C2N Diagnostics
Stage: 01 research, decision-ready architecture
Scope: the analytics (Superset) integration only. Multi-tenancy model, instance-per-client topology, and Django-as-tenant-source-of-truth are already-decided inputs to this document, not open questions here.

Purpose: today, every client instance runs three separate stores that must each be backed up, monitored, and reasoned about: the Django Postgres, Superset's own internal metadata store, and SENAITE's ZODB. This document specifies how to collapse the two SQL-capable stores (Django Postgres and Superset's metadata store) into one Postgres instance per client, with SENAITE's ZODB retained but reframed as an internal engine detail rather than a system database.

---

## 1. Principles

These four principles decide every design choice below. If a proposed change conflicts with one of them, the principle wins.

1. **One queryable relational store of record per client.** "Queryable" is the operative word: any database an operator, analyst, or backup script needs to open with `psql` and reason about should be the same database. A client's data should not be split across two SQL engines that both claim to be authoritative.

2. **SENAITE's ZODB is an internal engine detail, not a system database.** SENAITE is built on Zope, and Zope's persistence layer is ZODB. That is a fact about how SENAITE is built, not a design decision this project made. It sits below the "must not modify SENAITE code" boundary already in place. ZODB is therefore excluded from the "one database" count the same way a browser's IndexedDB or a compiler's intermediate representation would be: it is real, it exists, and it is not a decision point.

3. **Every service that CAN externalize its state into Postgres MUST.** Superset ships with a config hook (`SQLALCHEMY_DATABASE_URI`) built for exactly this. There is no engineering reason for Superset to keep its own database when a supported, first-class mechanism exists to point it at the same Postgres the rest of the stack already uses. Redis is exempt from this principle: Redis holds cache entries and Celery queue state, both disposable and rebuildable, so it correctly stays outside the "database of record" boundary.

4. **User identity has one source of truth.** Django already owns tenant, user, and client identity (`core.User`, `AUTH_USER_MODEL = "core.User"`, verified in `settings.py`). Moving Superset's metadata into the same Postgres does not change this: Superset's own user table (`ab_user`, a Flask-AppBuilder table) still holds Superset's dashboard/chart permissions, and Django's user table still holds tenant and business identity. The principle is not "one user table" (Superset's internal RBAC model does not map cleanly onto Django's), it is "no third identity system appears." Consolidating storage does not consolidate the two apps' user tables, and this document does not propose that it should.

From these four principles, the target state follows directly: one Postgres instance per client, three schemas inside it, Redis untouched, SENAITE untouched.

---

## 2. Current State (verified)

Verified directly against `docker-compose.yml`, `docker-compose.superset.yml`, `superset_config.py`, `xellabs-backend/config/settings.py`, `xellabs-backend/config/tenant_middleware.py`, `xellabs-backend/lims/tasks.py`, and `xellabs-frontend/app/api/superset/guest-token/route.ts`.

**Main stack (`docker-compose.yml`):** one Docker Compose project with `postgres` (image `postgres:16`, database `xellabs_lims`, user `xellabs_user`), `redis` (image `redis:7`, password-protected), `django` (built from `./xellabs-backend`, runs `migrate_schemas --shared` then `migrate_schemas` then `gunicorn`), `celery` and `celery-reports` (two worker pools, `celery-reports` isolated on the `reports` queue so report generation is not blocked behind the sync sweep), `celery-beat` (scheduler), `senaite` (built from `./senaite-rebrand`, healthcheck uses `python2.7`, confirming the Zope/Python2 stack, data persisted in a named volume `senaite_data`), and `frontend` (Next.js). Postgres data persists in a named volume `postgres_data`. There is no Superset service anywhere in this compose file.

**Superset stack (`docker-compose.superset.yml`):** a second, separate Docker Compose file, not referenced anywhere in `README.md`'s startup instructions. It defines one service, `superset` (image `apache/superset`, unpinned, i.e. effectively `latest`), publishing container port 8088 on host port 8089, and mounts only `superset_config.py`. No database service, no volume for Superset's own data directory, and no network wiring to the main stack's Postgres or Redis are declared in this file.

**Superset's metadata store, current location: TBD.** `superset_config.py` sets `GUEST_ROLE_NAME`, `FEATURE_FLAGS.EMBEDDED_SUPERSET`, CORS, disables Talisman and CSRF protection, and sets branding (`APP_NAME = "XELPulse"`), but it does **not** set `SQLALCHEMY_DATABASE_URI` (confirmed: no such key in the file). With that key absent, Superset falls back to whatever the `apache/superset` image's own entrypoint configures by default, which this document did not independently verify inside the running container. A file `superset_temp.db` sits in the project root and is confirmed (via `file`) to be a real SQLite 3 database, but it is **not** mounted into the Superset container per the compose file, so it is most likely a manual export/backup copied out with `docker cp` at some point, not proof of the live in-container path. **Action to resolve, one command:** `docker exec superset python -c "from superset import app; print(app.config['SQLALCHEMY_DATABASE_URI'])"`.

**Superset's connection to Postgres for chart data:** the team has told us this exists (Superset queries the Django Postgres for chart data), and dev scripts in the repo root (`create_embedded.py`, `fix_db.py`, `fix_db2.py`, `fix_db3.py`, `grant_public.py`) confirm Superset's own ORM models (`Dashboard`, `EmbeddedDashboard`, `Role`, `Permission`, `PermissionView`, `ViewMenu`, all standard Flask-AppBuilder/Superset entities) are being manipulated directly via `create_app()` + `db.session`, which is normal Superset admin scripting. This document did **not** verify which schema or tables that Postgres connection targets, because that connection is configured inside Superset's own metadata database (via its UI or REST API), not in a text file this repo tracks. **Action to resolve:** once the metadata store location above is confirmed, inspect its `dbs` table for the stored `sqlalchemy_uri`.

**Existing SENAITE-to-Postgres pull already in production.** `xellabs-backend/lims/tasks.py` defines `sync_from_senaite`, a Celery Beat task (scheduled every 300 seconds in `settings.py`'s `CELERY_BEAT_SCHEDULE`) that loops every non-public tenant schema and calls `lims.senaite_sync.pull_samples_and_results()` inside `schema_context(tenant.schema_name)`. This means the codebase already has a working, scheduled pattern for pulling SENAITE data into Postgres, per tenant schema. This is direct evidence that "periodic export from SENAITE into Postgres" is not a new concept for this system, it already exists for sample/result sync; section 8 covers whether the analytics export should extend this same mechanism or use `senaite.sqlmultiplex`.

**Embedding auth path, verified working today, independent of where Superset's metadata lives.** `xellabs-frontend/app/api/superset/guest-token/route.ts` authenticates the frontend session, then performs a four-step handshake entirely through Superset's own REST API: `POST /login/` for a CSRF token and session cookie, `POST /api/v1/security/login` for a JWT, `GET /api/v1/security/csrf_token/` for an API CSRF token, then `POST /api/v1/security/guest_token/` with the dashboard ID and the XelLabs session username embedded as the guest user identity. Every one of these calls is HTTP against Superset's application layer, not a direct database read. Note also: the guest token payload's `rls: []` array is empty today, meaning no Superset Row-Level Security rules are configured yet; that is a separate, pre-existing gap, out of scope for this document.

**Django's own multi-tenancy is already "one Postgres, many schemas".** `settings.py` configures `django_tenants.postgresql_backend` with `SHARED_APPS` (including `core`, which holds `Tenant`, `Domain`, `User`, `Client`) living in the `public` schema, and `TENANT_APPS` (`lims`, `inventory`, `instruments`, `workflow`, `audittrail`, `reporting`) replicated per tenant schema inside the same `xellabs_lims` database. `tenant_middleware.py` resolves the active schema from an `X-Tenant-Schema` header sent by the frontend's server actions. `CICD-QA-FIXES-REPORT.md` and `docker-compose.yml` confirm real schema names in use (`hl-01` as a hardcoded, since-flagged-as-a-bug default; `hephzibah` as the real migrated tenant on the QA server; `greenvalley` as an example in code comments). This is strong existing precedent: the target design in section 3 is not a new pattern, it extends a pattern already running in production.

### Current state diagram

```mermaid
flowchart TD
    Browser["Browser"]

    subgraph MainStack["docker-compose.yml, one project"]
        Frontend["Next.js frontend, port 3000"]
        Django["Django API, port 8001, django-tenants"]
        CeleryWorker["Celery worker + celery-reports"]
        CeleryBeat["Celery beat scheduler"]
        Senaite["SENAITE 2.6 on Zope, port 8080"]
        PG["Postgres 16: xellabs_lims\nschemas: public + one per tenant"]
        Redis["Redis 7: db0 broker, db1 cache"]
        ZODB["Data.fs, senaite_data volume"]
    end

    subgraph SupersetStack["docker-compose.superset.yml, separate project"]
        Superset["Superset, container port 8088,\nhost port 8089, image unpinned"]
        SupersetMeta["Superset metadata store\nTBD: confirm engine and path"]
    end

    Browser --> Frontend
    Frontend -->|server actions| Django
    Frontend -->|JSON API, HTTP basic auth| Senaite
    Frontend -->|guest-token REST calls,\nSUPERSET_URL=host.docker.internal:8088 in dev| Superset
    Django --> PG
    Django --> Redis
    CeleryWorker --> Redis
    CeleryWorker -->|sync_from_senaite task,\nscheduled every 5 min| Senaite
    CeleryWorker -->|writes lims app tables| PG
    CeleryBeat -.schedules.-> CeleryWorker
    Senaite --> ZODB
    Superset --> SupersetMeta
    Superset -.->|chart data connection,\nexact schema/tables TBD| PG
```

---

## 3. Target State

One Postgres 16 instance per client, same `xellabs_lims` database, three schemas:

- **`django`** (in practice: the existing `public` schema plus per-tenant schemas already managed by `django-tenants`; no change to this schema's structure or naming, it is called out separately here only to name it in the three-schema model)
- **`superset_meta`**: Superset's own tables (users, roles, dashboards, charts, datasets, permissions) via `SQLALCHEMY_DATABASE_URI`
- **`analytics`**: a warehouse area, populated by a scheduled export job from SENAITE, that Superset's chart datasets query

Redis is unchanged: cache and Celery broker only, never a database of record. SENAITE keeps ZODB internally; nothing about SENAITE's own storage changes.

### Target state diagram

```mermaid
flowchart TD
    Browser["Browser"]

    subgraph TargetStack["One docker-compose project, per client"]
        Frontend["Next.js frontend"]
        Django["Django API, django-tenants"]
        CeleryWorker["Celery worker + celery-reports"]
        CeleryBeat["Celery beat scheduler"]
        Senaite["SENAITE 2.6 on Zope"]
        Superset["Superset"]
        Redis["Redis 7: cache + broker only,\nnot a database of record"]
        ZODB["Data.fs, senaite_data volume\n(internal engine detail)"]

        subgraph PGInstance["One Postgres 16 instance: xellabs_lims"]
            SchemaDjango["schema: django\n(public + tenant schemas,\nbusiness/tenant/inventory data)"]
            SchemaSuperset["schema: superset_meta\n(Superset users, dashboards, charts)"]
            SchemaAnalytics["schema: analytics\n(warehouse, fed from SENAITE export)"]
        end
    end

    Browser --> Frontend
    Frontend --> Django
    Frontend -->|JSON API| Senaite
    Frontend -->|guest-token REST calls, unchanged| Superset
    Django --> SchemaDjango
    Django --> Redis
    CeleryWorker --> Redis
    CeleryWorker -->|export job: databox or sqlmultiplex,\nsee section 8| Senaite
    CeleryWorker -->|writes| SchemaAnalytics
    CeleryBeat -.schedules.-> CeleryWorker
    Senaite --> ZODB
    Superset -->|SQLALCHEMY_DATABASE_URI| SchemaSuperset
    Superset -->|chart data connection| SchemaAnalytics
```

---

## 4. What Changes Concretely

### 4.1 `superset_config.py`

Add the metadata connection, scoped to its own schema via the `search_path` connection option (standard SQLAlchemy/psycopg2 mechanism, not a Superset-specific feature):

```python
SQLALCHEMY_DATABASE_URI = os.getenv(
    "SUPERSET_METADATA_DB_URI",
    "postgresql+psycopg2://superset_meta_user:CHANGEME@postgres:5432/xellabs_lims"
    "?options=-csearch_path%3Dsuperset_meta",
)
```

No other keys in the existing `superset_config.py` (CORS, TALISMAN, THEME, GUEST_ROLE_NAME) need to change.

### 4.2 `docker-compose.yml` and `docker-compose.superset.yml`

Move the `superset` service into the main `docker-compose.yml` so it shares the same Docker network and can reach `postgres` by service name, replacing the current `host.docker.internal:8088` workaround visible in `xellabs-frontend/.env`. Concretely:

- Add `superset` to `docker-compose.yml`'s `services:` block, with `depends_on: postgres: condition: service_healthy`.
- Pin the image tag (e.g. `apache/superset:4.x`, exact version TBD, see section 8) instead of the current unpinned `apache/superset`.
- Add environment variable `SUPERSET_METADATA_DB_URI` pointing at the `superset_meta_user` credential (section 4.4).
- Retire `docker-compose.superset.yml` once the service is merged; keep it only if there is a reason to run Superset standalone for local debugging (unlikely to be needed once merged).

### 4.3 Metadata migration command

After the schema and grants exist (4.4) and `SQLALCHEMY_DATABASE_URI` points at `superset_meta`, run once per client, before first boot against the new target:

```bash
docker exec superset superset db upgrade
docker exec superset superset fab create-admin \
  --username admin --firstname Admin --lastname User \
  --email admin@example.com --password <set-a-real-password>
docker exec superset superset init
```

`superset db upgrade` runs Superset's Alembic migrations, creating every metadata table inside `superset_meta`. `superset init` creates default roles and permissions. These are Superset's own documented bootstrap commands, unchanged by where the schema lives.

### 4.4 Schema creation and least-privilege grants

Run once per client, as a Postgres superuser, against the existing `xellabs_lims` database:

```sql
CREATE SCHEMA IF NOT EXISTS superset_meta;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Superset's own login: full rights, but scoped to its own schema only
CREATE ROLE superset_meta_user WITH LOGIN PASSWORD 'CHANGEME';
GRANT USAGE, CREATE ON SCHEMA superset_meta TO superset_meta_user;
GRANT ALL ON ALL TABLES IN SCHEMA superset_meta TO superset_meta_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA superset_meta
  GRANT ALL ON TABLES TO superset_meta_user;

-- The export job (Celery) writes into the warehouse, nothing else
CREATE ROLE analytics_writer WITH LOGIN PASSWORD 'CHANGEME';
GRANT USAGE, CREATE ON SCHEMA analytics TO analytics_writer;

-- Superset's chart-data connection: read-only on the warehouse
CREATE ROLE superset_reader WITH LOGIN PASSWORD 'CHANGEME';
GRANT USAGE ON SCHEMA analytics TO superset_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO superset_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics
  GRANT SELECT ON TABLES TO superset_reader;
```

Three roles, three purposes: `superset_meta_user` never touches business data, `analytics_writer` never touches Superset's own tables, `superset_reader` is read-only so a compromised or misconfigured Superset chart cannot write into the warehouse or read Django's tenant schemas. None of these roles are granted anything on the `django` schema or tenant schemas; if a future dashboard needs to query Django tables directly, that grant should be added deliberately and narrowly, not by default.

---

## 5. Migration Plan

Ordered checklist. Each step names its rollback.

1. **Confirm Superset's current metadata store location and Superset version.** Run the `docker exec superset python -c "..."` command from section 2. Rollback: none needed, read-only step.
2. **Decide: export existing dashboards, or recreate them.** Two options:
   - **Option A, export/import:** use Superset's dashboard export (REST `POST /api/v1/dashboard/export/` or CLI `superset export-dashboards`, exact command depends on the confirmed version from step 1) to produce a zip, then import it (`POST /api/v1/dashboard/import/` or `superset import-dashboards`) into the new `superset_meta`-backed instance.
   - **Option B, recreate manually:** rebuild the dashboards by hand against the new instance.
   - **Recommendation: Option A.** There is no indication in this repo of a large number of hand-tuned dashboards yet (the dev scripts reference a single "Sales Dashboard"), so the export is low-risk and low-effort, and it preserves any chart-level tuning already done. Rollback: if the export/import fails, the old Superset container (untouched, still pointed at its original store) remains available until the new one is verified.
3. **Create `superset_meta` and `analytics` schemas and the three roles** (section 4.4) on the client's Postgres. Rollback: `DROP SCHEMA superset_meta CASCADE; DROP SCHEMA analytics CASCADE;` and drop the three roles, since nothing else depends on them yet at this point.
4. **Update `superset_config.py`** with `SQLALCHEMY_DATABASE_URI` (section 4.1). Rollback: revert the file, Superset falls back to its previous store.
5. **Merge the `superset` service into `docker-compose.yml`**, pin its image tag, add the metadata URI env var and `depends_on` (section 4.2). Rollback: `git revert` the compose change, keep running the old standalone `docker-compose.superset.yml`.
6. **Run `superset db upgrade`, `fab create-admin`, `superset init`** against the new metadata schema (section 4.3), on a stopped or newly-created container, not the live one. Rollback: if migrations fail, the schema created in step 3 can be dropped and recreated; the old Superset container has not been touched yet.
7. **Run the dashboard import from step 2** into the newly migrated instance. Rollback: drop and recreate `superset_meta`, retry.
8. **Point the frontend's `SUPERSET_URL` at the merged, in-network Superset service** (drop the `host.docker.internal` workaround). Rollback: revert the env var.
9. **Verify the guest-token embedding flow end to end** against the new instance (login the LIMS, load an embedded dashboard). Rollback: point `SUPERSET_URL` back at the old standalone container, which is still running until this step passes.
10. **Decommission the old standalone Superset container and `docker-compose.superset.yml`** only after step 9 has passed and stayed stable for an agreed observation period (recommend at least one full business week, since this is where any missed dashboard or data source surfaces). Rollback: the old container's image and config are still on disk until this step; nothing is deleted before this point.

---

## 6. User Management Impact

Superset's own users (the accounts that log into the Superset UI directly, e.g. to build dashboards) will live in `superset_meta.ab_user` and related Flask-AppBuilder tables, inside the same Postgres instance as everything else. Django remains the tenant and business-user source of truth, unchanged (`core.User`, `AUTH_USER_MODEL`).

**The guest-token embedding flow in `guest-token/route.ts` continues to work unchanged.** Every step in that flow (`/login/`, `/api/v1/security/login`, `/api/v1/security/csrf_token/`, `/api/v1/security/guest_token/`) is a call to Superset's own REST API using the `SUPERSET_ADMIN_USERNAME` / `SUPERSET_ADMIN_PASSWORD` service account plus the LIMS session's username embedded as guest identity. None of these calls read or write the metadata database directly from the frontend's code; they go through Superset's application layer, which does not care whether its own tables live in SQLite, a bundled Postgres, or the shared `xellabs_lims` Postgres. The only requirement is that the `superset_meta` schema contains a working `ab_user` row for the `SUPERSET_ADMIN_USERNAME` service account, which step 6 of the migration plan (`fab create-admin`) provides.

---

## 7. What This Simplifies

- **Backup:** one `pg_dump` per client covers Django's tenant data, Superset's dashboards/users/charts, and the analytics warehouse, in a single consistent snapshot. Add one `Data.fs` (or equivalent ZODB blob/filestorage) snapshot alongside it for SENAITE. Two artifacts to back up per client, not three.
- **Monitoring:** one Postgres connection pool, one set of disk/IOPS/replication metrics to watch per client, instead of two independent SQL engines with separate health checks, separate upgrade cadences, and separate credentials to rotate.
- **Provisioning a new tenant/client:** create one Postgres database, run three schema-creation steps (`django` via existing `migrate_schemas`, `superset_meta` via `superset db upgrade`, `analytics` via the export job's own migration), no second database server to stand up, size, or secure.
- **Fewer secrets to manage:** one Postgres connection string family (three role passwords) instead of a Postgres connection string plus a wholly separate Superset database connection string with its own rotation schedule.

---

## 8. Risks and Open Questions

- **Superset image is currently unpinned** (`image: apache/superset`, no tag, confirmed in `docker-compose.superset.yml`). Moving to a shared metadata schema makes the Superset version a durable commitment: an upgrade later means running Superset's Alembic migrations against a schema that other things do not touch, which is safe, but it also means version drift across clients becomes a real support burden if each client's Superset silently updates to a different `latest` at different times. **Recommendation:** pin an explicit version now, as part of this migration, not as a follow-up.
- **Connection pool sizing.** Adding Superset's metadata reads/writes and the analytics warehouse's read traffic to the same Postgres instance that already serves Django and Celery increases total connection count. Django's current `DATABASES` config (verified in `settings.py`) does not set an explicit `CONN_MAX_AGE` or pool size, so this is worth sizing deliberately (e.g. via PgBouncer) rather than assuming default Postgres `max_connections` is sufficient once Superset joins. Note: this repo previously removed a PgBouncer service (comment in `docker-compose.yml` explains `bitnami/pgbouncer` stopped resolving on Docker Hub and nothing was wired to use it), so pooling is not currently in place at all; this migration is a natural point to revisit it with a working image.
- **SENAITE export cadence: `senaite.sqlmultiplex` vs. the existing databox/`sync_from_senaite` pattern.** This is the one open team decision this document does not resolve on its own, per the brief. Two paths:
  - **Extend the existing `sync_from_senaite` Celery Beat task** (verified in `lims/tasks.py`, already running every 5 minutes per tenant schema) to also write into the new `analytics` schema. Lowest new-code risk, since the pull mechanism, error handling, and retry logic already exist and are already proven in production.
  - **Adopt `senaite.sqlmultiplex`**, a SENAITE add-on that replicates LIMS data to SQL, external to this repo (no reference to it exists anywhere in this codebase; confirmed via a full-repo grep for `sqlmultiplex` and `databox`, both zero hits outside the read-only `senaite-reference` directory, which was not searched since it is marked reference-only). If it does what its name implies, it removes the need for this project to maintain its own export/pull code at all for analytics purposes.
  - **Recommendation: evaluate `senaite.sqlmultiplex` first**, specifically because it deletes a custom component this team would otherwise own and maintain forever (the "why re-invent the wheel" argument the principles section leads with). If it does not fit (e.g. schema shape does not match what Superset dashboards need, or it does not support the specific SENAITE 2.6 version in use), fall back to extending `sync_from_senaite`, which is already proven and already the lower-risk path if a fast decision is needed. `docs/senaite-fit-gap/SENAITE-FIT-GAP.md` exists in this repo and was not read in detail for this document; it is worth reviewing before finalizing this decision, since it may already contain relevant analysis.
- **RLS in Superset is not configured today** (confirmed: `rls: []` in the guest-token payload). Out of scope for this document, but worth flagging: once dashboards read from a shared `analytics` schema serving multiple tenants' data (if the warehouse is ever shared rather than per-client, which this document does not propose), row-level security in Superset becomes a hard requirement, not an option. Under the instance-per-client topology already decided, this is currently moot since each client has its own Postgres instance and its own Superset, so there is no cross-tenant data in one `analytics` schema to leak.

---

## 9. Rollout

Do this on the next fresh client instance first. Do not migrate the current demo/QA server mid-RFP.

Reasoning: the current server (per `CICD-QA-FIXES-REPORT.md`, hardcoded `hl-01` tenant issue already patched live on that box) is an active demo environment with a real, migrated tenant (`hephzibah`) that stakeholders may be actively reviewing. A schema migration touching Superset's metadata store carries real, if small, risk of dashboard downtime during the cutover window (steps 6-9 of section 5). That risk is acceptable on a fresh instance with no live audience and unacceptable on a server currently supporting an active sales process.

Once a fresh instance has gone through the full checklist in section 5 and been observed stable for the recommended week, this same procedure becomes the standard provisioning path for every new client going forward, and a separate, explicitly scheduled maintenance window can be used to bring the existing demo server in line.

---

## Appendix: Verification Notes

Facts in this document were verified against the following files before writing; each TBD below has a one-command or one-lookup path to resolve it.

**Verified from `superset_config.py`:** no `SQLALCHEMY_DATABASE_URI` key present; `GUEST_ROLE_NAME = "Gamma"`; `FEATURE_FLAGS = {"EMBEDDED_SUPERSET": True}`; CORS origins driven by `SUPERSET_CORS_ORIGINS` env var; Talisman and CSRF disabled; `APP_NAME = "XELPulse"`.

**Verified from `docker-compose.superset.yml`:** standalone compose file, `apache/superset` image with no version tag, host port 8089 to container port 8088, only `superset_config.py` mounted, no database service or volume declared for Superset's own data.

**Verified from `docker-compose.yml`:** services are `postgres` (16, db `xellabs_lims`), `redis` (7, password-protected), `django`, `celery`, `celery-reports`, `celery-beat`, `senaite` (Python 2.7 healthcheck confirms Zope stack), `frontend`; named volumes `postgres_data` and `senaite_data`; PgBouncer explicitly removed per an in-file comment, nothing currently wired to any pooler; no Superset service present in this file.

**Verified from `xellabs-backend/config/settings.py`:** `DATABASES["default"]["ENGINE"] = "django_tenants.postgresql_backend"`; `SHARED_APPS` includes `core` (Tenant, Domain, User, Client) in the public schema; `TENANT_APPS` (`lims`, `inventory`, `instruments`, `workflow`, `audittrail`, `reporting`) replicated per tenant schema; `AUTH_USER_MODEL = "core.User"`; Redis used for Celery broker (db 0) and cache (db 1) only; `CELERY_BEAT_SCHEDULE` includes `sync-from-senaite-every-5-minutes` at a 300-second interval.

**Verified from `xellabs-backend/config/tenant_middleware.py`:** custom middleware resolves the active tenant schema from an `X-Tenant-Schema` request header, falling back to host-based resolution.

**Verified from `xellabs-backend/lims/tasks.py`:** `sync_from_senaite` Celery task loops every non-public tenant schema and calls `lims.senaite_sync.pull_samples_and_results()`, confirming a working SENAITE-to-Postgres pull pattern already runs in production.

**Verified from `xellabs-frontend/app/api/superset/guest-token/route.ts`:** the embedding flow authenticates entirely through Superset's own REST endpoints (`/login/`, `/api/v1/security/login`, `/api/v1/security/csrf_token/`, `/api/v1/security/guest_token/`), using `SUPERSET_URL`, `SUPERSET_ADMIN_USERNAME`, `SUPERSET_ADMIN_PASSWORD` from environment; guest token payload's `rls` array is currently empty.

**Verified from `README.md`:** documented startup instructions only reference `docker-compose.yml`; `docker-compose.superset.yml` is not mentioned anywhere in it.

**Verified from repo-root dev scripts** (`create_embedded.py`, `fix_db.py`, `fix_db2.py`, `fix_db3.py`, `grant_public.py`): all manipulate standard Superset/Flask-AppBuilder ORM models (`Dashboard`, `EmbeddedDashboard`, `Role`, `Permission`, `PermissionView`, `ViewMenu`) directly via `create_app()` and a SQLAlchemy session, confirming these are standard Superset entities that migrate cleanly to any Postgres-backed metadata store.

**Verified via `file superset_temp.db`:** confirmed to be a real SQLite 3.x database file; not mounted into the Superset container per the compose file's volume list, so its relationship to Superset's live, in-container state is not established by this alone.

**Verified via full-repo grep:** zero references to `sqlmultiplex` or `databox` anywhere outside the read-only `senaite-reference` directory (which was excluded from the search since it is marked reference-only), confirming neither mechanism is implemented yet.

**Verified from `CICD-QA-FIXES-REPORT.md` and `docker-compose.yml`:** `DEFAULT_TENANT_SCHEMA=hl-01` is hardcoded in the tracked compose file and documented as a known bug, patched to `hephzibah` (the real tenant) on the QA server; confirms `django-tenants` schema-per-tenant is live and working today.

### Open TBDs, with resolution path

1. **Where does Superset's metadata database currently live (engine and file path)?** Run: `docker exec superset python -c "from superset import app; print(app.config['SQLALCHEMY_DATABASE_URI'])"`.
2. **Which schema/tables does Superset's existing chart-data Postgres connection target?** Once (1) is answered, open that metadata store's `dbs` table and read the stored `sqlalchemy_uri` for the "chart data" connection.
3. **Exact Superset version running today**, to pin the image tag in section 4.2. Run: `docker exec superset superset version` (or check `pip show apache-superset` inside the container).
4. **Exact CLI/REST commands for dashboard export/import** (section 5, step 2) depend on the version found in (3); confirm against that version's own `superset --help` output before running.
5. **Whether `senaite.sqlmultiplex` supports the exact SENAITE 2.6.0 build in use here** (section 8); this needs a direct check of the add-on's compatibility matrix against the pinned SENAITE version in `senaite-rebrand/`.

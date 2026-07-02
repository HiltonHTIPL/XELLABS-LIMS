# XelLabs LIMS — Bug Tracker

> Tracks all defects found, root causes, and fixes applied.
> Update this file whenever a bug is found or fixed.

---

## Legend
| Status | Meaning |
|---|---|
| ✅ FIXED | Fix applied and verified |
| 🔴 OPEN | Bug confirmed, not yet fixed |
| ⚠️ KNOWN | Known limitation, workaround documented |

---

## Bug List

### BUG-001 — SyntaxError "Unexpected token '<'" on Methods/Tests/Lab-Samples/Analysis-Requests modals
- **Status:** ✅ FIXED (2026-07-02)
- **Symptom:** "SyntaxError: Unexpected token '<', '<!DOCTYPE ...' is not valid JSON" shown in modal on second open
- **Root cause:** Action files (`methods.ts`, `tests.ts`, `lab-samples.ts`, `analysis-requests.ts`) used raw `fetch` to `http://django:8001/api/lims/...` without `X-Tenant-Schema` header. Django public schema returns 404 HTML for these endpoints. `res.json()` called unconditionally on the HTML → SyntaxError stored in `useActionState` → shown on next modal open.
- **Fix:** Switched all 4 action files to `djangoFetch` from `@/app/lib/django` which automatically adds `X-Tenant-Schema: hl-01` header.
- **Files changed:** `app/actions/methods.ts`, `app/actions/tests.ts`, `app/actions/lab-samples.ts`, `app/actions/analysis-requests.ts`, `app/lib/django.ts`, `docker-compose.yml`

---

### BUG-002 — "No sample returned from SENAITE" on Samples page
- **Status:** ✅ FIXED (2026-07-02)
- **Symptom:** Creating a sample on the `/dashboard/samples` page shows "No sample returned from SENAITE"
- **Root cause:** `createSenaiteSample` in `senaite.ts` sent payload as a JSON array `[{obj_type: 'AnalysisRequest', Client: uid, ...}]`. SENAITE jsonapi v1 requires: plain object (not array), `portal_type` (not `obj_type`), and `parent_path: '/senaite/clients/client-X'` (not `Client: uid`). Individual client endpoint returns null for `path` — must use list endpoint with `?UID=&complete=true` to get client path.
- **Fix:** Rewrote `createSenaiteSample` to: (1) look up client path via `GET /@@API/senaite/v1/client?UID={uid}&complete=true`, (2) POST with `portal_type: 'AnalysisRequest'` + `parent_path: clientPath`.
- **Files changed:** `app/lib/senaite.ts`

---

### BUG-003 — "Failed to register sample." on Sample Register page
- **Status:** ✅ FIXED (2026-07-02)
- **Symptom:** Clicking "Register Sample" on `/dashboard/lab-samples` shows "Failed to register sample." (Django 400)
- **Root cause:** The Sample Register page loaded sample types using `getSampleTypes()` from `samples.ts` which returns SENAITE sample types (with string UIDs like `"abc123..."`). The dropdown set `value={st.uid}` (a string UID). `createLabSample` then did `sample_type: Number(uid)` → NaN → Django 400.
- **Fix:** Added `getDjangoSampleTypes()` to `lab-samples.ts` that fetches from `/api/lims/sample-types/` (integer IDs). Updated `page.tsx` to call this instead. Updated `LabSamplesShell.tsx` to use `DjangoSampleType` type with `value={st.id}`.
- **Files changed:** `app/actions/lab-samples.ts`, `app/dashboard/lab-samples/page.tsx`, `app/dashboard/lab-samples/_components/LabSamplesShell.tsx`

---

### BUG-004 — SENAITE sample creation fails silently if client has no senaite_uid
- **Status:** ✅ FIXED (2026-07-02)
- **Symptom:** On the Samples page, if a Django client was not synced to SENAITE (missing `senaite_uid`), its fallback value `String(c.id)` (e.g. "5") was passed to SENAITE as the client UID → SENAITE rejects it → sample creation fails with no clear error.
- **Root cause:** `SamplesShell.tsx` line 59: `uid: c.senaite_uid || String(c.id)` — the integer fallback is meaningless to SENAITE.
- **Fix:** Filter out clients without `senaite_uid` before building the client dropdown. Only SENAITE-synced clients appear.
- **Files changed:** `app/dashboard/samples/_components/SamplesShell.tsx`

---

### BUG-005 — SampleType prefix field not required (accepts blank)
- **Status:** ✅ FIXED (2026-07-02)
- **Symptom:** `POST /api/lims/sample-types/` with no `prefix` field returns 201 instead of 400 — creates a sample type with no prefix, breaking sample ID generation
- **Root cause:** `prefix = models.CharField(max_length=10, blank=True)` — `blank=True` makes it optional
- **Fix:** Changed to `blank=False` in model + added `extra_kwargs = {'prefix': {'required': True, 'allow_blank': False}}` in serializer. Migration: `0006_sampletype_prefix_required`
- **Files changed:** `xellabs-backend/lims/models.py`, `xellabs-backend/lims/serializers.py`, `xellabs-backend/lims/migrations/0006_sampletype_prefix_required.py`

---

### KNOWN-001 — Unauthenticated requests to tenant-only endpoints return 404 not 401
- **Status:** ⚠️ KNOWN — expected behavior, not a security hole
- **Symptom:** `GET /api/inventory/reagents/` without auth returns 404 instead of 401
- **Root cause:** Tenant-only endpoints (`/api/inventory/`, `/api/compliance/`, `/api/reports/`) only exist in `urls_tenant.py`, not `urls_public.py`. Without `X-Tenant-Schema` header, Django routes to the public URL conf which has no matching route → 404 hits before auth middleware runs.
- **Impact:** Unauthenticated users cannot discover or access these endpoints at all — 404 is actually more secure than 401 (reveals nothing). No data exposure.

---

### KNOWN-002 — SENAITE allows anonymous JSONAPI browsing (returns empty list without auth)
- **Status:** ⚠️ KNOWN — SENAITE configuration, outside Django scope
- **Symptom:** `GET /@@API/senaite/v1/client` without Authorization header returns 200 with empty results
- **Root cause:** SENAITE's default JSONAPI configuration permits anonymous browsing (returns only publicly visible records, which is nothing for lab data)
- **Impact:** No data exposed — anonymous user sees empty results. SENAITE can be hardened via Plone security settings if needed.

---

## Rules Added to CLAUDE.md

These bugs resulted in the following rules being added to CLAUDE.md:

1. **Section 19 (Data Source Consistency Rule):** Django lims pages must always load dropdown data from Django (integer IDs), never from SENAITE (UIDs). SENAITE pages must always load client/sample-type data from SENAITE (UIDs), never from Django.
2. **Section 20 (Pre-deployment Checklist):** Full checklist of things to verify before every deployment.

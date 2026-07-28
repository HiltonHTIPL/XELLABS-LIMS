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

### Original Bugs (2026-07-02)

_BUG-001 through BUG-005 were fixed and verified on 2026-07-02. See git history for details._

---

## New Bugs Found & Fixed (2026-07-09)

### CRITICAL Issues — Fixed

**BUG-006 — Race condition in SampleType.sync_from_senaite**
- **File:** `xellabs-backend/lims/views.py:48-65`
- **Status:** ✅ FIXED (2026-07-09)
- **Symptom:** Concurrent sync requests create duplicate SampleType records
- **Root cause:** Check-then-create pattern (lines 56-62) is not atomic — two requests can both pass the existence check before either creates
- **Fix:** Changed to atomic `get_or_create()` by senaite_uid, then by name

**BUG-007 — Partial failure silenced in createSampleWithAnalyses**
- **File:** `xellabs-frontend/app/actions/lab-samples.ts:143-146`
- **Status:** ✅ FIXED (2026-07-09)
- **Symptom:** Sample created but analysis request fails → returns `success: true` (misleading)
- **Root cause:** Line 145 returned success despite AR creation failing; sample left incomplete
- **Fix:** Returns `success: false` when AR creation fails

**BUG-008 — Orphaned Tenant records on domain creation failure**
- **File:** `xellabs-backend/core/models.py:30-47`
- **Status:** ✅ FIXED (2026-07-09)
- **Symptom:** Tenant created but domain creation fails → Tenant left without domains, breaks tenant resolution
- **Root cause:** Super().save() committed Tenant before domain creation; no rollback on failure
- **Fix:** Wrapped entire save() in `transaction.atomic()`

---

### HIGH Severity Issues — Fixed

**BUG-009 — Authentication bypass on password failure**
- **File:** `xellabs-frontend/app/actions/auth.ts:64-67`
- **Status:** ✅ FIXED (2026-07-09)
- **Symptom:** Wrong password → silently falls back to DJANGO_SERVICE_TOKEN (admin access)
- **Root cause:** Lines 65-67 used service token as fallback if own token fails to fetch
- **Fix:** Removed fallback; now returns auth error if Django token fails to fetch

**BUG-010 — Hard-coded default SENAITE credentials**
- **Files:** `xellabs-frontend/app/actions/lab-samples.ts`, `xellabs-frontend/app/actions/samples.ts`
- **Status:** ✅ FIXED (2026-07-09)
- **Symptom:** Missing SENAITE_ADMIN_USER/PASS env vars → defaults to 'admin'/'admin'
- **Root cause:** `process.env.SENAITE_ADMIN_USER ?? 'admin'` in multiple files
- **Fix:** Required env vars; throws error at startup if missing

**BUG-011 — Missing authorization on sync_from_senaite**
- **File:** `xellabs-backend/lims/views.py:28`
- **Status:** ✅ FIXED (2026-07-09)
- **Symptom:** Any authenticated user (including 'client' role) can trigger full SENAITE sync
- **Root cause:** No permission check at line 28
- **Fix:** Added role check; only admin/lab_manager can sync

**BUG-012 — N+1 query in TAT calculation**
- **File:** `xellabs-backend/lims/views.py:148-168`
- **Status:** ✅ FIXED (2026-07-09)
- **Symptom:** Calculating TAT for 1000 samples loads all Sample objects (1000+ queries)
- **Root cause:** Loop over `week_qs` loads full Sample objects; only 2 fields needed
- **Fix:** Changed to `.values('received_date', 'updated_at')` query

---

### MEDIUM Severity Issues — Fixed

**BUG-013 — Fail-open validation in checkClientIdAvailable**
- **File:** `xellabs-frontend/app/actions/clients.ts:98-110`
- **Status:** ✅ FIXED (2026-07-09)
- **Symptom:** API unreachable → returns `true` (available), allowing duplicate IDs through
- **Root cause:** Lines 103, 108 return `true` on any API error
- **Fix:** Returns `null` on error; UI can show validation error

**BUG-014 — Silent SENAITE sync failures**
- **File:** `xellabs-frontend/app/actions/lab-samples.ts:154-172`
- **Status:** ✅ FIXED (2026-07-09)
- **Symptom:** SENAITE sample creation fails → silently swallowed, invisible to users
- **Root cause:** Catch block on line 171 swallowed all errors
- **Fix:** Added console.error logging for failed/errored SENAITE syncs

**BUG-015 — String exceptions in error responses**
- **Files:** `xellabs-frontend/app/actions/lab-samples.ts`, `xellabs-frontend/app/actions/analysis-requests.ts`
- **Status:** ✅ FIXED (2026-07-09)
- **Symptom:** `catch (e) { return { message: String(e) } }` leaks internal errors to UI
- **Root cause:** Full exception string returned to client (e.g., stack traces, file paths)
- **Fix:** Changed to console.error full exception, return generic message to client

**BUG-016 — Type mismatch in result validation**
- **File:** `xellabs-backend/lims/services.py:62-68`
- **Status:** ✅ FIXED (2026-07-09)
- **Symptom:** Non-numeric result values silently pass spec validation (return False)
- **Root cause:** Line 68 caught ValueError and returned False instead of raising
- **Fix:** Now raises ValueError for non-numeric values with clear message

**BUG-017 — Unguarded pagination bypass in StorageLocation**
- **File:** `xellabs-backend/inventory/views.py:89`
- **Status:** ✅ FIXED (2026-07-09)
- **Symptom:** Tenant with 10K+ storage locations crashes browser (returns all at once)
- **Root cause:** `pagination_class = None` with no limit
- **Fix:** Removed pagination_class override; now uses default pagination (50 items/page)

---

### LOW Severity Issues — Fixed

**BUG-018 — Hard-coded localhost domain creation**
- **File:** `xellabs-backend/core/models.py:41, 45`
- **Status:** ✅ FIXED (2026-07-09)
- **Symptom:** Tenant.save() creates `.localhost` domains in production
- **Root cause:** Line 41 unconditionally created localhost domain
- **Fix:** Only create localhost domain in development (when DEBUG=True)

**BUG-019 — Unused select_related in Sample queryset**
- **File:** `xellabs-backend/lims/views.py:123`
- **Status:** ✅ FIXED (2026-07-09)
- **Symptom:** SampleViewSet loads unused related fields; wasted DB joins
- **Root cause:** Line 123 selected 'client', 'sample_type', 'created_by', 'received_by' but stats/tat_trend never use them
- **Fix:** Removed default select_related; individual endpoints can add as needed

---

## Rules Added to CLAUDE.md

These bugs resulted in the following rules being added to CLAUDE.md:

1. **Section 19 (Data Source Consistency Rule):** Django lims pages must always load dropdown data from Django (integer IDs), never from SENAITE (UIDs). SENAITE pages must always load client/sample-type data from SENAITE (UIDs), never from Django.
2. **Section 20 (Pre-deployment Checklist):** Full checklist of things to verify before every deployment.
3. **New (2026-07-09):** Always use atomic database operations for multi-step saves (use `transaction.atomic()`); Always add authorization checks to all sensitive endpoints; Enable pagination by default to prevent memory bloat; Never expose internal error messages to client UI (always log fully, return generic message); Always validate input types before operations (e.g., numeric validation on spec checks).

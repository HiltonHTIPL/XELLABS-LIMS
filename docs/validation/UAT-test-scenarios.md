# XelLabs LIMS — User Acceptance Test Scenarios

## How to Use
Each scenario maps to a user role. The tester performs the steps using the real application and marks Pass/Fail.
All tests run against the **staging** environment before production go-live.

---

## 1. Receptionist — Sample Registration

| # | Step | Expected Result | Pass/Fail |
|---|------|----------------|-----------|
| 1.1 | Log in with receptionist account | Dashboard loads, no admin menus visible | |
| 1.2 | POST `/api/samples/` with client + sample type | Response 201, `sample_id` auto-generated (e.g. `BLD-20260630-0001`) | |
| 1.3 | POST `/api/samples/{id}/receive/` with location | Status changes to `received`, chain-of-custody record created | |
| 1.4 | Try to verify a result (POST `/api/results/{id}/verify/`) | Response 403 Forbidden | |

---

## 2. Analyst — Test Entry and Result Submission

| # | Step | Expected Result | Pass/Fail |
|---|------|----------------|-----------|
| 2.1 | Log in with analyst account | Dashboard shows `tasks.my_open` count | |
| 2.2 | PATCH `/api/results/{id}/` with `value` | Response 200, value saved | |
| 2.3 | POST `/api/results/{id}/submit/` | Status → `submitted`, `submitted_by` populated | |
| 2.4 | POST `/api/worksheets/{id}/submit_for_review/` | Status → `to_be_verified` | |
| 2.5 | Upload CSV instrument file, POST `/api/instruments/result-imports/{id}/process/` | Task queued, results populated after processing | |

---

## 3. Reviewer — Result Verification

| # | Step | Expected Result | Pass/Fail |
|---|------|----------------|-----------|
| 3.1 | Log in with reviewer account | | |
| 3.2 | POST `/api/results/{id}/verify/` on a submitted result | Status → `verified`, `is_locked: true` | |
| 3.3 | Try to PATCH a verified result | Response 400 — record locked | |
| 3.4 | POST `/api/results/{id}/reject/` with remarks | Status → `rejected` | |
| 3.5 | POST `/api/compliance/workflow/signatures/sign/` with correct password | Signature created, audit event logged | |
| 3.6 | POST sign with wrong password | Response 400 — signature not applied | |

---

## 4. Lab Manager — Worksheet Approval and Inventory

| # | Step | Expected Result | Pass/Fail |
|---|------|----------------|-----------|
| 4.1 | Log in with lab_manager account | | |
| 4.2 | POST `/api/worksheets/{id}/verify/` | Status → `verified` | |
| 4.3 | POST `/api/worksheets/{id}/reject/` | Status → `rejected` | |
| 4.4 | GET `/api/inventory/lots/low-stock/` | Returns items below minimum | |
| 4.5 | POST `/api/inventory/expiry-alerts/{id}/acknowledge/` | `is_acknowledged: true` | |
| 4.6 | GET `/api/instruments/instruments/calibration-due/` | Returns instruments due within 30 days | |
| 4.7 | POST `/api/compliance/workflow/tasks/{id}/assign/` | Assignment created | |

---

## 5. Admin — User Management and Audit

| # | Step | Expected Result | Pass/Fail |
|---|------|----------------|-----------|
| 5.1 | Log in to Django Admin (`/admin/`) | Site header shows "XelLabs LIMS Administration" | |
| 5.2 | Create a new user with role=analyst | User created, no password in API response | |
| 5.3 | GET `/api/compliance/audit/events/` | Returns audit log — all compliance actions visible | |
| 5.4 | Try to DELETE an audit event via API | Response 405 Method Not Allowed | |
| 5.5 | GET `/api/compliance/audit/versions/` | Returns record versions with field-level change history | |

---

## 6. Performance Acceptance Criteria

| Endpoint | Max Response Time (p95) | Tested At |
|---|---|---|
| `GET /api/samples/` | < 500 ms | 100 concurrent users |
| `POST /api/results/{id}/submit/` | < 300 ms | 50 concurrent users |
| `GET /api/dashboard/` | < 800 ms | 50 concurrent users |
| `POST /api/instruments/result-imports/{id}/process/` | < 2 s (queue dispatch) | 10 concurrent users |

---

## Sign-Off

| Role | Name | Date | Signature |
|---|---|---|---|
| Lab Manager | | | |
| Reviewer | | | |
| IT / Admin | | | |
| Client Representative | | | |

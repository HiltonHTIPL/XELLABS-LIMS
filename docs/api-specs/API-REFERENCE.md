# XelLabs LIMS — API Reference

**Base URL:** `http://localhost:8001` (dev) / `https://your-domain.com` (prod)  
**Authentication:** `Authorization: Token <your-token>`  
**Get Token:** `POST /api/auth/token/` — body: `{"username": "...", "password": "..."}`

---

## Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health/` | Liveness probe — DB check |
| GET | `/api/health/ready/` | Readiness probe — DB + cache check |

---

## Dashboard

| Method | Endpoint | Auth Required |
|---|---|---|
| GET | `/api/dashboard/` | Yes |

Returns backlog counts: samples by status, pending ARs, open worksheets, pending results, task counts, expiry alerts.

---

## LIMS

### Samples
| Method | Endpoint | Notes |
|---|---|---|
| GET/POST | `/api/samples/` | List/create. `sample_id` auto-generated. |
| GET/PATCH/DELETE | `/api/samples/{id}/` | |
| POST | `/api/samples/{id}/receive/` | Body: `{location, notes}` |

**Filters:** `status`, `sample_type`, `client` · **Search:** `sample_id`, `barcode`

### Analysis Requests
| Method | Endpoint | Notes |
|---|---|---|
| GET/POST | `/api/analysis-requests/` | `ar_id` auto-generated |
| GET/PATCH/DELETE | `/api/analysis-requests/{id}/` | |

### Worksheets
| Method | Endpoint | Role |
|---|---|---|
| GET/POST | `/api/worksheets/` | Analyst+ |
| POST | `/api/worksheets/{id}/submit_for_review/` | Analyst+ |
| POST | `/api/worksheets/{id}/verify/` | Lab Manager+ |
| POST | `/api/worksheets/{id}/reject/` | Lab Manager+ |

### Results
| Method | Endpoint | Role |
|---|---|---|
| GET/POST | `/api/results/` | Analyst+ |
| POST | `/api/results/{id}/submit/` | Analyst+ |
| POST | `/api/results/{id}/verify/` | Reviewer+ |
| POST | `/api/results/{id}/reject/` | Reviewer+ — body: `{remarks}` |

---

## Inventory

| Method | Endpoint | Notes |
|---|---|---|
| GET/POST | `/api/inventory/reagents/` | |
| GET/POST | `/api/inventory/lots/` | |
| GET | `/api/inventory/lots/low-stock/` | Items below `min_stock_level` |
| GET/POST | `/api/inventory/transactions/` | Types: `in`, `out`, `adjust`, `dispose` |
| GET | `/api/inventory/expiry-alerts/upcoming/` | Unacknowledged, within 30 days |
| POST | `/api/inventory/expiry-alerts/{id}/acknowledge/` | |

---

## Instruments

| Method | Endpoint | Notes |
|---|---|---|
| GET/POST | `/api/instruments/instruments/` | |
| GET | `/api/instruments/instruments/calibration-due/?days=30` | |
| GET | `/api/instruments/instruments/maintenance-due/?days=30` | |
| GET/POST | `/api/instruments/result-imports/` | Upload CSV/XML file |
| POST | `/api/instruments/result-imports/{id}/process/` | Dispatch import to Celery |
| GET | `/api/instruments/result-imports/{id}/errors/` | Structured error log |

---

## Compliance

### Audit Trail
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/compliance/audit/events/` | Read-only. No create/delete. |
| GET | `/api/compliance/audit/changes/` | Field-level change log |
| GET | `/api/compliance/audit/versions/` | Record snapshots |

### Workflow
| Method | Endpoint | Notes |
|---|---|---|
| GET/POST | `/api/compliance/workflow/tasks/` | |
| GET | `/api/compliance/workflow/tasks/my-tasks/` | Tasks assigned to me |
| POST | `/api/compliance/workflow/tasks/{id}/assign/` | Body: `{assigned_to: user_id}` |
| POST | `/api/compliance/workflow/tasks/{id}/update_status/` | Body: `{status}` |
| POST | `/api/compliance/workflow/approvals/{id}/decide/` | Body: `{action: approve|reject, comments}` |
| POST | `/api/compliance/workflow/signatures/sign/` | Body: `{app_label, model, object_id, reason, password}` |

---

## Reports

| Method | Endpoint | Notes |
|---|---|---|
| GET/POST | `/api/reports/reports/` | Types: `coa`, `worksheet`, `qc`, `inventory`, `instrument`, `custom` |
| POST | `/api/reports/reports/{id}/generate/` | Dispatches PDF generation to Celery |
| GET | `/api/reports/reports/{id}/download/` | Stream PDF |

---

## Error Responses

| Code | Meaning |
|---|---|
| 400 | Validation error or invalid state transition |
| 401 | Missing or invalid token |
| 403 | Insufficient role |
| 404 | Record not found |
| 405 | Method not allowed (e.g. DELETE on audit events) |
| 503 | Service unavailable (health check failed) |

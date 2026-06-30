# XelLabs LIMS — Database Schema Overview

**Engine:** PostgreSQL 16  
**ORM:** Django 6 — all schema managed via migrations in `xellabs-backend/<app>/migrations/`

---

## App → Tables

### `core`
| Table | Key Fields |
|---|---|
| `tenants` | name, slug, email, is_active |
| `core_users` | username, role, department, tenant_id |
| `clients` | name, email, tenant_id |

### `lims`
| Table | Key Fields |
|---|---|
| `sample_types` | name, prefix |
| `methods` | name, code |
| `tests` | name, code, method_id |
| `specifications` | test_id, sample_type_id, min_value, max_value |
| `samples` | sample_id (auto), client_id, sample_type_id, status, is_locked |
| `analysis_requests` | ar_id (auto), sample_id, status, priority, due_date |
| `worksheets` | ws_id (auto), analyst_id, status |
| `worksheet_items` | worksheet_id, analysis_request_id, test_id |
| `results` | worksheet_assignment_id, value, status, is_locked, is_out_of_range |
| `qc_samples` | qc_id (auto), test_id, worksheet_id, value, status |
| `chain_of_custody` | sample_id, action, from_location, to_location, transferred_by |

### `inventory`
| Table | Key Fields |
|---|---|
| `storage_locations` | name, location_type, parent_id |
| `reagents` / `standards` / `solvents` | name, unit, min_stock_level, cas_number |
| `lots` | content_type_id, object_id (GenericFK), lot_number, expiry_date |
| `inventory_transactions` | lot_id, transaction_type, quantity |
| `expiry_alerts` | lot_id, alert_date, is_acknowledged |

### `instruments`
| Table | Key Fields |
|---|---|
| `instruments` | instrument_id, status, next_calibration, next_maintenance |
| `calibrations` | instrument_id, calibration_date, status, performed_by |
| `maintenances` | instrument_id, maintenance_date, maintenance_type |
| `instrument_runs` | instrument_id, run_date, method_id, operator |
| `instrument_result_imports` | instrument_id, file, file_format, status, error_log |

### `workflow`
| Table | Key Fields |
|---|---|
| `tasks` | title, priority, status, due_date, content_type+object_id (GenericFK) |
| `task_assignments` | task_id, assigned_to, assigned_by |
| `approvals` | content_type+object_id, status, requested_by, reviewed_by |
| `electronic_signatures` | content_type+object_id, signed_by, reason, ip_address |

### `audittrail`
| Table | Key Fields |
|---|---|
| `audit_events` | user, action, content_type+object_id, extra_data (JSON), timestamp |
| `data_change_logs` | audit_event_id, field_name, old_value, new_value |
| `login_events` | username_attempted, success, ip_address |
| `security_events` | event_type, severity, description |
| `record_versions` | content_type+object_id, version_number, data (JSON), changed_by |

### `reporting`
| Table | Key Fields |
|---|---|
| `reports` | report_id, report_type, sample_id, status, file_path |

---

## Auto-ID Format
| Model | Format | Example |
|---|---|---|
| Sample | `{PREFIX}-{YYYYMMDD}-{SEQ4}` | `BLD-20260630-0001` |
| Analysis Request | `AR-{YYYYMMDD}-{SEQ4}` | `AR-20260630-0001` |
| Worksheet | `WS-{YYYYMMDD}-{SEQ4}` | `WS-20260630-0001` |
| QC Sample | `QC-{YYYYMMDD}-{SEQ4}` | `QC-20260630-0001` |

# Pending Verification Tasks

> Run these when the user says **"verify"**. Do NOT run until then.

## 1. lims app models
Verify the lims models are migrated and not drifted:
```powershell
cd c:\Users\Hilton\xellabs-lims\xellabs-backend
.\venv\Scripts\Activate.ps1
python manage.py showmigrations lims
python manage.py makemigrations lims --check --dry-run
```
Models: SampleType, Method, Test, Specification, Sample, AnalysisRequest, Worksheet, WorksheetAssignment, Result — all defined in lims/models.py, migration 0001_initial exists.

## 2. inventory app models
Verify the inventory models are migrated and not drifted:
```powershell
cd c:\Users\Hilton\xellabs-lims\xellabs-backend
.\venv\Scripts\Activate.ps1
python manage.py showmigrations inventory
python manage.py makemigrations inventory --check --dry-run
```
Design (confirmed by user): Reagent, Standard, Solvent are separate concrete
models sharing an abstract InventoryItem base. Lot links to any of them via
GenericForeignKey. InventoryTransaction, ExpiryAlert, StorageLocation also
exist. Migration 0001_inventory_split_item_types applied successfully.

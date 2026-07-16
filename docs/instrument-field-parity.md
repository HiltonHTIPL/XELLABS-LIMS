# Instrument Field Parity — SENAITE ↔ XELLABS

Source: `senaite-reference/senaite.core/src/bika/lims/content/instrument.py`
Rule: no row marked present without `file:line`.

## Tab mapping (SENAITE schematas)

| SENAITE schemata | UI tab label |
|---|---|
| `default` | Description |
| `Additional info.` | Additional Information |
| `Procedures` | Procedures |

## Field table

| # | SENAITE field | Source | Tab | Django field | Status |
|---|---|---|---|---|---|
| 1 | `title` | BikaSchema (AT title) | Description | `Instrument.name` `models.py:69` | present |
| 2 | `description` | `instrument.py:365-366` (schemata=default) | Description | `Instrument.notes` `models.py:119` (UI label: Description) | present |
| 3 | `InstrumentType` | `instrument.py:74-92` | Description | `Instrument.instrument_type` `models.py:77-79` | present |
| 4 | `Manufacturer` | `instrument.py:94-112` | Description | `Instrument.manufacturer_org` `models.py:73-75` | present |
| 5 | `Supplier` | `instrument.py:114-132` | Description | `Instrument.supplier_org` `models.py:84-86` | present |
| 6 | `Model` | `instrument.py:134-140` | Description | `Instrument.model` `models.py:71` | present |
| 7 | `SerialNo` | `instrument.py:142-148` | Description | `Instrument.serial_number` `models.py:76` | present |
| 8 | `AssetNumber` | `instrument.py:305-311` | Description | `Instrument.asset_number` `models.py:87` | present |
| 9 | `Method` | `instrument.py:151-161` (deprecated, visible=False) | — | covered by Methods | N/A (hidden) |
| 10 | `Methods` | `instrument.py:163-180` | Additional Information | `InstrumentMethod` M2M `models.py:141-148` | present |
| 11 | `DisposeUntilNextCalibrationTest` | `instrument.py:182-190` | Additional Information | `Instrument.dispose_until_next_calibration` `models.py:109-112` | present |
| 12 | `DataInterface` | `instrument.py:217-228` | Additional Information | `Instrument.data_interface` `models.py:97-100` | present |
| 13 | `ImportDataInterface` | `instrument.py:230-242` | Additional Information | `Instrument.import_data_interface` `models.py:101-104` | present |
| 14 | `ResultFilesFolder` | `instrument.py:244-279` | Additional Information | `Instrument.result_files_folder` `models.py:105-108` | present |
| 15 | `DataInterfaceOptions` | `instrument.py:281-295` | Additional Information | `Instrument.data_interface_options` `models.py:119-122` | present |
| 16 | `Valid` | `instrument.py:297-303` (computed) | — | `Instrument.usability` `models.py:96-99` (derived) | present |
| 17 | `InstrumentLocation` | `instrument.py:313-332` (schemata=Additional info.) | Additional Information | `Instrument.instrument_location` `models.py:80-82` | present |
| 18 | `Photo` | `instrument.py:334-341` | Additional Information | `Instrument.photo` `models.py:95` | present |
| 19 | `InstallationDate` | `instrument.py:343-350` | Additional Information | `Instrument.installation_date` `models.py:91` | present |
| 20 | `InstallationCertificate` | `instrument.py:352-359` | Additional Information | `Instrument.installation_certificate` `models.py:92-94` | present |
| 21 | `InlabCalibrationProcedure` | `instrument.py:193-203` (schemata=Procedures) | Procedures | `Instrument.inlab_calibration_procedure` `models.py:113` | present |
| 22 | `PreventiveMaintenanceProcedure` | `instrument.py:205-215` (schemata=Procedures) | Procedures | `Instrument.preventive_maintenance_procedure` `models.py:114` | present |

## Django-only extras (keep; not in SENAITE form)

| Field | Purpose |
|---|---|
| `instrument_id` | Lab register ID (required in New UI) |
| `status` | Workflow state (active/inactive/under_maintenance/out_of_service/retired) |
| `purchase_date` | Optional purchase date |
| `location` | Legacy free-text location cache |
| `last_calibration` / `next_calibration` | Denormalized calendar columns |
| `last_maintenance` / `next_maintenance` | Denormalized calendar columns |

## Gaps closed by this build

1. Add `data_interface_options` TextField.
2. Add stored `usability` (`valid` / `expired` / `out_of_service`) recomputed by signals.
3. Expand `status` choices: rename `maintenance` → `under_maintenance`, add `out_of_service`.
4. Reorganize edit drawer into Description / Additional Information / Procedures tabs.

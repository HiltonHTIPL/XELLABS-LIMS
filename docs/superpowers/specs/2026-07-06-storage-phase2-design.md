# Storage Phase 2 — Box/Slot Hierarchy, SENAITE Sync, Chain of Custody
**Date:** 2026-07-06
**Status:** Approved

---

## Overview

Extend the existing Storage Management feature with:
1. `box` and `box_location` location types with auto-generated slots
2. SENAITE sync — every StorageLocation synced to `/senaite/setup/storagelocations`
3. Chain of Custody auto-update — AuditEvent logged when a sample is assigned to a slot
4. Frontend conditional rendering per location type + box slot grid UI

---

## Full Hierarchy

```
Room
  └── Fridge / Freezer / Cabinet
        └── Shelf
              └── Box  (e.g. 10×10 = 100 slots)
                    └── Box Location  (A1, A2 … J10 — each a unique slot)
```

---

## Backend — Model Changes

### StorageLocation new fields

```python
location_type choices — add:
  ('box', 'Box')
  ('box_location', 'Box Location')

senaite_uid   = CharField(max_length=100, blank=True)   # SENAITE UID after sync
rows          = IntegerField(null=True, blank=True)      # box only
columns       = IntegerField(null=True, blank=True)      # box only
slot_id       = CharField(max_length=20, blank=True)     # box_location only, e.g. "A1"
is_occupied   = BooleanField(default=False)              # box_location only
```

### Migration
`0002_storagelocation_box_fields.py` — adds all 5 fields.

### Auto-generation signal (`inventory/signals.py`)
`post_save` on StorageLocation where `location_type == 'box'` and `created == True`:
- Generate `rows × columns` child box_location records
- Slot IDs: row letter (A, B, C…) + column number (1, 2, 3…) → A1, A2, B1, B2…
- Each slot: `name = f"{parent.name} - {slot_id}"`, `parent = box`, `location_type = 'box_location'`, `slot_id = slot_id`, `is_occupied = False`
- Max supported: 26 rows (A–Z) × 99 columns = 2574 slots

### SENAITE sync signal (`inventory/signals.py`)
`post_save` on StorageLocation (any type, any save):
- Queue Celery task: `sync_storage_location_to_senaite.delay(instance.id)`
- Skip if `instance.location_type == 'box_location'` — slots synced in bulk when box is created

### Celery task (`inventory/tasks.py` — new file)
```python
@shared_task
def sync_storage_location_to_senaite(location_id):
    location = StorageLocation.objects.get(id=location_id)
    uid = push_storage_location(location)
    if uid:
        StorageLocation.objects.filter(id=location_id).update(senaite_uid=uid)
```

### Bulk slot sync task (`inventory/tasks.py`)
```python
@shared_task
def sync_box_slots_to_senaite(box_id):
    slots = StorageLocation.objects.filter(parent_id=box_id, location_type='box_location')
    for slot in slots:
        uid = push_storage_location(slot)
        if uid:
            StorageLocation.objects.filter(id=slot.id).update(senaite_uid=uid)
```

### senaite_service.py — add `push_storage_location`
```python
def push_storage_location(location) -> str | None:
    """
    Create or update a StorageLocation in SENAITE.
    Returns the SENAITE UID on success, None on failure.
    """
    # Build full path title: "Room 1 / Fridge A / Shelf 2 / Box B1 / A1"
    title = _build_storage_path(location)

    if location.senaite_uid:
        # Update existing
        result = _senaite_patch(f'/@@API/senaite/v1/update', {
            'uid': location.senaite_uid,
            'title': title,
        })
    else:
        # Create new
        result = _senaite_post('/@@API/senaite/v1/create', {
            'portal_type': 'StorageLocation',
            'title': title,
            'parent_path': '/senaite/setup/storagelocations',
        })

    if result and result.get('items'):
        return result['items'][0].get('uid')
    return None

def _build_storage_path(location) -> str:
    """Build full path name by walking up the parent chain."""
    parts = [location.name]
    current = location
    while current.parent_id:
        current = StorageLocation.objects.get(id=current.parent_id)
        parts.insert(0, current.name)
    return ' / '.join(parts)
```

### AuditEvent — new 'store' action
Add `'store'` to `AuditEvent.ACTION_CHOICES` in `audittrail/models.py`.

### Chain of Custody signal (`inventory/signals.py`)
`post_save` on StorageLocation where `location_type == 'box_location'` and `is_occupied` changed to `True`:
```python
AuditEvent.objects.create(
    user=None,  # set by view layer when available
    action='store',
    content_type=sample_content_type,
    object_id=sample.id,
    object_repr=str(sample),
    extra_data={
        'storage_path': _build_storage_path(slot),
        'slot_id': slot.slot_id,
        'storage_location_id': slot.id,
        'senaite_uid': slot.senaite_uid,
    }
)
```
Note: The signal cannot know which sample was assigned — the view/action layer must call this directly, not via signal. See API endpoint below.

### New API endpoint: `POST /api/inventory/storage-locations/{id}/assign/`
Custom action on `StorageLocationViewSet`:
- Accepts `{ sample_id: int }`
- Validates slot is `box_location` and `is_occupied == False`
- Sets `is_occupied = True`
- Creates AuditEvent with `action='store'`
- Returns updated slot

---

## Frontend Changes

### `StorageLocation` type (storage.ts)
Add new fields:
```typescript
type StorageLocation = {
  id: number
  name: string
  location_type: 'room' | 'fridge' | 'freezer' | 'cabinet' | 'shelf' | 'box' | 'box_location'
  parent: number | null
  temperature: string
  notes: string
  senaite_uid: string
  rows: number | null
  columns: number | null
  slot_id: string
  is_occupied: boolean
}
```

Add server action:
```typescript
assignSampleToSlot(slotId: number, sampleId: number): Promise<{ success: boolean; message: string }>
```

### `StorageModal.tsx`
- Add `box` and `box_location` to TYPE_OPTIONS — but hide `box_location` (auto-generated, not user-selectable):
  ```
  TYPE_OPTIONS = [room, fridge, freezer, cabinet, shelf, box]
  ```
- Show `rows` and `columns` number inputs **only when** `location_type === 'box'`
- Both fields required when type is box (min 1, max 26 rows, max 99 columns)

### `StorageTree.tsx`
- Add icons: `box = 'inventory_2'`, `box_location = 'grid_on'`
- **Never render `box_location` nodes in the tree** — they are slots shown in the grid, not tree nodes
- Box nodes show slot count badge (rows × columns)

### `StorageDetail.tsx` — Conditional rendering
```
location_type       → right panel content
─────────────────────────────────────────
room                → Sub-location cards (existing)
fridge/freezer/cabinet → Sub-location cards (existing)  
shelf               → Sub-location cards (existing) + box cards
box                 → SlotGrid component
box_location        → never selected directly (not in tree)
```

### New component: `SlotGrid.tsx`
```
xellabs-frontend/app/dashboard/storage/_components/SlotGrid.tsx
```
- Renders `rows × columns` grid
- Each cell: slot ID (e.g. A1) + color:
  - Green (`#ECFDF5` bg, `#10B981` text) = free → clickable
  - Red (`#FEF2F2` bg, `#EF4444` text) = occupied → not clickable
- Header: box name, total slots, free count, occupied count
- Clicking a free slot opens `SlotAssignModal`

### New component: `SlotAssignModal.tsx`
```
xellabs-frontend/app/dashboard/storage/_components/SlotAssignModal.tsx
```
- Shows selected slot ID (e.g. "Assign sample to A1")
- Text input: Sample ID (e.g. "S-25-01987") — required
- On submit: calls `assignSampleToSlot(slotId, sampleId)` server action
- On success: slot turns red (occupied), toast shown, Chain of Custody updated
- Validation: sample ID must not be empty

### `StorageDetail.tsx` — Info tab update
Show `senaite_uid` as a read-only field (so admins can verify sync status).

---

## Color Rules
- Primary: `#0154FC` — all interactive elements
- Never: `#14B8A6`
- Free slot: `#ECFDF5` bg / `#10B981` text
- Occupied slot: `#FEF2F2` bg / `#EF4444` text

---

### `assignSampleToSlot` server action (storage.ts)
```typescript
export async function assignSampleToSlot(
  slotId: number,
  sampleId: string
): Promise<{ success: boolean; message: string }>
```
- Calls `POST /api/inventory/storage-locations/{slotId}/assign/` with `{ sample_id: sampleId }`
- On success: revalidates `/dashboard/storage` and `/dashboard/chain-of-custody`

---

## Design Principles Applied
- **YAGNI**: No bulk import, no slot reassignment, no QR scanning
- **Separation of Concerns**: sync logic in senaite_service.py, CoC in audit trail, UI in components
- **Feature-Based Architecture**: all new frontend code under `app/dashboard/storage/`
- **KISS**: slot IDs are simple alphanumeric (A1-Z99), no complex encoding

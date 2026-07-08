# Storage Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Storage Management with box/slot hierarchy, SENAITE sync, Chain of Custody auto-update, slot grid UI, and sample assignment to slots.

**Architecture:** Django model extended with 5 new fields; a post_save signal auto-generates box_location slots and queues Celery tasks for SENAITE sync; a custom `assign/` API endpoint marks slots occupied and writes AuditEvents; Next.js frontend conditionally renders per location type with a slot grid and assignment modal.

**Tech Stack:** Django 6, DRF, Celery, requests, Next.js 16 App Router, React useActionState, Material Icons, inline styles.

## Global Constraints

- Primary color: `#0154FC` — never `#14B8A6`
- Free slot: `#ECFDF5` bg / `#10B981` text
- Occupied slot: `#FEF2F2` bg / `#EF4444` text
- All Django API calls from frontend use `djangoFetch` from `@/app/lib/django`
- `'use server'` on server actions, `'use client'` on client components
- Material Icons: `<span className="material-icons" style={{ fontSize: N }}>icon_name</span>`
- Inline styles for all colors — no Tailwind color classes
- Run Django commands inside the container: `docker exec xellabs-lims-django-1 python manage.py <cmd>`
- revalidatePath('/dashboard/storage') and revalidatePath('/dashboard/chain-of-custody') after slot assignment
- StorageLocation API base: `/api/inventory/storage-locations/`
- `box_location` nodes NEVER appear in the tree — only in the slot grid
- `box_location` type NOT in StorageModal type dropdown (auto-generated)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `xellabs-backend/inventory/models.py` | Modify | Add 5 new fields + box/box_location choices |
| `xellabs-backend/inventory/migrations/0002_storagelocation_box_fields.py` | Create | Migration for new fields |
| `xellabs-backend/core/senaite_service.py` | Modify | Add push_storage_location + _build_storage_path |
| `xellabs-backend/inventory/tasks.py` | Create | Celery tasks: sync_storage_location_to_senaite, sync_box_slots_to_senaite |
| `xellabs-backend/inventory/signals.py` | Create | post_save signals: auto-generate slots, queue SENAITE sync |
| `xellabs-backend/inventory/apps.py` | Modify | Call inventory signals.register_all() on ready |
| `xellabs-backend/audittrail/models.py` | Modify | Add 'store' to AuditEvent ACTION_CHOICES |
| `xellabs-backend/inventory/views.py` | Modify | Add assign/ custom action to StorageLocationViewSet |
| `xellabs-frontend/app/actions/storage.ts` | Modify | Update StorageLocation type + add assignSampleToSlot |
| `xellabs-frontend/app/dashboard/storage/_components/StorageModal.tsx` | Modify | Add box type + rows/columns fields |
| `xellabs-frontend/app/dashboard/storage/_components/StorageTree.tsx` | Modify | Box icon, filter out box_location nodes |
| `xellabs-frontend/app/dashboard/storage/_components/StorageDetail.tsx` | Modify | Conditional rendering per type |
| `xellabs-frontend/app/dashboard/storage/_components/SlotGrid.tsx` | Create | Slot grid for box locations |
| `xellabs-frontend/app/dashboard/storage/_components/SlotAssignModal.tsx` | Create | Modal to assign sample to a slot |

---

## Task 1: Extend StorageLocation Model + Migration

**Files:**
- Modify: `xellabs-backend/inventory/models.py`
- Create: `xellabs-backend/inventory/migrations/0002_storagelocation_box_fields.py`

**Interfaces:**
- Produces: StorageLocation model with fields: `senaite_uid`, `rows`, `columns`, `slot_id`, `is_occupied`, and choices `box`/`box_location`

- [ ] **Step 1: Update the StorageLocation model**

Replace the existing `StorageLocation` class (lines 7–20) in `xellabs-backend/inventory/models.py`:

```python
class StorageLocation(models.Model):
    LOCATION_TYPES = [
        ("room",         "Room"),
        ("fridge",       "Fridge"),
        ("freezer",      "Freezer"),
        ("cabinet",      "Cabinet"),
        ("shelf",        "Shelf"),
        ("box",          "Box"),
        ("box_location", "Box Location"),
    ]

    name          = models.CharField(max_length=200)
    location_type = models.CharField(max_length=50, default="room", choices=LOCATION_TYPES)
    parent        = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    temperature   = models.CharField(max_length=50, blank=True)
    notes         = models.TextField(blank=True)
    # SENAITE sync
    senaite_uid   = models.CharField(max_length=100, blank=True)
    # Box-specific
    rows          = models.IntegerField(null=True, blank=True)
    columns       = models.IntegerField(null=True, blank=True)
    # Box location (slot) specific
    slot_id       = models.CharField(max_length=20, blank=True)
    is_occupied   = models.BooleanField(default=False)

    class Meta:
        db_table = "storage_locations"

    def __str__(self):
        return self.name
```

- [ ] **Step 2: Generate migration**

```powershell
docker exec xellabs-lims-django-1 python manage.py makemigrations inventory --name storagelocation_box_fields
```

Expected output: `Migrations for 'inventory': inventory/migrations/0002_storagelocation_box_fields.py`

- [ ] **Step 3: Apply migration**

```powershell
docker exec xellabs-lims-django-1 python manage.py migrate inventory
```

Expected output: `Applying inventory.0002_storagelocation_box_fields... OK`

- [ ] **Step 4: Verify migration applied**

```powershell
docker exec xellabs-lims-django-1 python manage.py shell -c "
from inventory.models import StorageLocation
sl = StorageLocation(name='Test', location_type='box', rows=5, columns=5)
print('rows:', sl.rows, 'columns:', sl.columns, 'senaite_uid:', sl.senaite_uid, 'is_occupied:', sl.is_occupied)
"
```

Expected: `rows: 5 columns: 5 senaite_uid:  is_occupied: False`

- [ ] **Step 5: Commit**

```bash
git add xellabs-backend/inventory/models.py xellabs-backend/inventory/migrations/
git commit -m "feat: extend StorageLocation with box/slot fields and SENAITE uid"
```

---

## Task 2: SENAITE Service + Celery Tasks

**Files:**
- Modify: `xellabs-backend/core/senaite_service.py`
- Create: `xellabs-backend/inventory/tasks.py`

**Interfaces:**
- Consumes: `StorageLocation` model from `inventory.models`
- Produces:
  - `push_storage_location(location) -> str | None` in `senaite_service.py`
  - `sync_storage_location_to_senaite(location_id: int)` Celery task
  - `sync_box_slots_to_senaite(box_id: int)` Celery task

- [ ] **Step 1: Add push_storage_location to senaite_service.py**

Append to the end of `xellabs-backend/core/senaite_service.py`:

```python
# ── Storage Location sync ─────────────────────────────────────────────────────

def _build_storage_path(location) -> str:
    """Walk up parent chain to build full path, e.g. 'Room 1 / Fridge A / Shelf 2 / Box B1 / A1'."""
    from inventory.models import StorageLocation
    parts = [location.name]
    current = location
    while current.parent_id:
        try:
            current = StorageLocation.objects.get(id=current.parent_id)
            parts.insert(0, current.name)
        except StorageLocation.DoesNotExist:
            break
    return ' / '.join(parts)


def push_storage_location(location) -> str | None:
    """
    Create or update a StorageLocation in SENAITE.
    Returns SENAITE UID on success, None on failure (non-fatal).
    """
    s = _session()
    title = _build_storage_path(location)

    try:
        if location.senaite_uid:
            resp = s.post(_api(f"update/{location.senaite_uid}"), json={"title": title}, timeout=15)
        else:
            payload = {
                "portal_type": "StorageLocation",
                "title": title,
                "parent_path": "/senaite/setup/storagelocations",
            }
            resp = s.post(_api("create"), json=payload, timeout=15)

        resp.raise_for_status()
        items = resp.json().get("items") or []
        if items:
            uid = items[0].get("uid") or items[0].get("UID")
            logger.info("SENAITE storage sync OK: '%s' → uid=%s", title, uid)
            return uid

        logger.warning("SENAITE storage sync: unexpected response for '%s': %s", title, resp.json())
        return None

    except requests.RequestException as exc:
        logger.error("SENAITE storage sync failed for '%s': %s", title, exc)
        return None
```

- [ ] **Step 2: Create inventory/tasks.py**

```python
# xellabs-backend/inventory/tasks.py
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def sync_storage_location_to_senaite(self, location_id: int):
    """Sync a single StorageLocation to SENAITE and store the returned UID."""
    from inventory.models import StorageLocation
    from core.senaite_service import push_storage_location

    try:
        location = StorageLocation.objects.get(id=location_id)
    except StorageLocation.DoesNotExist:
        logger.warning("sync_storage_location_to_senaite: location %s not found", location_id)
        return

    uid = push_storage_location(location)
    if uid:
        StorageLocation.objects.filter(id=location_id).update(senaite_uid=uid)
        logger.info("Updated senaite_uid for location %s → %s", location_id, uid)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def sync_box_slots_to_senaite(self, box_id: int):
    """Sync all slot children of a box to SENAITE."""
    from inventory.models import StorageLocation
    from core.senaite_service import push_storage_location

    slots = StorageLocation.objects.filter(parent_id=box_id, location_type='box_location')
    for slot in slots:
        uid = push_storage_location(slot)
        if uid:
            StorageLocation.objects.filter(id=slot.id).update(senaite_uid=uid)
    logger.info("Synced %d slots for box %s to SENAITE", slots.count(), box_id)
```

- [ ] **Step 3: Verify tasks are importable**

```powershell
docker exec xellabs-lims-django-1 python manage.py shell -c "
from inventory.tasks import sync_storage_location_to_senaite, sync_box_slots_to_senaite
print('Tasks imported OK')
"
```

Expected: `Tasks imported OK`

- [ ] **Step 4: Commit**

```bash
git add xellabs-backend/core/senaite_service.py xellabs-backend/inventory/tasks.py
git commit -m "feat: SENAITE storage location sync service + Celery tasks"
```

---

## Task 3: Signals — Auto-Generate Slots + Queue SENAITE Sync

**Files:**
- Create: `xellabs-backend/inventory/signals.py`
- Modify: `xellabs-backend/inventory/apps.py`

**Interfaces:**
- Consumes: `sync_storage_location_to_senaite`, `sync_box_slots_to_senaite` from `inventory.tasks`
- Produces: auto-generates `rows × columns` box_location children when a box is created

- [ ] **Step 1: Create inventory/signals.py**

```python
# xellabs-backend/inventory/signals.py
"""
Inventory signals:
  1. Auto-generate box_location slots when a box is created.
  2. Queue SENAITE sync for every StorageLocation create/update.
"""
import logging
import string
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def _register_box_slot_signal():
    from inventory.models import StorageLocation

    @receiver(post_save, sender=StorageLocation, dispatch_uid="inventory_box_slot_autogenerate")
    def on_storage_location_saved(sender, instance, created, **kwargs):
        if not created or instance.location_type != 'box':
            return
        if not instance.rows or not instance.columns:
            return

        rows = min(instance.rows, 26)     # A–Z max
        cols = min(instance.columns, 99)  # 1–99 max

        slots = []
        for r in range(rows):
            row_letter = string.ascii_uppercase[r]
            for c in range(1, cols + 1):
                slot_id = f"{row_letter}{c}"
                slots.append(StorageLocation(
                    name=f"{instance.name} - {slot_id}",
                    location_type='box_location',
                    parent=instance,
                    slot_id=slot_id,
                    is_occupied=False,
                ))

        StorageLocation.objects.bulk_create(slots)
        logger.info("Auto-generated %d slots for box '%s' (pk=%s)", len(slots), instance.name, instance.pk)

        # Sync all slots to SENAITE after generation
        from inventory.tasks import sync_box_slots_to_senaite
        sync_box_slots_to_senaite.apply_async(args=[instance.pk], countdown=5)


def _register_senaite_sync_signal():
    from inventory.models import StorageLocation

    @receiver(post_save, sender=StorageLocation, dispatch_uid="inventory_senaite_sync")
    def on_storage_location_sync(sender, instance, created, **kwargs):
        # Don't sync box_location here — handled in bulk by sync_box_slots_to_senaite
        if instance.location_type == 'box_location':
            return
        from inventory.tasks import sync_storage_location_to_senaite
        sync_storage_location_to_senaite.apply_async(args=[instance.pk], countdown=2)
        logger.debug("Queued SENAITE sync for StorageLocation pk=%s", instance.pk)


def register_all():
    _register_box_slot_signal()
    _register_senaite_sync_signal()
```

- [ ] **Step 2: Check if inventory/apps.py exists, update it**

Read `xellabs-backend/inventory/apps.py`. If it exists, add `ready()` method. If not, create it:

```python
# xellabs-backend/inventory/apps.py
from django.apps import AppConfig


class InventoryConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "inventory"

    def ready(self):
        from inventory import signals as _signals
        _signals.register_all()
```

- [ ] **Step 3: Ensure inventory app uses InventoryConfig**

Check `xellabs-backend/inventory/__init__.py`. If empty or missing, add:

```python
default_app_config = "inventory.apps.InventoryConfig"
```

- [ ] **Step 4: Verify slots are auto-generated**

```powershell
docker exec xellabs-lims-django-1 python manage.py shell -c "
from inventory.models import StorageLocation

# Create a test box
box = StorageLocation.objects.create(name='Test Box', location_type='box', rows=2, columns=3)
slots = StorageLocation.objects.filter(parent=box, location_type='box_location')
print('Slots created:', slots.count())
print('Slot IDs:', list(slots.values_list('slot_id', flat=True)))

# Cleanup
StorageLocation.objects.filter(parent=box).delete()
box.delete()
print('Cleanup done')
"
```

Expected:
```
Slots created: 6
Slot IDs: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3']
Cleanup done
```

- [ ] **Step 5: Commit**

```bash
git add xellabs-backend/inventory/signals.py xellabs-backend/inventory/apps.py xellabs-backend/inventory/__init__.py
git commit -m "feat: auto-generate box slots on create + queue SENAITE sync signal"
```

---

## Task 4: AuditEvent 'store' Action + Assign API Endpoint

**Files:**
- Modify: `xellabs-backend/audittrail/models.py`
- Modify: `xellabs-backend/inventory/views.py`

**Interfaces:**
- Produces: `POST /api/inventory/storage-locations/{id}/assign/` endpoint
  - Request: `{ "sample_id": "S-25-01987" }`
  - Response 200: updated StorageLocation JSON
  - Response 400: `{ "error": "..." }` if slot not a box_location, already occupied, or sample_id missing

- [ ] **Step 1: Add 'store' to AuditEvent ACTION_CHOICES**

In `xellabs-backend/audittrail/models.py`, find the `ACTION_CHOICES` list and add `'store'`:

```python
ACTION_CHOICES = [
    ("create",            "Create"),
    ("update",            "Update"),
    ("delete",            "Delete"),
    ("view",              "View"),
    ("approve",           "Approve"),
    ("reject",            "Reject"),
    ("sign",              "Sign"),
    ("print",             "Print"),
    ("instrument_import", "Instrument Import"),
    ("receive",           "Receive"),
    ("submit",            "Submit"),
    ("verify",            "Verify"),
    ("complete",          "Complete"),
    ("store",             "Store"),   # ← new
]
```

- [ ] **Step 2: Make migration for AuditEvent change**

```powershell
docker exec xellabs-lims-django-1 python manage.py makemigrations audittrail --name add_store_action
docker exec xellabs-lims-django-1 python manage.py migrate audittrail
```

Expected: `Applying audittrail.0007_add_store_action... OK` (number may vary)

- [ ] **Step 3: Add assign/ action to StorageLocationViewSet**

In `xellabs-backend/inventory/views.py`, update `StorageLocationViewSet`:

```python
class StorageLocationViewSet(viewsets.ModelViewSet):
    queryset = StorageLocation.objects.all()
    serializer_class = StorageLocationSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["location_type", "parent", "is_occupied"]
    search_fields = ["name", "slot_id"]

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        """Assign a sample to a box_location slot."""
        slot = self.get_object()

        if slot.location_type != 'box_location':
            return Response({"error": "Only box_location slots can be assigned."}, status=status.HTTP_400_BAD_REQUEST)

        if slot.is_occupied:
            return Response({"error": f"Slot {slot.slot_id} is already occupied."}, status=status.HTTP_400_BAD_REQUEST)

        sample_id = (request.data.get("sample_id") or "").strip()
        if not sample_id:
            return Response({"error": "sample_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Mark slot as occupied
        slot.is_occupied = True
        slot.save(update_fields=["is_occupied"])

        # Build full storage path for audit
        from core.senaite_service import _build_storage_path
        storage_path = _build_storage_path(slot)

        # Log Chain of Custody event
        from django.contrib.contenttypes.models import ContentType
        from audittrail.models import AuditEvent
        AuditEvent.objects.create(
            user=request.user,
            action="store",
            content_type=ContentType.objects.get_for_model(slot),
            object_id=slot.pk,
            object_repr=f"Sample {sample_id} → {storage_path}",
            extra_data={
                "sample_id": sample_id,
                "storage_path": storage_path,
                "slot_id": slot.slot_id,
                "storage_location_id": slot.pk,
                "senaite_uid": slot.senaite_uid,
            },
        )

        return Response(StorageLocationSerializer(slot).data)
```

- [ ] **Step 4: Test the assign endpoint**

```powershell
docker exec xellabs-lims-django-1 python manage.py shell -c "
from inventory.models import StorageLocation

# Create test box + slots
box = StorageLocation.objects.create(name='Test Box', location_type='box', rows=2, columns=2)
import time; time.sleep(1)  # wait for signal
slot = StorageLocation.objects.filter(parent=box, slot_id='A1').first()
print('Slot A1 exists:', slot is not None)
print('is_occupied:', slot.is_occupied if slot else 'N/A')

# Cleanup
StorageLocation.objects.filter(parent=box).delete()
box.delete()
"
```

Expected:
```
Slot A1 exists: True
is_occupied: False
```

- [ ] **Step 5: Commit**

```bash
git add xellabs-backend/audittrail/models.py xellabs-backend/audittrail/migrations/ xellabs-backend/inventory/views.py
git commit -m "feat: AuditEvent store action + slot assign API endpoint with CoC logging"
```

---

## Task 5: Update Frontend storage.ts

**Files:**
- Modify: `xellabs-frontend/app/actions/storage.ts`

**Interfaces:**
- Produces updated `StorageLocation` type with new fields
- Produces: `assignSampleToSlot(slotId: number, sampleId: string): Promise<{ success: boolean; message: string }>`

- [ ] **Step 1: Update storage.ts**

Replace the full content of `xellabs-frontend/app/actions/storage.ts`:

```typescript
'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type StorageLocation = {
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

export type StorageFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function getStorageLocations(): Promise<StorageLocation[]> {
  try {
    const res = await djangoFetch('/api/inventory/storage-locations/?page_size=2000&ordering=name')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export async function createStorageLocation(
  _state: StorageFormState,
  formData: FormData
): Promise<StorageFormState> {
  const name          = (formData.get('name') as string)?.trim()
  const location_type = (formData.get('location_type') as string)?.trim()
  const parent        = (formData.get('parent') as string)?.trim()
  const temperature   = (formData.get('temperature') as string)?.trim()
  const notes         = (formData.get('notes') as string)?.trim()
  const rows          = (formData.get('rows') as string)?.trim()
  const columns       = (formData.get('columns') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!name)          errors.name          = ['Name is required']
  if (!location_type) errors.location_type = ['Type is required']
  if (location_type === 'box') {
    if (!rows || Number(rows) < 1)    errors.rows    = ['Rows required (min 1)']
    if (!columns || Number(columns) < 1) errors.columns = ['Columns required (min 1)']
  }
  if (Object.keys(errors).length) return { errors }

  const body: Record<string, unknown> = {
    name,
    location_type,
    temperature: temperature ?? '',
    notes: notes ?? '',
  }
  if (parent) body.parent = Number(parent)
  if (location_type === 'box') {
    body.rows    = Number(rows)
    body.columns = Number(columns)
  }

  const res = await djangoFetch('/api/inventory/storage-locations/', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    if (err.name)          return { errors: { name: [err.name] } }
    if (err.location_type) return { errors: { location_type: [err.location_type] } }
    return { message: 'Failed to create storage location.' }
  }

  revalidatePath('/dashboard/storage')
  return { success: true, message: `"${name}" created.` }
}

export async function updateStorageLocation(
  id: number,
  _state: StorageFormState,
  formData: FormData
): Promise<StorageFormState> {
  const name          = (formData.get('name') as string)?.trim()
  const location_type = (formData.get('location_type') as string)?.trim()
  const parent        = (formData.get('parent') as string)?.trim()
  const temperature   = (formData.get('temperature') as string)?.trim()
  const notes         = (formData.get('notes') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!name)          errors.name          = ['Name is required']
  if (!location_type) errors.location_type = ['Type is required']
  if (Object.keys(errors).length) return { errors }

  const body: Record<string, unknown> = {
    name,
    location_type,
    temperature: temperature ?? '',
    notes: notes ?? '',
    parent: parent ? Number(parent) : null,
  }

  const res = await djangoFetch(`/api/inventory/storage-locations/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    if (err.name)          return { errors: { name: [err.name] } }
    if (err.location_type) return { errors: { location_type: [err.location_type] } }
    return { message: 'Failed to update storage location.' }
  }

  revalidatePath('/dashboard/storage')
  return { success: true, message: `"${name}" updated.` }
}

export async function deleteStorageLocation(id: number): Promise<{ success: boolean; message: string }> {
  const res = await djangoFetch(`/api/inventory/storage-locations/${id}/`, { method: 'DELETE' })
  if (!res.ok) return { success: false, message: 'Failed to delete. Location may have contents.' }
  revalidatePath('/dashboard/storage')
  return { success: true, message: 'Location deleted.' }
}

export async function assignSampleToSlot(
  slotId: number,
  sampleId: string
): Promise<{ success: boolean; message: string }> {
  const res = await djangoFetch(`/api/inventory/storage-locations/${slotId}/assign/`, {
    method: 'POST',
    body: JSON.stringify({ sample_id: sampleId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { success: false, message: err.error ?? 'Failed to assign sample.' }
  }
  revalidatePath('/dashboard/storage')
  revalidatePath('/dashboard/chain-of-custody')
  return { success: true, message: `Sample ${sampleId} assigned to slot.` }
}
```

- [ ] **Step 2: Commit**

```bash
git add xellabs-frontend/app/actions/storage.ts
git commit -m "feat: update storage.ts types + assignSampleToSlot action"
```

---

## Task 6: Update StorageModal — Box Type + Rows/Columns

**Files:**
- Modify: `xellabs-frontend/app/dashboard/storage/_components/StorageModal.tsx`

**Interfaces:**
- Consumes: updated `StorageLocation` type from `@/app/actions/storage`
- When `location_type === 'box'` is selected: show rows + columns number inputs

- [ ] **Step 1: Update TYPE_OPTIONS and add conditional rows/columns fields**

In `StorageModal.tsx`, make these changes:

1. Replace `TYPE_OPTIONS` constant:
```typescript
const TYPE_OPTIONS = [
  { value: 'room',    label: 'Room' },
  { value: 'fridge',  label: 'Refrigerator' },
  { value: 'freezer', label: 'Freezer' },
  { value: 'cabinet', label: 'Cabinet' },
  { value: 'shelf',   label: 'Shelf' },
  { value: 'box',     label: 'Box' },
]
```

2. Add state for selected type inside `StorageModal` component (after `const isEdit = ...`):
```typescript
const [selectedType, setSelectedType] = useState(editing?.location_type ?? 'room')
```

3. Add `useState` to imports: `import { useActionState, useState } from 'react'`

4. Update the type `<select>` to track changes:
```tsx
<select
  name="location_type"
  value={selectedType}
  onChange={e => setSelectedType(e.target.value)}
  className="w-full px-3 py-2 text-xs rounded-lg outline-none"
  style={{ border: `1px solid ${state.errors?.location_type ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
>
  {TYPE_OPTIONS.map(o => (
    <option key={o.value} value={o.value}>{o.label}</option>
  ))}
</select>
```

5. Add rows/columns fields after the type select (inside the `<form>`), before the parent select:
```tsx
{selectedType === 'box' && (
  <div className="flex gap-2">
    <div className="flex-1">
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        Rows <span style={{ color: '#EF4444' }}>*</span>
        <span className="ml-1 font-normal" style={{ color: '#9CA3AF' }}>(max 26)</span>
      </label>
      <input
        name="rows"
        type="number"
        min={1}
        max={26}
        placeholder="e.g. 10"
        defaultValue={editing?.rows ?? ''}
        required={selectedType === 'box'}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
        style={{ border: `1px solid ${state.errors?.rows ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
      />
      {state.errors?.rows && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.rows[0]}</p>}
    </div>
    <div className="flex-1">
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        Columns <span style={{ color: '#EF4444' }}>*</span>
        <span className="ml-1 font-normal" style={{ color: '#9CA3AF' }}>(max 99)</span>
      </label>
      <input
        name="columns"
        type="number"
        min={1}
        max={99}
        placeholder="e.g. 10"
        defaultValue={editing?.columns ?? ''}
        required={selectedType === 'box'}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
        style={{ border: `1px solid ${state.errors?.columns ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
      />
      {state.errors?.columns && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.columns[0]}</p>}
    </div>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add xellabs-frontend/app/dashboard/storage/_components/StorageModal.tsx
git commit -m "feat: StorageModal — box type with rows x columns fields"
```

---

## Task 7: Update StorageTree — Box Icon, Hide box_location

**Files:**
- Modify: `xellabs-frontend/app/dashboard/storage/_components/StorageTree.tsx`

**Interfaces:**
- box_location nodes NEVER appear in the tree
- Box nodes show slot count badge

- [ ] **Step 1: Update TYPE_ICONS and filter out box_location**

In `StorageTree.tsx`:

1. Update `TYPE_ICONS`:
```typescript
const TYPE_ICONS: Record<string, string> = {
  room:         'meeting_room',
  fridge:       'thermostat',
  freezer:      'ac_unit',
  cabinet:      'inventory_2',
  shelf:        'view_agenda',
  box:          'grid_view',
  box_location: 'grid_on',
}
```

2. In `buildTree`, filter out `box_location` from tree roots **and** from all children arrays. Update `buildTree`:
```typescript
export function buildTree(locations: StorageLocation[]): StorageNode[] {
  // box_location slots are shown in the grid, not the tree
  const treeLocations = locations.filter(l => l.location_type !== 'box_location')
  const map = new Map<number, StorageNode>()
  treeLocations.forEach(l => map.set(l.id, { ...l, children: [] }))
  const roots: StorageNode[] = []
  map.forEach(node => {
    if (node.parent === null) {
      roots.push(node)
    } else {
      const parent = map.get(node.parent)
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
  })
  return roots
}
```

3. In `TreeNode`, update the child count badge to show slot count for boxes. After `const hasChildren = node.children.length > 0`, add:
```typescript
// For boxes, show the slot count (rows × columns) not the children count
const slotCount = node.location_type === 'box' && node.rows && node.columns
  ? node.rows * node.columns
  : null
```

Replace badge render:
```tsx
{(hasChildren || slotCount !== null) && (
  <span className="text-xs px-1.5 py-0.5 rounded-full"
    style={{ backgroundColor: isSelected ? '#DBEAFE' : '#F3F4F6', color: isSelected ? '#0154FC' : '#9CA3AF', fontSize: 10 }}>
    {slotCount !== null ? slotCount : node.children.length}
  </span>
)}
```

- [ ] **Step 2: Commit**

```bash
git add xellabs-frontend/app/dashboard/storage/_components/StorageTree.tsx
git commit -m "feat: StorageTree — box icon, filter box_location from tree, slot count badge"
```

---

## Task 8: SlotGrid + SlotAssignModal Components

**Files:**
- Create: `xellabs-frontend/app/dashboard/storage/_components/SlotGrid.tsx`
- Create: `xellabs-frontend/app/dashboard/storage/_components/SlotAssignModal.tsx`

**Interfaces:**
- `SlotGrid` props: `{ box: StorageLocation, allLocations: StorageLocation[], onAssigned: (msg: string) => void }`
- `SlotAssignModal` props: `{ slot: StorageLocation, onClose: () => void, onDone: (msg: string) => void }`

- [ ] **Step 1: Create SlotAssignModal.tsx**

```tsx
// xellabs-frontend/app/dashboard/storage/_components/SlotAssignModal.tsx
'use client'
import { useState } from 'react'
import { assignSampleToSlot, type StorageLocation } from '@/app/actions/storage'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export default function SlotAssignModal({
  slot,
  onClose,
  onDone,
}: {
  slot: StorageLocation
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const [sampleId, setSampleId] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const id = sampleId.trim()
    if (!id) { setError('Sample ID is required'); return }
    setPending(true)
    setError('')
    const result = await assignSampleToSlot(slot.id, id)
    setPending(false)
    if (result.success) {
      onDone(result.message)
      onClose()
    } else {
      setError(result.message)
    }
  }

  return (
    <div
      onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
              <MI name="science" size={16} color="#0154FC" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Assign Sample to Slot {slot.slot_id}</h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>Enter the sample ID to log it into this storage slot</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <MI name="close" size={16} color="#9CA3AF" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
              Sample ID <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              value={sampleId}
              onChange={e => setSampleId(e.target.value)}
              placeholder="e.g. S-25-01987"
              autoFocus
              className="w-full px-3 py-2 text-xs rounded-lg outline-none"
              style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
            />
            {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
          </div>

          {/* Slot info */}
          <div className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
            <div className="flex items-center gap-2">
              <MI name="grid_on" size={13} color="#6B7280" />
              <span style={{ color: '#6B7280' }}>Slot: <strong style={{ color: '#111827' }}>{slot.slot_id}</strong></span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <MI name="inventory_2" size={13} color="#6B7280" />
              <span style={{ color: '#6B7280' }}>{slot.name}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button
              type="button" onClick={onClose} disabled={pending}
              style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit" disabled={pending}
              className="flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}
            >
              <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
              {pending ? 'Assigning…' : 'Assign Sample'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create SlotGrid.tsx**

```tsx
// xellabs-frontend/app/dashboard/storage/_components/SlotGrid.tsx
'use client'
import { useState } from 'react'
import type { StorageLocation } from '@/app/actions/storage'
import SlotAssignModal from './SlotAssignModal'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export default function SlotGrid({
  box,
  allLocations,
  onAssigned,
}: {
  box: StorageLocation
  allLocations: StorageLocation[]
  onAssigned: (msg: string) => void
}) {
  const [assigningSlot, setAssigningSlot] = useState<StorageLocation | null>(null)

  const slots = allLocations
    .filter(l => l.parent === box.id && l.location_type === 'box_location')
    .sort((a, b) => a.slot_id.localeCompare(b.slot_id, undefined, { numeric: true }))

  const totalSlots = slots.length
  const freeSlots  = slots.filter(s => !s.is_occupied).length
  const usedSlots  = totalSlots - freeSlots

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <MI name="grid_view" size={32} color="#D1D5DB" />
        <p className="mt-2 text-sm" style={{ color: '#9CA3AF' }}>No slots found for this box</p>
        <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Slots are auto-generated when a box is created</p>
      </div>
    )
  }

  // Build grid rows
  const rows = box.rows ?? 1
  const cols = box.columns ?? 1
  const slotMap = new Map(slots.map(s => [s.slot_id, s]))

  return (
    <div>
      {/* Stats header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
          style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <MI name="check_circle" size={13} color="#10B981" />
          <span style={{ color: '#065F46', fontWeight: 600 }}>{freeSlots}</span>
          <span style={{ color: '#6B7280' }}>free</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
          style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
          <MI name="cancel" size={13} color="#EF4444" />
          <span style={{ color: '#991B1B', fontWeight: 600 }}>{usedSlots}</span>
          <span style={{ color: '#6B7280' }}>occupied</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
          style={{ backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB' }}>
          <MI name="grid_view" size={13} color="#6B7280" />
          <span style={{ color: '#374151', fontWeight: 600 }}>{totalSlots}</span>
          <span style={{ color: '#6B7280' }}>total</span>
        </div>
      </div>

      {/* Column headers */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `32px repeat(${cols}, minmax(44px, 1fr))`, gap: 4, minWidth: cols * 48 + 36 }}>
          {/* Empty top-left corner */}
          <div />
          {Array.from({ length: cols }, (_, i) => (
            <div key={i} className="text-center text-xs font-semibold" style={{ color: '#9CA3AF', paddingBottom: 4 }}>
              {i + 1}
            </div>
          ))}

          {/* Rows */}
          {Array.from({ length: rows }, (_, r) => {
            const rowLetter = String.fromCharCode(65 + r) // A, B, C...
            return [
              // Row label
              <div key={`label-${r}`} className="flex items-center justify-center text-xs font-semibold"
                style={{ color: '#9CA3AF' }}>
                {rowLetter}
              </div>,
              // Slot cells
              ...Array.from({ length: cols }, (_, c) => {
                const slotId = `${rowLetter}${c + 1}`
                const slot = slotMap.get(slotId)
                const occupied = slot?.is_occupied ?? false

                return (
                  <button
                    key={slotId}
                    onClick={() => !occupied && slot && setAssigningSlot(slot)}
                    disabled={occupied || !slot}
                    title={occupied ? `${slotId} — Occupied` : `${slotId} — Click to assign`}
                    style={{
                      height: 40,
                      borderRadius: 6,
                      border: `1px solid ${occupied ? '#FECACA' : '#BBF7D0'}`,
                      backgroundColor: occupied ? '#FEF2F2' : '#F0FDF4',
                      color: occupied ? '#EF4444' : '#10B981',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: occupied ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {slotId}
                  </button>
                )
              }),
            ]
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }} />
          Free — click to assign
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }} />
          Occupied
        </div>
      </div>

      {/* Assign modal */}
      {assigningSlot && (
        <SlotAssignModal
          slot={assigningSlot}
          onClose={() => setAssigningSlot(null)}
          onDone={msg => { onAssigned(msg); setAssigningSlot(null) }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add xellabs-frontend/app/dashboard/storage/_components/SlotGrid.tsx
git add xellabs-frontend/app/dashboard/storage/_components/SlotAssignModal.tsx
git commit -m "feat: SlotGrid with free/occupied cells + SlotAssignModal for sample assignment"
```

---

## Task 9: Update StorageDetail — Conditional Rendering

**Files:**
- Modify: `xellabs-frontend/app/dashboard/storage/_components/StorageDetail.tsx`

**Interfaces:**
- Consumes: `SlotGrid` from `./SlotGrid`
- When `location.location_type === 'box'`: render `SlotGrid` instead of sub-location cards
- `onAssigned` callback passed from shell via `onSelectChild` prop (reuse existing prop or add new one)

- [ ] **Step 1: Update StorageDetail props and rendering**

Update `StorageDetail.tsx`:

1. Add `onAssigned` prop to the component:
```typescript
export default function StorageDetail({
  location,
  allLocations,
  onEdit,
  onDelete,
  onSelectChild,
  onAssigned,
}: {
  location: StorageLocation | null
  allLocations: StorageLocation[]
  onEdit: (loc: StorageLocation) => void
  onDelete: (id: number) => void
  onSelectChild: (id: number) => void
  onAssigned: (msg: string) => void
})
```

2. Add import at top of file:
```typescript
import SlotGrid from './SlotGrid'
```

3. Update the tab content for `sublocations` tab — wrap existing cards with a conditional:
```tsx
{tab === 'sublocations' && (
  <>
    {location.location_type === 'box' ? (
      <SlotGrid
        box={location}
        allLocations={allLocations}
        onAssigned={onAssigned}
      />
    ) : (
      <>
        {children.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <MI name="inbox" size={32} color="#D1D5DB" />
            <p className="mt-2 text-sm" style={{ color: '#9CA3AF' }}>No sub-locations</p>
          </div>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {children.map(child => {
              const childIcon = TYPE_ICONS[child.location_type] ?? 'place'
              const childLabel = TYPE_LABELS[child.location_type] ?? child.location_type
              const grandchildren = allLocations.filter(l => l.parent === child.id && l.location_type !== 'box_location').length
              return (
                <button
                  key={child.id}
                  onClick={() => onSelectChild(child.id)}
                  className="text-left p-3 rounded-xl"
                  style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', cursor: 'pointer' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: '#EFF6FF' }}>
                      <MI name={childIcon} size={14} color="#0154FC" />
                    </div>
                    <span className="text-xs font-semibold truncate" style={{ color: '#111827' }}>{child.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: '#9CA3AF' }}>{childLabel}</span>
                    {grandchildren > 0 && (
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>{grandchildren} inside</span>
                    )}
                  </div>
                  {child.temperature && (
                    <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{child.temperature}</p>
                  )}
                  {child.location_type === 'box' && child.rows && child.columns && (
                    <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{child.rows}×{child.columns} slots</p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </>
    )}
  </>
)}
```

4. Add `TYPE_ICONS` and `TYPE_LABELS` entries for box/box_location (they may already exist — just ensure they have):
```typescript
const TYPE_ICONS: Record<string, string> = {
  room:         'meeting_room',
  fridge:       'thermostat',
  freezer:      'ac_unit',
  cabinet:      'inventory_2',
  shelf:        'view_agenda',
  box:          'grid_view',
  box_location: 'grid_on',
}

const TYPE_LABELS: Record<string, string> = {
  room: 'Room', fridge: 'Refrigerator', freezer: 'Freezer',
  cabinet: 'Cabinet', shelf: 'Shelf', box: 'Box', box_location: 'Slot',
}
```

5. Update Info tab to show senaite_uid + box dimensions:
In the Info tab, add these rows after the existing InfoRows:
```tsx
{location.location_type === 'box' && location.rows && location.columns && (
  <InfoRow label="Grid Size" value={`${location.rows} rows × ${location.columns} columns (${location.rows * location.columns} slots)`} />
)}
{location.slot_id && <InfoRow label="Slot ID" value={location.slot_id} />}
{location.senaite_uid && <InfoRow label="SENAITE UID" value={location.senaite_uid} />}
```

- [ ] **Step 2: Update StorageShell to pass onAssigned**

In `StorageShell.tsx`, update the `<StorageDetail>` usage:
```tsx
<StorageDetail
  location={selected}
  allLocations={initialLocations}
  onEdit={(loc) => setModal({ editing: loc })}
  onDelete={handleDelete}
  onSelectChild={setSelectedId}
  onAssigned={(msg) => { showToast(true, msg); router.refresh() }}
/>
```

- [ ] **Step 3: Commit**

```bash
git add xellabs-frontend/app/dashboard/storage/_components/StorageDetail.tsx
git add xellabs-frontend/app/dashboard/storage/_components/StorageShell.tsx
git commit -m "feat: StorageDetail conditional rendering — SlotGrid for box type, onAssigned prop"
```

---

## Task 10: Rebuild + Smoke Test

- [ ] **Step 1: Rebuild frontend container**

```powershell
docker compose stop frontend; docker compose rm -f frontend; docker compose up -d frontend
```

- [ ] **Step 2: Check Django logs for errors**

```powershell
docker logs xellabs-lims-django-1 --tail 20
```

Expected: no traceback errors.

- [ ] **Step 3: Check frontend logs**

```powershell
docker logs xellabs-lims-frontend-1 --tail 20
```

Expected: `✓ Ready` with no TypeScript errors.

- [ ] **Step 4: End-to-end smoke test**

Navigate to `http://localhost:3000/dashboard/storage`

1. Create a Room → appears in tree, SENAITE sync queued in Celery
2. Create a Fridge under Room → appears nested
3. Create a Shelf under Fridge
4. Create a Box under Shelf — set rows=3, columns=4 → box appears in tree
5. Click Box in tree → right panel shows slot grid (3×4 = 12 slots, all green)
6. Click slot A1 → SlotAssignModal opens
7. Enter sample ID "S-25-TEST" → submit
8. Slot A1 turns red (occupied), toast shows "Sample S-25-TEST assigned to slot"
9. Check Django Admin → `http://localhost:8001/admin/inventory/storagelocation/` → see box_location rows
10. Check AuditEvent → `http://localhost:8001/admin/audittrail/auditevent/` → see 'store' event

- [ ] **Step 5: Verify SENAITE sync**

```powershell
docker exec xellabs-lims-senaite-1 python2.7 -c "
import urllib2, json
req = urllib2.Request('http://localhost:8080/senaite/@@API/senaite/v1/StorageLocation?limit=10')
req.add_header('Authorization', 'Basic YWRtaW46YWRtaW4=')
r = urllib2.urlopen(req, timeout=10)
data = json.loads(r.read())
print('SENAITE storage count:', data.get('count'))
for item in data.get('items', []):
    print(' -', item.get('title'))
"
```

Expected: count > 0, titles matching your created locations.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: storage phase 2 complete — box slots, SENAITE sync, CoC, slot assignment"
```

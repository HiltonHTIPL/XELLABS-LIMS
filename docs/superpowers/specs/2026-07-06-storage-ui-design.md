# Storage UI — Design Spec
**Date:** 2026-07-06  
**Status:** Approved

---

## Overview

Build the Storage Management page in the XelLabs LIMS Next.js frontend. Replaces the current "Under Development" placeholder. Django backend API is already complete — no backend changes needed.

---

## Architecture

### Data Flow
```
Django API (/api/storage-locations/) 
  → app/actions/storage.ts (server actions)
  → StorageShell.tsx (client state)
  → StorageTree (left) + StorageDetail (right)
```

### Files

| File | Purpose |
|------|---------|
| `app/actions/storage.ts` | Server actions: list, getOne, create, update, delete |
| `app/dashboard/storage/_components/StorageShell.tsx` | Main shell — split layout, selected node state |
| `app/dashboard/storage/_components/StorageTree.tsx` | Left panel — collapsible hierarchy tree |
| `app/dashboard/storage/_components/StorageDetail.tsx` | Right panel — detail, contents, sub-locations |
| `app/dashboard/storage/_components/StorageModal.tsx` | Create/edit modal |
| `app/dashboard/storage/page.tsx` | Page entry — replaces UnderDevelopment |

---

## Layout

Split explorer — left tree (280px fixed) + right detail (flex-1).

- Left: collapsible tree, active node in `#0154FC`, icons per type, child count badge, "New Location" button
- Right: detail header (name, type badge, temperature, capacity, edit/delete), then 3 tabs: Contents | Sub-locations | Info
- Mobile: tree collapses to a drawer

---

## Data Types

```ts
type StorageLocationType = 'room' | 'fridge' | 'freezer' | 'cabinet' | 'shelf' | 'other'

type StorageLocation = {
  id: number
  name: string
  location_type: StorageLocationType
  parent: number | null
  temperature_min: number | null
  temperature_max: number | null
  capacity: number | null
  description: string
}

// Client-side tree node (built by nesting flat API list)
type StorageNode = StorageLocation & {
  children: StorageNode[]
}
```

---

## Components

### StorageTree
- Renders nested `StorageNode[]` recursively
- Expand/collapse per node
- Click selects node → updates `selectedId` in shell
- Active node: `bg-blue-50 text-[#0154FC] font-medium border-l-2 border-[#0154FC]`
- Icons: room=Building2, fridge=Thermometer, freezer=Snowflake, cabinet=Archive, shelf=Layers, other=MapPin
- Top: "+ New Location" button (opens modal with no parent pre-selected)
- Each node: right-click or "+" icon to add child

### StorageDetail
- No selection state: centered empty state "Select a location to view details"
- Header: name (h2), type badge, temperature range (if set), capacity (if set), Edit + Delete buttons
- Tabs:
  - **Contents**: samples stored here (from lab-samples API filtered by storage_location) + lots (from lots API filtered by storage_location)
  - **Sub-locations**: child locations as cards with name, type, item count
  - **Info**: all fields in a description list

### StorageModal
- Mode: create | edit
- Fields:
  - Name (required, text)
  - Type (required, select: Room/Fridge/Freezer/Cabinet/Shelf/Other)
  - Parent Location (optional, searchable select from existing locations)
  - Temperature Min °C (optional, number)
  - Temperature Max °C (optional, number)  
  - Capacity (optional, number — max items)
  - Description (optional, textarea)
- Validation: name required, temp min < temp max if both set
- On save: optimistic update → refetch tree

---

## Color Rules

- Primary actions, active states, focus rings: `#0154FC`
- **Never use `#14B8A6` (teal) anywhere in this feature**
- Type badges: use blue shades (`bg-blue-100 text-blue-700`) not teal
- Destructive actions: red (`#EF4444`)

---

## API — Server Actions (app/actions/storage.ts)

| Action | Method | Endpoint |
|--------|--------|----------|
| `getStorageLocations()` | GET | `/api/storage-locations/?page_size=500` |
| `getStorageLocation(id)` | GET | `/api/storage-locations/{id}/` |
| `createStorageLocation(data)` | POST | `/api/storage-locations/` |
| `updateStorageLocation(id, data)` | PATCH | `/api/storage-locations/{id}/` |
| `deleteStorageLocation(id)` | DELETE | `/api/storage-locations/{id}/` |

All actions use `djangoFetch` from `app/lib/django.ts`.

---

## Contents Tab — Related Data

- **Samples**: fetch `GET /api/lab-samples/?storage_location={id}` — show sample ID, status, received date
- **Lots**: fetch `GET /api/lots/?storage_location={id}` — show lot number, item name, quantity, expiry

---

## Error Handling

- API errors show inline toast (red)
- Delete: confirm dialog before request
- If delete fails (location has contents): show error "Remove all contents before deleting"

---

## Design Principles Applied

- **Feature-Based Architecture**: all storage code lives under `app/dashboard/storage/`
- **Separation of Concerns**: server actions handle API, shell handles state, leaf components are pure UI
- **YAGNI**: no bulk import, no QR codes, no temperature logging charts — those are future features
- **KISS**: flat API list → client-side tree nesting, no recursive backend queries needed

# Storage Management UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Storage Management page — split explorer with left hierarchy tree and right detail panel — wired to the Django `/api/inventory/storage-locations/` API.

**Architecture:** Server actions fetch from Django via `djangoFetch`. A client-side shell holds selected node state and passes data down to a tree navigator (left) and detail panel (right). Create/edit via modal. No backend changes needed.

**Tech Stack:** Next.js 16 App Router, React `useActionState`, `djangoFetch` helper, Material Icons (span.material-icons), inline styles.

## Global Constraints

- Primary color: `#0154FC` — used for all active states, primary buttons, focus rings
- **Never use `#14B8A6`** anywhere in this feature
- All Django API calls go through `djangoFetch` from `@/app/lib/django`
- Server actions marked `'use server'`, client components marked `'use client'`
- Material Icons via `<span className="material-icons" style={{ fontSize: N }}>icon_name</span>`
- Revalidate `/dashboard/storage` after every mutation
- StorageLocation fields: `id`, `name`, `location_type` (room|fridge|freezer|cabinet|shelf), `parent` (number|null), `temperature` (string), `notes` (string)
- No `capacity` field — model doesn't have it
- `temperature` is a free string (e.g. "2-8°C", "-20°C") — not min/max numbers

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `xellabs-frontend/app/actions/storage.ts` | Create | Server actions: list, create, update, delete |
| `xellabs-frontend/app/dashboard/storage/_components/StorageShell.tsx` | Create | Client shell: split layout, selected node state, toast |
| `xellabs-frontend/app/dashboard/storage/_components/StorageTree.tsx` | Create | Left panel: collapsible hierarchy tree |
| `xellabs-frontend/app/dashboard/storage/_components/StorageModal.tsx` | Create | Create/edit modal with form |
| `xellabs-frontend/app/dashboard/storage/_components/StorageDetail.tsx` | Create | Right panel: tabs (Contents, Sub-locations, Info) |
| `xellabs-frontend/app/dashboard/storage/page.tsx` | Modify | Replace UnderDevelopment with StorageShell |

---

## Task 1: Server Actions

**Files:**
- Create: `xellabs-frontend/app/actions/storage.ts`

**Interfaces:**
- Produces:
  - `StorageLocation` type
  - `StorageFormState` type
  - `getStorageLocations(): Promise<StorageLocation[]>`
  - `createStorageLocation(_state: StorageFormState, formData: FormData): Promise<StorageFormState>`
  - `updateStorageLocation(id: number, _state: StorageFormState, formData: FormData): Promise<StorageFormState>`
  - `deleteStorageLocation(id: number): Promise<{ success: boolean; message: string }>`

- [ ] **Step 1: Create the server actions file**

```typescript
// xellabs-frontend/app/actions/storage.ts
'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type StorageLocation = {
  id: number
  name: string
  location_type: 'room' | 'fridge' | 'freezer' | 'cabinet' | 'shelf'
  parent: number | null
  temperature: string
  notes: string
}

export type StorageFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function getStorageLocations(): Promise<StorageLocation[]> {
  try {
    const res = await djangoFetch('/api/inventory/storage-locations/?page_size=500&ordering=name')
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

  const errors: Record<string, string[]> = {}
  if (!name)          errors.name          = ['Name is required']
  if (!location_type) errors.location_type = ['Type is required']
  if (Object.keys(errors).length) return { errors }

  const body: Record<string, unknown> = { name, location_type, temperature: temperature ?? '', notes: notes ?? '' }
  if (parent) body.parent = Number(parent)

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

  const body: Record<string, unknown> = { name, location_type, temperature: temperature ?? '', notes: notes ?? '' }
  body.parent = parent ? Number(parent) : null

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
```

- [ ] **Step 2: Verify the API endpoint URL**

```bash
docker exec xellabs-lims-django-1 python manage.py shell -c "
from django.urls import reverse
print(reverse('storagelocation-list'))
"
```

If the output is not `/api/inventory/storage-locations/`, update the path in `storage.ts` to match.

- [ ] **Step 3: Commit**

```bash
git add xellabs-frontend/app/actions/storage.ts
git commit -m "feat: storage server actions — CRUD via Django API"
```

---

## Task 2: StorageModal

**Files:**
- Create: `xellabs-frontend/app/dashboard/storage/_components/StorageModal.tsx`

**Interfaces:**
- Consumes: `StorageLocation`, `StorageFormState`, `createStorageLocation`, `updateStorageLocation` from `@/app/actions/storage`
- Props:
  ```ts
  {
    editing: StorageLocation | null        // null = create mode
    defaultParentId?: number | null        // pre-selects parent in create mode
    allLocations: StorageLocation[]        // for parent dropdown
    onClose: () => void
    onDone: (msg: string) => void
  }
  ```

- [ ] **Step 1: Create StorageModal.tsx**

```tsx
// xellabs-frontend/app/dashboard/storage/_components/StorageModal.tsx
'use client'
import { useActionState } from 'react'
import {
  createStorageLocation,
  updateStorageLocation,
  type StorageLocation,
  type StorageFormState,
} from '@/app/actions/storage'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({
  label, name, placeholder, required, error, defaultValue, hint, type = 'text',
}: {
  label: string; name: string; placeholder?: string; required?: boolean
  error?: string; defaultValue?: string; hint?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
        {hint && <span className="ml-1 font-normal" style={{ color: '#9CA3AF' }}>{hint}</span>}
      </label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
        style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
      />
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

const TYPE_OPTIONS = [
  { value: 'room',    label: 'Room' },
  { value: 'fridge',  label: 'Refrigerator' },
  { value: 'freezer', label: 'Freezer' },
  { value: 'cabinet', label: 'Cabinet' },
  { value: 'shelf',   label: 'Shelf' },
]

export default function StorageModal({
  editing,
  defaultParentId,
  allLocations,
  onClose,
  onDone,
}: {
  editing: StorageLocation | null
  defaultParentId?: number | null
  allLocations: StorageLocation[]
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const isEdit = editing !== null

  const createAction = async (prev: StorageFormState, fd: FormData) => {
    const result = await createStorageLocation(prev, fd)
    if (result.success) { onDone(result.message ?? 'Created.'); onClose() }
    return result
  }

  const editAction = async (prev: StorageFormState, fd: FormData) => {
    const result = await updateStorageLocation(editing!.id, prev, fd)
    if (result.success) { onDone(result.message ?? 'Updated.'); onClose() }
    return result
  }

  const [state, action, pending] = useActionState(isEdit ? editAction : createAction, {})

  // Exclude self and descendants from parent options to avoid cycles
  const parentOptions = allLocations.filter(l => !editing || l.id !== editing.id)

  return (
    <div
      onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: 460, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
              <MI name={isEdit ? 'edit' : 'add_location'} size={16} color="#0154FC" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                {isEdit ? `Edit — ${editing!.name}` : 'New Storage Location'}
              </h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                {isEdit ? 'Update location details' : 'Add a new storage location'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <MI name="close" size={16} color="#9CA3AF" />
          </button>
        </div>

        <form action={action} className="px-5 py-4 flex flex-col gap-3">
          <Field
            label="Name" name="name" placeholder="e.g. Fridge A" required
            error={state.errors?.name?.[0]} defaultValue={editing?.name}
          />

          {/* Type select */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
              Type <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              name="location_type"
              defaultValue={editing?.location_type ?? 'room'}
              className="w-full px-3 py-2 text-xs rounded-lg outline-none"
              style={{ border: `1px solid ${state.errors?.location_type ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
            >
              {TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {state.errors?.location_type && (
              <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.location_type[0]}</p>
            )}
          </div>

          {/* Parent select */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
              Parent Location <span className="font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
            </label>
            <select
              name="parent"
              defaultValue={editing?.parent ?? defaultParentId ?? ''}
              className="w-full px-3 py-2 text-xs rounded-lg outline-none"
              style={{ border: '1px solid #D1D5DB', color: '#111827' }}
            >
              <option value="">— None (top level) —</option>
              {parentOptions.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <Field
            label="Temperature" name="temperature" placeholder="e.g. 2-8°C or -20°C"
            hint="(optional)" defaultValue={editing?.temperature}
          />

          {/* Notes textarea */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
              Notes <span className="font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
            </label>
            <textarea
              name="notes"
              rows={3}
              placeholder="Any additional notes about this location..."
              defaultValue={editing?.notes}
              className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none"
              style={{ border: '1px solid #D1D5DB', color: '#111827' }}
            />
          </div>

          {state.message && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
              {state.message}
            </p>
          )}

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
              {pending ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add xellabs-frontend/app/dashboard/storage/_components/StorageModal.tsx
git commit -m "feat: storage location create/edit modal"
```

---

## Task 3: StorageTree

**Files:**
- Create: `xellabs-frontend/app/dashboard/storage/_components/StorageTree.tsx`

**Interfaces:**
- Consumes: `StorageLocation` from `@/app/actions/storage`
- Produces exported component with props:
  ```ts
  {
    locations: StorageLocation[]          // flat list from API
    selectedId: number | null
    onSelect: (id: number) => void
    onAddChild: (parentId: number) => void
    onAddRoot: () => void
  }
  ```
- Exports helper: `buildTree(locations: StorageLocation[]): StorageNode[]`
  ```ts
  type StorageNode = StorageLocation & { children: StorageNode[] }
  ```

- [ ] **Step 1: Create StorageTree.tsx**

```tsx
// xellabs-frontend/app/dashboard/storage/_components/StorageTree.tsx
'use client'
import { useState } from 'react'
import type { StorageLocation } from '@/app/actions/storage'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export type StorageNode = StorageLocation & { children: StorageNode[] }

export function buildTree(locations: StorageLocation[]): StorageNode[] {
  const map = new Map<number, StorageNode>()
  locations.forEach(l => map.set(l.id, { ...l, children: [] }))
  const roots: StorageNode[] = []
  map.forEach(node => {
    if (node.parent === null) {
      roots.push(node)
    } else {
      const parent = map.get(node.parent)
      if (parent) parent.children.push(node)
      else roots.push(node) // orphan — treat as root
    }
  })
  return roots
}

const TYPE_ICONS: Record<string, string> = {
  room:    'meeting_room',
  fridge:  'thermostat',
  freezer: 'ac_unit',
  cabinet: 'inventory_2',
  shelf:   'view_agenda',
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
  onAddChild,
}: {
  node: StorageNode
  depth: number
  selectedId: number | null
  onSelect: (id: number) => void
  onAddChild: (parentId: number) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const isSelected = selectedId === node.id
  const hasChildren = node.children.length > 0
  const icon = TYPE_ICONS[node.location_type] ?? 'place'

  return (
    <div>
      <div
        className="flex items-center gap-1 group"
        style={{
          paddingLeft: 12 + depth * 16,
          paddingRight: 8,
          paddingTop: 5,
          paddingBottom: 5,
          cursor: 'pointer',
          borderLeft: isSelected ? '2px solid #0154FC' : '2px solid transparent',
          backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
          borderRadius: '0 6px 6px 0',
        }}
        onClick={() => onSelect(node.id)}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {hasChildren
            ? <MI name={expanded ? 'expand_more' : 'chevron_right'} size={14} color={isSelected ? '#0154FC' : '#9CA3AF'} />
            : <span style={{ width: 14 }} />
          }
        </button>

        {/* Type icon */}
        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
          style={{ backgroundColor: isSelected ? '#DBEAFE' : '#F3F4F6' }}>
          <MI name={icon} size={12} color={isSelected ? '#0154FC' : '#6B7280'} />
        </div>

        {/* Name */}
        <span className="flex-1 text-xs truncate"
          style={{ fontWeight: isSelected ? 600 : 400, color: isSelected ? '#0154FC' : '#374151' }}>
          {node.name}
        </span>

        {/* Child count badge */}
        {hasChildren && (
          <span className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: isSelected ? '#DBEAFE' : '#F3F4F6', color: isSelected ? '#0154FC' : '#9CA3AF', fontSize: 10 }}>
            {node.children.length}
          </span>
        )}

        {/* Add child button — shows on hover */}
        <button
          onClick={e => { e.stopPropagation(); onAddChild(node.id) }}
          className="opacity-0 group-hover:opacity-100"
          title="Add child location"
          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', borderRadius: 4, flexShrink: 0 }}
        >
          <MI name="add" size={13} color="#9CA3AF" />
        </button>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function StorageTree({
  locations,
  selectedId,
  onSelect,
  onAddChild,
  onAddRoot,
}: {
  locations: StorageLocation[]
  selectedId: number | null
  onSelect: (id: number) => void
  onAddChild: (parentId: number) => void
  onAddRoot: () => void
}) {
  const tree = buildTree(locations)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tree header */}
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF', letterSpacing: '0.05em' }}>
          Locations
        </span>
        <button
          onClick={onAddRoot}
          title="New top-level location"
          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg"
          style={{ backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          <MI name="add" size={13} color="#fff" />
          New
        </button>
      </div>

      {/* Tree body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <MI name="storage" size={28} color="#D1D5DB" />
            <p className="mt-2 text-xs" style={{ color: '#9CA3AF' }}>No locations yet</p>
            <button
              onClick={onAddRoot}
              className="mt-2 text-xs font-medium"
              style={{ color: '#0154FC', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              + Add first location
            </button>
          </div>
        ) : (
          tree.map(node => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
            />
          ))
        )}
      </div>

      {/* Footer count */}
      <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6' }}>
        <p style={{ fontSize: 10, color: '#9CA3AF' }}>{locations.length} location{locations.length !== 1 ? 's' : ''}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add xellabs-frontend/app/dashboard/storage/_components/StorageTree.tsx
git commit -m "feat: storage tree navigator with collapsible hierarchy"
```

---

## Task 4: StorageDetail

**Files:**
- Create: `xellabs-frontend/app/dashboard/storage/_components/StorageDetail.tsx`

**Interfaces:**
- Consumes: `StorageLocation` from `@/app/actions/storage`, `StorageNode` from `./StorageTree`
- Props:
  ```ts
  {
    location: StorageLocation | null        // null = nothing selected
    allLocations: StorageLocation[]         // to find parent name + children
    onEdit: (loc: StorageLocation) => void
    onDelete: (id: number) => void
    onSelectChild: (id: number) => void
  }
  ```

- [ ] **Step 1: Create StorageDetail.tsx**

```tsx
// xellabs-frontend/app/dashboard/storage/_components/StorageDetail.tsx
'use client'
import { useState } from 'react'
import type { StorageLocation } from '@/app/actions/storage'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const TYPE_ICONS: Record<string, string> = {
  room:    'meeting_room',
  fridge:  'thermostat',
  freezer: 'ac_unit',
  cabinet: 'inventory_2',
  shelf:   'view_agenda',
}

const TYPE_LABELS: Record<string, string> = {
  room: 'Room', fridge: 'Refrigerator', freezer: 'Freezer', cabinet: 'Cabinet', shelf: 'Shelf',
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-2" style={{ borderBottom: '1px solid #F9FAFB' }}>
      <span className="text-xs w-32 shrink-0" style={{ color: '#9CA3AF' }}>{label}</span>
      <span className="text-xs" style={{ color: '#111827' }}>{value || '—'}</span>
    </div>
  )
}

export default function StorageDetail({
  location,
  allLocations,
  onEdit,
  onDelete,
  onSelectChild,
}: {
  location: StorageLocation | null
  allLocations: StorageLocation[]
  onEdit: (loc: StorageLocation) => void
  onDelete: (id: number) => void
  onSelectChild: (id: number) => void
}) {
  const [tab, setTab] = useState<'sublocations' | 'info'>('sublocations')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!location) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' }}>
        <MI name="storage" size={40} color="#D1D5DB" />
        <p className="mt-3 text-sm font-medium" style={{ color: '#6B7280' }}>Select a location</p>
        <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Choose a storage location from the tree to view details</p>
      </div>
    )
  }

  const children = allLocations.filter(l => l.parent === location.id)
  const parent = location.parent ? allLocations.find(l => l.id === location.parent) : null
  const icon = TYPE_ICONS[location.location_type] ?? 'place'
  const typeLabel = TYPE_LABELS[location.location_type] ?? location.location_type

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#F9FAFB', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #E5E7EB', padding: '16px 20px' }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#EFF6FF' }}>
              <MI name={icon} size={20} color="#0154FC" />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: '#111827' }}>{location.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: '#EFF6FF', color: '#0154FC' }}>
                  {typeLabel}
                </span>
                {location.temperature && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: '#6B7280' }}>
                    <MI name="thermostat" size={13} color="#6B7280" />
                    {location.temperature}
                  </span>
                )}
                {parent && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: '#9CA3AF' }}>
                    <MI name="subdirectory_arrow_right" size={13} color="#9CA3AF" />
                    {parent.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(location)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}
            >
              <MI name="edit" size={13} color="#374151" />
              Edit
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ border: '1px solid #FECACA', color: '#DC2626', backgroundColor: '#FEF2F2', cursor: 'pointer' }}
              >
                <MI name="delete" size={13} color="#DC2626" />
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: '#DC2626' }}>Confirm?</span>
                <button
                  onClick={() => { onDelete(location.id); setConfirmDelete(false) }}
                  className="text-xs font-medium px-2 py-1 rounded"
                  style={{ backgroundColor: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs px-2 py-1 rounded"
                  style={{ border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}
                >
                  No
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #E5E7EB', paddingLeft: 20 }}>
        <div className="flex gap-1">
          {([['sublocations', 'Sub-locations', children.length], ['info', 'Info', null]] as const).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2.5"
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: tab === key ? '2px solid #0154FC' : '2px solid transparent',
                color: tab === key ? '#0154FC' : '#6B7280',
              }}
            >
              {label}
              {count !== null && count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-xs"
                  style={{ backgroundColor: tab === key ? '#EFF6FF' : '#F3F4F6', color: tab === key ? '#0154FC' : '#6B7280', fontSize: 10 }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        {tab === 'sublocations' && (
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
                  const grandchildren = allLocations.filter(l => l.parent === child.id).length
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
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === 'info' && (
          <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #E5E7EB' }}>
            <InfoRow label="Name" value={location.name} />
            <InfoRow label="Type" value={typeLabel} />
            <InfoRow label="Parent" value={parent?.name ?? 'None (top level)'} />
            <InfoRow label="Temperature" value={location.temperature} />
            <InfoRow label="Notes" value={location.notes} />
            <InfoRow label="ID" value={String(location.id)} />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add xellabs-frontend/app/dashboard/storage/_components/StorageDetail.tsx
git commit -m "feat: storage detail panel with tabs"
```

---

## Task 5: StorageShell + Page

**Files:**
- Create: `xellabs-frontend/app/dashboard/storage/_components/StorageShell.tsx`
- Modify: `xellabs-frontend/app/dashboard/storage/page.tsx`

**Interfaces:**
- Consumes: all components + actions from Tasks 1–4
- `StorageShell` props: `{ initialLocations: StorageLocation[] }`

- [ ] **Step 1: Create StorageShell.tsx**

```tsx
// xellabs-frontend/app/dashboard/storage/_components/StorageShell.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteStorageLocation, type StorageLocation } from '@/app/actions/storage'
import StorageTree from './StorageTree'
import StorageDetail from './StorageDetail'
import StorageModal from './StorageModal'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export default function StorageShell({ initialLocations }: { initialLocations: StorageLocation[] }) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [modal, setModal] = useState<{ editing: StorageLocation | null; defaultParentId?: number | null } | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  const selected = initialLocations.find(l => l.id === selectedId) ?? null

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function handleDone(msg: string) {
    showToast(true, msg)
    router.refresh()
  }

  async function handleDelete(id: number) {
    const result = await deleteStorageLocation(id)
    showToast(result.success, result.message)
    if (result.success) {
      if (selectedId === id) setSelectedId(null)
      router.refresh()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F5F6FA' }}>
      {/* Page header */}
      <div className="flex items-center justify-between px-5 py-3" style={{ backgroundColor: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <div>
          <h1 className="text-lg font-bold" style={{ color: '#111827' }}>Storage Management</h1>
          <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Manage laboratory storage locations and their contents</p>
        </div>
        <button
          onClick={() => setModal({ editing: null, defaultParentId: null })}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-white"
          style={{ backgroundColor: '#0154FC', border: 'none', cursor: 'pointer' }}
        >
          <MI name="add" size={15} color="#fff" />
          New Location
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mx-5 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{
            backgroundColor: toast.ok ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${toast.ok ? '#A7F3D0' : '#FECACA'}`,
            color: toast.ok ? '#065F46' : '#991B1B',
          }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#10B981' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* Split explorer */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', margin: '12px 20px 20px', gap: 12 }}>
        {/* Left tree panel */}
        <div style={{ width: 280, flexShrink: 0, backgroundColor: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <StorageTree
            locations={initialLocations}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAddChild={(parentId) => setModal({ editing: null, defaultParentId: parentId })}
            onAddRoot={() => setModal({ editing: null, defaultParentId: null })}
          />
        </div>

        {/* Right detail panel */}
        <div style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', display: 'flex' }}>
          <StorageDetail
            location={selected}
            allLocations={initialLocations}
            onEdit={(loc) => setModal({ editing: loc })}
            onDelete={handleDelete}
            onSelectChild={setSelectedId}
          />
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <StorageModal
          editing={modal.editing}
          defaultParentId={modal.defaultParentId}
          allLocations={initialLocations}
          onClose={() => setModal(null)}
          onDone={handleDone}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update page.tsx**

```tsx
// xellabs-frontend/app/dashboard/storage/page.tsx
import { getStorageLocations } from '@/app/actions/storage'
import StorageShell from './_components/StorageShell'

export default async function StoragePage() {
  const locations = await getStorageLocations()
  return <StorageShell initialLocations={locations} />
}
```

- [ ] **Step 3: Commit**

```bash
git add xellabs-frontend/app/dashboard/storage/_components/StorageShell.tsx
git add xellabs-frontend/app/dashboard/storage/page.tsx
git commit -m "feat: storage management page — split explorer UI with full CRUD"
```

---

## Task 6: Verify & Rebuild

- [ ] **Step 1: Check API URL is correct**

```bash
docker exec xellabs-lims-django-1 python manage.py shell -c "
from django.urls import reverse
try:
    print(reverse('storagelocation-list'))
except Exception as e:
    print('Error:', e)
"
```

Expected output: `/api/inventory/storage-locations/`

If different, update the path in `xellabs-frontend/app/actions/storage.ts` (all 5 occurrences).

- [ ] **Step 2: Rebuild and restart frontend**

```powershell
docker compose stop frontend
docker compose rm -f frontend
docker compose up -d frontend
```

- [ ] **Step 3: Check frontend logs for errors**

```powershell
docker logs xellabs-lims-frontend-1 --tail 30
```

Expected: `✓ Ready` with no TypeScript errors.

- [ ] **Step 4: Smoke test in browser**

Navigate to `http://localhost:3000/dashboard/storage`

Verify:
1. Page loads with split layout (tree left, detail right)
2. Empty state shows in both panels
3. "New Location" button opens modal
4. Create a Room — appears in tree
5. Click room in tree — detail panel shows with Info tab
6. Add a child Fridge under the Room — appears nested in tree
7. Click Edit — modal pre-fills correctly
8. Delete a location — removed from tree, toast shows
9. No `#14B8A6` teal anywhere — all blues are `#0154FC`

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: storage management UI complete — split explorer, CRUD, #0154FC theme"
```

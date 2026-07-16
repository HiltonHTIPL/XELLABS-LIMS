'use client'
import { useActionState, useState, useEffect } from 'react'
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
  label, name, placeholder, required, error, defaultValue, hint, type = 'text', onClearError,
}: {
  label: string; name: string; placeholder?: string; required?: boolean
  error?: string; defaultValue?: string; hint?: string; type?: string; onClearError?: () => void
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
        onChange={onClearError}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
        style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
      />
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

const TYPE_OPTIONS = [
  { value: 'building', label: 'Building' },
  { value: 'room',     label: 'Room' },
  { value: 'fridge',   label: 'Refrigerator' },
  { value: 'freezer',  label: 'Freezer' },
  { value: 'cabinet',  label: 'Cabinet' },
  { value: 'shelf',    label: 'Shelf' },
  { value: 'box',      label: 'Box' },
]

// Mirrors StorageLocation.ALLOWED_PARENT_TYPES (inventory/models.py) — kept in
// sync manually since this is a small, stable, rarely-changed domain rule; the
// backend serializer is still the real enforcement point (this is just so the
// Parent Location dropdown doesn't even offer an invalid combination).
const ALLOWED_PARENT_TYPES: Record<string, Set<string>> = {
  building: new Set(),
  room: new Set(['building']),
  fridge: new Set(['building', 'room']),
  freezer: new Set(['building', 'room']),
  cabinet: new Set(['building', 'room']),
  shelf: new Set(['building', 'room', 'fridge', 'freezer', 'cabinet', 'shelf']),
  box: new Set(['fridge', 'freezer', 'cabinet', 'shelf']),
}

// Only fridge/freezer/cabinet/shelf map to senaite.storage's StorageContainer,
// the one content type with a real Temperature field — building/room/box have
// nothing to send it to.
const TYPES_WITH_TEMPERATURE = new Set(['fridge', 'freezer', 'cabinet', 'shelf'])

export default function StorageModal({
  open,
  editing,
  defaultParentId,
  allLocations,
  onClose,
  onDone,
}: {
  open: boolean
  editing: StorageLocation | null
  defaultParentId?: number | null
  allLocations: StorageLocation[]
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const isEdit = editing !== null
  const [selectedType, setSelectedType] = useState<string>(editing?.location_type ?? 'building')
  const [selectedParent, setSelectedParent] = useState<number | null>(
    editing?.parent ?? defaultParentId ?? null
  )

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  useEffect(() => {
    if (state.errors) {
      const fe: Record<string, string> = {}
      for (const [k, msgs] of Object.entries(state.errors)) { if (msgs?.length) fe[k] = msgs[0] }
      // fieldErrors is independently cleared per-field via onClearError below, so it
      // can't be a plain derived value — it needs its own lifecycle synced from state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFieldErrors(fe)
    }
  }, [state])

  // Exclude self AND all descendants from parent options to avoid cycles —
  // choosing a child (or grandchild) as parent would break the tree and send
  // ancestor-walking code into an infinite loop.
  const excludedIds = (() => {
    if (!editing) return new Set<number>()
    const childrenByParent = new Map<number, number[]>()
    for (const l of allLocations) {
      if (l.parent != null) {
        const arr = childrenByParent.get(l.parent) ?? []
        arr.push(l.id)
        childrenByParent.set(l.parent, arr)
      }
    }
    const excluded = new Set<number>([editing.id])
    const queue = [editing.id]
    while (queue.length) {
      for (const childId of childrenByParent.get(queue.shift()!) ?? []) {
        if (!excluded.has(childId)) { excluded.add(childId); queue.push(childId) }
      }
    }
    return excluded
  })()
  // Only offer parents whose type this location is actually allowed to sit
  // under (mirrors the backend's StorageLocationSerializer.validate()) —
  // e.g. selecting "Box" only offers fridges/freezers/cabinets/shelves.
  const allowedParentTypes = ALLOWED_PARENT_TYPES[selectedType] ?? new Set<string>()
  const parentOptions = allLocations
    .filter(l => !excludedIds.has(l.id))
    .filter(l => l.location_type !== 'box_location' && allowedParentTypes.has(l.location_type))

  // If the type change made the currently-selected parent invalid, clear it
  // rather than silently submit a combination the backend will reject.
  useEffect(() => {
    if (selectedParent == null) return
    const parent = allLocations.find(l => l.id === selectedParent)
    if (!parent || !allowedParentTypes.has(parent.location_type)) setSelectedParent(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType])

  return (
    <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, zIndex: 200, pointerEvents: open ? 'auto' : 'none' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: open ? 1 : 0, transition: 'opacity 0.25s ease' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 480, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
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

        <form action={action} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          <Field
            label="Name" name="name" placeholder="e.g. Fridge A" required
            error={fieldErrors.name} defaultValue={editing?.name}
            onClearError={() => setFieldErrors(p => { const n={...p}; delete n.name; return n })}
          />

          {/* Type select */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
              Type <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              name="location_type"
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg outline-none"
              style={{ border: `1px solid ${fieldErrors.location_type ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
            >
              {TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {fieldErrors.location_type && (
              <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{fieldErrors.location_type}</p>
            )}
          </div>

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
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                  style={{ border: `1px solid ${state.errors?.columns ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
                />
                {state.errors?.columns && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.columns[0]}</p>}
              </div>
            </div>
          )}

          {/* Parent select — a Building is always top-level (no parent possible);
              every other type requires one, so there's no "None" option for them. */}
          {selectedType === 'building' ? (
            <p className="text-xs" style={{ color: '#9CA3AF' }}>
              A Building is always top-level — it has no parent location.
            </p>
          ) : (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                Parent Location <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                name="parent"
                required
                value={selectedParent ?? ''}
                onChange={e => setSelectedParent(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                style={{ border: `1px solid ${fieldErrors.parent ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
              >
                <option value="">— Select a parent —</option>
                {parentOptions.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.location_type})</option>
                ))}
              </select>
              {fieldErrors.parent && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{fieldErrors.parent}</p>}
            </div>
          )}

          {TYPES_WITH_TEMPERATURE.has(selectedType) && (
            <Field
              label="Temperature" name="temperature" placeholder="e.g. 2-8°C or -20°C"
              hint="(optional)" defaultValue={editing?.temperature}
            />
          )}

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

          {/* Description — sent to SENAITE on every mapped content type */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
              Description <span className="font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
            </label>
            <textarea name="description" rows={2} placeholder="General description"
              defaultValue={editing?.description ?? ''}
              className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none"
              style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
          </div>

          {/* Building-only fields — StorageFacility supports Phone/EmailAddress/Address */}
          {selectedType === 'building' && (
            <>
              <Field
                label="Phone" name="phone" placeholder="e.g. 4567795512"
                hint="(optional)" defaultValue={editing?.phone}
              />
              <Field
                label="Email" name="email" type="email" placeholder="e.g. lab@example.com"
                hint="(optional)" error={fieldErrors.email} defaultValue={editing?.email}
                onClearError={() => setFieldErrors(p => { const n={...p}; delete n.email; return n })}
              />
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                  Address <span className="font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
                </label>
                <input name="address" type="text" placeholder="Physical address"
                  defaultValue={editing?.address ?? ''}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                  style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
              </div>
            </>
          )}

          {state.message && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
              {state.message}
            </p>
          )}

        <div className="flex items-center justify-end gap-2 shrink-0 px-5 py-4" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#fff' }}>
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

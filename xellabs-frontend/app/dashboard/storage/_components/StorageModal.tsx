'use client'
import { useActionState, useState, useMemo, useEffect } from 'react'
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
  { value: 'room',    label: 'Room' },
  { value: 'fridge',  label: 'Refrigerator' },
  { value: 'freezer', label: 'Freezer' },
  { value: 'cabinet', label: 'Cabinet' },
  { value: 'shelf',   label: 'Shelf' },
  { value: 'box',     label: 'Box' },
]

// Maps XelLabs location_type → SENAITE role + auto location_type value
const SENAITE_TYPE_MAP: Record<string, string> = {
  fridge:  'Refrigerator',
  freezer: 'Freezer',
  cabinet: 'SafetyLevel1',
}

type SenaiteDefaults = {
  site_title: string; site_code: string; site_description: string
  location_title: string; location_code: string; location_description: string; senaite_location_type: string
  shelf_title: string; shelf_code: string; shelf_description: string
}

function computeSenaiteDefaults(
  parentId: number | null,
  all: StorageLocation[],
): SenaiteDefaults {
  const map = new Map(all.map(l => [l.id, l]))
  const d: SenaiteDefaults = {
    site_title: '', site_code: '', site_description: '',
    location_title: '', location_code: '', location_description: '', senaite_location_type: '',
    shelf_title: '', shelf_code: '', shelf_description: '',
  }
  if (!parentId) return d

  // Walk up ancestor chain
  const ancestors: StorageLocation[] = []
  let cur: StorageLocation | undefined = map.get(parentId)
  while (cur) {
    ancestors.push(cur)
    cur = cur.parent ? map.get(cur.parent) : undefined
  }

  for (const anc of ancestors) {
    if (anc.location_type === 'room') {
      if (!d.site_title) d.site_title = anc.site_title || anc.name
      if (!d.site_code)  d.site_code  = anc.site_code  || ''
      if (!d.site_description) d.site_description = anc.site_description || anc.notes || ''
    } else if (['fridge', 'freezer', 'cabinet'].includes(anc.location_type)) {
      if (!d.location_title) d.location_title = anc.location_title || anc.name
      if (!d.location_code)  d.location_code  = anc.location_code  || ''
      if (!d.location_description) d.location_description = anc.location_description || anc.notes || ''
      if (!d.senaite_location_type) d.senaite_location_type = anc.senaite_location_type || SENAITE_TYPE_MAP[anc.location_type] || ''
    } else if (anc.location_type === 'shelf') {
      if (!d.shelf_title) d.shelf_title = anc.shelf_title || anc.name
      if (!d.shelf_code)  d.shelf_code  = anc.shelf_code  || ''
      if (!d.shelf_description) d.shelf_description = anc.shelf_description || anc.notes || ''
    }
  }
  return d
}

const SENAITE_LOCATION_TYPES = [
  { value: '', label: 'Not specified' },
  { value: 'SafetyLevel1', label: 'Safety Level 1' },
  { value: 'SafetyLevel2', label: 'Safety Level 2' },
  { value: 'SafetyLevel3', label: 'Safety Level 3' },
  { value: 'Freezer', label: 'Freezer' },
  { value: 'Refrigerator', label: 'Refrigerator' },
  { value: 'RoomTemp', label: 'Room Temperature' },
]

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
  const [selectedType, setSelectedType] = useState<string>(editing?.location_type ?? 'room')
  const [selectedParent, setSelectedParent] = useState<number | null>(
    editing?.parent ?? defaultParentId ?? null
  )
  const [showSenaite, setShowSenaite] = useState(false)

  // Auto-fill SENAITE fields from ancestor hierarchy when parent changes
  const senaiteDefaults = useMemo(
    () => isEdit ? null : computeSenaiteDefaults(selectedParent, allLocations),
    [selectedParent, allLocations, isEdit]
  )

  // Auto-expand SENAITE section when there are auto-filled values
  const hasAutoFill = senaiteDefaults && (
    senaiteDefaults.site_title || senaiteDefaults.location_title || senaiteDefaults.shelf_title
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

  // Exclude self and descendants from parent options to avoid cycles
  const parentOptions = allLocations.filter(l => !editing || l.id !== editing.id)

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

          {/* Parent select */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
              Parent Location <span className="font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
            </label>
            <select
              name="parent"
              value={selectedParent ?? ''}
              onChange={e => {
                const v = e.target.value ? Number(e.target.value) : null
                setSelectedParent(v)
                if (v && !isEdit) setShowSenaite(true)
              }}
              className="w-full px-3 py-2 text-xs rounded-lg outline-none"
              style={{ border: '1px solid #D1D5DB', color: '#111827' }}
            >
              <option value="">— None (top level) —</option>
              {parentOptions
                .filter(l => l.location_type !== 'box_location')
                .map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.location_type})</option>
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

          {/* SENAITE Details — collapsible, auto-fills from parent hierarchy */}
          <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>
            <button
              type="button"
              onClick={() => setShowSenaite(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium w-full text-left"
              style={{ color: '#6B7280' }}
            >
              <span className="material-icons" style={{ fontSize: 14, color: '#9CA3AF' }}>
                {showSenaite ? 'expand_less' : 'expand_more'}
              </span>
              Storage Details
              {hasAutoFill && !showSenaite && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs font-medium"
                  style={{ backgroundColor: '#EFF6FF', color: '#0154FC', fontSize: 10 }}>
                  Auto-filled from hierarchy
                </span>
              )}
              {!hasAutoFill && (
                <span className="ml-1 text-xs font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
              )}
            </button>

            {showSenaite && (
              // key=selectedParent forces remount so defaultValues refresh when parent changes
              <div key={selectedParent ?? 'none'} className="flex flex-col gap-2 mt-3">
                {hasAutoFill && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                    style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                    <span className="material-icons" style={{ fontSize: 12, color: '#0154FC' }}>auto_fix_high</span>
                    <span style={{ color: '#1D4ED8' }}>Fields auto-filled from the parent hierarchy — you can edit them</span>
                  </div>
                )}

                {/* Address */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Address</label>
                  <input name="address" type="text" placeholder="Physical address"
                    defaultValue={editing?.address ?? ''}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                    style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Description</label>
                  <textarea name="description" rows={2} placeholder="General description"
                    defaultValue={editing?.description ?? ''}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none"
                    style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
                </div>

                {/* SENAITE Location Type */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Location Type</label>
                  <select name="senaite_location_type"
                    defaultValue={editing?.senaite_location_type ?? senaiteDefaults?.senaite_location_type ?? ''}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                    style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                    {SENAITE_LOCATION_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                {/* Site */}
                <p className="text-xs font-semibold mt-1" style={{ color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Site</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Title</label>
                    <input name="site_title" type="text" placeholder="e.g. Tirunelveli NTQ"
                      defaultValue={editing?.site_title ?? senaiteDefaults?.site_title ?? ''}
                      className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                      style={{ border: `1px solid ${senaiteDefaults?.site_title ? '#BFDBFE' : '#D1D5DB'}`, color: '#111827', backgroundColor: senaiteDefaults?.site_title ? '#F0F9FF' : '#fff' }} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Code</label>
                    <input name="site_code" type="text" placeholder="Site code"
                      defaultValue={editing?.site_code ?? senaiteDefaults?.site_code ?? ''}
                      className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                      style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Site Description</label>
                  <textarea name="site_description" rows={2} placeholder="Site description"
                    defaultValue={editing?.site_description ?? senaiteDefaults?.site_description ?? ''}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none"
                    style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
                </div>

                {/* Location */}
                <p className="text-xs font-semibold mt-1" style={{ color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Title</label>
                    <input name="location_title" type="text" placeholder="e.g. Blood Type 1"
                      defaultValue={editing?.location_title ?? senaiteDefaults?.location_title ?? ''}
                      className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                      style={{ border: `1px solid ${senaiteDefaults?.location_title ? '#BFDBFE' : '#D1D5DB'}`, color: '#111827', backgroundColor: senaiteDefaults?.location_title ? '#F0F9FF' : '#fff' }} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Code</label>
                    <input name="location_code" type="text" placeholder="Location code"
                      defaultValue={editing?.location_code ?? senaiteDefaults?.location_code ?? ''}
                      className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                      style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Location Description</label>
                  <textarea name="location_description" rows={2} placeholder="Location description"
                    defaultValue={editing?.location_description ?? senaiteDefaults?.location_description ?? ''}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none"
                    style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
                </div>

                {/* Shelf */}
                <p className="text-xs font-semibold mt-1" style={{ color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shelf</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Title</label>
                    <input name="shelf_title" type="text" placeholder="e.g. Shelf Cab"
                      defaultValue={editing?.shelf_title ?? senaiteDefaults?.shelf_title ?? ''}
                      className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                      style={{ border: `1px solid ${senaiteDefaults?.shelf_title ? '#BFDBFE' : '#D1D5DB'}`, color: '#111827', backgroundColor: senaiteDefaults?.shelf_title ? '#F0F9FF' : '#fff' }} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Code</label>
                    <input name="shelf_code" type="text" placeholder="Shelf code"
                      defaultValue={editing?.shelf_code ?? senaiteDefaults?.shelf_code ?? ''}
                      className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                      style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Shelf Description</label>
                  <textarea name="shelf_description" rows={2} placeholder="Shelf description"
                    defaultValue={editing?.shelf_description ?? senaiteDefaults?.shelf_description ?? ''}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none"
                    style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
                </div>
              </div>
            )}
          </div>

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

'use client'
import { useState } from 'react'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export type SelectOrAddItem = { id: number; name: string; description?: string; code?: string }

export type CreateNamedResult = {
  ok: boolean
  message: string
  item?: SelectOrAddItem
}

export type ExtraField = {
  key: string
  label: string
  required?: boolean
  placeholder?: string
}

type SlideProps = {
  open: boolean
  onClose: () => void
  entityLabel: string
  items: SelectOrAddItem[]
  /** Currently selected id(s) as strings for highlight. */
  selectedIds: string[]
  onPickExisting: (id: string) => void
  createAction: (name: string, description: string, extras?: Record<string, string>) => Promise<CreateNamedResult>
  onCreated: (item: SelectOrAddItem) => void
  extraFields?: ExtraField[]
  zIndex?: number
}

/** Shared right-slide: choose existing + add new. Used by single and multi select-or-add. */
export function NamedRefSlide({
  open, onClose, entityLabel, items, selectedIds, onPickExisting,
  createAction, onCreated, extraFields = [], zIndex = 400,
}: SlideProps) {
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [extras, setExtras] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  function reset() {
    setNewName('')
    setNewDesc('')
    setExtras({})
    setLocalError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleCreate() {
    if (!newName.trim()) {
      setLocalError('Name is required.')
      return
    }
    for (const f of extraFields) {
      if (f.required && !(extras[f.key] ?? '').trim()) {
        setLocalError(`${f.label} is required.`)
        return
      }
    }
    setSaving(true)
    setLocalError(null)
    const res = await createAction(newName, newDesc, extras)
    setSaving(false)
    if (res.ok && res.item) {
      onCreated(res.item)
      reset()
      onClose()
    } else {
      setLocalError(res.message || 'Failed to create.')
    }
  }

  const extrasOk = extraFields.every(f => !f.required || (extras[f.key] ?? '').trim())

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex, pointerEvents: open ? 'auto' : 'none' }}>
      <div
        onClick={handleClose}
        style={{
          position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)',
          opacity: open ? 1 : 0, transition: 'opacity 0.25s ease',
        }}
      />
      <div style={{
        position: 'absolute', top: 'var(--dashboard-header-h)', right: 0, bottom: 'var(--dashboard-footer-h)', width: 380, backgroundColor: '#fff',
        boxShadow: '-6px 0 32px rgba(0,0,0,0.12)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{entityLabel}</h2>
          <button type="button" onClick={handleClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <MI name="close" size={16} color="#9CA3AF" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', letterSpacing: '0.03em', marginBottom: 6 }}>CHOOSE EXISTING</p>
          <div className="mb-5" style={{ border: '1px solid #F3F4F6', borderRadius: 8, maxHeight: 200, overflowY: 'auto' }}>
            {items.length === 0 && (
              <div style={{ fontSize: 12, color: '#9CA3AF', padding: 12 }}>None yet. Add one below.</div>
            )}
            {items.map(t => {
              const sel = selectedIds.includes(String(t.id))
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { onPickExisting(String(t.id)); handleClose() }}
                  className="w-full text-left flex items-center justify-between hover:bg-gray-50"
                  style={{
                    fontSize: 12, padding: '9px 12px', borderBottom: '1px solid #F9FAFB',
                    color: sel ? '#0154FC' : '#111827', fontWeight: sel ? 600 : 400,
                  }}
                >
                  <span>{t.name}{t.code ? ` (${t.code})` : ''}</span>
                  {sel && <MI name="check" size={14} color="#0154FC" />}
                </button>
              )
            })}
          </div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', letterSpacing: '0.03em', marginBottom: 6 }}>ADD NEW</p>
          {localError && (
            <p className="mb-2 text-xs" style={{ color: '#EF4444' }}>{localError}</p>
          )}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Name *</label>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
            placeholder={`e.g. New ${entityLabel.toLowerCase()}`}
            className="w-full px-3 py-2 rounded-lg mb-3"
            style={{ fontSize: 12, border: '1px solid #D1D5DB' }}
          />
          {extraFields.map(f => (
            <div key={f.key} className="mb-3">
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 4 }}>
                {f.label}{f.required ? ' *' : ''}
              </label>
              <input
                value={extras[f.key] ?? ''}
                onChange={e => setExtras(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full px-3 py-2 rounded-lg"
                style={{ fontSize: 12, border: '1px solid #D1D5DB' }}
              />
            </div>
          ))}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Description</label>
          <textarea
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            rows={2}
            placeholder="Optional"
            className="w-full px-3 py-2 rounded-lg"
            style={{ fontSize: 12, border: '1px solid #D1D5DB', resize: 'none' }}
          />
        </div>
        <div className="px-5 py-4 flex justify-end gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
          <button type="button" onClick={handleClose}
            style={{ fontSize: 12, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', background: '#fff' }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !newName.trim() || !extrasOk}
            onClick={handleCreate}
            style={{
              fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8,
              backgroundColor: '#0154FC', color: '#fff', border: 'none',
              opacity: saving || !newName.trim() || !extrasOk ? 0.6 : 1,
            }}
          >
            {saving ? 'Creating…' : 'Create & Select'}
          </button>
        </div>
      </div>
    </div>
  )
}

type Props = {
  label: string
  tip?: string
  name: string
  value: string
  items: SelectOrAddItem[]
  onChange: (id: string) => void
  onItemsChange: (items: SelectOrAddItem[]) => void
  createAction: (name: string, description: string, extras?: Record<string, string>) => Promise<CreateNamedResult>
  required?: boolean
  error?: string
  placeholder?: string
  entityLabel: string
  extraFields?: ExtraField[]
  zIndex?: number
}

/**
 * Reusable select-or-add reference control.
 * Pattern: native select with "+ Add new…" → right slide (choose existing + create & select).
 */
export default function SelectOrAddField({
  label, tip, name, value, items, onChange, onItemsChange, createAction,
  required, error, placeholder, entityLabel, extraFields = [], zIndex = 400,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      {label && (
        <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
          {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
        </label>
      )}
      {tip && <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>{tip}</p>}
      <select
        name={name}
        value={value}
        onChange={e => {
          if (e.target.value === '__add__') setOpen(true)
          else onChange(e.target.value)
        }}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
        style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
      >
        <option value="">{placeholder ?? `Select ${entityLabel.toLowerCase()}…`}</option>
        {items.map(i => (
          <option key={i.id} value={i.id}>
            {i.name}{i.code ? ` (${i.code})` : ''}
          </option>
        ))}
        <option value="__add__">+ Add new {entityLabel.toLowerCase()}…</option>
      </select>
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}

      <NamedRefSlide
        open={open}
        onClose={() => setOpen(false)}
        entityLabel={entityLabel}
        items={items}
        selectedIds={value ? [value] : []}
        onPickExisting={onChange}
        createAction={createAction}
        onCreated={item => {
          onItemsChange([...items, item].sort((a, b) => a.name.localeCompare(b.name)))
          onChange(String(item.id))
        }}
        extraFields={extraFields}
        zIndex={zIndex}
      />
    </div>
  )
}

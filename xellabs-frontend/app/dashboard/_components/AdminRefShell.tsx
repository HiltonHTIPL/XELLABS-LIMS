'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'

// Reusable, config-driven CRUD shell for SENAITE "setup" reference data pages.
// One component drives every simple/medium Administration list (DRY): each page
// supplies its columns, field config, rows, and create/update server actions.

export type AdminFormState = { success?: boolean; message?: string; errors?: Record<string, string[]> }

export type RefOption = { uid: string; title: string }

export type FieldKind = 'text' | 'textarea' | 'number' | 'select' | 'multiselect'

export type FieldConfig = {
  name: string
  label: string
  kind: FieldKind
  required?: boolean
  placeholder?: string
  help?: string
  options?: RefOption[]      // select / multiselect
}

export type AdminRow = { uid: string; title: string;[k: string]: unknown }

export type AdminColumn = {
  key: string
  label: string
  width?: string
  render?: (row: AdminRow) => string
}

type Props = {
  title: string
  subtitle: string
  singularLabel: string
  icon: string
  columns: AdminColumn[]
  fields: FieldConfig[]
  rows: AdminRow[]
  createAction: (prev: AdminFormState, fd: FormData) => Promise<AdminFormState>
  updateAction: (uid: string, prev: AdminFormState, fd: FormData) => Promise<AdminFormState>
}

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

type FormVals = Record<string, string | string[]>

function blankVals(fields: FieldConfig[]): FormVals {
  const v: FormVals = {}
  for (const f of fields) v[f.name] = f.kind === 'multiselect' ? [] : ''
  return v
}

function rowToVals(row: AdminRow, fields: FieldConfig[]): FormVals {
  const v: FormVals = {}
  for (const f of fields) {
    const raw = row[f.name]
    if (f.kind === 'multiselect') {
      v[f.name] = Array.isArray(raw) ? (raw as string[]) : []
    } else {
      v[f.name] = raw == null ? '' : String(raw)
    }
  }
  return v
}

export default function AdminRefShell({
  title, subtitle, singularLabel, icon, columns, fields, rows, createAction, updateAction,
}: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AdminRow | null>(null)
  const [vals, setVals] = useState<FormVals>(blankVals(fields))
  const isEditing = editing !== null

  const [state, action, pending] = useActionState(
    async (prev: AdminFormState, fd: FormData) => {
      const uid = fd.get('_uid') as string | null
      const result = uid ? await updateAction(uid, prev, fd) : await createAction(prev, fd)
      if (result.success) {
        setShowForm(false); setEditing(null); setVals(blankVals(fields))
        router.refresh()
      }
      return result
    },
    {},
  )

  function openCreate() { setEditing(null); setVals(blankVals(fields)); setShowForm(true) }
  function openEdit(row: AdminRow) { setEditing(row); setVals(rowToVals(row, fields)); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditing(null) }
  function setVal(name: string, value: string | string[]) { setVals(prev => ({ ...prev, [name]: value })) }

  function toggleMulti(name: string, uid: string) {
    setVals(prev => {
      const cur = (prev[name] as string[]) ?? []
      return { ...prev, [name]: cur.includes(uid) ? cur.filter(u => u !== uid) : [...cur, uid] }
    })
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-3" style={{ flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>{title}</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>{subtitle}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New {singularLabel}
        </button>
      </div>

      {/* Drawer — full-viewport overlay (matches app-wide drawer convention) */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: showForm ? 'auto' : 'none' }}>
        <div onClick={closeForm} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showForm ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 460, maxWidth: '92vw', backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showForm ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEditing ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEditing ? 'edit' : icon} size={16} color={isEditing ? '#2563EB' : '#0154FC'} />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                {isEditing ? `Edit — ${editing.title}` : `New ${singularLabel}`}
              </h2>
            </div>
            <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
          </div>

          <form action={action} className="flex flex-col flex-1 min-h-0">
            {isEditing && <input type="hidden" name="_uid" value={editing.uid} />}
            {isEditing && editing.path != null && <input type="hidden" name="_path" value={String(editing.path)} />}
            {/* Serialize values into FormData via hidden inputs */}
            {fields.map(f =>
              f.kind === 'multiselect'
                ? (vals[f.name] as string[]).map(uid => <input key={`${f.name}-${uid}`} type="hidden" name={f.name} value={uid} />)
                : <input key={`h-${f.name}`} type="hidden" name={f.name} value={vals[f.name] as string} />,
            )}

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {fields.map(f => (
                <FieldInput
                  key={f.name}
                  field={f}
                  value={vals[f.name]}
                  error={state.errors?.[f.name]?.[0]}
                  onChange={v => setVal(f.name, v)}
                  onToggleMulti={uid => toggleMulti(f.name, uid)}
                />
              ))}
              {state.message && !state.success && (
                <p className="text-xs" style={{ color: '#DC2626' }}>{state.message}</p>
              )}
            </div>

            <div className="px-6 py-4 flex gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
              <button type="button" onClick={closeForm} className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium" style={{ border: '1px solid #D1D5DB', color: '#374151' }}>
                <MI name="close" size={13} color="#374151" /> Cancel
              </button>
              <div className="flex-1" />
              <button type="submit" disabled={pending}
                className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium text-white"
                style={{ backgroundColor: pending ? '#DBEAFE' : isEditing ? '#2563EB' : '#0154FC', cursor: pending ? 'not-allowed' : 'pointer' }}>
                <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
                {pending ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {state.success && (
        <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#DBEAFE', border: '1px solid #93C5FD', color: '#0154FC', flexShrink: 0 }}>
          <div className="flex items-center gap-2"><MI name="check_circle" size={13} color="#0154FC" /><span>{state.message}</span></div>
        </div>
      )}

      {/* Only this area scrolls; header/title bar above stays fixed. */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      {rows.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name={icon} size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No {title.toLowerCase()} yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create your first {singularLabel.toLowerCase()} to get started</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New {singularLabel}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              {columns.map(c => <col key={c.key} style={{ width: c.width ?? 'auto' }} />)}
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {columns.map(c => (
                  <th key={c.key} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{c.label}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.uid} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                  {columns.map((c, ci) => (
                    <td key={c.key} className="px-3 py-2 text-xs truncate" style={{ color: ci === 0 ? '#111827' : '#6B7280', fontWeight: ci === 0 ? 500 : 400 }}>
                      {(c.render ? c.render(row) : (row[c.key] == null ? '' : String(row[c.key]))) || '—'}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <button onClick={() => openEdit(row)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                      <MI name="edit" size={14} color="#6B7280" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{rows.length} {rows.length !== 1 ? `${singularLabel.toLowerCase()}s` : singularLabel.toLowerCase()}</p>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

function FieldInput({ field, value, error, onChange, onToggleMulti }: {
  field: FieldConfig
  value: string | string[]
  error?: string
  onChange: (v: string) => void
  onToggleMulti: (uid: string) => void
}) {
  const base = 'w-full px-3 py-2 text-xs rounded-lg outline-none'
  const style = { border: `1px solid ${error ? '#FCA5A5' : '#D1D5DB'}`, color: '#111827' } as const
  const label = (
    <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
      {field.label}{field.required && <span style={{ color: '#EF4444' }}> *</span>}
    </label>
  )

  if (field.kind === 'textarea') {
    return (
      <div>{label}
        <textarea rows={4} placeholder={field.placeholder} value={value as string}
          onChange={e => onChange(e.target.value)} className={`${base} resize-none`} style={style} />
        {field.help && <p className="mt-0.5" style={{ fontSize: 10, color: '#9CA3AF' }}>{field.help}</p>}
        {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
      </div>
    )
  }

  if (field.kind === 'select') {
    return (
      <div>{label}
        <select value={value as string} onChange={e => onChange(e.target.value)} className={base} style={style}>
          <option value="">— None —</option>
          {(field.options ?? []).map(o => <option key={o.uid} value={o.uid}>{o.title}</option>)}
        </select>
        {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
      </div>
    )
  }

  if (field.kind === 'multiselect') {
    const selected = (value as string[]) ?? []
    return (
      <div>{label}
        <div className="rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto" style={{ border: `1px solid ${error ? '#FCA5A5' : '#D1D5DB'}` }}>
          {(field.options ?? []).length === 0
            ? <p style={{ fontSize: 11, color: '#9CA3AF' }}>None available</p>
            : (field.options ?? []).map(o => (
              <label key={o.uid} className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#374151' }}>
                <input type="checkbox" checked={selected.includes(o.uid)} onChange={() => onToggleMulti(o.uid)} />
                {o.title}
              </label>
            ))}
        </div>
        {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
      </div>
    )
  }

  // text / number
  return (
    <div>{label}
      <input type={field.kind === 'number' ? 'number' : 'text'} placeholder={field.placeholder}
        value={value as string} onChange={e => onChange(e.target.value)} className={base} style={style} />
      {field.help && <p className="mt-0.5" style={{ fontSize: 10, color: '#9CA3AF' }}>{field.help}</p>}
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { exportRowsToCsv } from '@/app/lib/exportCsv'
import ImportButton, { type ParsedRow } from './ImportButton'
import Link from 'next/link'

// Reusable, config-driven CRUD shell for SENAITE "setup" reference data pages.
// One component drives every simple/medium Administration list (DRY): each page
// supplies its columns, field config, rows, and create/update server actions.

export type AdminFormState = { success?: boolean; message?: string; errors?: Record<string, string[]> }

export type RefOption = { uid: string; title: string }

export type FieldKind = 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'select-or-add'

export type QuickField = { key: string; label: string; required?: boolean; placeholder?: string }

export type QuickCreateResult = { success: boolean; message?: string; option?: RefOption }

export type FieldConfig = {
  name: string
  label: string
  kind: FieldKind
  required?: boolean
  placeholder?: string
  help?: string
  options?: RefOption[]      // select / multiselect / select-or-add
  entityLabel?: string       // select-or-add: used in "+ Add new {entityLabel}" and the slide title
  quickFields?: QuickField[] // select-or-add: fields shown in the generic inline create sub-form
  quickCreate?: (values: Record<string, string>) => Promise<QuickCreateResult> // select-or-add
  // select-or-add: swap the generic quickFields sub-form for a fully custom
  // slide-over (e.g. a multi-tab form) when the related entity needs richer
  // fields than a flat list of text inputs supports.
  customCreateSlide?: (props: { open: boolean; onClose: () => void; onCreated: (option: RefOption) => void }) => React.ReactNode
  // Optional heading rendered before this field when it differs from the
  // previous field's section — purely a display grouping, no behavior change
  // for existing configs that never set it.
  section?: string
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
  // Optional CSV export columns. When set, Export uses these instead of the
  // on-screen `columns` — lets a page's export match SENAITE's listing exactly
  // (headers, order, derived values) without changing the visible table.
  exportColumns?: AdminColumn[]
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
  title, subtitle, singularLabel, icon, columns, exportColumns, fields, rows, createAction, updateAction,
}: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AdminRow | null>(null)
  const [vals, setVals] = useState<FormVals>(blankVals(fields))
  const [extraOptions, setExtraOptions] = useState<Record<string, RefOption[]>>({})
  const [addFieldOpen, setAddFieldOpen] = useState<string | null>(null)
  const isEditing = editing !== null

  function optionsFor(f: FieldConfig): RefOption[] {
    return [...(f.options ?? []), ...(extraOptions[f.name] ?? [])]
  }

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

  async function handleImportRow(row: ParsedRow) {
    const fd = new FormData()
    fd.append('_is_import', 'true')
    for (const f of fields) {
      const rawVal = row[f.name]
      if (!rawVal) continue

      if (f.kind === 'select') {
        const match = f.options?.find(o => o.title.toLowerCase() === rawVal.toLowerCase())
        if (!match) return { success: false, message: `Reference not found: ${rawVal}` }
        fd.append(f.name, match.uid)
      } else if (f.kind === 'multiselect') {
        const names = rawVal.split(/[|,]/).map(n => n.trim()).filter(Boolean)
        for (const n of names) {
          const match = f.options?.find(o => o.title.toLowerCase() === n.toLowerCase())
          if (!match) return { success: false, message: `Reference not found: ${n}` }
          fd.append(f.name, match.uid)
        }
      } else {
        fd.append(f.name, rawVal)
      }
    }
    const res = await createAction({}, fd)
    return { success: res.success, message: res.message, errors: res.errors }
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-3" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="arrow_back" size={16} color="#374151" />
          </Link>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>{title}</h1>
            <p className="text-sm mt-0.5" style={{ color: '#374151' }}>{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportRowsToCsv(exportColumns ?? columns, [], title.toLowerCase().replace(/\s+/g, '-') + '-template')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ color: '#374151', border: '1px solid #D1D5DB', backgroundColor: '#fff' }}>
            <MI name="download" size={15} color="#374151" /> Template
          </button>
          <button onClick={() => exportRowsToCsv(exportColumns ?? columns, rows, title.toLowerCase().replace(/\s+/g, '-'))} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ color: '#0154FC', border: '1px solid #0154FC', backgroundColor: '#fff' }}>
            <MI name="file_download" size={15} color="#0154FC" /> Export
          </button>
          <ImportButton 
            columns={exportColumns ?? columns} 
            existingTitles={rows.map(r => String(r.title))} 
            templateFilename={title.toLowerCase().replace(/\s+/g, '-') + '-template'}
            entityName={title}
            onImportRow={handleImportRow} 
            onRefresh={() => router.refresh()} 
          />
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={15} color="#fff" /> New {singularLabel}
          </button>
        </div>
      </div>

      {/* Drawer — full-viewport overlay (matches app-wide drawer convention) */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: showForm ? 'auto' : 'none' }}>
        <div onClick={closeForm} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showForm ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 'var(--dashboard-header-h)', right: 0, bottom: 'var(--dashboard-footer-h)', width: 460, maxWidth: '92vw', backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showForm ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEditing ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEditing ? 'edit' : icon} size={16} color={isEditing ? '#2563EB' : '#0154FC'} />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                {isEditing ? `Edit — ${editing.title}` : `New ${singularLabel}`}
              </h2>
            </div>
            <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#374151" /></button>
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
              {fields.map((f, i) => (
                <div key={f.name}>
                  {f.section && f.section !== fields[i - 1]?.section && (
                    <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#374151', marginTop: i === 0 ? 0 : 14 }}>{f.section}</h3>
                  )}
                  <FieldInput
                    field={f}
                    value={vals[f.name]}
                    options={optionsFor(f)}
                    error={state.errors?.[f.name]?.[0]}
                    onChange={v => setVal(f.name, v)}
                    onToggleMulti={uid => toggleMulti(f.name, uid)}
                    onOpenAdd={() => setAddFieldOpen(f.name)}
                  />
                </div>
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

      {fields.filter(f => f.kind === 'select-or-add').map(f => {
        const onCreated = (option: RefOption) => {
          setExtraOptions(prev => ({ ...prev, [f.name]: [...(prev[f.name] ?? []), option] }))
          setVal(f.name, option.uid)
          setAddFieldOpen(null)
        }
        return f.customCreateSlide
          ? <span key={`qa-${f.name}`}>{f.customCreateSlide({ open: addFieldOpen === f.name, onClose: () => setAddFieldOpen(null), onCreated })}</span>
          : (
            <QuickAddSlide
              key={`qa-${f.name}`}
              open={addFieldOpen === f.name}
              field={f}
              onClose={() => setAddFieldOpen(null)}
              onCreated={onCreated}
            />
          )
      })}

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
          <p className="mt-2 text-sm font-medium" style={{ color: '#374151' }}>No {title.toLowerCase()} yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#374151' }}>Create your first {singularLabel.toLowerCase()} to get started</p>
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
                  <th key={c.key} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#374151', letterSpacing: '0.05em' }}>{c.label}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.uid} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                  {columns.map((c, ci) => (
                    <td key={c.key} className="px-3 py-2 text-xs truncate" style={{ color: ci === 0 ? '#111827' : '#374151', fontWeight: ci === 0 ? 500 : 400 }}>
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
          <div className="px-3 py-2 flex items-center justify-between" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 12, color: '#1F2937', fontWeight: 500 }}>{rows.length} {rows.length !== 1 ? `${singularLabel.toLowerCase()}s` : singularLabel.toLowerCase()}</p>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

function FieldInput({ field, value, options, error, onChange, onToggleMulti, onOpenAdd }: {
  field: FieldConfig
  value: string | string[]
  options: RefOption[]
  error?: string
  onChange: (v: string) => void
  onToggleMulti: (uid: string) => void
  onOpenAdd: () => void
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
        {field.help && <p className="mt-0.5" style={{ fontSize: 10, color: '#374151' }}>{field.help}</p>}
        {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
      </div>
    )
  }

  if (field.kind === 'select') {
    return (
      <div>{label}
        <select value={value as string} onChange={e => onChange(e.target.value)} className={base} style={style}>
          <option value="">— None —</option>
          {options.map(o => <option key={o.uid} value={o.uid}>{o.title}</option>)}
        </select>
        {field.help && <p className="mt-0.5" style={{ fontSize: 10, color: '#374151' }}>{field.help}</p>}
        {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
      </div>
    )
  }

  if (field.kind === 'select-or-add') {
    const entityLabel = field.entityLabel ?? field.label
    return (
      <div>{label}
        <select
          value={value as string}
          onChange={e => { if (e.target.value === '__add__') onOpenAdd(); else onChange(e.target.value) }}
          className={base} style={style}
        >
          <option value="">— None —</option>
          {options.map(o => <option key={o.uid} value={o.uid}>{o.title}</option>)}
          <option value="__add__">+ Add new {entityLabel.toLowerCase()}…</option>
        </select>
        {field.help && <p className="mt-0.5" style={{ fontSize: 10, color: '#374151' }}>{field.help}</p>}
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
            ? <p style={{ fontSize: 11, color: '#374151' }}>None available</p>
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
      {field.help && <p className="mt-0.5" style={{ fontSize: 10, color: '#374151' }}>{field.help}</p>}
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

// Right-slide "create related record inline" for select-or-add fields — the
// main <select> already shows existing options, so unlike the instruments
// SelectOrAddField this only needs the create sub-form, not a duplicate
// choose-existing list.
function QuickAddSlide({ open, field, onClose, onCreated }: {
  open: boolean
  field: FieldConfig
  onClose: () => void
  onCreated: (option: RefOption) => void
}) {
  const quickFields = field.quickFields ?? []
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const entityLabel = field.entityLabel ?? field.label

  function reset() { setValues({}); setLocalError(null) }
  function handleClose() { reset(); onClose() }

  async function handleCreate() {
    for (const qf of quickFields) {
      if (qf.required && !(values[qf.key] ?? '').trim()) {
        setLocalError(`${qf.label} is required.`)
        return
      }
    }
    if (!field.quickCreate) return
    setSaving(true)
    setLocalError(null)
    const res = await field.quickCreate(values)
    setSaving(false)
    if (res.success && res.option) {
      onCreated(res.option)
      reset()
    } else {
      setLocalError(res.message ?? 'Failed to create.')
    }
  }

  const canCreate = quickFields.every(qf => !qf.required || (values[qf.key] ?? '').trim())

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, pointerEvents: open ? 'auto' : 'none' }}>
      <div onClick={handleClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: open ? 1 : 0, transition: 'opacity 0.25s ease' }} />
      <div style={{
        position: 'absolute', top: 'var(--dashboard-header-h)', right: 0, bottom: 'var(--dashboard-footer-h)', width: 380, backgroundColor: '#fff',
        boxShadow: '-6px 0 32px rgba(0,0,0,0.12)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>New {entityLabel}</h2>
          <button type="button" onClick={handleClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <MI name="close" size={16} color="#374151" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {localError && <p className="mb-2 text-xs" style={{ color: '#EF4444' }}>{localError}</p>}
          {quickFields.map(qf => (
            <div key={qf.key} className="mb-3">
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 4 }}>
                {qf.label}{qf.required && <span style={{ color: '#EF4444' }}> *</span>}
              </label>
              <input
                value={values[qf.key] ?? ''}
                onChange={e => setValues(prev => ({ ...prev, [qf.key]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
                placeholder={qf.placeholder}
                className="w-full px-3 py-2 rounded-lg"
                style={{ fontSize: 12, border: '1px solid #D1D5DB' }}
              />
            </div>
          ))}
        </div>
        <div className="px-5 py-4 flex justify-end gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
          <button type="button" onClick={handleClose}
            style={{ fontSize: 12, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', background: '#fff' }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !canCreate}
            onClick={handleCreate}
            style={{
              fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8,
              backgroundColor: '#0154FC', color: '#fff', border: 'none',
              opacity: saving || !canCreate ? 0.6 : 1,
            }}
          >
            {saving ? 'Creating…' : 'Create & Select'}
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState, useActionState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createMethod, updateMethod, toggleMethodActive, type Method, type MethodFormState } from '@/app/actions/methods'
import type { Calculation } from '@/app/actions/calculations'
import type { InstrumentOption } from '@/app/actions/instrument-maintenance'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({ label, name, placeholder, required, error, value, onChange, as }: {
  label: string; name: string; placeholder?: string; required?: boolean
  error?: string; value: string; onChange: (v: string) => void; as?: 'textarea'
}) {
  const base = 'w-full px-3 py-2 text-xs rounded-lg outline-none'
  const border = { border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      {as === 'textarea'
        ? <textarea name={name} rows={3} placeholder={placeholder} value={value}
            onChange={e => onChange(e.target.value)} className={base + ' resize-none'} style={border} />
        : <input name={name} placeholder={placeholder} required={required} value={value}
            onChange={e => onChange(e.target.value)} className={base} style={border} />}
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

function CheckboxList({ label, options, selected, onChange }: {
  label: string; options: { id: number; name: string }[]; selected: number[]; onChange: (ids: number[]) => void
}) {
  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>{label}</label>
      <div className="rounded-lg overflow-y-auto" style={{ border: '1px solid #D1D5DB', maxHeight: 120 }}>
        {options.length === 0
          ? <p className="px-3 py-2 text-xs" style={{ color: '#9CA3AF' }}>None available</p>
          : options.map(o => (
              <label key={o.id} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50" style={{ color: '#374151' }}>
                <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} />
                {o.name}
              </label>
            ))}
      </div>
    </div>
  )
}

type FV = {
  name: string; code: string; description: string; instructions: string
  accredited: boolean; instrumentIds: number[]; calculationIds: number[]
}
const blank = (): FV => ({ name: '', code: '', description: '', instructions: '', accredited: false, instrumentIds: [], calculationIds: [] })

export default function MethodsShell({ initialMethods, calculations, instruments }: {
  initialMethods: Method[]; calculations: Calculation[]; instruments: InstrumentOption[]
}) {
  const router = useRouter()
  const [showDrawer, setShowDrawer] = useState(false)
  const [editing, setEditing] = useState<Method | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [, startTransition] = useTransition()
  const [vals, setVals] = useState<FV>(blank)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const isEdit = editing !== null

  function setVal(k: keyof FV, v: string) {
    setVals(prev => ({ ...prev, [k]: v }))
    if (fieldErrors[k]) setFieldErrors(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  const [state, action, pending] = useActionState(
    async (prev: MethodFormState, fd: FormData) => {
      const id = fd.get('_editingId')
      const result = id ? await updateMethod(Number(id), prev, fd) : await createMethod(prev, fd)
      if (result.success) {
        setShowDrawer(false)
        setEditing(null)
        setVals(blank())
        setFieldErrors({})
        setToast({ ok: true, msg: editing ? 'Method updated.' : 'Method created.' })
        setTimeout(() => setToast(null), 4000)
        router.refresh()
      } else if (result.errors) {
        const fe: Record<string, string> = {}
        for (const [k, msgs] of Object.entries(result.errors)) { if (msgs?.length) fe[k] = msgs[0] }
        setFieldErrors(fe)
      }
      return result
    },
    {}
  )

  function openCreate() { setEditing(null); setVals(blank()); setFieldErrors({}); setShowDrawer(true) }
  function openEdit(m: Method) {
    setEditing(m)
    setVals({
      name: m.name, code: m.code, description: m.description ?? '', instructions: m.instructions ?? '',
      accredited: m.accredited ?? false, instrumentIds: m.instruments ?? [], calculationIds: m.calculations ?? [],
    })
    setFieldErrors({})
    setShowDrawer(true)
  }
  function closeDrawer() { setShowDrawer(false) }

  // Per-row pending state — a single shared `busy` flag disabled every toggle
  // in the table while one request was in flight.
  const [togglingId, setTogglingId] = useState<number | null>(null)

  function toggle(m: Method) {
    setTogglingId(m.id)
    startTransition(async () => {
      const r = await toggleMethodActive(m.id, !m.is_active)
      setToast({ ok: r.success, msg: r.message })
      setTimeout(() => setToast(null), 3000)
      if (r.success) router.refresh()
      setTogglingId(null)
    })
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Methods</h1>
          <p className="mt-1" style={{ fontSize: 13, color: '#6B7280' }}>Manage analytical methods used in testing</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#2563EB', border: 'none', cursor: 'pointer' }}>
          <MI name="add" size={15} color="#fff" /> New Method
        </button>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* ── Right Drawer ── */}
      <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, zIndex: 200, pointerEvents: showDrawer ? 'auto' : 'none' }}>
        <div onClick={closeDrawer} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showDrawer ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 420, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showDrawer ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEdit ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEdit ? 'edit' : 'add'} size={16} color={isEdit ? '#2563EB' : '#0154FC'} />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEdit ? `Edit — ${editing!.name}` : 'New Method'}</h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>{isEdit ? 'Update method details' : 'Create a new analytical method'}</p>
              </div>
            </div>
            <button onClick={closeDrawer} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
          </div>

          {/* Form */}
          <form action={action} className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {isEdit && <input type="hidden" name="_editingId" value={editing!.id} />}
            <div className="flex-1 px-5 py-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Method Name" name="name" placeholder="e.g. HPLC Analysis" required
                  error={fieldErrors.name} value={vals.name} onChange={v => setVal('name', v)} />
                <Field label="Code" name="code" placeholder="e.g. HPLC-001" required
                  error={fieldErrors.code} value={vals.code} onChange={v => setVal('code', v)} />
              </div>
              <Field label="Description" name="description" as="textarea" placeholder="Describe this method…"
                value={vals.description} onChange={v => setVal('description', v)} />
              <Field label="Instructions" name="instructions" as="textarea" placeholder="Technical instructions for analysts…"
                value={vals.instructions} onChange={v => setVal('instructions', v)} />

              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#374151' }}>
                <input type="checkbox" name="accredited" checked={vals.accredited}
                  onChange={e => setVals(prev => ({ ...prev, accredited: e.target.checked }))} />
                Accredited
              </label>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Method Document</label>
                <input type="file" name="document" className="w-full text-xs" />
                {isEdit && editing!.document && (
                  <a href={editing!.document} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs" style={{ color: '#2563EB' }}>
                    View current document
                  </a>
                )}
              </div>

              {vals.instrumentIds.map(id => <input key={id} type="hidden" name="instrument_ids" value={id} />)}
              <CheckboxList label="Instruments" options={instruments} selected={vals.instrumentIds}
                onChange={ids => setVals(prev => ({ ...prev, instrumentIds: ids }))} />

              {vals.calculationIds.map(id => <input key={id} type="hidden" name="calculation_ids" value={id} />)}
              <CheckboxList label="Calculations" options={calculations} selected={vals.calculationIds}
                onChange={ids => setVals(prev => ({ ...prev, calculationIds: ids }))} />
            </div>

            {/* Footer */}
            <div className="px-5 py-4 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#fff' }}>
              <button type="button" onClick={closeDrawer} disabled={pending}
                style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={pending} className="flex items-center gap-1.5"
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: isEdit ? '#2563EB' : '#0154FC', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}>
                <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
                {pending ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Table */}
      {initialMethods.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2', borderRadius: 14 }}>
          <MI name="biotech" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No methods yet</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Method
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '28%' }} /><col style={{ width: '14%' }} /><col style={{ width: '38%' }} /><col style={{ width: '12%' }} /><col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Code', 'Description', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialMethods.map((m, i) => (
                <tr key={m.id} style={{ borderBottom: i < initialMethods.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-xs font-medium" style={{ color: '#111827' }}>{m.name}</td>
                  <td className="px-3 py-2.5"><span className="font-mono text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>{m.code}</span></td>
                  <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#6B7280' }}>{m.description || '—'}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => toggle(m)} disabled={togglingId === m.id}
                      className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, color: m.is_active ? '#0154FC' : '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: m.is_active ? '#0154FC' : '#9CA3AF', display: 'inline-block' }} />
                      {m.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => openEdit(m)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                      <MI name="edit" size={14} color="#9CA3AF" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialMethods.length} method{initialMethods.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

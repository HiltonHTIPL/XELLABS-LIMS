'use client'
import { useState, useActionState, useRef, useEffect } from 'react'
import { createMethod, updateMethod, type Method, type MethodFormState } from '@/app/actions/methods'
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

function fromMethod(m: Method): FV {
  return {
    name: m.name, code: m.code, description: m.description ?? '', instructions: m.instructions ?? '',
    accredited: m.accredited ?? false, instrumentIds: m.instruments ?? [], calculationIds: m.calculations ?? [],
  }
}

type Props = {
  open: boolean
  onClose: () => void
  editing: Method | null
  calculations: Calculation[]
  instruments: InstrumentOption[]
  /** Called after a successful create/update with the saved method. */
  onSaved: (method: Method | null, message: string) => void
  zIndex?: number
}

/**
 * Full Method create/edit drawer — every field the Method model has.
 * Shared by the Methods admin page and any other "+ Add new Method" entry
 * point (e.g. Worksheet instrument/method assignment), so there is exactly
 * one place these fields are defined.
 */
export default function MethodFormDrawer({ open, onClose, editing, calculations, instruments, onSaved, zIndex = 200 }: Props) {
  const [vals, setVals] = useState<FV>(blank)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const isEdit = editing !== null

  useEffect(() => {
    if (!open) return
    setVals(editing ? fromMethod(editing) : blank())
    setFieldErrors({})
    setFileName('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  function setVal(k: keyof FV, v: string) {
    setVals(prev => ({ ...prev, [k]: v }))
    if (fieldErrors[k]) setFieldErrors(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  const [, action, pending] = useActionState(
    async (prev: MethodFormState, fd: FormData) => {
      const editingId = fd.get('_editingId')
      const result = editingId ? await updateMethod(Number(editingId), prev, fd) : await createMethod(prev, fd)
      if (result.success) {
        const saved: Method | null = result.id
          ? { id: result.id, name: vals.name, code: vals.code, description: vals.description, accredited: vals.accredited,
              instructions: vals.instructions, document: editing?.document ?? null, instruments: vals.instrumentIds,
              calculations: vals.calculationIds, is_active: editing?.is_active ?? true, created_at: editing?.created_at ?? '' }
          : null
        onSaved(saved, result.message ?? (isEdit ? 'Method updated.' : 'Method created.'))
      } else if (result.errors) {
        const fe: Record<string, string> = {}
        for (const [k, msgs] of Object.entries(result.errors)) { if (msgs?.length) fe[k] = msgs[0] }
        setFieldErrors(fe)
      }
      return result
    },
    {},
  )

  return (
    <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', bottom: 'var(--dashboard-footer-h)', left: 0, right: 0, zIndex, pointerEvents: open ? 'auto' : 'none' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: open ? 1 : 0, transition: 'opacity 0.25s ease' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 420, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>

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
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
        </div>

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
              <input ref={fileInputRef} type="file" name="document" className="hidden"
                onChange={e => setFileName(e.target.files?.[0]?.name ?? '')} />
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#F9FAFB', cursor: 'pointer' }}>
                  Choose File
                </button>
                <span className="text-xs truncate" style={{ color: fileName ? '#374151' : '#9CA3AF' }}>
                  {fileName || 'No file chosen'}
                </span>
              </div>
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

          <div className="px-5 py-4 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#fff' }}>
            <button type="button" onClick={onClose} disabled={pending}
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
  )
}

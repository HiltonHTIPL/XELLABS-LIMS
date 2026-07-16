'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createSampleType, updateSampleType, type SampleTypeFormState } from '@/app/actions/sample-types'
import { type SenaiteSampleType } from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({
  label, name, placeholder, required, error, hint, value, onChange,
}: {
  label: string; name: string; placeholder?: string; required?: boolean
  error?: string; hint?: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
        {hint && <span className="ml-1 font-normal" style={{ color: '#9CA3AF' }}>{hint}</span>}
      </label>
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
        style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
      />
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

type FV = { title: string; Prefix: string; MinimumVolume: string; retention_days: string }
const blank = (): FV => ({ title: '', Prefix: '', MinimumVolume: '', retention_days: '14' })

export default function SampleTypesShell({
  initialSampleTypes,
  retentionByName = {},
}: {
  initialSampleTypes: SenaiteSampleType[]
  retentionByName?: Record<string, number>
}) {
  const router = useRouter()
  const [showDrawer, setShowDrawer] = useState(false)
  const [editing, setEditing] = useState<SenaiteSampleType | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [vals, setVals] = useState<FV>(blank)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const isEdit = editing !== null

  function setVal(k: keyof FV, v: string) {
    setVals(prev => ({ ...prev, [k]: v }))
    if (fieldErrors[k]) setFieldErrors(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  const [state, action, pending] = useActionState(
    async (prev: SampleTypeFormState, fd: FormData) => {
      const uid = fd.get('_editingUid') as string | null
      const result = uid ? await updateSampleType(uid, prev, fd) : await createSampleType(prev, fd)
      if (result.success) {
        setShowDrawer(false)
        setEditing(null)
        setVals(blank())
        setFieldErrors({})
        setToast({ ok: true, msg: editing ? 'Sample type updated.' : 'Sample type created.' })
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
  function openEdit(st: SenaiteSampleType) {
    setEditing(st)
    setVals({
      title: st.title,
      Prefix: st.Prefix ?? '',
      MinimumVolume: st.MinimumVolume ?? '',
      retention_days: String(retentionByName[st.title] ?? 14),
    })
    setFieldErrors({})
    setShowDrawer(true)
  }
  function closeDrawer() { setShowDrawer(false) }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Sample Types</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Sample types and retention periods used for due dates and Past Retention disposal</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New Sample Type
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, color: toast.ok ? '#0154FC' : '#991B1B' }}>
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
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                  {isEdit ? `Edit — ${editing!.title}` : 'New Sample Type'}
                </h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                  {isEdit ? 'Update sample type details' : 'Create a new sample type'}
                </p>
              </div>
            </div>
            <button onClick={closeDrawer} className="p-1.5 rounded-lg hover:bg-gray-100">
              <MI name="close" size={16} color="#9CA3AF" />
            </button>
          </div>

          {/* Form */}
          <form action={action} className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {isEdit && <input type="hidden" name="_editingUid" value={editing!.uid} />}
            <div className="flex-1 px-5 py-4 flex flex-col gap-3">
              <Field label="Sample Type Name" name="title" placeholder="e.g. Blood Plasma" required
                error={fieldErrors.title} value={vals.title} onChange={v => setVal('title', v)} />
              <Field label="Prefix" name="Prefix" placeholder="e.g. BP" required
                hint="(used in sample ID generation)"
                error={fieldErrors.Prefix} value={vals.Prefix} onChange={v => setVal('Prefix', v)} />
              <Field label="Minimum Volume" name="MinimumVolume" placeholder="e.g. 5 mL"
                hint="(optional)" value={vals.MinimumVolume} onChange={v => setVal('MinimumVolume', v)} />
              <Field label="Retention Period (days)" name="retention_days" placeholder="14"
                hint="(drives due date / Past Retention)"
                value={vals.retention_days} onChange={v => setVal('retention_days', v)} />
            </div>

            {/* Footer */}
            <div className="px-5 py-4 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#fff' }}>
              <button type="button" onClick={closeDrawer} disabled={pending}
                style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
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

      {/* Table / empty state */}
      {initialSampleTypes.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="science" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No sample types yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create your first sample type to get started</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Sample Type
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '28%' }} /><col style={{ width: '12%' }} /><col style={{ width: '16%' }} /><col style={{ width: '14%' }} /><col style={{ width: '22%' }} /><col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Prefix', 'Min. Volume', 'Retention', 'UID', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialSampleTypes.map((st, i) => (
                <tr key={st.uid} style={{ borderBottom: i < initialSampleTypes.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                        <MI name="science" size={13} color="#0154FC" />
                      </div>
                      <span className="text-xs font-medium" style={{ color: '#111827' }}>{st.title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>
                      {st.Prefix || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{st.MinimumVolume || '—'}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#374151', fontWeight: 600 }}>
                    {retentionByName[st.title] ?? 14} days
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs truncate" style={{ color: '#9CA3AF' }}>{st.uid}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => openEdit(st)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }} title="Edit">
                      <MI name="edit" size={14} color="#9CA3AF" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialSampleTypes.length} sample type{initialSampleTypes.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

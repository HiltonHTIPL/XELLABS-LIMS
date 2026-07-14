'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createTest, updateTest, type LimsTest, type TestFormState } from '@/app/actions/tests'
import { type Method } from '@/app/actions/methods'
import { type SenaiteAnalysisService } from '@/app/lib/senaite'

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

type FV = { name: string; code: string; unit: string; price: string; method: string; description: string; senaite_uid: string }
const blank = (): FV => ({ name: '', code: '', unit: '', price: '', method: '', description: '', senaite_uid: '' })

export default function TestsShell({ initialTests, methods, senaiteServices }: { initialTests: LimsTest[]; methods: Method[]; senaiteServices: SenaiteAnalysisService[] }) {
  const router = useRouter()
  const [showDrawer, setShowDrawer] = useState(false)
  const [editing, setEditing] = useState<LimsTest | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [vals, setVals] = useState<FV>(blank)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const isEdit = editing !== null

  function setVal(k: keyof FV, v: string) {
    setVals(prev => ({ ...prev, [k]: v }))
    if (fieldErrors[k]) setFieldErrors(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  const [state, action, pending] = useActionState(
    async (prev: TestFormState, fd: FormData) => {
      const id = fd.get('_editingId')
      const result = id ? await updateTest(Number(id), prev, fd) : await createTest(prev, fd)
      if (result.success) {
        setShowDrawer(false)
        setEditing(null)
        setVals(blank())
        setFieldErrors({})
        setToast({ ok: true, msg: editing ? 'Test updated.' : 'Test created.' })
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
  function openEdit(t: LimsTest) {
    setEditing(t)
    setVals({ name: t.name, code: t.code, unit: t.unit ?? '', price: t.price ?? '', method: t.method ? String(t.method) : '', description: t.description ?? '', senaite_uid: t.senaite_uid ?? '' })
    setFieldErrors({})
    setShowDrawer(true)
  }
  function closeDrawer() { setShowDrawer(false) }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Tests</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage laboratory tests and their methods</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New Test
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
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 460, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showDrawer ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEdit ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEdit ? 'edit' : 'add'} size={16} color={isEdit ? '#2563EB' : '#0154FC'} />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEdit ? `Edit — ${editing!.name}` : 'New Test'}</h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>{isEdit ? 'Update test details' : 'Create a new laboratory test'}</p>
              </div>
            </div>
            <button onClick={closeDrawer} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
          </div>

          {/* Form */}
          <form action={action} className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {isEdit && <input type="hidden" name="_editingId" value={editing!.id} />}
            <div className="flex-1 px-5 py-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Test Name" name="name" placeholder="e.g. Total Protein" required
                  error={fieldErrors.name} value={vals.name} onChange={v => setVal('name', v)} />
                <Field label="Code" name="code" placeholder="e.g. TP-001" required
                  error={fieldErrors.code} value={vals.code} onChange={v => setVal('code', v)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Unit" name="unit" placeholder="e.g. g/dL"
                  error={fieldErrors.unit} value={vals.unit} onChange={v => setVal('unit', v)} />
                <Field label="Price" name="price" placeholder="e.g. 25.00"
                  error={fieldErrors.price} value={vals.price} onChange={v => setVal('price', v)} />
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Method</label>
                  <select name="method" value={vals.method}
                    onChange={e => setVal('method', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                    style={{ border: `1px solid ${fieldErrors.method ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}>
                    <option value="">— None —</option>
                    {methods.filter(m => m.is_active).map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                    ))}
                  </select>
                  {fieldErrors.method && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{fieldErrors.method}</p>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                  Lab Analysis Service<span style={{ color: '#EF4444' }}> *</span>
                </label>
                <select name="senaite_uid" value={vals.senaite_uid}
                  onChange={e => setVal('senaite_uid', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                  style={{ border: `1px solid ${fieldErrors.senaite_uid ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}>
                  <option value="">— Select —</option>
                  {senaiteServices.map(s => (
                    <option key={s.uid} value={s.uid}>{s.title} ({s.Keyword})</option>
                  ))}
                </select>
                {fieldErrors.senaite_uid && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{fieldErrors.senaite_uid}</p>}
                <p className="mt-1" style={{ fontSize: 10, color: '#9CA3AF' }}>
                  Required — links this test to a lab analysis so samples using it get the analysis attached.
                </p>
              </div>
              <Field label="Description" name="description" as="textarea" placeholder="Describe this test…"
                error={fieldErrors.description} value={vals.description} onChange={v => setVal('description', v)} />
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

      {/* Table */}
      {initialTests.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="assignment" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No tests yet</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Test
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '22%' }} /><col style={{ width: '11%' }} /><col style={{ width: '9%' }} /><col style={{ width: '10%' }} /><col style={{ width: '17%' }} /><col style={{ width: '23%' }} /><col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Code', 'Unit', 'Price', 'Method', 'Description', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialTests.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: i < initialTests.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-xs font-medium" style={{ color: '#111827' }}>
                    {t.name}
                    {!t.senaite_uid && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 700, backgroundColor: '#FEF2F2', color: '#991B1B' }} title="Samples using this test won't get the analysis attached until it's linked">
                        Not linked
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5"><span className="font-mono text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>{t.code}</span></td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{t.unit || '—'}</td>
                  <td className="px-3 py-2.5 text-xs font-medium" style={{ color: '#111827' }}>{t.price ? `$${Number(t.price).toFixed(2)}` : '—'}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#374151' }}>{t.method_name || '—'}</td>
                  <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#6B7280' }}>{t.description || '—'}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => openEdit(t)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                      <MI name="edit" size={14} color="#9CA3AF" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialTests.length} test{initialTests.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

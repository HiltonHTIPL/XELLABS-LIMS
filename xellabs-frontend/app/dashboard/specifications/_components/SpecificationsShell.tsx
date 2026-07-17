'use client'
import { useState, useActionState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createAnalysisSpecification,
  updateAnalysisSpecification,
  deleteAnalysisSpecification,
  type AnalysisSpecification,
  type SpecificationRow,
  type SpecificationFormState,
} from '@/app/actions/specifications'
import type { SenaiteAnalysisService } from '@/app/lib/senaite'
import type { DjangoSampleType } from '@/app/actions/lab-samples'
import type { DynamicAnalysisSpecification } from '@/app/actions/dynamic-analysis-specifications'
import { ConfirmModal } from '@/app/dashboard/_components/ui'

const OPERATORS = ['>=', '>', '<=', '<', '=']

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({ label, children, required, error }: {
  label: string; children: React.ReactNode; required?: boolean; error?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      {children}
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

const inputCls = 'w-full px-2 py-1.5 text-xs rounded-md outline-none bg-white'
function inputStyle(error?: string) {
  return { border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }
}

type RowState = SpecificationRow & { selected: boolean }

function blankRow(uid: string, name: string): RowState {
  return {
    senaite_service_uid: uid, senaite_service_name: name, min_value: null, max_value: null, min_operator: '>=', max_operator: '<=',
    min_warn: null, max_warn: null, out_of_range_low: '', out_of_range_high: '', out_of_range_comment: '',
    is_active: true, selected: false,
  }
}

function SpecificationModal({ editing, services, sampleTypes, dynamicSpecs, onClose, onDone }: {
  editing: AnalysisSpecification | null
  services: SenaiteAnalysisService[]
  sampleTypes: DjangoSampleType[]
  dynamicSpecs: DynamicAnalysisSpecification[]
  onClose: () => void
  onDone: () => void
}) {
  const isEdit = editing !== null

  // One row per known SENAITE analysis service — pre-checked/pre-filled for
  // services already in `editing.rows`, unchecked+blank otherwise. Only
  // checked rows get submitted.
  const [rows, setRows] = useState<RowState[]>(() => {
    const existingByUid = new Map((editing?.rows ?? []).map(r => [r.senaite_service_uid, r]))
    return services.map(s => {
      const existing = existingByUid.get(s.uid)
      return existing ? { ...blankRow(s.uid, s.title), ...existing, selected: true } : blankRow(s.uid, s.title)
    })
  })

  function updateRow(uid: string, patch: Partial<RowState>) {
    setRows(prev => prev.map(r => (r.senaite_service_uid === uid ? { ...r, ...patch } : r)))
  }

  const createAction = async (prev: SpecificationFormState, fd: FormData) => {
    const result = await createAnalysisSpecification(prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const editAction = async (prev: SpecificationFormState, fd: FormData) => {
    const result = await updateAnalysisSpecification(editing!.id, prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const [state, action, pending] = useActionState(isEdit ? editAction : createAction, {})

  const fieldErrors: Record<string, string> = {}
  if (state.errors) {
    for (const [k, msgs] of Object.entries(state.errors)) { if (msgs?.length) fieldErrors[k] = msgs[0] }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const selectedRows = rows.filter(r => r.selected).map(({ selected: _selected, ...r }) => r)
    const hidden = e.currentTarget.querySelector('input[name="rows_json"]') as HTMLInputElement
    hidden.value = JSON.stringify(selectedRows)
  }

  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1000 }}>
      <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', right: 0, bottom: 'var(--dashboard-footer-h)', width: 760, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEdit ? '#EFF6FF' : '#DBEAFE' }}>
              <MI name={isEdit ? 'edit' : 'add'} size={16} color={isEdit ? '#2563EB' : '#0154FC'} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEdit ? 'Edit Specification' : 'New Specification'}</h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>Define pass/fail ranges per test for a sample type</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
        </div>
        <form action={action} onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-3">
          <input type="hidden" name="rows_json" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title" required error={fieldErrors.title}>
              <input name="title" type="text" placeholder="e.g. Minerals Default Spec" defaultValue={editing?.title}
                className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle(fieldErrors.title)} />
            </Field>
            <Field label="Sample Type" required error={fieldErrors.sample_type}>
              <select name="sample_type" required defaultValue={editing?.sample_type ?? ''} className="w-full px-3 py-2 text-xs rounded-lg outline-none bg-white" style={inputStyle(fieldErrors.sample_type)}>
                <option value="" disabled>Select sample type…</option>
                {sampleTypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Dynamic Analysis Specification" error={fieldErrors.dynamic_spec}>
            <select name="dynamic_spec" defaultValue={editing?.dynamic_spec ?? ''} className="w-full px-3 py-2 text-xs rounded-lg outline-none bg-white" style={inputStyle()}>
              <option value="">— None —</option>
              {dynamicSpecs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Description">
            <textarea name="description" rows={2} placeholder="Used in item listings and search results." defaultValue={editing?.description}
              className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none" style={inputStyle()} />
          </Field>
          <label className="flex items-center gap-2 mt-1">
            <input type="checkbox" name="is_active" defaultChecked={editing ? editing.is_active : true} />
            <span className="text-xs" style={{ color: '#374151' }}>Active</span>
          </label>

          <div className="mt-2">
            <p className="text-xs font-semibold mb-1" style={{ color: '#374151' }}>
              Specifications{fieldErrors.rows && <span className="ml-2" style={{ color: '#EF4444', fontWeight: 400 }}>{fieldErrors.rows}</span>}
            </p>
            <p className="mb-2" style={{ fontSize: 10, color: '#9CA3AF' }}>
              Check a test to include it, then set its range. &apos;Min warn&apos;/&apos;Max warn&apos; raise a less severe alert (shoulder range); &apos;&lt; Min&apos;/&apos;&gt; Max&apos; are the display values shown in results when out of range.
            </p>
            <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid #E5E7EB' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
                <thead>
                  <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #E5E7EB' }}>
                    {['', 'Test', 'Min warn', 'Min', 'Min op', 'Max', 'Max warn', 'Max op', '< Min', '> Max', 'Comment'].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {services.map(s => {
                    const row = rows.find(r => r.senaite_service_uid === s.uid)!
                    const dis = !row.selected
                    return (
                      <tr key={s.uid} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td className="px-2 py-1.5"><input type="checkbox" checked={row.selected} onChange={e => updateRow(s.uid, { selected: e.target.checked })} /></td>
                        <td className="px-2 py-1.5 text-xs" style={{ color: '#111827', whiteSpace: 'nowrap' }}>{s.title}</td>
                        <td className="px-1 py-1"><input disabled={dis} value={row.min_warn ?? ''} onChange={e => updateRow(s.uid, { min_warn: e.target.value || null })} className={inputCls} style={{ width: 64, ...inputStyle() }} /></td>
                        <td className="px-1 py-1"><input disabled={dis} value={row.min_value ?? ''} onChange={e => updateRow(s.uid, { min_value: e.target.value || null })} className={inputCls} style={{ width: 64, ...inputStyle() }} /></td>
                        <td className="px-1 py-1">
                          <select disabled={dis} value={row.min_operator} onChange={e => updateRow(s.uid, { min_operator: e.target.value })} className={inputCls} style={{ width: 56, ...inputStyle() }}>
                            {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                          </select>
                        </td>
                        <td className="px-1 py-1"><input disabled={dis} value={row.max_value ?? ''} onChange={e => updateRow(s.uid, { max_value: e.target.value || null })} className={inputCls} style={{ width: 64, ...inputStyle() }} /></td>
                        <td className="px-1 py-1"><input disabled={dis} value={row.max_warn ?? ''} onChange={e => updateRow(s.uid, { max_warn: e.target.value || null })} className={inputCls} style={{ width: 64, ...inputStyle() }} /></td>
                        <td className="px-1 py-1">
                          <select disabled={dis} value={row.max_operator} onChange={e => updateRow(s.uid, { max_operator: e.target.value })} className={inputCls} style={{ width: 56, ...inputStyle() }}>
                            {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                          </select>
                        </td>
                        <td className="px-1 py-1"><input disabled={dis} value={row.out_of_range_low} onChange={e => updateRow(s.uid, { out_of_range_low: e.target.value })} className={inputCls} style={{ width: 64, ...inputStyle() }} /></td>
                        <td className="px-1 py-1"><input disabled={dis} value={row.out_of_range_high} onChange={e => updateRow(s.uid, { out_of_range_high: e.target.value })} className={inputCls} style={{ width: 64, ...inputStyle() }} /></td>
                        <td className="px-1 py-1"><input disabled={dis} value={row.out_of_range_comment} onChange={e => updateRow(s.uid, { out_of_range_comment: e.target.value })} className={inputCls} style={{ width: 100, ...inputStyle() }} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {state.message && !state.success && (
            <p className="text-xs" style={{ color: '#EF4444' }}>{state.message}</p>
          )}
          <div className="flex items-center justify-end gap-2 pt-1 mt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
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

export default function SpecificationsShell({ initialSpecifications, services, sampleTypes, dynamicSpecs }: {
  initialSpecifications: AnalysisSpecification[]
  services: SenaiteAnalysisService[]
  sampleTypes: DjangoSampleType[]
  dynamicSpecs: DynamicAnalysisSpecification[]
}) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AnalysisSpecification | null>(null)
  const [deleting, setDeleting] = useState<AnalysisSpecification | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [busy, startTransition] = useTransition()
  const [filterSampleType, setFilterSampleType] = useState('')

  const sampleTypeMap = useMemo(() => new Map(sampleTypes.map(s => [s.id, s.name])), [sampleTypes])

  const filtered = useMemo(() => {
    return initialSpecifications.filter(s => {
      if (filterSampleType && String(s.sample_type) !== filterSampleType) return false
      return true
    })
  }, [initialSpecifications, filterSampleType])

  function openCreate() { setEditing(null); setShowModal(true) }
  function openEdit(s: AnalysisSpecification) { setEditing(s); setShowModal(true) }
  function closeModal() { setShowModal(false); setEditing(null) }
  function handleDone() {
    setToast({ ok: true, msg: editing ? 'Specification updated.' : 'Specification created.' })
    setTimeout(() => setToast(null), 4000)
    router.refresh()
  }
  function confirmDelete() {
    if (!deleting) return
    const target = deleting
    startTransition(async () => {
      const r = await deleteAnalysisSpecification(target.id)
      setToast({ ok: r.success, msg: r.message })
      setTimeout(() => setToast(null), 3000)
      setDeleting(null)
      if (r.success) router.refresh()
    })
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-5" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="arrow_back" size={16} color="#6B7280" />
          </Link>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Specifications</h1>
            <p className="mt-1" style={{ fontSize: 13, color: '#6B7280' }}>Define pass/fail ranges per test and sample type</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#2563EB', border: 'none', cursor: 'pointer' }}>
          <MI name="add" size={15} color="#fff" /> New Specification
        </button>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ flexShrink: 0,
          backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      <div className="flex items-center gap-2 mb-3" style={{ flexShrink: 0 }}>
        <select value={filterSampleType} onChange={e => setFilterSampleType(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg outline-none bg-white" style={{ border: '1px solid #D1D5DB', color: '#374151' }}>
          <option value="">All Sample Types</option>
          {sampleTypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {showModal && <SpecificationModal editing={editing} services={services} sampleTypes={sampleTypes} dynamicSpecs={dynamicSpecs} onClose={closeModal} onDone={handleDone} />}
      {deleting && (
        <ConfirmModal
          title="Delete Specification"
          message={`Delete "${deleting.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2', borderRadius: 14 }}>
          <MI name="rule" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No specifications yet</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Specification
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '30%' }} /><col style={{ width: '26%' }} /><col style={{ width: '18%' }} /><col style={{ width: '14%' }} /><col style={{ width: '12%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Title', 'Sample Type', 'Tests', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-xs font-medium" style={{ color: '#111827' }}>{s.title}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#111827' }}>{sampleTypeMap.get(s.sample_type) ?? `#${s.sample_type}`}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>
                      {s.rows.length} test{s.rows.length !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, color: s.is_active ? '#0154FC' : '#6B7280' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: s.is_active ? '#0154FC' : '#9CA3AF', display: 'inline-block' }} />
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(s)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                        <MI name="edit" size={14} color="#9CA3AF" />
                      </button>
                      <button onClick={() => setDeleting(s)} disabled={busy} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                        <MI name="delete" size={14} color="#EF4444" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{filtered.length} specification{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

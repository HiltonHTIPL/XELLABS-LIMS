'use client'
import { useState, useActionState, useTransition, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  createSpecification,
  updateSpecification,
  deleteSpecification,
  type Specification,
  type SpecificationFormState,
} from '@/app/actions/specifications'
import type { LimsTest } from '@/app/actions/tests'
import type { DjangoSampleType } from '@/app/actions/lab-samples'
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

const selectCls = 'w-full px-3 py-2 text-xs rounded-lg outline-none bg-white'
function selectStyle(error?: string) {
  return { border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }
}

function formatRange(spec: Specification, testName: string, sampleTypeName: string) {
  const parts: string[] = []
  if (spec.min_value !== null && spec.min_value !== '') parts.push(`${spec.min_operator} ${spec.min_value}`)
  if (spec.max_value !== null && spec.max_value !== '') parts.push(`${spec.max_operator} ${spec.max_value}`)
  const range = parts.length ? parts.join(' and ') : '—'
  return { range, testName, sampleTypeName }
}

function SpecificationModal({ editing, tests, sampleTypes, onClose, onDone }: {
  editing: Specification | null
  tests: LimsTest[]
  sampleTypes: DjangoSampleType[]
  onClose: () => void
  onDone: () => void
}) {
  const isEdit = editing !== null
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const createAction = async (prev: SpecificationFormState, fd: FormData) => {
    const result = await createSpecification(prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const editAction = async (prev: SpecificationFormState, fd: FormData) => {
    const result = await updateSpecification(editing!.id, prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const [state, action, pending] = useActionState(isEdit ? editAction : createAction, {})

  useEffect(() => {
    if (state.errors) {
      const fe: Record<string, string> = {}
      for (const [k, msgs] of Object.entries(state.errors)) { if (msgs?.length) fe[k] = msgs[0] }
      setFieldErrors(fe)
    }
  }, [state])

  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1000 }}>
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEdit ? '#EFF6FF' : '#DBEAFE' }}>
              <MI name={isEdit ? 'edit' : 'add'} size={16} color={isEdit ? '#2563EB' : '#0154FC'} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEdit ? 'Edit Specification' : 'New Specification'}</h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>{isEdit ? 'Update pass/fail range' : 'Define a pass/fail range for a test'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
        </div>
        <form action={action} className="px-5 py-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Test" required error={fieldErrors.test}>
              <select name="test" required defaultValue={editing?.test ?? ''} className={selectCls} style={selectStyle(fieldErrors.test)}>
                <option value="" disabled>Select test…</option>
                {tests.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Sample Type" required error={fieldErrors.sample_type}>
              <select name="sample_type" required defaultValue={editing?.sample_type ?? ''} className={selectCls} style={selectStyle(fieldErrors.sample_type)}>
                <option value="" disabled>Select sample type…</option>
                {sampleTypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min Operator">
              <select name="min_operator" defaultValue={editing?.min_operator ?? '>='} className={selectCls} style={selectStyle()}>
                {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
            </Field>
            <Field label="Min Value" error={fieldErrors.min_value}>
              <input name="min_value" type="number" step="any" placeholder="e.g. 10" defaultValue={editing?.min_value ?? ''}
                className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={selectStyle(fieldErrors.min_value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max Operator">
              <select name="max_operator" defaultValue={editing?.max_operator ?? '<='} className={selectCls} style={selectStyle()}>
                {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
            </Field>
            <Field label="Max Value">
              <input name="max_value" type="number" step="any" placeholder="e.g. 50" defaultValue={editing?.max_value ?? ''}
                className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={selectStyle()} />
            </Field>
          </div>
          <label className="flex items-center gap-2 mt-1">
            <input type="checkbox" name="is_active" defaultChecked={editing ? editing.is_active : true} />
            <span className="text-xs" style={{ color: '#374151' }}>Active</span>
          </label>
          {state.message && !state.success && (
            <p className="text-xs" style={{ color: '#EF4444' }}>{state.message}</p>
          )}
          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
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

export default function SpecificationsShell({ initialSpecifications, tests, sampleTypes }: {
  initialSpecifications: Specification[]
  tests: LimsTest[]
  sampleTypes: DjangoSampleType[]
}) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Specification | null>(null)
  const [deleting, setDeleting] = useState<Specification | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [busy, startTransition] = useTransition()
  const [filterTest, setFilterTest] = useState('')
  const [filterSampleType, setFilterSampleType] = useState('')

  const testMap = useMemo(() => new Map(tests.map(t => [t.id, t.name])), [tests])
  const sampleTypeMap = useMemo(() => new Map(sampleTypes.map(s => [s.id, s.name])), [sampleTypes])

  const filtered = useMemo(() => {
    return initialSpecifications.filter(s => {
      if (filterTest && String(s.test) !== filterTest) return false
      if (filterSampleType && String(s.sample_type) !== filterSampleType) return false
      return true
    })
  }, [initialSpecifications, filterTest, filterSampleType])

  function openCreate() { setEditing(null); setShowModal(true) }
  function openEdit(s: Specification) { setEditing(s); setShowModal(true) }
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
      const r = await deleteSpecification(target.id)
      setToast({ ok: r.success, msg: r.message })
      setTimeout(() => setToast(null), 3000)
      setDeleting(null)
      if (r.success) router.refresh()
    })
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Specifications</h1>
          <p className="mt-1" style={{ fontSize: 13, color: '#6B7280' }}>Define pass/fail ranges per test and sample type</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#2563EB', border: 'none', cursor: 'pointer' }}>
          <MI name="add" size={15} color="#fff" /> New Specification
        </button>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <select value={filterTest} onChange={e => setFilterTest(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg outline-none bg-white" style={{ border: '1px solid #D1D5DB', color: '#374151' }}>
          <option value="">All Tests</option>
          {tests.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filterSampleType} onChange={e => setFilterSampleType(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg outline-none bg-white" style={{ border: '1px solid #D1D5DB', color: '#374151' }}>
          <option value="">All Sample Types</option>
          {sampleTypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {showModal && <SpecificationModal editing={editing} tests={tests} sampleTypes={sampleTypes} onClose={closeModal} onDone={handleDone} />}
      {deleting && (
        <ConfirmModal
          title="Delete Specification"
          message={`Delete the specification for "${testMap.get(deleting.test) ?? deleting.test}" / "${sampleTypeMap.get(deleting.sample_type) ?? deleting.sample_type}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

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
              <col style={{ width: '26%' }} /><col style={{ width: '26%' }} /><col style={{ width: '28%' }} /><col style={{ width: '12%' }} /><col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Test', 'Sample Type', 'Range', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const { range } = formatRange(s, '', '')
                return (
                  <tr key={s.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-xs font-medium" style={{ color: '#111827' }}>{testMap.get(s.test) ?? `#${s.test}`}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#111827' }}>{sampleTypeMap.get(s.sample_type) ?? `#${s.sample_type}`}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>{range}</span>
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
                )
              })}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{filtered.length} specification{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

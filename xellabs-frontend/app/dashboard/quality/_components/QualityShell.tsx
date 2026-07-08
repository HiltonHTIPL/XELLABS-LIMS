'use client'
import { useMemo, useState, useActionState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeader, Card, StatCard, Btn, Field, ConfirmModal, EmptyState, Pagination,
  MI, T, Chip, thStyle, tdStyle, inputStyle, selectStyle, textareaStyle,
} from '@/app/dashboard/_components/ui'
import {
  createQCSample, updateQCSample, deleteQCSample,
  type QCSample, type QCSampleFormState, type QCWorksheet,
} from '@/app/actions/quality'
import { type LimsTest } from '@/app/actions/tests'

const QC_TYPES: { value: QCSample['qc_type']; label: string }[] = [
  { value: 'blank', label: 'Blank' },
  { value: 'control', label: 'Control' },
  { value: 'spike', label: 'Spike' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'reference', label: 'Reference Material' },
  { value: 'calibrator', label: 'Calibrator' },
]

const STATUSES: { value: QCSample['status']; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'warning', label: 'Warning' },
]

function qcTypeLabel(v: string) {
  return QC_TYPES.find(t => t.value === v)?.label ?? v
}

function statusChipTone(status: string): 'green' | 'red' | 'orange' | 'gray' {
  if (status === 'passed') return 'green'
  if (status === 'failed') return 'red'
  if (status === 'warning') return 'orange'
  return 'gray'
}

const PAGE_SIZE = 10

function QCModal({
  editing, tests, worksheets, onClose, onDone,
}: {
  editing: QCSample | null; tests: LimsTest[]; worksheets: QCWorksheet[]
  onClose: () => void; onDone: () => void
}) {
  const isEdit = editing !== null

  const createAction = async (prev: QCSampleFormState, fd: FormData) => {
    const result = await createQCSample(prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const editAction = async (prev: QCSampleFormState, fd: FormData) => {
    const result = await updateQCSample(editing!.id, prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const [state, action, pending] = useActionState(isEdit ? editAction : createAction, {})

  const fieldErrors: Record<string, string> = {}
  if (state.errors) {
    for (const [k, msgs] of Object.entries(state.errors)) { if (msgs?.length) fieldErrors[k] = msgs[0] }
  }

  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEdit ? '#EFF6FF' : '#DBEAFE' }}>
              <MI name={isEdit ? 'edit' : 'add'} size={16} color={isEdit ? T.primaryHover : T.primary} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: T.heading }}>{isEdit ? `Edit — ${editing!.qc_id}` : 'New QC Sample'}</h2>
              <p style={{ fontSize: 10, color: T.faint }}>{isEdit ? 'Update QC sample details' : 'Log a new quality control sample'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
            <MI name="close" size={16} color={T.faint} />
          </button>
        </div>
        <form action={action} className="px-5 py-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="QC ID" required>
              <input name="qc_id" placeholder="e.g. QC-0001" defaultValue={editing?.qc_id}
                className="w-full outline-none bg-white" style={{ ...inputStyle, borderColor: fieldErrors.qc_id ? T.danger : T.inputBorder }} />
              {fieldErrors.qc_id && <p className="mt-0.5" style={{ fontSize: 11, color: T.danger }}>{fieldErrors.qc_id}</p>}
            </Field>
            <Field label="QC Type" required>
              <select name="qc_type" defaultValue={editing?.qc_type ?? ''} className="w-full outline-none bg-white"
                style={{ ...selectStyle, borderColor: fieldErrors.qc_type ? T.danger : T.inputBorder }}>
                <option value="" disabled>Select type…</option>
                {QC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {fieldErrors.qc_type && <p className="mt-0.5" style={{ fontSize: 11, color: T.danger }}>{fieldErrors.qc_type}</p>}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Test" required>
              <select name="test" defaultValue={editing?.test ?? ''} className="w-full outline-none bg-white"
                style={{ ...selectStyle, borderColor: fieldErrors.test ? T.danger : T.inputBorder }}>
                <option value="" disabled>Select test…</option>
                {tests.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {fieldErrors.test && <p className="mt-0.5" style={{ fontSize: 11, color: T.danger }}>{fieldErrors.test}</p>}
            </Field>
            <Field label="Worksheet" hint="Optional">
              <select name="worksheet" defaultValue={editing?.worksheet ?? ''} className="w-full outline-none bg-white" style={selectStyle}>
                <option value="">None</option>
                {worksheets.map(w => <option key={w.id} value={w.id}>{w.ws_id}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Lot Number">
              <input name="lot_number" placeholder="e.g. LOT-2026-01" defaultValue={editing?.lot_number} className="w-full outline-none bg-white" style={inputStyle} />
            </Field>
            <Field label="Expiry Date">
              <input type="date" name="expiry_date" defaultValue={editing?.expiry_date ?? ''} className="w-full outline-none bg-white" style={inputStyle} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Target Value">
              <input name="target_value" placeholder="0.0000" defaultValue={editing?.target_value ?? ''}
                className="w-full outline-none bg-white" style={{ ...inputStyle, borderColor: fieldErrors.target_value ? T.danger : T.inputBorder }} />
              {fieldErrors.target_value && <p className="mt-0.5" style={{ fontSize: 11, color: T.danger }}>{fieldErrors.target_value}</p>}
            </Field>
            <Field label="Tolerance %">
              <input name="tolerance_percent" placeholder="0.00" defaultValue={editing?.tolerance_percent ?? ''}
                className="w-full outline-none bg-white" style={{ ...inputStyle, borderColor: fieldErrors.tolerance_percent ? T.danger : T.inputBorder }} />
              {fieldErrors.tolerance_percent && <p className="mt-0.5" style={{ fontSize: 11, color: T.danger }}>{fieldErrors.tolerance_percent}</p>}
            </Field>
            <Field label="Actual Value">
              <input name="actual_value" placeholder="0.0000" defaultValue={editing?.actual_value ?? ''}
                className="w-full outline-none bg-white" style={{ ...inputStyle, borderColor: fieldErrors.actual_value ? T.danger : T.inputBorder }} />
              {fieldErrors.actual_value && <p className="mt-0.5" style={{ fontSize: 11, color: T.danger }}>{fieldErrors.actual_value}</p>}
            </Field>
          </div>

          <Field label="Status">
            <select name="status" defaultValue={editing?.status ?? 'pending'} className="w-full outline-none bg-white" style={selectStyle}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>

          <Field label="Notes">
            <textarea name="notes" rows={3} placeholder="Observations, corrective actions…" defaultValue={editing?.notes}
              className="w-full outline-none bg-white resize-none" style={textareaStyle} />
          </Field>

          {state.message && !state.success && (
            <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 12 }}>
              {state.message}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
            <Btn type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Btn>
            <Btn type="submit" variant={isEdit ? 'primary' : 'success'} icon={pending ? 'hourglass_top' : 'check'} disabled={pending}>
              {pending ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save Changes' : 'Create'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function QualityShell({
  initialQCSamples, tests, worksheets,
}: { initialQCSamples: QCSample[]; tests: LimsTest[]; worksheets: QCWorksheet[] }) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<QCSample | null>(null)
  const [deleting, setDeleting] = useState<QCSample | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [, startTransition] = useTransition()
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const testNameById = useMemo(() => {
    const m = new Map<number, string>()
    tests.forEach(t => m.set(t.id, t.name))
    return m
  }, [tests])
  const worksheetIdById = useMemo(() => {
    const m = new Map<number, string>()
    worksheets.forEach(w => m.set(w.id, w.ws_id))
    return m
  }, [worksheets])

  const filtered = useMemo(() => {
    return initialQCSamples.filter(q =>
      (!typeFilter || q.qc_type === typeFilter) &&
      (!statusFilter || q.status === statusFilter)
    )
  }, [initialQCSamples, typeFilter, statusFilter])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const total = initialQCSamples.length
  const passed = initialQCSamples.filter(q => q.status === 'passed').length
  const failed = initialQCSamples.filter(q => q.status === 'failed').length
  const pending = initialQCSamples.filter(q => q.status === 'pending').length

  function openCreate() { setEditing(null); setShowModal(true) }
  function openEdit(q: QCSample) { setEditing(q); setShowModal(true) }
  function closeModal() { setShowModal(false); setEditing(null) }
  function handleDone(msg: string) {
    setToast({ ok: true, msg })
    setTimeout(() => setToast(null), 4000)
    router.refresh()
  }
  function confirmDelete() {
    if (!deleting) return
    const target = deleting
    setDeleting(null)
    startTransition(async () => {
      const r = await deleteQCSample(target.id)
      setToast({ ok: r.success, msg: r.message })
      setTimeout(() => setToast(null), 4000)
      if (r.success) router.refresh()
    })
  }

  return (
    <div style={{ padding: 20, backgroundColor: T.pageBg, minHeight: '100%' }}>
      <PageHeader
        title="Quality Control"
        subtitle="Track QC samples — blanks, controls, spikes, duplicates and more"
        right={
          <Btn variant="primary" icon="add" onClick={openCreate}>New QC Sample</Btn>
        }
      />

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? T.primary : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? T.primary : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-5">
        <StatCard icon="science" label="Total QC Samples" value={total} />
        <StatCard icon="check_circle" iconColor={T.success} iconBg="#DBEAFE" label="Passed" value={passed} />
        <StatCard icon="cancel" iconColor={T.danger} iconBg="#FEF2F2" label="Failed" value={failed} />
        <StatCard icon="hourglass_top" iconColor={T.warning} iconBg="#FFF7ED" label="Pending" value={pending} />
      </div>

      {showModal && <QCModal editing={editing} tests={tests} worksheets={worksheets} onClose={closeModal} onDone={() => handleDone(editing ? 'QC sample updated.' : 'QC sample created.')} />}
      {deleting && (
        <ConfirmModal
          title="Delete QC Sample"
          message={`Are you sure you want to delete "${deleting.qc_id}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      <Card
        title="QC Samples"
        icon="science"
        action={
          <div className="flex items-center gap-2">
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }} style={{ ...selectStyle, height: 32, fontSize: 12 }}>
              <option value="">All Types</option>
              {QC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} style={{ ...selectStyle, height: 32, fontSize: 12 }}>
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        }
        pad={false}
      >
        {filtered.length === 0 ? (
          <EmptyState icon="science" title="No QC samples found" sub="Adjust your filters or create a new QC sample." />
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['QC ID', 'Type', 'Test', 'Worksheet', 'Lot #', 'Target', 'Actual', 'Status', ''].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(q => (
                    <tr key={q.id}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: T.heading }}>{q.qc_id}</td>
                      <td style={tdStyle}>{qcTypeLabel(q.qc_type)}</td>
                      <td style={tdStyle}>{testNameById.get(q.test) ?? `#${q.test}`}</td>
                      <td style={tdStyle}>{q.worksheet ? (worksheetIdById.get(q.worksheet) ?? `#${q.worksheet}`) : '—'}</td>
                      <td style={tdStyle}>{q.lot_number || '—'}</td>
                      <td style={tdStyle}>{q.target_value ?? '—'}</td>
                      <td style={tdStyle}>{q.actual_value ?? '—'}</td>
                      <td style={tdStyle}><Chip tone={statusChipTone(q.status)} dot>{q.status}</Chip></td>
                      <td style={tdStyle}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(q)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                            <MI name="edit" size={14} color={T.faint} />
                          </button>
                          <button onClick={() => setDeleting(q)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                            <MI name="delete" size={14} color={T.danger} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
              <p style={{ fontSize: 11, color: T.faint }}>{filtered.length} QC sample{filtered.length !== 1 ? 's' : ''}</p>
              <Pagination page={page} pages={pages} onPage={setPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

'use client'
import { useMemo, useState, useActionState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeader, Card, StatCard, Btn, Field, ConfirmModal, EmptyState, Pagination,
  MI, T, Chip, thStyle, tdStyle, inputStyle, selectStyle, textareaStyle,
} from '@/app/dashboard/_components/ui'
import {
  createQCSample, updateQCSample, deleteQCSample, reviewQCSample,
  type QCSample, type QCSampleFormState, type QCWorksheet,
} from '@/app/actions/quality'
import { type SenaiteAnalysisService } from '@/app/lib/senaite'
import QualityResultImportPanel from './QualityResultImportPanel'

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
  editing, services, worksheets, onClose, onDone,
}: {
  editing: QCSample | null; services: SenaiteAnalysisService[]; worksheets: QCWorksheet[]
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
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1000 }}>
      <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', right: 0, bottom: 'var(--dashboard-footer-h)', width: 560, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
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
              <select name="senaite_service_uid" defaultValue={editing?.senaite_service_uid ?? ''} className="w-full outline-none bg-white"
                onChange={e => {
                  const nameInput = e.currentTarget.form?.elements.namedItem('senaite_service_name') as HTMLInputElement | null
                  if (nameInput) nameInput.value = e.currentTarget.selectedOptions[0]?.text ?? ''
                }}
                style={{ ...selectStyle, borderColor: fieldErrors.senaite_service_uid ? T.danger : T.inputBorder }}>
                <option value="" disabled>Select test…</option>
                {services.map(s => <option key={s.uid} value={s.uid}>{s.title}</option>)}
              </select>
              <input type="hidden" name="senaite_service_name" defaultValue={editing?.senaite_service_name ?? ''} />
              {fieldErrors.senaite_service_uid && <p className="mt-0.5" style={{ fontSize: 11, color: T.danger }}>{fieldErrors.senaite_service_uid}</p>}
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

          <p style={{ fontSize: 11, color: T.muted }}>
            Status is evaluated automatically: Actual within Target ± Tolerance → Passed; otherwise → Failed (holds for administrator review).
          </p>
          <input type="hidden" name="status" value={editing?.status ?? 'pending'} />

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

function ReviewModal({
  sample, onClose, onDone,
}: {
  sample: QCSample; onClose: () => void; onDone: (msg: string) => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function handleReview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    const notes = formData.get('review_notes') as string
    const action = formData.get('action_type') as 'accept' | 'reanalyze'
    if (!notes.trim()) return setError('Review notes are required.')
    
    setPending(true)
    const res = await reviewQCSample(sample.id, notes, action)
    setPending(false)
    if (res.success) {
      onDone(res.message)
    } else {
      setError(res.message)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 }}>
      <div className="bg-white rounded-xl shadow-2xl flex flex-col w-[500px] overflow-hidden" style={{ maxHeight: '90vh' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
          <div>
            <h2 className="font-semibold text-gray-900">Administrator Review</h2>
            <p className="text-xs text-gray-500 mt-1">Reviewing failing QC Sample {sample.qc_id}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><MI name="close" size={18} color={T.faint} /></button>
        </div>
        <form onSubmit={handleReview} className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">
          <div className="p-3 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <p className="text-xs font-semibold text-red-800 flex items-center gap-1">
              <MI name="warning" size={14} /> Failed QC Verification
            </p>
            <p className="text-xs text-red-700 mt-1">
              Target: {sample.target_value} ±{sample.tolerance_percent}% | Actual: {sample.actual_value}
            </p>
          </div>

          <Field label="Action">
            <select name="action_type" className="w-full outline-none bg-white" style={selectStyle}>
              <option value="accept">Review & Accept (Override)</option>
              <option value="reanalyze">Reject & Trigger Re-analysis</option>
            </select>
          </Field>

          <Field label="Corrective Action Notes (Required)">
            <textarea name="review_notes" rows={4} placeholder="Enter your review notes, corrective actions, or reasons for acceptance..."
              className="w-full outline-none bg-white resize-none" style={textareaStyle} required />
          </Field>

          {error && (
            <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 12 }}>
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
            <Btn type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Btn>
            <Btn type="submit" variant="primary" icon={pending ? 'hourglass_top' : 'verified_user'} disabled={pending}>
              {pending ? 'Submitting…' : 'Submit Review'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function QualityShell({
  initialQCSamples, services, worksheets,
}: { initialQCSamples: QCSample[]; services: SenaiteAnalysisService[]; worksheets: QCWorksheet[] }) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<QCSample | null>(null)
  const [deleting, setDeleting] = useState<QCSample | null>(null)
  const [reviewing, setReviewing] = useState<QCSample | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [, startTransition] = useTransition()
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<'qc' | 'import'>('qc')

  const worksheetIdById = useMemo(() => {
    const m = new Map<number, string>()
    worksheets.forEach(w => m.set(w.id, w.ws_id))
    return m
  }, [worksheets])

  const filtered = useMemo(() => {
    return initialQCSamples.filter(q =>
      (!typeFilter || q.qc_type === typeFilter) &&
      (!statusFilter || q.status === statusFilter) &&
      (!needsReviewOnly || ((q.status === 'failed' || q.status === 'warning') && !q.is_reviewed))
    )
  }, [initialQCSamples, typeFilter, statusFilter, needsReviewOnly])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const total = initialQCSamples.length
  const passed = initialQCSamples.filter(q => q.status === 'passed').length
  const failed = initialQCSamples.filter(q => q.status === 'failed').length
  const pending = initialQCSamples.filter(q => q.status === 'pending').length
  const needsReview = initialQCSamples.filter(q => (q.status === 'failed' || q.status === 'warning') && !q.is_reviewed).length

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
    <div style={{ padding: 20, backgroundColor: T.pageBg, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0 }}>
      <PageHeader
        title="Quality Control"
        subtitle="Controls, blanks, spikes — failed QC is flagged for administrator review before release"
        right={
          tab === 'qc' ? <Btn variant="primary" icon="add" onClick={openCreate}>New QC Sample</Btn> : undefined
        }
      />

      <div className="flex items-center gap-1 mb-4" style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
        {([['qc', 'QC Samples'], ['import', 'Result Import']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className="px-4 py-2 text-sm font-medium"
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              color: tab === key ? T.primary : T.muted,
              borderBottom: tab === key ? `2px solid ${T.primary}` : '2px solid transparent',
            }}>
            {label}
          </button>
        ))}
      </div>
      </div>

      {tab === 'import' && (
        <Card title="Import Results" icon="upload_file">
          <QualityResultImportPanel />
        </Card>
      )}

      {tab === 'qc' && <>
      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? T.primary : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? T.primary : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {needsReview > 0 && (
        <div className="mb-4 flex items-center justify-between px-4 py-3 rounded-xl"
          style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
          <div className="flex items-center gap-2">
            <MI name="policy" size={18} color="#DC2626" />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#991B1B' }}>{needsReview} QC sample{needsReview !== 1 ? 's' : ''} awaiting administrator review</p>
              <p style={{ fontSize: 11, color: '#B91C1C' }}>Failed or warning controls must be reviewed before related results can be treated as release-ready.</p>
            </div>
          </div>
          <Btn variant="outline" icon="filter_list" onClick={() => { setNeedsReviewOnly(true); setStatusFilter(''); setPage(1) }}>
            Show queue
          </Btn>
        </div>
      )}

      <div className="grid grid-cols-5 gap-4 mb-5">
        <StatCard icon="science" label="Total QC Samples" value={total} />
        <StatCard icon="check_circle" iconColor={T.success} iconBg="#DBEAFE" label="Passed" value={passed} />
        <StatCard icon="cancel" iconColor={T.danger} iconBg="#FEF2F2" label="Failed" value={failed} />
        <StatCard icon="hourglass_top" iconColor={T.warning} iconBg="#FFF7ED" label="Pending" value={pending} />
        <StatCard icon="policy" iconColor="#DC2626" iconBg="#FEF2F2" label="Needs Review" value={needsReview} />
      </div>

      {showModal && <QCModal editing={editing} services={services} worksheets={worksheets} onClose={closeModal} onDone={() => handleDone(editing ? 'QC sample updated.' : 'QC sample created.')} />}
      {reviewing && <ReviewModal sample={reviewing} onClose={() => setReviewing(null)} onDone={msg => { setReviewing(null); handleDone(msg) }} />}
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

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <Card
        title="QC Samples"
        icon="science"
        action={
          <div className="flex items-center gap-2">
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }} style={{ ...selectStyle, height: 32, fontSize: 12 }}>
              <option value="">All Types</option>
              {QC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setNeedsReviewOnly(false); setPage(1) }} style={{ ...selectStyle, height: 32, fontSize: 12 }}>
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button type="button" onClick={() => { setNeedsReviewOnly(v => !v); setStatusFilter(''); setPage(1) }}
              className="px-2 rounded"
              style={{
                height: 32, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: needsReviewOnly ? '1px solid #FECACA' : `1px solid ${T.cardBorder}`,
                backgroundColor: needsReviewOnly ? '#FEF2F2' : '#fff',
                color: needsReviewOnly ? '#991B1B' : T.muted,
              }}>
              Needs review
            </button>
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
                      <td style={tdStyle}>{q.senaite_service_name || '—'}</td>
                      <td style={tdStyle}>{q.worksheet ? (worksheetIdById.get(q.worksheet) ?? `#${q.worksheet}`) : '—'}</td>
                      <td style={tdStyle}>{q.lot_number || '—'}</td>
                      <td style={tdStyle}>
                        {q.target_value != null
                          ? <>{q.target_value}{q.tolerance_percent != null ? <span style={{ color: T.faint }}> ±{q.tolerance_percent}%</span> : null}</>
                          : '—'}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: q.status === 'failed' ? 700 : 400, color: q.status === 'failed' ? T.danger : T.text }}>
                        {q.actual_value ?? '—'}
                      </td>
                      <td style={tdStyle}>
                        <div className="flex items-center gap-2">
                          <Chip tone={statusChipTone(q.status)} dot>{q.status}</Chip>
                          {(q.status === 'failed' || q.status === 'warning') && !q.is_reviewed && (
                             <span className="inline-flex items-center gap-1 font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200" style={{ fontSize: 10 }}>
                               <MI name="warning" size={10} /> Requires Review
                             </span>
                          )}
                          {q.is_reviewed && (
                             <span className="inline-flex items-center gap-1 font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200" style={{ fontSize: 10 }}>
                               <MI name="verified_user" size={10} /> Reviewed by {q.reviewed_by_name || 'Admin'}
                             </span>
                          )}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div className="flex items-center justify-end gap-1">
                          {(q.status === 'failed' || q.status === 'warning') && !q.is_reviewed && (
                             <button onClick={() => setReviewing(q)} className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 flex items-center gap-1" style={{ border: '1px solid #FECACA', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                               <MI name="policy" size={13} /> Review
                             </button>
                          )}
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
      </>}
    </div>
  )
}

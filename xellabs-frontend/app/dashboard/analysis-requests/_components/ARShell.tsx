'use client'
import { useState, useActionState, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createAnalysisRequest, updateAnalysisRequest, updateARStatus, type AnalysisRequest, type ARFormState } from '@/app/actions/analysis-requests'
import { type LabSample } from '@/app/actions/lab-samples'
import { type LimsTest } from '@/app/actions/tests'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low',    bg: '#F3F4F6', color: '#6B7280' },
  { value: 'normal', label: 'Normal', bg: '#DBEAFE', color: '#1E40AF' },
  { value: 'high',   label: 'High',   bg: '#FEF3C7', color: '#92400E' },
  { value: 'urgent', label: 'Urgent', bg: '#FEE2E2', color: '#991B1B' },
]

const STATUS_OPTIONS = [
  { value: 'pending',     label: 'Pending',     bg: '#F3F4F6', color: '#374151' },
  { value: 'in_progress', label: 'In Progress', bg: '#DBEAFE', color: '#1E40AF' },
  { value: 'completed',   label: 'Completed',   bg: '#DBEAFE', color: '#0154FC' },
  { value: 'cancelled',   label: 'Cancelled',   bg: '#FEE2E2', color: '#991B1B' },
]

type Props = { initialARs: AnalysisRequest[]; samples: LabSample[]; tests: LimsTest[] }

function ARModal({ samples, tests, onClose, onDone, preselectedSampleId, editing }: { samples: LabSample[]; tests: LimsTest[]; onClose: () => void; onDone: () => void; preselectedSampleId?: string; editing?: AnalysisRequest | null }) {
  const isEdit = Boolean(editing)
  const formAction = async (prev: ARFormState, fd: FormData) => {
    const result = isEdit ? await updateAnalysisRequest(editing!.id, prev, fd) : await createAnalysisRequest(prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const [state, action, pending] = useActionState(formAction, {})
  const inputStyle = (err?: string) => ({ border: `1px solid ${err ? '#EF4444' : '#D1D5DB'}`, color: '#111827' })

  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1000 }}>
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 520, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
              <MI name="assignment_add" size={16} color="#0154FC" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEdit ? `Edit — ${editing!.ar_id}` : 'New Analysis Request'}</h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>{isEdit ? 'Update tests, priority and notes' : 'Link a sample to tests and set priority'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
        </div>
        <form action={action} className="px-5 py-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Sample <span style={{ color: '#EF4444' }}>*</span></label>
            {isEdit ? (
              <input readOnly value={editing!.sample_id || `#${editing!.sample}`} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ ...inputStyle(), backgroundColor: '#FAFAFA', color: '#9CA3AF' }} />
            ) : (
              <select name="sample" required defaultValue={preselectedSampleId ?? ''} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle(state.errors?.sample?.[0])}>
                <option value="">Select sample…</option>
                {samples.map(s => <option key={s.id} value={s.id}>{s.sample_id} — {s.client_name} ({s.sample_type_name})</option>)}
              </select>
            )}
            {state.errors?.sample && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.sample[0]}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Tests <span style={{ color: '#EF4444' }}>*</span> <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(select multiple)</span></label>
            <div style={{ border: `1px solid ${state.errors?.tests?.[0] ? '#EF4444' : '#D1D5DB'}`, borderRadius: 8, backgroundColor: '#FAFAFA', maxHeight: 160, overflowY: 'auto', padding: '8px 12px' }}>
              {tests.filter(t => t.is_active).map(t => (
                <label key={t.id} className="flex items-center gap-2 py-1.5 cursor-pointer">
                  <input type="checkbox" name="tests" value={t.id} defaultChecked={editing?.tests?.includes(t.id)} style={{ accentColor: '#2563EB' }} />
                  <span style={{ fontSize: 12, color: '#374151' }}>{t.name}</span>
                  <span style={{ fontSize: 10, color: '#9CA3AF' }}>({t.code})</span>
                  {t.unit && <span style={{ fontSize: 10, color: '#9CA3AF' }}>— {t.unit}</span>}
                </label>
              ))}
              {tests.filter(t => t.is_active).length === 0 && <p style={{ fontSize: 12, color: '#9CA3AF' }}>No active tests — create tests first.</p>}
            </div>
            {state.errors?.tests && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.tests[0]}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Priority</label>
              <select name="priority" defaultValue={editing?.priority ?? 'normal'} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle(state.errors?.priority?.[0])}>
                {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {state.errors?.priority?.[0] && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.priority[0]}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Due Date</label>
              <input type="date" name="due_date" defaultValue={editing?.due_date?.slice(0, 10) ?? ''} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle(state.errors?.due_date?.[0])} />
              {state.errors?.due_date?.[0] && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.due_date[0]}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Notes</label>
            <textarea name="notes" rows={2} defaultValue={editing?.notes ?? ''} placeholder="Any additional instructions…" className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none" style={inputStyle(state.errors?.notes?.[0])} />
            {state.errors?.notes?.[0] && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.notes[0]}</p>}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button type="button" onClick={onClose} disabled={pending}
              style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className="flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}>
              <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
              {pending ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save Changes' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ARShell({ initialARs, samples, tests }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedSampleId = searchParams.get('sample') ?? undefined
  const [showModal, setShowModal] = useState(!!preselectedSampleId)
  const [editing, setEditing] = useState<AnalysisRequest | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [busy, startTransition] = useTransition()

  // Arriving via a deep link from Sample Detail (?sample=ID) opens the create
  // modal pre-filled — otherwise a user has to re-find the sample manually.
  useEffect(() => { if (preselectedSampleId) setShowModal(true) }, [preselectedSampleId])

  // Deep link to a specific AR (?ar=<id>) — opens that AR's modal directly,
  // used by the AR ID links on the Sample Detail page.
  const deepLinkArId = searchParams.get('ar')
  useEffect(() => {
    if (!deepLinkArId) return
    const target = initialARs.find(a => String(a.id) === deepLinkArId)
    if (target) { setEditing(target); setShowModal(true) }
  }, [deepLinkArId, initialARs])

  function handleDone() {
    setToast({ ok: true, msg: editing ? 'Analysis request updated.' : 'Analysis request created.' })
    setTimeout(() => setToast(null), 4000)
    setEditing(null)
    router.refresh()
  }

  function changeStatus(id: number, status: string) {
    startTransition(async () => {
      const r = await updateARStatus(id, status)
      setToast({ ok: r.success, msg: r.message })
      setTimeout(() => setToast(null), 3000)
      if (r.success) router.refresh()
    })
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Analysis Requests</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Link samples to tests and manage analysis workflow</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New Request
        </button>
      </div>
      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? "1px solid #93C5FD" : "1px solid #FECACA", color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}
      {showModal && (
        <ARModal
          samples={samples}
          tests={tests}
          preselectedSampleId={preselectedSampleId}
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null); if (preselectedSampleId || deepLinkArId) router.replace('/dashboard/analysis-requests') }}
          onDone={handleDone}
        />
      )}
      {initialARs.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="assignment" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No analysis requests yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Register a sample first, then create an analysis request</p>
          <button onClick={() => setShowModal(true)} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Request
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '12%' }} /><col style={{ width: '14%' }} /><col style={{ width: '24%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} /><col style={{ width: '12%' }} /><col style={{ width: '12%' }} /><col style={{ width: '6%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['AR ID', 'Sample', 'Tests', 'Priority', 'Due Date', 'Status', 'Change Status', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialARs.map((ar, i) => {
                const pri = PRIORITY_OPTIONS.find(o => o.value === ar.priority) ?? PRIORITY_OPTIONS[1]
                const sta = STATUS_OPTIONS.find(o => o.value === ar.status) ?? STATUS_OPTIONS[0]
                return (
                  <tr key={ar.id} style={{ borderBottom: i < initialARs.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-xs font-semibold font-mono" style={{ color: '#2563EB' }}>{ar.ar_id}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#374151' }}>{ar.sample_id || `#${ar.sample}`}</td>
                    <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#6B7280' }}>{ar.test_names?.join(', ') || `${ar.tests?.length ?? 0} test(s)`}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: pri.bg, color: pri.color }}>{pri.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{ar.due_date ? new Date(ar.due_date).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: sta.bg, color: sta.color }}>{sta.label}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={ar.status}
                        disabled={busy || ar.status === 'completed' || ar.status === 'cancelled'}
                        onChange={e => changeStatus(ar.id, e.target.value)}
                        className="text-xs rounded-lg outline-none px-2 py-1"
                        style={{ border: '1px solid #D1D5DB', color: '#374151', fontSize: 11 }}
                      >
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => { setEditing(ar); setShowModal(true) }} title="Edit tests / priority / notes"
                        className="flex items-center justify-center rounded-lg hover:bg-gray-100"
                        style={{ width: 28, height: 28, border: 'none', backgroundColor: '#F9FAFB', cursor: 'pointer' }}>
                        <MI name="edit" size={15} color="#6B7280" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialARs.length} request{initialARs.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useActionState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createAnalysisRequest, updateARStatus, type AnalysisRequest, type ARFormState } from '@/app/actions/analysis-requests'
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
  { value: 'completed',   label: 'Completed',   bg: '#DCFCE7', color: '#166534' },
  { value: 'cancelled',   label: 'Cancelled',   bg: '#FEE2E2', color: '#991B1B' },
]

type Props = { initialARs: AnalysisRequest[]; samples: LabSample[]; tests: LimsTest[] }

function ARModal({ samples, tests, onClose, onDone }: { samples: LabSample[]; tests: LimsTest[]; onClose: () => void; onDone: () => void }) {
  const createAction = async (prev: ARFormState, fd: FormData) => {
    const result = await createAnalysisRequest(prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const [state, action, pending] = useActionState(createAction, {})
  const inputStyle = (err?: string) => ({ border: `1px solid ${err ? '#EF4444' : '#D1D5DB'}`, color: '#111827' })

  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F0FDFA' }}>
              <MI name="assignment_add" size={16} color="#14B8A6" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>New Analysis Request</h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>Link a sample to tests and set priority</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
        </div>
        {state.message && !state.success && (
          <div className="mx-5 mt-4 px-3 py-2 rounded-lg flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <MI name="error_outline" size={14} color="#EF4444" />
            <span style={{ fontSize: 12, color: '#B91C1C' }}>{state.message}</span>
          </div>
        )}
        <form action={action} className="px-5 py-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Sample <span style={{ color: '#EF4444' }}>*</span></label>
            <select name="sample" required className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle(state.errors?.sample?.[0])}>
              <option value="">Select sample…</option>
              {samples.map(s => <option key={s.id} value={s.id}>{s.sample_id} — {s.client_name} ({s.sample_type_name})</option>)}
            </select>
            {state.errors?.sample && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.sample[0]}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Tests <span style={{ color: '#EF4444' }}>*</span> <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(select multiple)</span></label>
            <div style={{ border: `1px solid ${state.errors?.tests?.[0] ? '#EF4444' : '#D1D5DB'}`, borderRadius: 8, backgroundColor: '#FAFAFA', maxHeight: 160, overflowY: 'auto', padding: '8px 12px' }}>
              {tests.filter(t => t.is_active).map(t => (
                <label key={t.id} className="flex items-center gap-2 py-1.5 cursor-pointer">
                  <input type="checkbox" name="tests" value={t.id} style={{ accentColor: '#2563EB' }} />
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
              <select name="priority" defaultValue="normal" className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle()}>
                {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Due Date</label>
              <input type="date" name="due_date" className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle()} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Notes</label>
            <textarea name="notes" rows={2} placeholder="Any additional instructions…" className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none" style={inputStyle()} />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button type="button" onClick={onClose} disabled={pending}
              style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className="flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#14B8A6', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}>
              <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
              {pending ? 'Creating…' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ARShell({ initialARs, samples, tests }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [busy, startTransition] = useTransition()

  function handleDone() {
    setToast({ ok: true, msg: 'Analysis request created.' })
    setTimeout(() => setToast(null), 4000)
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
    <div style={{ padding: '12px 20px 0', backgroundColor: '#F5F6FA', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#111827' }}>Analysis Requests</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Link samples to tests and manage analysis workflow</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#14B8A6' }}>
          <MI name="add" size={15} color="#fff" /> New Request
        </button>
      </div>
      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${toast.ok ? '#A7F3D0' : '#FECACA'}`, color: toast.ok ? '#065F46' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#10B981' : '#DC2626'} />
          {toast.msg}
        </div>
      )}
      {showModal && <ARModal samples={samples} tests={tests} onClose={() => setShowModal(false)} onDone={handleDone} />}
      {initialARs.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E5E7EB' }}>
          <MI name="assignment" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No analysis requests yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Register a sample first, then create an analysis request</p>
          <button onClick={() => setShowModal(true)} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#14B8A6' }}>
            <MI name="add" size={13} color="#fff" /> New Request
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '12%' }} /><col style={{ width: '14%' }} /><col style={{ width: '28%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} /><col style={{ width: '12%' }} /><col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['AR ID', 'Sample', 'Tests', 'Priority', 'Due Date', 'Status', 'Change Status'].map(h => (
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
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{ar.due_date ? new Date(ar.due_date).toLocaleDateString() : '—'}</td>
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

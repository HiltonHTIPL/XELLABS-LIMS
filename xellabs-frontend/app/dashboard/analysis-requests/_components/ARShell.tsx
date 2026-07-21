'use client'
import { useState, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { updateARStatus, type AnalysisRequest } from '@/app/actions/analysis-requests'
import { type LabSample } from '@/app/actions/lab-samples'
import { type SenaiteAnalysisService } from '@/app/lib/senaite'
import AnalysisRequestModal from '@/app/dashboard/_components/AnalysisRequestModal'

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

type Props = { initialARs: AnalysisRequest[]; samples: LabSample[]; services: SenaiteAnalysisService[] }

export default function ARShell({ initialARs, samples, services }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedSampleId = searchParams.get('sample') ?? undefined
  const [showModal, setShowModal] = useState(!!preselectedSampleId)
  const [editing, setEditing] = useState<AnalysisRequest | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [busy, startTransition] = useTransition()

  // Arriving via a deep link from Sample Detail (?sample=ID) opens the create
  // modal pre-filled — otherwise a user has to re-find the sample manually.
  // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-3" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="arrow_back" size={16} color="#6B7280" />
          </Link>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Analysis Requests</h1>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Link samples to tests and manage analysis workflow</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New Request
        </button>
      </div>
      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? "1px solid #93C5FD" : "1px solid #FECACA", color: toast.ok ? '#0154FC' : '#991B1B', flexShrink: 0 }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}
      {showModal && (
        <AnalysisRequestModal
          samples={samples}
          services={services}
          preselectedSampleId={preselectedSampleId}
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null); if (preselectedSampleId || deepLinkArId) router.replace('/dashboard/analysis-requests') }}
          onDone={handleDone}
        />
      )}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
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
                    <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#6B7280' }}>{ar.analyses.map(a => a.senaite_service_name).join(', ') || `${ar.analyses.length} test(s)`}</td>
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
    </div>
  )
}

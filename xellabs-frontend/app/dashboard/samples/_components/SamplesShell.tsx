'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import NewSampleModal from './NewSampleModal'
import { receiveSample } from '@/app/actions/samples'
import { SenaiteSample, SenaiteSampleType, SenaiteAnalysisService, mapSenaiteState, mapSenaitePriority } from '@/app/lib/senaite'
import { DjangoClient } from '@/app/actions/clients'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const STATE_BADGE: Record<string, { bg: string; color: string }> = {
  'Registered':      { bg: '#F3F4F6', color: '#374151' },
  'Sample Due':      { bg: '#FEF3C7', color: '#92400E' },
  'Received':        { bg: '#CCFBF1', color: '#0F766E' },
  'To Be Verified':  { bg: '#FEF3C7', color: '#92400E' },
  'Verified':        { bg: '#DBEAFE', color: '#1E40AF' },
  'Published':       { bg: '#DCFCE7', color: '#166534' },
  'Invalid':         { bg: '#FEE2E2', color: '#991B1B' },
  'Cancelled':       { bg: '#F3F4F6', color: '#9CA3AF' },
}

const PRIORITY_BADGE: Record<string, { bg: string; color: string }> = {
  'Critical': { bg: '#FEE2E2', color: '#B91C1C' },
  'High':     { bg: '#FFEDD5', color: '#C2410C' },
  'Normal':   { bg: '#DBEAFE', color: '#1E40AF' },
  'Low':      { bg: '#F3F4F6', color: '#6B7280' },
  'Routine':  { bg: '#F0FDF4', color: '#166534' },
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return d }
}

type Props = {
  initialSamples: SenaiteSample[]
  clients: DjangoClient[]
  sampleTypes: SenaiteSampleType[]
  analysisServices: SenaiteAnalysisService[]
}

type ClientOption = { uid: string; name: string; client_id: string }

export default function SamplesShell({ initialSamples, clients, sampleTypes, analysisServices }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [samples] = useState(initialSamples)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  const clientOptions: ClientOption[] = clients.map(c => ({ uid: c.senaite_uid || String(c.id), name: c.name, client_id: c.client_id }))

  const filtered = samples.filter(s => {
    const stateLabel = mapSenaiteState(s.review_state)
    const priorityLabel = mapSenaitePriority(s.Priority)
    if (search && !s.id.toLowerCase().includes(search.toLowerCase()) && !s.ClientTitle.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus && stateLabel !== filterStatus) return false
    if (filterPriority && priorityLabel !== filterPriority) return false
    if (filterClient && s.ClientTitle !== filterClient) return false
    return true
  })

  function handleReceive(uid: string) {
    startTransition(async () => {
      const result = await receiveSample(uid)
      setActionMsg({ text: result.message, ok: result.success })
      setTimeout(() => setActionMsg(null), 3000)
      router.refresh()
    })
  }

  const allStatuses = [...new Set(samples.map(s => mapSenaiteState(s.review_state)))]
  const allClients  = [...new Set(samples.map(s => s.ClientTitle).filter(Boolean))]

  // KPI counts
  const kpis = [
    { label: 'Registered',     value: samples.filter(s => s.review_state === 'registered').length,      icon: 'science',      iconBg: '#EFF6FF', iconColor: '#3B82F6' },
    { label: 'Received',       value: samples.filter(s => s.review_state === 'sample_received').length,  icon: 'move_to_inbox',iconBg: '#F0FDFA', iconColor: '#0D9488' },
    { label: 'To Be Verified', value: samples.filter(s => s.review_state === 'to_be_verified').length,   icon: 'fact_check',   iconBg: '#FFF7ED', iconColor: '#F97316' },
    { label: 'Verified',       value: samples.filter(s => s.review_state === 'verified').length,          icon: 'verified',     iconBg: '#EEF2FF', iconColor: '#6366F1' },
    { label: 'Published',      value: samples.filter(s => s.review_state === 'published').length,         icon: 'check_circle', iconBg: '#F0FDF4', iconColor: '#22C55E' },
    { label: 'Total',          value: samples.length,                                                     icon: 'analytics',    iconBg: '#F5F3FF', iconColor: '#7C3AED' },
  ]

  return (
    <div style={{ backgroundColor: '#F5F6FA', minHeight: '100%', padding: '16px 20px', boxSizing: 'border-box' }}>

      {showModal && (
        <NewSampleModal
          onClose={() => setShowModal(false)}
          clients={clientOptions}
          sampleTypes={sampleTypes}
          analysisServices={analysisServices}
          onCreated={() => router.refresh()}
        />
      )}

      {/* Action feedback */}
      {actionMsg && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg flex items-center gap-2 shadow-lg"
          style={{ backgroundColor: actionMsg.ok ? '#DCFCE7' : '#FEE2E2', border: `1px solid ${actionMsg.ok ? '#86EFAC' : '#FECACA'}` }}>
          <MI name={actionMsg.ok ? 'check_circle' : 'error_outline'} size={16} color={actionMsg.ok ? '#16A34A' : '#EF4444'} />
          <span style={{ fontSize: 13, color: actionMsg.ok ? '#166534' : '#B91C1C' }}>{actionMsg.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#111827' }}>Samples</h1>
          <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Manage and track laboratory samples — live from XELLABS LIMS.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.refresh()} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
            style={{ border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
            <MI name="refresh" size={14} color="#6B7280" /> Refresh
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
            style={{ backgroundColor: '#2563EB', cursor: 'pointer' }}>
            <MI name="add" size={14} color="#fff" /> New Sample
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-6 gap-2.5 mb-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl p-3" style={{ border: '1px solid #E5E7EB' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: k.iconBg }}>
                <MI name={k.icon} size={16} color={k.iconColor} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#111827', lineHeight: 1 }}>{k.value}</p>
            <p className="text-xs font-medium mt-1" style={{ color: '#374151' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl mb-3" style={{ border: '1px solid #E5E7EB', padding: '12px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Search Samples</p>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ border: '1px solid #E5E7EB', backgroundColor: '#FAFAFA' }}>
              <MI name="search" size={14} color="#9CA3AF" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Sample ID or client…" className="flex-1 text-xs bg-transparent outline-none" style={{ color: '#374151' }} />
            </div>
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Client</p>
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
              className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none" style={{ border: '1px solid #E5E7EB', backgroundColor: '#FAFAFA', color: '#374151' }}>
              <option value="">All Clients</option>
              {allClients.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Status</p>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none" style={{ border: '1px solid #E5E7EB', backgroundColor: '#FAFAFA', color: '#374151' }}>
              <option value="">All Statuses</option>
              {allStatuses.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Priority</p>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
              className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none" style={{ border: '1px solid #E5E7EB', backgroundColor: '#FAFAFA', color: '#374151' }}>
              <option value="">All Priorities</option>
              {['Critical','High','Normal','Low','Routine'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterPriority(''); setFilterClient('') }}
            className="text-xs px-3 py-1.5 rounded-lg" style={{ border: '1px solid #E5E7EB', color: '#6B7280', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center" style={{ border: '1px solid #E5E7EB', height: 280 }}>
          <MI name="science" size={40} color="#E5E7EB" />
          <p style={{ fontSize: 14, color: '#9CA3AF', marginTop: 12 }}>No samples yet</p>
          <p style={{ fontSize: 12, color: '#D1D5DB', marginTop: 4 }}>Create a sample or check XELLABS LIMS for existing ones</p>
          <button onClick={() => setShowModal(true)} className="mt-4 flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg text-white"
            style={{ backgroundColor: '#2563EB', cursor: 'pointer' }}>
            <MI name="add" size={14} color="#fff" /> New Sample
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                  {['Sample ID','Client','Sample Type','Status','Priority','Date Sampled','Date Due','Analyses','Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const stateLabel    = mapSenaiteState(s.review_state)
                  const priorityLabel = mapSenaitePriority(s.Priority)
                  const sb = STATE_BADGE[stateLabel]    ?? { bg: '#F3F4F6', color: '#374151' }
                  const pb = PRIORITY_BADGE[priorityLabel] ?? { bg: '#F3F4F6', color: '#374151' }
                  const canReceive = s.review_state === 'registered' || s.review_state === 'sample_due'
                  return (
                    <tr key={s.uid} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F9FAFB' : 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAFAFA')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <Link href={`/dashboard/samples/${s.uid}`}
                          style={{ fontSize: 12, fontWeight: 600, color: '#2563EB', textDecoration: 'none' }}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                          {s.id || s.uid.slice(0, 8)}
                        </Link>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>
                        {s.ClientTitle || '—'}
                        {s.ClientID && <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 4 }}>({s.ClientID})</span>}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>{s.SampleTypeTitle || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, backgroundColor: sb.bg, color: sb.color, whiteSpace: 'nowrap' }}>
                          {stateLabel}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, backgroundColor: pb.bg, color: pb.color }}>
                          {priorityLabel}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>{fmtDate(s.DateSampled)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>{fmtDate(s.DateDue)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151' }}>
                        <span style={{ fontSize: 11, color: '#6B7280' }}>{s.Analyses.length} test{s.Analyses.length !== 1 ? 's' : ''}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div className="flex items-center gap-1">
                          {canReceive && (
                            <button onClick={() => handleReceive(s.uid)} disabled={isPending}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                              style={{ backgroundColor: '#F0FDFA', color: '#0D9488', border: '1px solid #CCFBF1', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <MI name="move_to_inbox" size={12} color="#0D9488" /> Receive
                            </button>
                          )}
                          <Link href={`/dashboard/samples/${s.uid}`}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                            style={{ backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #DBEAFE', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                            <MI name="visibility" size={12} color="#2563EB" /> View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5" style={{ borderTop: '1px solid #F3F4F6' }}>
            <span style={{ fontSize: 11, color: '#6B7280' }}>Showing {filtered.length} of {samples.length} samples</span>
          </div>
        </div>
      )}
    </div>
  )
}

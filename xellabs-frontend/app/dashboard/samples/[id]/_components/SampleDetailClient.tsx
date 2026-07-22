'use client'
import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SenaiteSample, mapSenaiteState, mapSenaitePriority } from '@/app/lib/senaite'
import { receiveSample, verifySample, publishSample, getSampleReviewHistory } from '@/app/actions/samples'
import { getLabSample, type LabSample } from '@/app/actions/lab-samples'
import { EditDrawer } from '../../../samples-overview/[id]/_components/SampleOverviewDetail'
import ChainOfCustodyDrawer from '../../../samples-overview/[id]/_components/ChainOfCustodyDrawer'
import { T, MI, Breadcrumb, Btn, Card, Chip, StatusChip, thStyle, tdStyle, EmptyState } from '../../../_components/ui'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return d }
}

const ANALYSIS_TONE: Record<string, 'gray'|'blue'|'orange'|'green'|'red'> = {
  unassigned: 'gray', assigned: 'blue', to_be_verified: 'orange', verified: 'green', published: 'green', retracted: 'red',
}

type Props = { sample: SenaiteSample | null; uid: string; loading?: boolean; djangoId?: number; onClose?: () => void }

export default function SampleDetailClient({ sample, uid, loading, djangoId }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('Overview')
  const [showAuditTrail, setShowAuditTrail] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [auditHistory, setAuditHistory] = useState<any[]>([])

  useEffect(() => {
    if (sample?.uid) getSampleReviewHistory(sample.uid).then(res => setAuditHistory(res || []))
  }, [sample?.uid])

  // The Django-mirrored LabSample (same record this SENAITE sample syncs
  // with) — only fetched when a djangoId is known, so Edit Sample / Storage
  // History / Create Analysis Request / View Results match the button row
  // already offered on the Django-only Sample Detail view (SampleOverviewDetail).
  const [labSample, setLabSample] = useState<LabSample | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showChainOfCustody, setShowChainOfCustody] = useState(false)
  useEffect(() => {
    let active = true
    if (djangoId) {
      getLabSample(djangoId).then(s => { if (active) setLabSample(s) })
    } else {
      setLabSample(null)
    }
    return () => { active = false }
  }, [djangoId])

  function openStorageHistory() {
    setActiveTab('Overview')
    setTimeout(() => document.getElementById('storage-info')?.scrollIntoView({ behavior: 'smooth' }), 0)
  }

  function doAction(fn: (uid: string) => Promise<{ success: boolean; message: string }>) {
    startTransition(async () => {
      const result = await fn(uid)
      setActionMsg({ text: result.message, ok: result.success })
      setTimeout(() => setActionMsg(null), 3000)
      if (result.success) router.refresh()
    })
  }

  if (!sample) {
    if (loading) {
      return (
        <div className="flex items-center justify-center" style={{ backgroundColor: T.pageBg, minHeight: '100%' }}>
          <div style={{ fontSize: 13, color: T.muted }}>Loading sample details...</div>
        </div>
      )
    }
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', backgroundColor: T.pageBg, minHeight: '100%' }}>
        <MI name="science" size={48} color={T.cardBorder} />
        <p style={{ fontSize: 16, color: T.muted, marginTop: 12 }}>Sample not found</p>
        <p style={{ fontSize: 13, color: T.faint }}>UID: {uid}</p>
        <Link href="/dashboard/samples" style={{ fontSize: 13, color: T.primary, marginTop: 16, display: 'inline-block' }}>← Back to Samples</Link>
      </div>
    )
  }

  const stateLabel    = mapSenaiteState(sample.review_state)
  const priorityLabel = mapSenaitePriority(sample.Priority)
  const canReceive = sample.review_state === 'registered' || sample.review_state === 'sample_due'
  const canVerify  = sample.review_state === 'to_be_verified'
  const canPublish = sample.review_state === 'verified'
  const TABS = ['Overview', 'Analyses']
  const TAB_ICONS: Record<string, string> = { Overview: 'grid_view', Analyses: 'biotech' }

  return (
    <div style={{ padding: 20, minHeight: '100%', backgroundColor: T.pageBg }}>

      {/* Toast */}
      {actionMsg && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl flex items-center gap-2"
          style={{ backgroundColor: actionMsg.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${actionMsg.ok ? '#93C5FD' : '#FECACA'}`, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
          <MI name={actionMsg.ok ? 'check_circle' : 'error_outline'} size={16} color={actionMsg.ok ? T.success : T.danger} />
          <span style={{ fontSize: 13, color: actionMsg.ok ? '#0154FC' : '#991B1B' }}>{actionMsg.text}</span>
        </div>
      )}

      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: 'Samples', href: '/dashboard/samples' }, { label: 'Sample Detail' }]} />

      {/* Title row */}
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.heading, letterSpacing: '-0.02em', margin: 0 }}>Sample Detail</h1>
        <div className="flex items-center gap-2">
          <Btn variant="primary" icon="edit" onClick={() => setShowEdit(true)} disabled={!labSample}>Edit Sample</Btn>
          <Btn variant="outline" icon="inventory_2" onClick={openStorageHistory}>Storage History</Btn>
          <Btn variant="outline" icon="shield" onClick={() => setShowAuditTrail(true)}>Audit Trail</Btn>
          <Btn variant="outline" icon="link" onClick={() => setShowChainOfCustody(true)}>Chain of Custody</Btn>
          <Btn variant="outline" icon="print" onClick={() => window.print()}>Print</Btn>
          {canReceive && <Btn variant="success" icon="move_to_inbox" onClick={() => doAction(receiveSample)} disabled={isPending}>Receive</Btn>}
          {canVerify  && <Btn style={{ backgroundColor: '#6366F1', color: '#fff' }} icon="verified" onClick={() => doAction(verifySample)} disabled={isPending}>Verify</Btn>}
          {canPublish && <Btn variant="success" icon="publish" onClick={() => doAction(publishSample)} disabled={isPending}>Publish</Btn>}
        </div>
      </div>

      {showEdit && labSample && (
        <EditDrawer sample={labSample} onClose={() => setShowEdit(false)} onSaved={() => router.refresh()} />
      )}

      {showChainOfCustody && (
        <ChainOfCustodyDrawer sampleId={sample.id} open={showChainOfCustody} onClose={() => setShowChainOfCustody(false)} />
      )}

      {/* Hero card */}
      <div className="bg-white mb-5" style={{ border: `1px solid ${T.cardBorder}`, borderRadius: T.cardRadius, boxShadow: T.cardShadow, padding: '16px 20px' }}>
        <div className="flex items-center gap-4">

          {/* Icon + ID */}
          <div className="flex items-center gap-3 shrink-0" style={{ paddingRight: 20, borderRight: `1px solid ${T.cardBorder}` }}>
            <div className="flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: '#EFF6FF' }}>
              <MI name="science" size={28} color={T.primary} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span style={{ fontSize: 22, fontWeight: 800, color: T.heading }}>{sample.id}</span>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                  onClick={() => navigator.clipboard?.writeText(sample.id)}>
                  <MI name="content_copy" size={14} color={T.faint} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <StatusChip status={stateLabel} />
                {priorityLabel !== 'Normal' && <StatusChip status={priorityLabel} />}
              </div>
            </div>
          </div>

          {/* Meta grid */}
          <div className="flex items-center flex-1 min-w-0">
            {[
              { label: 'Client',       value: sample.ClientTitle || '—' },
              { label: 'Sample Type',  value: sample.SampleTypeTitle || '—' },
              { label: 'Priority',     value: priorityLabel },
              { label: 'Collected On', value: fmtDate(sample.DateSampled) },
              { label: 'Due Date',     value: fmtDate(sample.DateDue) },
            ].map((m, i, arr) => (
              <div key={m.label} style={{
                flex: 1, textAlign: 'center',
                borderRight: i < arr.length - 1 ? `1px solid ${T.cardBorder}` : 'none',
                paddingLeft: 16, paddingRight: 16,
              }}>
                <p style={{ fontSize: 11, color: T.faint, marginBottom: 4 }}>{m.label}</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.heading }}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 mb-4" style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="flex items-center gap-1.5 px-4 py-2.5"
            style={{
              fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', marginBottom: -1,
              borderBottom: activeTab === tab ? `2px solid ${T.primary}` : '2px solid transparent',
              color: activeTab === tab ? T.primary : T.muted,
            }}>
            <MI name={TAB_ICONS[tab]} size={15} color={activeTab === tab ? T.primary : T.faint} />
            {tab}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'Overview' && (
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1.4fr' }}>

          {/* Sample Information */}
          <Card title="Sample Information" icon="info">
            {[
              ['Sample ID',        sample.id],
              ['Client',           sample.ClientTitle || '—'],
              ['Client ID',        sample.ClientID || '—'],
              ['Sample Type',      sample.SampleTypeTitle || '—'],
              ['Status',           stateLabel],
              ['Priority',         priorityLabel],
              ['Date Sampled',     fmtDate(sample.DateSampled)],
              ['Date Received',    fmtDate(sample.DateReceived)],
              ['Date Due',         fmtDate(sample.DateDue)],
              ['Client Sample ID', sample.ClientSampleID || '—'],
              ['Sample UID',       sample.uid],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-start justify-between gap-2 py-2" style={{ borderBottom: `1px solid ${T.rowBorder}` }}>
                <span style={{ fontSize: 11, color: T.faint }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.heading, textAlign: 'right', wordBreak: 'break-all', maxWidth: '60%' }}>{value as string}</span>
              </div>
            ))}
          </Card>

          <div className="flex flex-col gap-4">
            {/* Requested Analyses */}
            <Card title={`Requested Analyses (${sample.Analyses.length})`} icon="biotech" pad={false}>
              {sample.Analyses.length === 0 ? (
                <div className="px-4 pb-4">
                  <EmptyState icon="biotech" title="No analyses assigned" sub="Analyses will appear here once assigned." />
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Test / Analysis', 'Keyword', 'Status'].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sample.Analyses.map((a, i) => (
                        <tr key={i}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAFBFE')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{a.title}</td>
                          <td style={{ ...tdStyle, color: T.muted }}>{a.Keyword}</td>
                          <td style={tdStyle}>
                            <Chip tone={ANALYSIS_TONE[a.review_state] ?? 'gray'}>{mapSenaiteState(a.review_state)}</Chip>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Storage Information */}
            <div id="storage-info">
              <Card title="Storage Information" icon="inventory_2">
                <EmptyState icon="inventory_2" title="No storage records" sub="Storage data will appear here once the sample is stored." />
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Analyses tab */}
      {activeTab === 'Analyses' && (
        <Card title={`All Analyses (${sample.Analyses.length})`} icon="biotech" pad={false}>
          {sample.Analyses.length === 0 ? (
            <div className="p-4">
              <EmptyState icon="biotech" title="No analyses assigned" sub="No analyses have been assigned to this sample." />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Test', 'Keyword', 'Status', 'UID'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sample.Analyses.map((a, i) => (
                    <tr key={i}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAFBFE')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{a.title}</td>
                      <td style={{ ...tdStyle, color: T.muted }}>{a.Keyword}</td>
                      <td style={tdStyle}><Chip tone={ANALYSIS_TONE[a.review_state] ?? 'gray'}>{mapSenaiteState(a.review_state)}</Chip></td>
                      <td style={{ ...tdStyle, fontSize: 11, color: T.faint, fontFamily: 'monospace' }}>{a.uid.slice(0, 12)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Audit Trail Drawer */}
      <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, zIndex: 300, pointerEvents: showAuditTrail ? 'auto' : 'none' }}>
        <div
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', opacity: showAuditTrail ? 1 : 0, transition: 'opacity 0.2s ease-in-out' }}
          onClick={() => setShowAuditTrail(false)}
        />
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(560px, 92%)', backgroundColor: '#fff',
          boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
          transform: showAuditTrail ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)' 
        }}>
          <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
            <div className="flex items-center gap-2 text-[#14265E]">
              <MI name="shield" size={20} />
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Audit Trail</h2>
            </div>
            <button onClick={() => setShowAuditTrail(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#374151' }}>
              <MI name="close" size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            {auditHistory.length === 0 ? (
              <div className="text-center py-10">
                <MI name="history" size={48} color="#D1D5DB" />
                <p className="text-sm font-medium text-gray-900 mt-4">No History</p>
                <p className="text-xs text-gray-500 mt-1">There are no audit events recorded for this sample.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {auditHistory.map((entry, idx) => (
                  <div key={idx} className="flex gap-4 group">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full border-2 border-white box-content z-10 mt-1" style={{ backgroundColor: '#0154FC' }} />
                      {idx < auditHistory.length - 1 && (
                        <div className="w-[2px] flex-1 bg-gray-200 my-1" />
                      )}
                    </div>
                    <div className="pb-6 flex-1">
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2, textTransform: 'capitalize' }}>
                        {entry.action ? `Transition: ${entry.action}` : 'Created'}
                      </div>
                      <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>
                        {fmtDate(entry.time)} by <span style={{ fontWeight: 500 }}>{entry.actor}</span>
                      </div>
                      <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, backgroundColor: '#EFF6FF', color: T.primary, fontWeight: 500 }}>
                        Status: {mapSenaiteState(entry.review_state)}
                      </div>
                      {entry.comments && (
                        <div style={{ marginTop: 6, fontSize: 12, color: T.text, backgroundColor: '#F9FAFB', padding: '6px 10px', borderRadius: 6, fontStyle: 'italic' }}>
                          "{entry.comments}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

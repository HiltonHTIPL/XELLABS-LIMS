'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SenaiteSample, mapSenaiteState, mapSenaitePriority } from '@/app/lib/senaite'
import { receiveSample, verifySample, publishSample } from '@/app/actions/samples'
import { T, MI, Breadcrumb, Btn, Card, Chip, StatusChip, thStyle, tdStyle, EmptyState } from '../../../_components/ui'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return d }
}

const ANALYSIS_TONE: Record<string, 'gray'|'blue'|'orange'|'green'|'red'> = {
  unassigned: 'gray', assigned: 'blue', to_be_verified: 'orange', verified: 'green', published: 'green', retracted: 'red',
}

type Props = { sample: SenaiteSample | null; uid: string }

export default function SampleDetailClient({ sample, uid }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('Overview')
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  function doAction(fn: (uid: string) => Promise<{ success: boolean; message: string }>) {
    startTransition(async () => {
      const result = await fn(uid)
      setActionMsg({ text: result.message, ok: result.success })
      setTimeout(() => setActionMsg(null), 3000)
      if (result.success) router.refresh()
    })
  }

  if (!sample) {
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
  const TABS = ['Overview', 'Analyses', 'Audit Trail']
  const TAB_ICONS: Record<string, string> = { Overview: 'grid_view', Analyses: 'biotech', 'Audit Trail': 'history' }

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
          <Btn variant="outline" icon="shield" onClick={() => setActiveTab('Audit Trail')}>Audit Trail</Btn>
          <Btn variant="outline" icon="print" onClick={() => window.print()}>Print</Btn>
          {canReceive && <Btn variant="success" icon="move_to_inbox" onClick={() => doAction(receiveSample)} disabled={isPending}>Receive</Btn>}
          {canVerify  && <Btn style={{ backgroundColor: '#6366F1', color: '#fff' }} icon="verified" onClick={() => doAction(verifySample)} disabled={isPending}>Verify</Btn>}
          {canPublish && <Btn variant="success" icon="publish" onClick={() => doAction(publishSample)} disabled={isPending}>Publish</Btn>}
        </div>
      </div>

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
            <Card title="Storage Information" icon="inventory_2">
              <EmptyState icon="inventory_2" title="No storage records" sub="Storage data will appear here once the sample is stored." />
            </Card>
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

      {/* Audit Trail tab */}
      {activeTab === 'Audit Trail' && (
        <Card title="Audit Trail" icon="history">
          <EmptyState icon="history" title="Audit trail coming soon" sub="A complete history of all actions will be shown here." />
        </Card>
      )}
    </div>
  )
}

'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SenaiteSample, mapSenaiteState, mapSenaitePriority } from '@/app/lib/senaite'
import { receiveSample, verifySample, publishSample } from '@/app/actions/samples'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const STATE_BADGE: Record<string, { bg: string; color: string }> = {
  'Registered':     { bg: '#F3F4F6', color: '#374151' },
  'Sample Due':     { bg: '#FEF3C7', color: '#92400E' },
  'Received':       { bg: '#CCFBF1', color: '#0F766E' },
  'To Be Verified': { bg: '#FEF3C7', color: '#92400E' },
  'Verified':       { bg: '#DBEAFE', color: '#1E40AF' },
  'Published':      { bg: '#DCFCE7', color: '#166534' },
  'Invalid':        { bg: '#FEE2E2', color: '#991B1B' },
  'Cancelled':      { bg: '#F3F4F6', color: '#9CA3AF' },
}

const ANALYSIS_STATE_BADGE: Record<string, { bg: string; color: string }> = {
  unassigned:      { bg: '#F3F4F6', color: '#6B7280' },
  assigned:        { bg: '#DBEAFE', color: '#1E40AF' },
  to_be_verified:  { bg: '#FEF3C7', color: '#92400E' },
  verified:        { bg: '#DCFCE7', color: '#166534' },
  published:       { bg: '#F0FDF4', color: '#166534' },
  retracted:       { bg: '#FEE2E2', color: '#991B1B' },
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return d }
}

const TABS = ['Overview', 'Analyses', 'Audit Trail']
const TAB_ICONS: Record<string, string> = {
  'Overview': 'grid_view', 'Analyses': 'biotech', 'Audit Trail': 'history',
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
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <MI name="science" size={48} color="#E5E7EB" />
        <p style={{ fontSize: 16, color: '#6B7280', marginTop: 12 }}>Sample not found</p>
        <p style={{ fontSize: 13, color: '#9CA3AF' }}>UID: {uid}</p>
        <Link href="/dashboard/samples" style={{ fontSize: 13, color: '#2563EB', marginTop: 16, display: 'inline-block' }}>
          ← Back to Samples
        </Link>
      </div>
    )
  }

  const stateLabel    = mapSenaiteState(sample.review_state)
  const priorityLabel = mapSenaitePriority(sample.Priority)
  const sb = STATE_BADGE[stateLabel] ?? { bg: '#F3F4F6', color: '#374151' }

  const canReceive = sample.review_state === 'registered' || sample.review_state === 'sample_due'
  const canVerify  = sample.review_state === 'to_be_verified'
  const canPublish = sample.review_state === 'verified'

  return (
    <div style={{ padding: '20px 24px', minHeight: '100%', backgroundColor: '#F9FAFB' }}>

      {/* Action feedback */}
      {actionMsg && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg flex items-center gap-2 shadow-lg"
          style={{ backgroundColor: actionMsg.ok ? '#DCFCE7' : '#FEE2E2', border: `1px solid ${actionMsg.ok ? '#86EFAC' : '#FECACA'}` }}>
          <MI name={actionMsg.ok ? 'check_circle' : 'error_outline'} size={16} color={actionMsg.ok ? '#16A34A' : '#EF4444'} />
          <span style={{ fontSize: 13, color: actionMsg.ok ? '#166534' : '#B91C1C' }}>{actionMsg.text}</span>
        </div>
      )}

      {/* Breadcrumb + header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1" style={{ fontSize: 12, color: '#9CA3AF' }}>
            <Link href="/dashboard/samples" style={{ color: '#6B7280', textDecoration: 'none' }}>Samples</Link>
            <MI name="chevron_right" size={14} color="#9CA3AF" />
            <span style={{ color: '#374151' }}>{sample.id}</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Sample Detail</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.refresh()} disabled={isPending}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg"
            style={{ border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
            <MI name="refresh" size={14} color="#6B7280" /> Refresh
          </button>
          {canReceive && (
            <button onClick={() => doAction(receiveSample)} disabled={isPending}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ backgroundColor: '#0D9488', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <MI name="move_to_inbox" size={14} color="#fff" /> Receive
            </button>
          )}
          {canVerify && (
            <button onClick={() => doAction(verifySample)} disabled={isPending}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ backgroundColor: '#6366F1', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <MI name="verified" size={14} color="#fff" /> Verify
            </button>
          )}
          {canPublish && (
            <button onClick={() => doAction(publishSample)} disabled={isPending}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ backgroundColor: '#16A34A', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <MI name="publish" size={14} color="#fff" /> Publish
            </button>
          )}
        </div>
      </div>

      {/* Hero card */}
      <div className="bg-white rounded-xl mb-3" style={{ border: '1px solid #E5E7EB', padding: '14px 20px 12px' }}>
        <div className="flex items-center gap-0" style={{ minHeight: 64 }}>
          <div className="flex items-center gap-3" style={{ flex: '0 0 auto', paddingRight: 16, borderRight: '1px solid #EBEBEB' }}>
            <div className="flex items-center justify-center rounded-xl" style={{ width: 52, height: 52, backgroundColor: '#EFF6FF', flexShrink: 0 }}>
              <MI name="science" size={26} color="#3B82F6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{sample.id}</span>
              </div>
              <span className="flex items-center gap-1" style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999, backgroundColor: sb.bg, color: sb.color, display: 'inline-flex' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: sb.color, display: 'inline-block', flexShrink: 0 }} />
                {stateLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center flex-1">
            {[
              { label: 'Client',       value: `${sample.ClientTitle}${sample.ClientID ? ` (${sample.ClientID})` : ''}` },
              { label: 'Sample Type',  value: sample.SampleTypeTitle || '—' },
              { label: 'Priority',     value: priorityLabel },
              { label: 'Date Sampled', value: fmtDate(sample.DateSampled) },
              { label: 'Date Due',     value: fmtDate(sample.DateDue) },
            ].map((m, i, arr) => (
              <div key={m.label} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid #EBEBEB' : 'none', paddingLeft: i === 0 ? 16 : 14, paddingRight: 14 }}>
                <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 4 }}>{m.label}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 mb-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium"
            style={{ borderBottom: activeTab === tab ? '2px solid #2563EB' : '2px solid transparent', color: activeTab === tab ? '#2563EB' : '#6B7280', background: 'none', cursor: 'pointer', marginBottom: -1 }}>
            <MI name={TAB_ICONS[tab]} size={14} color={activeTab === tab ? '#2563EB' : '#9CA3AF'} />
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'Overview' && (
        <div className="grid gap-4" style={{ gridTemplateColumns: '280px 1fr' }}>
          {/* Sample info */}
          <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #E5E7EB', alignSelf: 'start' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Sample Information</p>
            {[
              ['Sample ID',        sample.id],
              ['Client',           sample.ClientTitle],
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
              <div key={label as string} className="flex items-start justify-between gap-2 mb-2.5">
                <span style={{ fontSize: 10, color: '#9CA3AF', flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#111827', textAlign: 'right', wordBreak: 'break-all' }}>{value as string}</span>
              </div>
            ))}
          </div>

          {/* Analyses */}
          <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #E5E7EB', alignSelf: 'start' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 12 }}>
              Requested Analyses <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>({sample.Analyses.length})</span>
            </p>
            {sample.Analyses.length === 0 ? (
              <p style={{ fontSize: 12, color: '#9CA3AF' }}>No analyses assigned.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                    {['Test / Method', 'Keyword', 'Status'].map(h => (
                      <th key={h} style={{ fontSize: 9, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '4px 8px 8px', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sample.Analyses.map((a, i) => {
                    const asb = ANALYSIS_STATE_BADGE[a.review_state] ?? { bg: '#F3F4F6', color: '#374151' }
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                        <td style={{ padding: '9px 8px', fontSize: 11, color: '#374151', fontWeight: 500 }}>{a.title}</td>
                        <td style={{ padding: '9px 8px', fontSize: 11, color: '#6B7280' }}>{a.Keyword}</td>
                        <td style={{ padding: '9px 8px' }}>
                          <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 999, backgroundColor: asb.bg, color: asb.color, whiteSpace: 'nowrap' }}>
                            {mapSenaiteState(a.review_state)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Analyses tab */}
      {activeTab === 'Analyses' && (
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Analyses</p>
          {sample.Analyses.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>No analyses assigned to this sample.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                  {['Test', 'Keyword', 'Status', 'UID'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sample.Analyses.map((a, i) => {
                  const asb = ANALYSIS_STATE_BADGE[a.review_state] ?? { bg: '#F3F4F6', color: '#374151' }
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151', fontWeight: 500 }}>{a.title}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#6B7280' }}>{a.Keyword}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, backgroundColor: asb.bg, color: asb.color }}>
                          {mapSenaiteState(a.review_state)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace' }}>{a.uid.slice(0, 12)}…</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Audit Trail placeholder */}
      {activeTab === 'Audit Trail' && (
        <div className="bg-white rounded-xl flex items-center justify-center" style={{ border: '1px solid #E5E7EB', height: 200 }}>
          <div style={{ textAlign: 'center' }}>
            <MI name="history" size={36} color="#E5E7EB" />
            <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 12 }}>Audit trail coming soon</p>
          </div>
        </div>
      )}
    </div>
  )
}

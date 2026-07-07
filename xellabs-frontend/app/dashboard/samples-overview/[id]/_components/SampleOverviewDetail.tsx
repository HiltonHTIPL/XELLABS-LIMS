'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type CSSProperties } from 'react'
import { type LabSample } from '@/app/actions/lab-samples'
import { type AnalysisRequest } from '@/app/actions/analysis-requests'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  registered:      { bg: '#EFF6FF', color: '#1D4ED8', label: 'Logged' },
  received:        { bg: '#DBEAFE', color: '#0154FC', label: 'Received' },
  in_progress:     { bg: '#DBEAFE', color: '#1E40AF', label: 'In Process' },
  results_pending: { bg: '#FEF3C7', color: '#92400E', label: 'To Be Verified' },
  reviewed:        { bg: '#E0E7FF', color: '#3730A3', label: 'Reviewed' },
  published:       { bg: '#DBEAFE', color: '#0154FC', label: 'Completed' },
  rejected:        { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
  disposed:        { bg: '#F3F4F6', color: '#6B7280', label: 'Disposed' },
}

const PRIORITY_BADGE: Record<string, { bg: string; color: string }> = {
  high:   { bg: '#FEE2E2', color: '#991B1B' },
  medium: { bg: '#FEF3C7', color: '#92400E' },
  low:    { bg: '#DBEAFE', color: '#0154FC' },
  normal: { bg: '#FEF3C7', color: '#92400E' },
  urgent: { bg: '#FEE2E2', color: '#991B1B' },
}

const AR_STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending:     { bg: '#F3F4F6', color: '#374151', label: 'Not Started' },
  in_progress: { bg: '#DBEAFE', color: '#1E40AF', label: 'In Process' },
  completed:   { bg: '#DBEAFE', color: '#0154FC', label: 'Completed' },
  cancelled:   { bg: '#FEE2E2', color: '#991B1B', label: 'Cancelled' },
}

function fmt(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) }
  catch { return d }
}

function fmtShort(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return d }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F3F4F6' }}>
      <span style={{ fontSize: 12, color: '#6B7280' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  )
}

const th: CSSProperties = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '10px 12px', fontSize: 12, color: '#374151', borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }

export default function SampleOverviewDetail({ sample, id, analysisRequests }: { sample: LabSample | null; id: string; analysisRequests: AnalysisRequest[] }) {
  const router = useRouter()
  // Date.now() is impure — capture it after mount rather than during render.
  const [nowMs, setNowMs] = useState<number | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowMs(Date.now())
  }, [])

  if (!sample) {
    return (
      <div style={{ padding: 40, textAlign: 'center', background: '#F9FAFB', minHeight: '100%' }}>
        <MI name="science" size={48} color="#D1D5DB" />
        <p style={{ fontSize: 15, color: '#6B7280', marginTop: 12 }}>Sample not found</p>
        <p style={{ fontSize: 12, color: '#9CA3AF' }}>ID: {id}</p>
        <Link href="/dashboard/samples-overview" style={{ fontSize: 13, color: '#2563EB', marginTop: 16, display: 'inline-block' }}>← Back to Samples</Link>
      </div>
    )
  }

  const badge = STATUS_BADGE[sample.status] ?? { bg: '#F3F4F6', color: '#374151', label: sample.status }
  const pBadge = PRIORITY_BADGE[sample.priority] ?? { bg: '#F3F4F6', color: '#374151' }

  // Flatten analysis requests -> one row per test
  const analysisRows = analysisRequests.flatMap(ar =>
    (ar.tests_detail?.length ? ar.tests_detail : ar.test_names?.map((n, i) => ({ id: i, name: n, code: '', unit: '' })) ?? [])
      .map(t => ({ test: t, ar }))
  )

  return (
    <div style={{ padding: 24, minHeight: '100%', background: '#F9FAFB' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push('/dashboard/samples-overview')}>Samples</span>
        <span style={{ margin: '0 6px' }}>›</span>
        <span style={{ fontWeight: 600, color: '#111827' }}>Sample Detail</span>
      </div>

      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#14265E', margin: 0 }}>Sample Detail</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => document.getElementById('storage-info')?.scrollIntoView({ behavior: 'smooth' })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <MI name="inventory_2" size={16} /><span>Storage History</span>
          </button>
          <button onClick={() => router.push(`/dashboard/audit-trail?sample=${sample.sample_id}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <MI name="shield" size={16} /><span>Audit Trail</span>
          </button>
          <button onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <MI name="print" size={16} /><span>Print</span>
          </button>
        </div>
      </div>

      {/* Hero card */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8EAF2', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Icon + ID + chips */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', paddingRight: 20, borderRight: '1px solid #E8EAF2' }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MI name="science" size={28} color="#2563EB" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#14265E' }}>{sample.sample_id}</span>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                  onClick={() => navigator.clipboard?.writeText(sample.sample_id)}>
                  <MI name="content_copy" size={14} color="#9CA3AF" />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ background: badge.bg, color: badge.color, borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11 }}>{badge.label}</span>
                {sample.priority && <span style={{ background: pBadge.bg, color: pBadge.color, borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11, textTransform: 'capitalize' }}>{sample.priority}</span>}
                {sample.hold_for_qa && <span style={{ background: '#FFF7ED', color: '#C2410C', borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11 }}>On Hold for QA</span>}
              </div>
            </div>
          </div>

          {/* Meta grid */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
            {[
              { label: 'Client', value: sample.client_name },
              { label: 'Batch / Project', value: sample.batch_id },
              { label: 'Sample Type', value: sample.sample_type_name },
              { label: 'Priority', value: sample.priority },
            ].map((m, i, arr) => (
              <div key={m.label} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid #E8EAF2' : 'none', padding: '0 14px' }}>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 4px' }}>{m.label}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: m.label === 'Priority' && sample.priority === 'high' ? '#DC2626' : '#14265E', margin: 0, textTransform: 'capitalize' }}>{m.value || '—'}</p>
              </div>
            ))}
          </div>

          {/* Barcode */}
          <div style={{ textAlign: 'center', paddingLeft: 20, borderLeft: '1px solid #E8EAF2' }}>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 6px' }}>Sample Bar Code</p>
            <div className="xl-barcode" style={{ height: 32, width: 160 }} />
            <p style={{ fontSize: 11, fontWeight: 600, color: '#14265E', margin: '4px 0 0', letterSpacing: '0.05em' }}>{sample.sample_id}</p>
          </div>
        </div>

        {/* second meta row */}
        <div style={{ display: 'flex', marginTop: 14, paddingTop: 14, borderTop: '1px solid #E8EAF2', gap: 14, flexWrap: 'wrap' }}>
          {[
            { label: 'Collected On', value: fmt(sample.collection_date) },
            { label: 'Received On', value: fmt(sample.received_date) },
            { label: 'Due Date', value: fmtShort(sample.expiry_date), icon: 'event' },
            { label: 'Received By', value: sample.received_by_name },
            { label: 'TAT (Days)', value: sample.collection_date && nowMs !== null ? String(Math.max(0, Math.floor((nowMs - new Date(sample.collection_date).getTime()) / (1000 * 60 * 60 * 24)))) : '—' },
          ].map((m, i, arr) => (
            <div key={m.label} style={{ flex: 1, minWidth: 130, textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid #E8EAF2' : 'none' }}>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 4px' }}>{m.label}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#14265E', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {m.icon && <MI name={m.icon} size={13} color="#9CA3AF" />}{m.value || '—'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Sample Info + Requested Analyses */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8EAF2', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 18 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#14265E', margin: '0 0 8px' }}>Sample Information</p>
          <Row label="Matrix" value={sample.sample_type_name} />
          <Row label="Container" value={sample.container_type} />
          <Row label="Collection Point" value={sample.sample_point} />
          <Row label="Collected By" value={sample.contact_name} />
          <Row label="Received By" value={sample.received_by_name} />
          <Row label="Receipt Condition" value={sample.condition} />
          <Row label="Barcode / Accession" value={sample.barcode} />
          <Row label="Storage Location" value={sample.storage_location} />
          <Row label="Preservation" value={sample.preservation} />
          <Row label="Sample Notes" value={sample.description} />
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8EAF2', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#14265E', margin: 0, padding: '14px 18px 10px' }}>Requested Analyses</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Test / Method', 'AR ID', 'Status', 'Priority', 'Due Date'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {analysisRows.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#9CA3AF', padding: '24px 12px' }}>No analyses requested yet.</td></tr>
                ) : analysisRows.map(({ test, ar }, i) => {
                  const arBadge = AR_STATUS_BADGE[ar.status] ?? { bg: '#F3F4F6', color: '#374151', label: ar.status }
                  const prBadge = PRIORITY_BADGE[ar.priority] ?? { bg: '#F3F4F6', color: '#374151' }
                  return (
                    <tr key={`${ar.id}-${i}`}>
                      <td style={{ ...td, fontWeight: 600 }}>{test.name}</td>
                      <td style={{ ...td, color: '#2563EB', cursor: 'pointer' }} onClick={() => router.push('/dashboard/analysis-requests')}>{ar.ar_id}</td>
                      <td style={td}><span style={{ background: arBadge.bg, color: arBadge.color, borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11 }}>{arBadge.label}</span></td>
                      <td style={td}><span style={{ background: prBadge.bg, color: prBadge.color, borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11, textTransform: 'capitalize' }}>{ar.priority}</span></td>
                      <td style={td}>{fmtShort(ar.due_date)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Storage Information + Documents */}
      <div id="storage-info" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8EAF2', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#14265E', margin: 0, padding: '14px 18px 10px' }}>Storage Information</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Location', 'Requirement', 'Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {sample.storage_location ? (
                  <tr>
                    <td style={{ ...td, fontWeight: 600, color: '#2563EB' }}>{sample.storage_location}</td>
                    <td style={td}>{sample.storage_location ? '—' : '—'}</td>
                    <td style={td}><span style={{ background: '#DBEAFE', color: '#0154FC', borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11 }}>Active</span></td>
                  </tr>
                ) : (
                  <tr><td colSpan={3} style={{ ...td, textAlign: 'center', color: '#9CA3AF', padding: '24px 12px' }}>No storage location assigned yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8EAF2', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 18 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#14265E', margin: '0 0 10px' }}>Documents</p>
          <div style={{ textAlign: 'center', padding: '18px 0', color: '#9CA3AF' }}>
            <MI name="description" size={28} color="#D1D5DB" />
            <p style={{ fontSize: 12, marginTop: 8 }}>No documents uploaded for this sample yet.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

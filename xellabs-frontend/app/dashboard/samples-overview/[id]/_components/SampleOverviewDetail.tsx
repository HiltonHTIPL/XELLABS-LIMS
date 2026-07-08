'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { type LabSample } from '@/app/actions/lab-samples'
import { type AnalysisRequest } from '@/app/actions/analysis-requests'
import LiveBarcode from '@/app/dashboard/_components/LiveBarcode'
import { STICKER_TEMPLATES, printSticker, type StickerTemplate } from '@/app/lib/stickerTemplates'
import { type CocSample } from '@/app/actions/storage'

// renderSticker/printSticker were built for the chain-of-custody lookup shape
// (CocSample) — adapt LabSample into it rather than writing a second sticker
// renderer, so both pages print from the exact same templates/logic.
function toCocSample(s: LabSample): CocSample {
  return {
    sample_id: s.sample_id, status: s.status, status_display: s.status,
    sample_type: s.sample_type_name, client: s.client_name, barcode: s.barcode,
    collection_date: s.collection_date, received_date: s.received_date, expiry_date: s.expiry_date,
    condition: s.condition, seal_condition: '', priority: s.priority,
    storage_requirement: '', sampling_deviation: '',
    quantity_received: '', quantity_unit: '', hold_for_qa: s.hold_for_qa,
    received_by: s.received_by_name, receipt_notes: '', collector: s.contact_name,
    client_order_number: s.client_order_number, composite: s.composite,
    container_type: s.container_type, preservation: s.preservation, sample_point: s.sample_point,
  }
}

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
  const [printOpen, setPrintOpen] = useState(false)
  const [templateId, setTemplateId] = useState(STICKER_TEMPLATES[0].id)
  const [copies, setCopies] = useState(1)

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
          <div style={{ position: 'relative' }}>
            <button onClick={() => setPrintOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <MI name="print" size={16} /><span>Print Label</span>
            </button>
            {printOpen && (
              <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 20, width: 260, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', padding: 14 }}>
                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Template</label>
                <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                  style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, marginBottom: 10 }}>
                  {STICKER_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Copies</label>
                <input type="number" min={1} max={50} value={copies}
                  onChange={e => setCopies(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, marginBottom: 10 }} />
                <button
                  onClick={async () => {
                    const template = STICKER_TEMPLATES.find((t: StickerTemplate) => t.id === templateId)!
                    await printSticker(toCocSample(sample), template, copies)
                    setPrintOpen(false)
                  }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg"
                  style={{ backgroundColor: '#0154FC', color: '#fff', cursor: 'pointer', border: 'none' }}>
                  <MI name="print" size={14} color="#fff" /> Print
                </button>
              </div>
            )}
          </div>
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
            <div style={{ height: 32, width: 160 }}><LiveBarcode value={sample.barcode || sample.sample_id} height={32} /></div>
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
            { label: 'TAT (Days)', value: sample.collection_date ? String(Math.max(0, Math.floor((Date.now() - new Date(sample.collection_date).getTime()) / (1000 * 60 * 60 * 24)))) : '—' },
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
          <Row label="Current Storage Location" value={sample.storage_location || 'Not stored yet'} />
          <Row label="Preferred Storage Location" value={sample.preferred_storage_location} />
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

'use client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, type CSSProperties } from 'react'
import { type LabSample, type DjangoSampleType } from '@/app/actions/lab-samples'
import { type AnalysisRequest } from '@/app/actions/analysis-requests'
import { type DjangoClient } from '@/app/actions/clients'
import { type AnalysisSpecification } from '@/app/actions/specifications'
import { type SenaiteAnalysisService, type SenaiteBatch, type SenaiteSampleTemplate, type SenaiteRefOption } from '@/app/lib/senaite'
import LiveBarcode from '@/app/dashboard/_components/LiveBarcode'
import { STICKER_TEMPLATES, printSticker, type StickerTemplate } from '@/app/lib/stickerTemplates'
import { type CocSample } from '@/app/actions/storage'
import DisposeSampleModal from '../../_components/DisposeSampleModal'
import AnalysisRequestModal from '@/app/dashboard/_components/AnalysisRequestModal'
import NewSampleShell from '../../new/_components/NewSampleShell'
import { sampleDisplayId as displayId } from '@/app/lib/sampleDisplay'
import { getAuditEvents, type AuditEvent } from '@/app/actions/audit-trail'
import { getResults, type EnrichedResult } from '@/app/actions/results'

// renderSticker/printSticker were built for the chain-of-custody lookup shape
// (CocSample) — adapt LabSample into it rather than writing a second sticker
// renderer, so both pages print from the exact same templates/logic.

function toCocSample(s: LabSample): CocSample {
  return {
    sample_id: displayId(s), status: s.status, status_display: s.status,
    sample_type: s.sample_type_name, client: s.client_name, barcode: s.barcode,
    collection_date: s.collection_date, received_date: s.received_date, expiry_date: s.expiry_date,
    condition: s.condition, seal_condition: '', priority: s.priority,
    storage_requirement: '', sampling_deviation: '',
    quantity_received: '', quantity_unit: '', hold_for_qa: s.hold_for_qa,
    received_by: s.received_by_name, receipt_notes: '', collector: s.contact_name,
    client_order_number: s.client_order_number, composite: s.composite,
    container_type: s.container_type, preservation: s.preservation, sample_point: s.sample_point,
    batch_id: s.batch_id, batch_sub_group: s.batch_sub_group,
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

const RESULT_STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#F3F4F6', color: '#374151', label: 'Pending' },
  submitted: { bg: '#DBEAFE', color: '#1E40AF', label: 'Submitted' },
  verified:  { bg: '#DBEAFE', color: '#0154FC', label: 'Verified' },
  rejected:  { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
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

type Props = {
  sample: LabSample | null; id: string; analysisRequests: AnalysisRequest[]; services: SenaiteAnalysisService[]
  sampleTypes: DjangoSampleType[]; clients: DjangoClient[]
  sampleTemplates: SenaiteSampleTemplate[]; sampleContainers: SenaiteRefOption[]; batches: SenaiteBatch[]
  analysisSpecifications: AnalysisSpecification[]; preservations: SenaiteRefOption[]
  samplingDeviations: SenaiteRefOption[]; samplePoints: SenaiteRefOption[]
}

export default function SampleOverviewDetail({
  sample, id, analysisRequests, services, sampleTypes, clients, sampleTemplates,
  sampleContainers, batches, analysisSpecifications, preservations, samplingDeviations, samplePoints,
}: Props) {
  const router = useRouter()
  // Date.now() is impure — capture it after mount rather than during render.
  const [nowMs, setNowMs] = useState<number | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowMs(Date.now())
  }, [])
  const searchParams = useSearchParams()
  useEffect(() => {
    // The old in-page edit drawer used ?edit=1 — any old link/bookmark using
    // that now redirects straight to the full pre-filled edit page instead.
    if (searchParams.get('edit') === '1' && id) {
      router.replace(`/dashboard/samples-overview/new?edit=${id}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [showDispose, setShowDispose] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [showAudit, setShowAudit] = useState(false)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditEvents, setAuditEvents] = useState<AuditEvent[] | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showARModal, setShowARModal] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [resultsLoading, setResultsLoading] = useState(false)
  const [results, setResults] = useState<EnrichedResult[] | null>(null)

  function openResults() {
    if (!sample) return
    setShowResults(true)
    if (results === null && !resultsLoading) {
      setResultsLoading(true)
      getResults({ search: sample.sample_id })
        .then(setResults)
        .finally(() => setResultsLoading(false))
    }
    setTimeout(() => document.getElementById('results-panel')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  function openAuditTrail() {
    if (!sample) return
    const sampleId = sample.id
    setShowAudit(true)
    if (auditEvents === null && !auditLoading) {
      setAuditLoading(true)
      getAuditEvents()
        .then(events => {
          const forThisSample = events.filter(e => e.content_type_label === 'lims.sample' && e.object_id === sampleId)
          setAuditEvents(forThisSample)
        })
        .finally(() => setAuditLoading(false))
    }
    setTimeout(() => document.getElementById('audit-trail-panel')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }
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
  const syncBadge =
    sample.status === 'disposed' && sample.senaite_sync_status === 'pending'
      ? { bg: '#FEF3C7', color: '#92400E', label: 'Pending sync' }
      : sample.status === 'disposed' && sample.senaite_sync_status === 'failed'
        ? { bg: '#FEE2E2', color: '#991B1B', label: 'Sync failed' }
        : null
  const pBadge = PRIORITY_BADGE[sample.priority] ?? { bg: '#F3F4F6', color: '#374151' }
  const pastRetention = Boolean(
    sample.expiry_date
    && new Date(sample.expiry_date) < new Date()
    && !['published', 'disposed', 'rejected'].includes(sample.status)
  )
  const docUrl = sample.attachment_url || sample.attachment || null

  // Flatten analysis requests -> one row per analysis
  const analysisRows = analysisRequests.flatMap(ar =>
    ar.analyses.map(a => ({ test: { name: a.senaite_service_name }, ar }))
  )

  return (
    <div style={{ padding: 24, minHeight: '100%', background: '#F9FAFB' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push('/dashboard/samples-overview')}>Samples</span>
        <span style={{ margin: '0 6px' }}>›</span>
        <span style={{ fontWeight: 600, color: '#111827' }}>Sample Detail</span>
      </div>

      {showDispose && (
        <DisposeSampleModal
          sampleId={sample.id}
          sampleLabel={sample.sample_id}
          onClose={() => setShowDispose(false)}
          onDisposed={() => router.refresh()}
        />
      )}

      {showEditModal && (
        <NewSampleShell
          sampleTypes={sampleTypes}
          clients={clients}
          services={services}
          sampleTemplates={sampleTemplates}
          sampleContainers={sampleContainers}
          batches={batches}
          analysisSpecifications={analysisSpecifications}
          preservations={preservations}
          samplingDeviations={samplingDeviations}
          samplePoints={samplePoints}
          existingSamples={[]}
          editSample={sample}
          editAnalysisRequest={analysisRequests[0] ?? null}
          onClose={() => { setShowEditModal(false); router.refresh() }}
        />
      )}

      {showARModal && (
        <AnalysisRequestModal
          samples={[sample]}
          services={services}
          preselectedSampleId={String(sample.id)}
          onClose={() => setShowARModal(false)}
          onDone={() => router.refresh()}
        />
      )}

      {pastRetention && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs mb-4"
          style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
          <MI name="schedule" size={16} color="#DC2626" />
          <span>
            Past retention — due date {fmtShort(sample.expiry_date)} has passed.
            Dispose the sample and record the regulatory basis for compliance documentation.
          </span>
        </div>
      )}

      {syncBadge && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs mb-4"
          style={{ backgroundColor: syncBadge.bg, border: `1px solid ${syncBadge.color}33`, color: syncBadge.color }}>
          <MI name={sample.senaite_sync_status === 'failed' ? 'error' : 'sync'} size={16} color={syncBadge.color} />
          <span>
            {syncBadge.label}
            {sample.senaite_sync_status === 'failed' && sample.senaite_sync_error
              ? ` — ${sample.senaite_sync_error}`
              : sample.senaite_sync_status === 'pending'
                ? ' — disposal record is being confirmed with the lab system.'
                : ''}
          </span>
        </div>
      )}

      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#14265E', margin: 0 }}>Sample Detail</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setShowEditModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: '#0154FC', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <MI name="edit" size={16} color="#fff" /><span>Edit Sample</span>
          </button>
          {['received', 'results_pending', 'reviewed', 'published'].includes(sample.status) && (
            <button onClick={() => setShowDispose(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <MI name="delete_forever" size={16} color="#B91C1C" /><span>Dispose</span>
            </button>
          )}
          <button onClick={() => document.getElementById('storage-info')?.scrollIntoView({ behavior: 'smooth' })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <MI name="inventory_2" size={16} /><span>Storage History</span>
          </button>
          <button onClick={openAuditTrail}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <MI name="shield" size={16} /><span>Audit Trail</span>
          </button>
          <button onClick={() => setShowARModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: '#0154FC', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <MI name="assignment_add" size={16} color="#fff" /><span>Create Analysis Request</span>
          </button>
          <button onClick={openResults}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <MI name="science" size={16} /><span>View Results</span>
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
                <span style={{ fontSize: 22, fontWeight: 800, color: '#14265E' }}>{displayId(sample)}</span>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                  onClick={() => navigator.clipboard?.writeText(displayId(sample))}>
                  <MI name="content_copy" size={14} color="#9CA3AF" />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ background: badge.bg, color: badge.color, borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11 }}>{badge.label}</span>
                {syncBadge && (
                  <span style={{ background: syncBadge.bg, color: syncBadge.color, borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11 }}>{syncBadge.label}</span>
                )}
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
            <div style={{ height: 32, width: 160 }}><LiveBarcode value={sample.barcode || displayId(sample)} height={32} /></div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#14265E', margin: '4px 0 0', letterSpacing: '0.05em' }}>{displayId(sample)}</p>
          </div>
        </div>

        {/* second meta row */}
        <div style={{ display: 'flex', marginTop: 14, paddingTop: 14, borderTop: '1px solid #E8EAF2', gap: 14, flexWrap: 'wrap' }}>
          {[
            { label: 'Collected On', value: fmt(sample.collection_date) },
            { label: 'Received On', value: fmt(sample.received_date) },
            { label: 'Due Date', value: fmtShort(sample.expiry_date), icon: 'event' },
            { label: 'Received By', value: sample.received_by_name },
            // TAT counts from receipt (same as the samples list), not collection —
            // the clock only starts when the lab actually has the sample.
            { label: 'TAT (Days)', value: sample.received_date && nowMs !== null ? String(Math.max(0, Math.floor((nowMs - new Date(sample.received_date).getTime()) / (1000 * 60 * 60 * 24)))) : '—' },
          ].map((m, i, arr) => (
            <div key={m.label} style={{ flex: 1, minWidth: 130, textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid #E8EAF2' : 'none' }}>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 4px' }}>{m.label}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: m.label === 'Due Date' && pastRetention ? '#DC2626' : '#14265E', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {m.icon && <MI name={m.icon} size={13} color={m.label === 'Due Date' && pastRetention ? '#DC2626' : '#9CA3AF'} />}{m.value || '—'}
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
                      <td style={{ ...td, color: '#2563EB', cursor: 'pointer' }} onClick={() => router.push(`/dashboard/analysis-requests?ar=${ar.id}`)}>{ar.ar_id}</td>
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
          {docUrl ? (
            <a href={docUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ border: '1px solid #E8EAF2', textDecoration: 'none', backgroundColor: '#F9FAFB' }}>
              <MI name="description" size={18} color="#0154FC" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#2563EB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {decodeURIComponent(docUrl.split('/').pop() ?? 'Attachment')}
              </span>
              <MI name="open_in_new" size={13} color="#9CA3AF" />
            </a>
          ) : (
            <div style={{ textAlign: 'center', padding: '18px 0', color: '#9CA3AF' }}>
              <MI name="description" size={28} color="#D1D5DB" />
              <p style={{ fontSize: 12, marginTop: 8 }}>No documents uploaded for this sample yet.</p>
              <p style={{ fontSize: 11, marginTop: 4 }}>Attach a disposal certificate when disposing the sample.</p>
            </div>
          )}
        </div>
      </div>

      {showAudit && (
        <div id="audit-trail-panel" style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8EAF2', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden', marginTop: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#14265E', margin: 0, padding: '14px 18px 10px' }}>Audit Trail</p>
          {auditLoading ? (
            <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, padding: '24px 12px' }}>Loading audit history…</p>
          ) : !auditEvents || auditEvents.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, padding: '24px 12px' }}>No audit events recorded for this sample yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Timestamp', 'User', 'Action', 'Changes'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {auditEvents.map(ev => (
                    <tr key={ev.id}>
                      <td style={td}>{new Date(ev.timestamp).toLocaleString()}</td>
                      <td style={td}>{ev.user_display ?? 'System'}</td>
                      <td style={td}>
                        <span style={{ background: '#DBEAFE', color: '#0154FC', borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11, textTransform: 'capitalize' }}>{ev.action}</span>
                      </td>
                      <td style={td}>
                        {ev.changes.length === 0 ? '—' : ev.changes.map(c => `${c.field_name}: ${c.old_value ?? '—'} → ${c.new_value ?? '—'}`).join('; ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showResults && (
        <div id="results-panel" style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8EAF2', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden', marginTop: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#14265E', margin: 0, padding: '14px 18px 10px' }}>Results</p>
          {resultsLoading ? (
            <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, padding: '24px 12px' }}>Loading results…</p>
          ) : !results || results.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, padding: '24px 12px' }}>No results recorded for this sample yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Test', 'AR ID', 'Value', 'Unit', 'Status', 'Range', 'Submitted', 'Verified'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {results.map(r => {
                    const rBadge = RESULT_STATUS_BADGE[r.status] ?? { bg: '#F3F4F6', color: '#374151', label: r.status }
                    return (
                      <tr key={r.id}>
                        <td style={{ ...td, fontWeight: 600 }}>{r.test_name || '—'}</td>
                        <td style={td}>{r.ar_id || '—'}</td>
                        <td style={td}>{r.value || '—'}</td>
                        <td style={td}>{r.unit || '—'}</td>
                        <td style={td}><span style={{ background: rBadge.bg, color: rBadge.color, borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11 }}>{rBadge.label}</span></td>
                        <td style={td}>{r.is_out_of_range ? <span style={{ color: '#DC2626', fontWeight: 600 }}>Out of range</span> : <span style={{ color: '#6B7280' }}>In range</span>}</td>
                        <td style={td}>{fmt(r.submitted_at)}</td>
                        <td style={td}>{fmt(r.verified_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition, type CSSProperties } from 'react'
import { type LabSample, patchLabSample } from '@/app/actions/lab-samples'
import { type AnalysisRequest } from '@/app/actions/analysis-requests'
import LiveBarcode from '@/app/dashboard/_components/LiveBarcode'
import { STICKER_TEMPLATES, printSticker, type StickerTemplate } from '@/app/lib/stickerTemplates'
import { type CocSample } from '@/app/actions/storage'
import { sampleDisplayId as displayId } from '@/app/lib/sampleDisplay'
import SampleAuditDrawer from './SampleAuditDrawer'
import ChainOfCustodyDrawer from './ChainOfCustodyDrawer'

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
  received:        { bg: '#DCFCE7', color: '#166534', label: 'Received' },
  in_progress:     { bg: '#DBEAFE', color: '#1E40AF', label: 'In Process' },
  results_pending: { bg: '#FEF3C7', color: '#92400E', label: 'To Be Verified' },
  reviewed:        { bg: '#E0E7FF', color: '#3730A3', label: 'Reviewed' },
  published:       { bg: '#DBEAFE', color: '#0154FC', label: 'Completed' },
  rejected:        { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
  disposed:        { bg: '#F3F4F6', color: '#374151', label: 'Disposed' },
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
  try { return new Date(d).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }) }
  catch { return d }
}

function fmtShort(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) }
  catch { return d }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F3F4F6' }}>
      <span style={{ fontSize: 12, color: '#374151' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  )
}

const th: CSSProperties = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '10px 12px', fontSize: 12, color: '#374151', borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }

const headerBtn: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 20, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
const headerBtnPrimary: CSSProperties = { ...headerBtn, border: 'none', background: '#0154FC', color: '#fff' }

const inp: CSSProperties = { border: '1px solid #D1D5DB', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: '#111827', background: '#fff', width: '100%', outline: 'none', boxSizing: 'border-box' }
const lbl: CSSProperties = { fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }

export function EditDrawer({ sample, onClose, onSaved }: { sample: LabSample; onClose: () => void; onSaved: () => void }) {
  const [busy, startTransition] = useTransition()
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [vals, setVals] = useState({
    description:     sample.description ?? '',
    collection_date: sample.collection_date ? sample.collection_date.slice(0, 16) : '',
    expiry_date:     sample.expiry_date ? sample.expiry_date.slice(0, 16) : '',
    storage_location: sample.storage_location ?? '',
    priority:        sample.priority ?? 'medium',
    condition:       sample.condition ?? 'good',
    contact_name:    sample.contact_name ?? '',
    client_order_number: sample.client_order_number ?? '',
    client_reference:    sample.client_reference ?? '',
    client_sample_id:    sample.client_sample_id ?? '',
    batch_id:        sample.batch_id ?? '',
  })

  // Snapshot of the values as the drawer opened — a field is PATCHed when it
  // differs from this, so clearing a field ('' when it had a value) is sent too.
  const [initialVals] = useState(vals)

  function set(k: string, v: string) { setVals(prev => ({ ...prev, [k]: v })) }

  function handleSave() {
    startTransition(async () => {
      const patch: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(vals)) {
        if (v !== initialVals[k as keyof typeof initialVals]) patch[k] = v
      }
      const res = await patchLabSample(sample.id, patch)
      setToast({ ok: res.ok, msg: res.ok ? 'Changes saved.' : (res.message ?? 'Save failed.') })
      if (res.ok) setTimeout(() => { onSaved(); onClose() }, 800)
    })
  }

  // Date.now() is impure — capture it after mount rather than during render.
  const [nowLocal, setNowLocal] = useState<string | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowLocal(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16))
  }, [])

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 400, backgroundColor: 'rgba(0,0,0,0.28)' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 460, zIndex: 401, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#14265E', margin: 0 }}>Edit Sample</h3>
            <p style={{ fontSize: 11, color: '#374151', margin: '2px 0 0' }}>{displayId(sample)}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <MI name="close" size={18} color="#374151" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sample.is_locked && (
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MI name="lock" size={14} color="#92400E" />
              This sample is locked. Only admins and lab managers can make changes.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Date Sampled</label>
              <input type="datetime-local" value={vals.collection_date} max={nowLocal ?? undefined}
                onChange={e => set('collection_date', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Due Date</label>
              <input type="datetime-local" value={vals.expiry_date}
                onChange={e => set('expiry_date', e.target.value)} style={inp} /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Priority</label>
              <select value={vals.priority} onChange={e => set('priority', e.target.value)} style={inp}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select></div>
            <div><label style={lbl}>Sample Condition</label>
              <select value={vals.condition} onChange={e => set('condition', e.target.value)} style={inp}>
                <option value="good">Good</option>
                <option value="acceptable">Acceptable</option>
                <option value="compromised">Compromised</option>
                <option value="not_acceptable">Not Acceptable</option>
              </select></div>
          </div>

          <div><label style={lbl}>Storage Location</label>
            <input value={vals.storage_location} onChange={e => set('storage_location', e.target.value)} placeholder="e.g. Refrigerator 2" style={inp} /></div>

          <div><label style={lbl}>Contact Name</label>
            <input value={vals.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="Contact person" style={inp} /></div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Batch ID</label>
              <input value={vals.batch_id} onChange={e => set('batch_id', e.target.value)} placeholder="e.g. B-001" style={inp} /></div>
            <div><label style={lbl}>Client Order No.</label>
              <input value={vals.client_order_number} onChange={e => set('client_order_number', e.target.value)} placeholder="e.g. CO-001" style={inp} /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Client Reference</label>
              <input value={vals.client_reference} onChange={e => set('client_reference', e.target.value)} placeholder="Reference" style={inp} /></div>
            <div><label style={lbl}>Client Sample ID</label>
              <input value={vals.client_sample_id} onChange={e => set('client_sample_id', e.target.value)} placeholder="e.g. SMP-001" style={inp} /></div>
          </div>

          <div><label style={lbl}>Sample Notes</label>
            <textarea value={vals.description} onChange={e => set('description', e.target.value)} rows={3}
              placeholder="Any notes about this sample..." style={{ ...inp, resize: 'none' }} /></div>
        </div>

        {toast && (
          <div style={{ margin: '0 20px 8px', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', color: toast.ok ? '#0154FC' : '#991B1B',
            border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}` }}>
            {toast.msg}
          </div>
        )}

        <div style={{ padding: '14px 20px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Cancel</button>
          <button onClick={handleSave} disabled={busy} style={{ flex: 2, padding: '9px', borderRadius: 8, border: 'none', background: busy ? '#93C5FD' : '#0154FC', color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  )
}

export default function SampleOverviewDetail({ sample, id, analysisRequests, isDrawer }: { sample: LabSample | null; id: string; analysisRequests: AnalysisRequest[]; isDrawer?: boolean }) {
  const router = useRouter()
  // Date.now() is impure — capture it after mount rather than during render.
  const [nowMs, setNowMs] = useState<number | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowMs(Date.now())
  }, [])
  const searchParams = useSearchParams()
  const [showEdit, setShowEdit] = useState(() => searchParams.get('edit') === '1')
  const [showAuditTrail, setShowAuditTrail] = useState(false)
  const [showChainOfCustody, setShowChainOfCustody] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [templateId, setTemplateId] = useState(STICKER_TEMPLATES[0].id)
  const [copies, setCopies] = useState(1)

  if (!sample) {
    return (
      <div style={{ padding: 40, textAlign: 'center', background: '#F9FAFB', minHeight: '100%' }}>
        <MI name="science" size={48} color="#D1D5DB" />
        <p style={{ fontSize: 15, color: '#374151', marginTop: 12 }}>Sample not found</p>
        <p style={{ fontSize: 12, color: '#374151' }}>ID: {id}</p>
        {!isDrawer && (
          <Link href="/dashboard/samples-overview" style={{ fontSize: 13, color: '#2563EB', marginTop: 16, display: 'inline-block' }}>← Back to Samples</Link>
        )}
      </div>
    )
  }

  const badge = STATUS_BADGE[sample.status] ?? { bg: '#F3F4F6', color: '#374151', label: sample.status }
  const pBadge = PRIORITY_BADGE[sample.priority] ?? { bg: '#F3F4F6', color: '#374151' }
  const pastRetention = Boolean(
    sample.expiry_date
    && new Date(sample.expiry_date) < new Date()
    && !['registered', 'disposed', 'rejected'].includes(sample.status)
  )
  const docUrl = sample.attachment_url || sample.attachment || null

  // Flatten analysis requests -> one row per analysis
  const analysisRows = analysisRequests.flatMap(ar =>
    ar.analyses.map(a => ({ test: { name: a.senaite_service_name }, ar }))
  )

  return (
    <div style={{ padding: isDrawer ? '40px 24px 24px' : 24, minHeight: '100%', background: '#F9FAFB' }}>
      {/* Breadcrumb */}
      {!isDrawer && (
        <div style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>
          <span style={{ cursor: 'pointer' }} onClick={() => router.push('/dashboard/samples-overview')}>Samples</span>
          <span style={{ margin: '0 6px' }}>›</span>
          <span style={{ fontWeight: 600, color: '#111827' }}>Sample Detail</span>
        </div>
      )}

      {showEdit && <EditDrawer sample={sample} onClose={() => setShowEdit(false)} onSaved={() => router.refresh()} />}

      {showAuditTrail && (
        // Django's AuditEvent.object_repr is always the Django sample_id field
        // (str(Sample) — see lims/models.py), never the SENAITE-preferring
        // displayId() shown elsewhere on this page. Must match sample_id exactly
        // or the audit trail always looks empty.
        <SampleAuditDrawer
          sampleId={sample.id}
          open={showAuditTrail}
          onClose={() => setShowAuditTrail(false)}
        />
      )}

      {showChainOfCustody && (
        <ChainOfCustodyDrawer
          sampleId={displayId(sample)}
          open={showChainOfCustody}
          onClose={() => setShowChainOfCustody(false)}
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

      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#14265E', margin: 0 }}>Sample Detail</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => router.push(`/dashboard/samples-overview/new?edit=${sample.id}`)} style={headerBtnPrimary}>
            <MI name="edit" size={15} color="#fff" /><span>Edit Sample</span>
          </button>
          <button onClick={() => document.getElementById('storage-info')?.scrollIntoView({ behavior: 'smooth' })} style={headerBtn}>
            <MI name="inventory_2" size={15} /><span>Storage History</span>
          </button>
          <button onClick={() => router.push(`/dashboard/samples-overview/${sample.id}/audit-trail`)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <MI name="shield" size={16} /><span>Audit Trail</span>
          </button>
          <button onClick={() => setShowChainOfCustody(true)} style={headerBtn}>
            <MI name="link" size={15} /><span>Chain of Custody</span>
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setPrintOpen(v => !v)} style={headerBtn}>
              <MI name="print" size={15} /><span>Print Label</span>
            </button>
            {printOpen && (
              <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 20, width: 260, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', padding: 14 }}>
                <label style={{ fontSize: 11, color: '#374151', display: 'block', marginBottom: 4 }}>Template</label>
                <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                  style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, marginBottom: 10 }}>
                  {STICKER_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <label style={{ fontSize: 11, color: '#374151', display: 'block', marginBottom: 4 }}>Copies</label>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#14265E' }}>{displayId(sample)}</span>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                  onClick={() => navigator.clipboard?.writeText(displayId(sample))}>
                  <MI name="content_copy" size={14} color="#374151" />
                </button>
                <span style={{ background: badge.bg, color: badge.color, borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11 }}>{badge.label}</span>
                {sample.priority && <span style={{ background: pBadge.bg, color: pBadge.color, borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11, textTransform: 'capitalize' }}>{sample.priority}</span>}
                {sample.hold_for_qa && <span style={{ background: '#F3F4F6', color: '#374151', borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11 }}>On Hold for QA</span>}
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
                <p style={{ fontSize: 11, color: '#374151', margin: '0 0 4px' }}>{m.label}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: m.label === 'Priority' && sample.priority === 'high' ? '#DC2626' : '#14265E', margin: 0, textTransform: 'capitalize' }}>{m.value || '—'}</p>
              </div>
            ))}
          </div>

          {/* Barcode */}
          <div style={{ textAlign: 'center', paddingLeft: 20, borderLeft: '1px solid #E8EAF2' }}>
            <p style={{ fontSize: 11, color: '#374151', margin: '0 0 6px' }}>Sample Bar Code</p>
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
              <p style={{ fontSize: 11, color: '#374151', margin: '0 0 4px' }}>{m.label}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: m.label === 'Due Date' && pastRetention ? '#DC2626' : '#14265E', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {m.icon && <MI name={m.icon} size={13} color={m.label === 'Due Date' && pastRetention ? '#DC2626' : '#374151'} />}{m.value || '—'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Sample Info + Requested Analyses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: 16, marginBottom: 16 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8EAF2', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 18, minWidth: 0 }}>
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

        <div id="requested-analyses" style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8EAF2', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden', minWidth: 0 }}>
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
                  <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#374151', padding: '24px 12px' }}>No analyses requested yet.</td></tr>
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
      <div id="storage-info" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8EAF2', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden', minWidth: 0 }}>
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
                  <tr><td colSpan={3} style={{ ...td, textAlign: 'center', color: '#374151', padding: '24px 12px' }}>No storage location assigned yet.</td></tr>
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
              <MI name="open_in_new" size={13} color="#374151" />
            </a>
          ) : (
            <div style={{ textAlign: 'center', padding: '18px 0', color: '#374151' }}>
              <MI name="description" size={28} color="#D1D5DB" />
              <p style={{ fontSize: 12, marginTop: 8 }}>No documents uploaded for this sample yet.</p>
              <p style={{ fontSize: 11, marginTop: 4 }}>Attach a disposal certificate when disposing the sample.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

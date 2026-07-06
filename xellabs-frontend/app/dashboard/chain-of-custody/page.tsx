'use client'
import { useState, useRef } from 'react'
import { lookupChainOfCustody, type ChainOfCustodyResult, type CocSample, type CocEvent } from '@/app/actions/storage'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Code 39 barcode SVG generator (no external libs) ─────────────────────────
const C39: Record<string, string> = {
  '0':'000110100','1':'100100001','2':'001100001','3':'101100000',
  '4':'000110001','5':'100110000','6':'001110000','7':'000100101',
  '8':'100100100','9':'001100100','A':'100001001','B':'001001001',
  'C':'101001000','D':'000011001','E':'100011000','F':'001011000',
  'G':'000001101','H':'100001100','I':'001001100','J':'000011100',
  'K':'100000011','L':'001000011','M':'101000010','N':'000010011',
  'O':'100010010','P':'001010010','Q':'000000111','R':'100000110',
  'S':'001000110','T':'000010110','U':'110000001','V':'011000001',
  'W':'111000000','X':'010010001','Y':'110010000','Z':'011010000',
  '-':'010000101','.':'110000100',' ':'011000100','$':'010101000',
  '/':'010100010','+':'010001010','%':'000101010','*':'010010100',
}
function code39Svg(raw: string, barH = 64): string {
  const N = 2.4, W = 6, GAP = 3
  // Code 39 only supports uppercase + limited symbols — filter/uppercase
  const value = raw.toUpperCase().replace(/[^0-9A-Z\-\. \$\/\+%]/g, '')
  const full = '*' + value + '*'
  let x = 10
  const rects: string[] = []
  for (const ch of full) {
    const pat = C39[ch]
    if (!pat) { x += GAP; continue }
    for (let j = 0; j < 9; j++) {
      const w = pat[j] === '1' ? W : N
      if (j % 2 === 0) rects.push(`<rect x="${x.toFixed(1)}" y="0" width="${w}" height="${barH}" fill="#000"/>`)
      x += w
    }
    x += GAP
  }
  const totalW = x + 10
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${barH}" viewBox="0 0 ${totalW} ${barH}">${rects.join('')}</svg>`
}

// ── Print label ───────────────────────────────────────────────────────────────
function printLabel(sample: CocSample, loc: ChainOfCustodyResult['current_location']) {
  const barcode = sample.barcode || sample.sample_id
  const barcodesvg = code39Svg(barcode)
  const html = `<!DOCTYPE html><html><head><title>Sample Label — ${sample.sample_id}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Inter, Arial, sans-serif; background:#fff; }
  @media print { body { margin:0; } @page { margin:6mm; size: 100mm 62mm; } }
  .label { width:100mm; min-height:62mm; border:1px solid #ccc; padding:5mm; display:flex; flex-direction:column; gap:3mm; }
  .header { display:flex; align-items:center; justify-content:space-between; border-bottom:0.5px solid #ddd; padding-bottom:2mm; }
  .lab { font-size:9pt; font-weight:700; color:#0154FC; letter-spacing:0.04em; }
  .date { font-size:7pt; color:#888; }
  .bc-wrap { display:flex; flex-direction:column; align-items:center; gap:1.5mm; }
  .bc-wrap svg { max-width:100%; height:auto; }
  .bc-val { font-size:9pt; font-weight:700; font-family:monospace; letter-spacing:0.06em; color:#111; }
  .info { display:grid; grid-template-columns:1fr 1fr; gap:1mm 4mm; }
  .row { display:flex; flex-direction:column; }
  .lbl { font-size:6pt; color:#999; text-transform:uppercase; letter-spacing:0.05em; }
  .val { font-size:7.5pt; font-weight:600; color:#111; }
  .storage { font-size:7pt; color:#374151; background:#f3f4f6; border-radius:2mm; padding:1.5mm 2mm; margin-top:1mm; }
  .status { font-size:7pt; font-weight:700; padding:1mm 3mm; border-radius:999px; background:#dbeafe; color:#1d4ed8; display:inline-block; }
</style></head><body>
<div class="label">
  <div class="header">
    <span class="lab">XelLabs LIMS</span>
    <span class="date">Printed: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</span>
  </div>
  <div class="bc-wrap">
    ${barcodesvg}
    <span class="bc-val">${barcode}</span>
  </div>
  <div class="info">
    <div class="row"><span class="lbl">Sample ID</span><span class="val">${sample.sample_id}</span></div>
    <div class="row"><span class="lbl">Sample Type</span><span class="val">${sample.sample_type}</span></div>
    <div class="row"><span class="lbl">Client</span><span class="val">${sample.client}</span></div>
    <div class="row"><span class="lbl">Status</span><span class="val"><span class="status">${sample.status_display}</span></span></div>
    ${sample.received_date ? `<div class="row"><span class="lbl">Received</span><span class="val">${new Date(sample.received_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</span></div>` : ''}
    ${sample.received_by ? `<div class="row"><span class="lbl">Received By</span><span class="val">${sample.received_by}</span></div>` : ''}
    ${sample.condition ? `<div class="row"><span class="lbl">Condition</span><span class="val">${sample.condition}</span></div>` : ''}
    ${sample.priority ? `<div class="row"><span class="lbl">Priority</span><span class="val">${sample.priority}</span></div>` : ''}
  </div>
  ${loc ? `<div class="storage">
    <strong>Storage:</strong> ${loc.storage_path.split(' / ').slice(-3).join(' / ')} &nbsp;•&nbsp; Slot ${loc.slot_id}
    ${loc.temperature ? `&nbsp;•&nbsp; ${loc.temperature}` : ''}
    ${loc.capacity ? `&nbsp;•&nbsp; ${loc.capacity.occupied}/${loc.capacity.total} slots used` : ''}
  </div>` : '<div class="storage" style="color:#999;">Not currently in storage</div>'}
</div>
<script>window.onload = function(){ window.print(); }<\/script>
</body></html>`
  const w = window.open('', '_blank', 'width=500,height=420')
  if (w) { w.document.write(html); w.document.close() }
}

function statusStyle(status: string): { bg: string; color: string; label: string } {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    registered:      { bg: '#F3F4F6', color: '#374151', label: 'Registered' },
    received:        { bg: '#DBEAFE', color: '#1D4ED8', label: 'Received' },
    in_progress:     { bg: '#FEF3C7', color: '#92400E', label: 'In Process' },
    results_pending: { bg: '#EDE9FE', color: '#5B21B6', label: 'Results Pending' },
    reviewed:        { bg: '#CCFBF1', color: '#0F766E', label: 'Reviewed' },
    published:       { bg: '#DCFCE7', color: '#166534', label: 'Published' },
    rejected:        { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
    disposed:        { bg: '#F3F4F6', color: '#6B7280', label: 'Disposed' },
  }
  return map[status] ?? { bg: '#F3F4F6', color: '#374151', label: status }
}

function eventMeta(ev: CocEvent): { label: string; icon: string; color: string } {
  switch (ev.event_type) {
    case 'sample_registered': return { label: 'Registered',           icon: 'assignment_add', color: '#22C55E' }
    case 'sample_received':   return { label: 'Received',             icon: 'check_circle',   color: '#22C55E' }
    case 'stored':            return { label: `Stored in ${(ev.details?.storage_path as string) ?? 'Storage'}`, icon: 'inventory_2', color: '#0154FC' }
    case 'released':          return { label: 'Released from Storage', icon: 'link_off',      color: '#EF4444' }
    case 'status_change': {
      const nc = (ev.details?.changes as Array<{ field: string; new: string | null }>)?.find(c => c.field === 'status')?.new ?? ''
      if (nc === 'in_progress') return { label: 'Released for Testing', icon: 'person',    color: '#8B5CF6' }
      if (nc === 'reviewed')    return { label: 'Results Reviewed',     icon: 'verified',  color: '#0891B2' }
      if (nc === 'published')   return { label: 'Results Published',    icon: 'publish',   color: '#22C55E' }
      if (nc === 'rejected')    return { label: 'Sample Rejected',      icon: 'cancel',    color: '#EF4444' }
      return { label: ev.label, icon: 'swap_horiz', color: '#8B5CF6' }
    }
    default: return { label: ev.label, icon: 'edit', color: '#F59E0B' }
  }
}

function eventRows(ev: CocEvent, sample: CocSample | null): Array<{ key: string; value: string }> {
  const rows: Array<{ key: string; value: string }> = [{ key: 'By', value: ev.user }]
  if (ev.event_type === 'sample_registered' || ev.event_type === 'sample_received') {
    if (sample?.barcode) rows.push({ key: 'Barcode', value: sample.barcode })
  }
  if (ev.event_type === 'stored') {
    if (ev.details?.storage_path) rows.push({ key: 'Location',  value: ev.details.storage_path as string })
    if (ev.details?.slot_id)      rows.push({ key: 'Container', value: `Slot ${ev.details.slot_id as string}` })
    if (sample?.barcode)          rows.push({ key: 'Barcode',   value: sample.barcode })
  }
  if (ev.event_type === 'released') {
    if (ev.details?.slot_id)      rows.push({ key: 'Container', value: `Slot ${ev.details.slot_id as string}` })
    if (sample?.barcode)          rows.push({ key: 'Barcode',   value: sample.barcode })
  }
  return rows
}

export default function ChainOfCustodyPage() {
  const [sampleInput, setSampleInput] = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [result, setResult]           = useState<ChainOfCustodyResult | null>(null)
  const [storageReason, setStorageReason] = useState('Routine Storage')
  const [storageNotes, setStorageNotes]   = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleLookup(id?: string) {
    const sid = (id ?? sampleInput).trim()
    if (!sid) return
    setLoading(true); setError(''); setResult(null)
    const res = await lookupChainOfCustody(sid)
    setLoading(false)
    if (!res.success || !res.data?.sample) { setError(res.message ?? `Sample "${sid}" not found.`); return }
    setResult(res.data)
  }

  const sample = result?.sample ?? null
  const loc    = result?.current_location ?? null
  const events = result?.history ?? []
  const st     = sample ? statusStyle(sample.status) : null
  const cap    = loc?.capacity ?? null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', height: '100%', fontFamily: 'Inter, sans-serif', backgroundColor: '#F8F9FB', overflow: 'hidden' }}>

      {/* ══ MAIN ══ */}
      <div style={{ overflowY: 'auto', padding: '20px 20px 28px 24px' }}>

        {/* Breadcrumb + actions */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
            <span style={{ cursor: 'pointer', color: '#0154FC' }}>Samples</span>
            {sample && <><MI name="chevron_right" size={14} color="#9CA3AF" />
              <span style={{ cursor: 'pointer', color: '#0154FC' }}>{sample.sample_id}</span></>}
            <MI name="chevron_right" size={14} color="#9CA3AF" />
            <span style={{ color: '#374151' }}>Store Sample</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => sample && printLabel(sample, loc)}
              disabled={!sample}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg"
              style={{ border: '1px solid #E5E7EB', color: sample ? '#374151' : '#9CA3AF', backgroundColor: '#fff', cursor: sample ? 'pointer' : 'not-allowed', opacity: sample ? 1 : 0.5 }}>
              <MI name="print" size={14} color={sample ? '#374151' : '#9CA3AF'} /> Print Label
            </button>
            <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg"
              style={{ border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              More Actions <MI name="keyboard_arrow_down" size={14} color="#6B7280" />
            </button>
          </div>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '2px 0 4px' }}>Store Sample</h1>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 20px' }}>Store the sample in designated storage and update chain of custody.</p>

        {/* ── Sample lookup bar ── */}
        {!sample && (
          <div className="bg-white rounded-2xl mb-4 p-4" style={{ border: '1px solid #E5E7EB' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Enter Sample ID or Scan Barcode</p>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 flex-1 rounded-xl px-3 py-2.5"
                style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, backgroundColor: '#FAFAFA' }}>
                <MI name="qr_code_scanner" size={16} color="#9CA3AF" />
                <input ref={inputRef} autoFocus value={sampleInput}
                  onChange={e => { setSampleInput(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleLookup()}
                  placeholder="e.g. S-25-01987"
                  className="flex-1 outline-none text-sm"
                  style={{ color: '#111827', backgroundColor: 'transparent' }} />
              </div>
              <button onClick={() => handleLookup()} disabled={!sampleInput.trim() || loading}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: '#0154FC', border: 'none', cursor: !sampleInput.trim() || loading ? 'not-allowed' : 'pointer', opacity: !sampleInput.trim() || loading ? 0.6 : 1 }}>
                {loading ? 'Loading…' : 'Look Up'}
              </button>
            </div>
            {error && <p className="text-xs mt-2" style={{ color: '#EF4444' }}>{error}</p>}
          </div>
        )}

        {/* ── Sample Information ── */}
        {sample && (
          <div className="bg-white rounded-2xl mb-4" style={{ border: '1px solid #E5E7EB', padding: '16px 20px' }}>
            <div className="flex items-center gap-2 mb-4">
              <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MI name="verified_user" size={15} color="#3B82F6" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Sample Information</span>
              <button onClick={() => { setResult(null); setSampleInput(''); setError('') }}
                className="ml-auto flex items-center gap-1 text-xs" style={{ color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}>
                <MI name="close" size={13} color="#9CA3AF" /> Clear
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {[
                { label: 'Sample ID',        val: sample.sample_id,                isStatus: false, isBarcode: false },
                { label: 'Project / Client', val: sample.client,                   isStatus: false, isBarcode: false },
                { label: 'Sample Type',      val: sample.sample_type,              isStatus: false, isBarcode: false },
                { label: 'Barcode',          val: sample.barcode || sample.sample_id, isStatus: false, isBarcode: true },
                { label: 'Status',           val: '',                              isStatus: true,  isBarcode: false },
              ].map(f => (
                <div key={f.label}>
                  <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 3 }}>{f.label}</p>
                  {f.isStatus ? (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 999, backgroundColor: st!.bg, color: st!.color }}>{st!.label}</span>
                  ) : f.isBarcode ? (
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: 0, fontFamily: 'monospace', letterSpacing: '0.04em' }}>{f.val}</p>
                  ) : (
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>{f.val}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 flex flex-wrap gap-x-8 gap-y-1" style={{ borderTop: '1px solid #F3F4F6' }}>
              {sample.received_date && <><span style={{ fontSize: 10, color: '#9CA3AF' }}>Received</span><span style={{ fontSize: 10, fontWeight: 500, color: '#374151' }}>{fmtDate(sample.received_date)}</span></>}
              {sample.received_by  && <><span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 16 }}>Received by</span><span style={{ fontSize: 10, fontWeight: 500, color: '#374151' }}>{sample.received_by}</span></>}
              {sample.condition    && <><span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 16 }}>Condition</span><span style={{ fontSize: 10, fontWeight: 500, color: '#374151' }}>{sample.condition}</span></>}
              {sample.priority     && <><span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 16 }}>Priority</span><span style={{ fontSize: 10, fontWeight: 500, color: '#374151' }}>{sample.priority}</span></>}
              {sample.hold_for_qa  && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, backgroundColor: '#FEF3C7', color: '#92400E', marginLeft: 16 }}>QA Hold</span>}
            </div>
            {sample.receipt_notes && (
              <div className="mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <span style={{ fontSize: 10, color: '#92400E', fontWeight: 600 }}>Receipt Notes: </span>
                <span style={{ fontSize: 10, color: '#451A03' }}>{sample.receipt_notes}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Barcode Scan ── */}
        {sample && (
          <div className="bg-white rounded-2xl mb-4" style={{ border: '1px solid #E5E7EB', padding: '16px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center' }}>
              <div className="flex items-start gap-3">
                <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MI name="view_week" size={22} color="#6B7280" />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 3 }}>Barcode Scan</p>
                  <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 2px' }}>Scan the storage container barcode</p>
                  <p style={{ fontSize: 11, color: '#0154FC' }}>Ensure the correct container is selected for storage.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl p-3" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <MI name="check_circle" size={18} color="#22C55E" />
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#166534', margin: '0 0 4px' }}>Barcode Scanned Successfully</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 3px', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                    {sample.barcode || sample.sample_id}
                  </p>
                  {loc
                    ? <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{loc.storage_path.split(' / ').slice(-2).join(' / ')} • Slot {loc.slot_id}</p>
                    : <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Not currently in storage</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Selected Storage ── */}
        {sample && loc && (
          <div className="bg-white rounded-2xl mb-4" style={{ border: '1px solid #E5E7EB', padding: '16px 20px' }}>
            <div className="flex items-center gap-2 mb-4">
              <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MI name="inventory_2" size={15} color="#6B7280" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Selected Storage</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, alignItems: 'start' }}>
              {/* Location */}
              <div>
                <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>Location</p>
                <p style={{ fontSize: 11, color: '#0154FC', marginBottom: 2 }}>
                  {loc.storage_path.split(' / ').slice(0, -2).join(' > ') || '—'}
                </p>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>
                  {loc.storage_path.split(' / ').slice(-2, -1)[0] ?? loc.slot_name}
                </p>
              </div>
              {/* Container / Slot */}
              <div>
                <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>Container / Slot</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 5 }}>{loc.slot_name}</p>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 12px', borderRadius: 999, backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                  Slot {loc.slot_id}
                </span>
              </div>
              {/* Temperature */}
              {loc.temperature ? (
                <div>
                  <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>Temperature</p>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 14px', borderRadius: 999, backgroundColor: '#CCFBF1', color: '#0F766E' }}>
                    {loc.temperature}
                  </span>
                </div>
              ) : <div />}
              {/* Capacity: occupied vs free */}
              <div>
                <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>Capacity</p>
                {cap ? (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                      {cap.occupied} / {cap.total}
                      <span style={{ fontSize: 10, fontWeight: 400, color: '#6B7280', marginLeft: 4 }}>
                        ({Math.round((cap.occupied / Math.max(cap.total, 1)) * 100)}%)
                      </span>
                    </p>
                    {/* Progress bar */}
                    <div style={{ height: 6, borderRadius: 999, backgroundColor: '#E5E7EB', overflow: 'hidden', marginBottom: 5 }}>
                      <div style={{ height: '100%', width: `${Math.round((cap.occupied / Math.max(cap.total, 1)) * 100)}%`, borderRadius: 999, backgroundColor: cap.free === 0 ? '#EF4444' : '#3B82F6', transition: 'width 0.3s' }} />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex items-center gap-1">
                        <div style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: '#EF4444' }} />
                        <span style={{ fontSize: 9, color: '#6B7280' }}>{cap.occupied} occupied</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: '#22C55E' }} />
                        <span style={{ fontSize: 9, color: '#6B7280' }}>{cap.free} free</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>—</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Storage Details ── */}
        {sample && (
          <div className="bg-white rounded-2xl mb-5" style={{ border: '1px solid #E5E7EB', padding: '16px 20px' }}>
            <div className="flex items-center gap-2 mb-4">
              <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MI name="edit_note" size={15} color="#6B7280" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Storage Details</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Storage Reason</label>
                <select value={storageReason} onChange={e => setStorageReason(e.target.value)}
                  className="w-full outline-none text-sm px-3 py-2.5 rounded-xl"
                  style={{ border: '1px solid #D1D5DB', color: '#374151', cursor: 'pointer', backgroundColor: '#fff' }}>
                  <option>Routine Storage</option>
                  <option>QA Hold</option>
                  <option>Pending Analysis</option>
                  <option>Long-term Archive</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Storage Notes <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span>
                </label>
                <input value={storageNotes} onChange={e => setStorageNotes(e.target.value)}
                  placeholder="Enter notes about storage conditions, observations, etc."
                  className="w-full outline-none text-sm px-3 py-2.5 rounded-xl"
                  style={{ border: '1px solid #D1D5DB', color: '#374151' }} />
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {sample && (
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              <MI name="qr_code_scanner" size={15} color="#374151" /> Scan Barcode
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              <MI name="add_location" size={15} color="#374151" /> Assign Storage
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              <MI name="swap_horiz" size={15} color="#374151" /> Transfer Custody
            </button>
            <button className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white ml-auto"
              style={{ backgroundColor: '#0154FC', cursor: 'pointer', border: 'none' }}>
              <MI name="check_circle" size={15} color="#fff" /> Confirm Storage
            </button>
          </div>
        )}
      </div>

      {/* ══ RIGHT: CoC timeline ══ */}
      <div className="flex flex-col" style={{ backgroundColor: '#fff', borderLeft: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Chain of Custody</span>
            <MI name="info_outline" size={14} color="#9CA3AF" />
          </div>
          {loc && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 999, backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
              Current Custody
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto" style={{ padding: '16px 16px 8px' }}>
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-10">
              <MI name="history" size={30} color="#D1D5DB" />
              <p className="mt-3 text-xs text-center" style={{ color: '#9CA3AF', lineHeight: 1.6, maxWidth: 160 }}>
                {result ? 'No custody events recorded yet.' : 'Scan a sample barcode to view the full custody trail.'}
              </p>
            </div>
          ) : (
            events.map((ev, i) => {
              const isLast = i === events.length - 1
              const meta = eventMeta(ev)
              const rows = eventRows(ev, sample)
              type FC = { field: string; old: string | null; new: string | null }
              const changes = (ev.details?.changes as FC[]) ?? []
              return (
                <div key={ev.id} style={{ display: 'flex', gap: 12, marginBottom: 20, position: 'relative' }}>
                  {!isLast && (
                    <div style={{ position: 'absolute', left: 14, top: 30, width: 2, height: 'calc(100% + 4px)', backgroundColor: '#E5E7EB', zIndex: 0 }} />
                  )}
                  <div style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: meta.color + '1A', border: `2px solid ${meta.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                    <MI name={meta.icon} size={14} color={meta.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', lineHeight: 1.35 }}>{meta.label}</span>
                      <span style={{ fontSize: 10, color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDateShort(ev.timestamp)}</span>
                    </div>
                    <p style={{ fontSize: 10, color: '#9CA3AF', margin: '0 0 5px' }}>{fmtTime(ev.timestamp)}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {rows.map(row => (
                        <div key={row.key} style={{ display: 'flex', gap: 8 }}>
                          <span style={{ fontSize: 10, color: '#9CA3AF', minWidth: 64, flexShrink: 0 }}>{row.key}</span>
                          <span style={{ fontSize: 10, fontWeight: 500, color: '#111827', wordBreak: 'break-word', fontFamily: row.key === 'Barcode' ? 'monospace' : 'inherit' }}>{row.value}</span>
                        </div>
                      ))}
                      {ev.event_type === 'sample_received' && sample?.receipt_notes && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <span style={{ fontSize: 10, color: '#9CA3AF', minWidth: 64, flexShrink: 0 }}>Remarks</span>
                          <span style={{ fontSize: 10, fontWeight: 500, color: '#111827' }}>{sample.receipt_notes}</span>
                        </div>
                      )}
                      {ev.event_type === 'stored' && (ev.details?.storage_path as string | undefined) && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <span style={{ fontSize: 10, color: '#9CA3AF', minWidth: 64, flexShrink: 0 }}>Remarks</span>
                          <span style={{ fontSize: 10, fontWeight: 500, color: '#111827' }}>Stored in {ev.details.storage_path as string}</span>
                        </div>
                      )}
                      {/* Field-level changes for update events */}
                      {ev.event_type === 'update' && changes.length > 0 && (
                        <div style={{ marginTop: 2 }}>
                          {changes.slice(0, 3).map((c, ci) => (
                            <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#6B7280', lineHeight: 1.5 }}>
                              <span style={{ color: '#9CA3AF', minWidth: 56 }}>{c.field.replace(/_/g, ' ')}</span>
                              <span style={{ color: '#EF4444' }}>{c.old || '—'}</span>
                              <MI name="arrow_forward" size={9} color="#9CA3AF" />
                              <span style={{ color: '#22C55E' }}>{c.new || '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="px-4 py-3" style={{ borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
          <button className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-medium"
            style={{ border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
            <MI name="history" size={14} color="#6B7280" /> View Full History
          </button>
        </div>
      </div>
    </div>
  )
}

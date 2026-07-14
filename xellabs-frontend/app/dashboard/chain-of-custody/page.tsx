'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  lookupChainOfCustody, resolveStorageLabel, assignSampleByLabel,
  type ChainOfCustodyResult, type CocSample, type CocEvent, type ResolvedLabel,
} from '@/app/actions/storage'
import { STICKER_TEMPLATES, renderSticker, stickerPageCss, printSticker, type StickerTemplate } from '@/app/lib/stickerTemplates'
import QrScanModal from '@/app/dashboard/_components/QrScanModal'
import { sampleDisplayId } from '@/app/lib/sampleDisplay'

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

// ── Sticker preview ──────────────────────────────────────────────────────────
const PREVIEW_BOX_PX = 240
const MM_TO_PX_PREVIEW = 4

function stickerPreviewDoc(stickerHtml: string, template: StickerTemplate): string {
  return `<!DOCTYPE html><html><head><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { background:#fff; }
    body { font-family: Inter, Arial, sans-serif; }
    ${stickerPageCss(template)}
  </style></head><body>${stickerHtml}</body></html>`
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
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false)
  const [stickerTemplateId, setStickerTemplateId] = useState(STICKER_TEMPLATES[0].id)
  const [stickerCopies, setStickerCopies] = useState(1)
  const [stickerPreviewDocHtml, setStickerPreviewDocHtml] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Storage assignment flow
  const [pendingLabel, setPendingLabel] = useState<ResolvedLabel | null>(null)
  const [assignOpen, setAssignOpen]     = useState(false)
  const [assignMode, setAssignMode]     = useState<'assign' | 'transfer'>('assign')
  const [labelInput, setLabelInput]     = useState('')
  const [resolving, setResolving]       = useState(false)
  const [resolveErr, setResolveErr]     = useState('')
  const [scanOpen, setScanOpen]         = useState(false)
  const [confirming, setConfirming]     = useState(false)
  const [toast, setToast]               = useState<{ ok: boolean; msg: string } | null>(null)
  const [historyOpen, setHistoryOpen]   = useState(false)
  const [morePos, setMorePos]           = useState<{ top: number; right: number } | null>(null)
  const moreBtnRef = useRef<HTMLButtonElement>(null)

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4500)
  }

  async function handleLookup(id?: string) {
    const sid = (id ?? sampleInput).trim()
    if (!sid) return
    setLoading(true); setError(''); setResult(null)
    const res = await lookupChainOfCustody(sid)
    setLoading(false)
    if (!res.success || !res.data?.sample) { setError(res.message ?? `Sample "${sid}" not found.`); return }
    setResult(res.data)
  }

  function openAssign(mode: 'assign' | 'transfer') {
    setAssignMode(mode); setLabelInput(''); setResolveErr(''); setAssignOpen(true)
  }

  function validateTarget(d: ResolvedLabel): string | null {
    if (d.location_type === 'slot' && d.is_occupied) return 'That slot is already occupied — pick a free slot.'
    if (d.location_type !== 'slot' && !d.next_free_slot) return 'No free slots available in that container.'
    return null
  }

  async function handleResolve() {
    const code = labelInput.trim()
    if (!code) return
    setResolving(true); setResolveErr('')
    const res = await resolveStorageLabel(code)
    setResolving(false)
    if (!res.success || !res.data) { setResolveErr(res.message ?? 'Location not found.'); return }
    const bad = validateTarget(res.data)
    if (bad) { setResolveErr(bad); return }
    setPendingLabel(res.data)
    setAssignOpen(false)
    setLabelInput('')
  }

  const handleScanDecode = useCallback(async (code: string): Promise<boolean> => {
    const res = await resolveStorageLabel(code)
    if (!res.success || !res.data) return false
    if (res.data.location_type === 'slot' && res.data.is_occupied) return false
    if (res.data.location_type !== 'slot' && !res.data.next_free_slot) return false
    setPendingLabel(res.data)
    setScanOpen(false)
    return true
  }, [])

  async function handleConfirm() {
    const s = result?.sample
    if (!s || !pendingLabel || confirming) return
    setConfirming(true)
    const targetCode = pendingLabel.location_type === 'slot'
      ? pendingLabel.label_code
      : (pendingLabel.next_free_slot?.label_code ?? pendingLabel.label_code)
    const res = await assignSampleByLabel(targetCode, s.sample_id)
    setConfirming(false)
    showToast(res.success, res.message)
    if (res.success) {
      setPendingLabel(null)
      await handleLookup(s.sample_id)
    }
  }

  function toggleMore() {
    if (morePos) { setMorePos(null); return }
    const rect = moreBtnRef.current!.getBoundingClientRect()
    setMorePos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
  }

  const sample = result?.sample ?? null
  const loc    = result?.current_location ?? null
  const events = result?.history ?? []
  const st     = sample ? statusStyle(sample.status) : null
  const cap    = loc?.capacity ?? null

  useEffect(() => {
    if (!stickerPickerOpen || !sample) { setStickerPreviewDocHtml(''); return }
    const template = STICKER_TEMPLATES.find(t => t.id === stickerTemplateId)!
    let cancelled = false
    renderSticker(template, sample).then(html => {
      if (!cancelled) setStickerPreviewDocHtml(stickerPreviewDoc(html, template))
    })
    return () => { cancelled = true }
  }, [stickerPickerOpen, stickerTemplateId, sample])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', height: '100%', fontFamily: 'Inter, sans-serif', backgroundColor: '#F8F9FB', overflow: 'hidden' }}>

      {/* ══ MAIN ══ */}
      <div style={{ overflowY: 'auto', padding: '20px 20px 28px 24px' }}>

        {/* Breadcrumb + actions */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
            <span style={{ cursor: 'pointer', color: '#0154FC' }}>Samples</span>
            {sample && <><MI name="chevron_right" size={14} color="#9CA3AF" />
              <span style={{ cursor: 'pointer', color: '#0154FC' }}>{sampleDisplayId(sample)}</span></>}
            <MI name="chevron_right" size={14} color="#9CA3AF" />
            <span style={{ color: '#374151' }}>Store Sample</span>
          </div>
          <div className="flex items-center gap-2" style={{ position: 'relative' }}>
            <button
              onClick={() => sample && setStickerPickerOpen(v => !v)}
              disabled={!sample}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg"
              style={{ border: '1px solid #E5E7EB', color: sample ? '#374151' : '#9CA3AF', backgroundColor: '#fff', cursor: sample ? 'pointer' : 'not-allowed', opacity: sample ? 1 : 0.5 }}>
              <MI name="print" size={14} color={sample ? '#374151' : '#9CA3AF'} /> Print Label
            </button>
            {stickerPickerOpen && sample && (
              <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 20, width: 280, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Print Sticker</div>
                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Template</label>
                <select
                  value={stickerTemplateId}
                  onChange={e => setStickerTemplateId(e.target.value)}
                  style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, marginBottom: 10 }}>
                  {STICKER_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Copies</label>
                <input
                  type="number" min={1} max={50} value={stickerCopies}
                  onChange={e => setStickerCopies(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, marginBottom: 10 }} />

                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Preview</label>
                {(() => {
                  const template = STICKER_TEMPLATES.find(t => t.id === stickerTemplateId)!
                  const wPx = template.widthMm * MM_TO_PX_PREVIEW
                  const hPx = template.heightMm * MM_TO_PX_PREVIEW
                  const scale = Math.min(PREVIEW_BOX_PX / wPx, (PREVIEW_BOX_PX * 0.7) / hPx, 1)
                  return (
                    <div style={{
                      width: '100%', height: PREVIEW_BOX_PX * 0.7, marginBottom: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 6, overflow: 'hidden',
                    }}>
                      {stickerPreviewDocHtml ? (
                        <iframe
                          key={stickerTemplateId}
                          title="Sticker preview"
                          srcDoc={stickerPreviewDocHtml}
                          style={{
                            width: wPx, height: hPx, border: 'none', background: '#fff',
                            transform: `scale(${scale})`,
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>Loading preview…</span>
                      )}
                    </div>
                  )
                })()}

                <button
                  onClick={async () => {
                    const template = STICKER_TEMPLATES.find(t => t.id === stickerTemplateId)!
                    await printSticker(sample, template, stickerCopies)
                    setStickerPickerOpen(false)
                  }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg"
                  style={{ backgroundColor: '#0154FC', color: '#fff', cursor: 'pointer' }}>
                  <MI name="print" size={14} color="#fff" /> Print
                </button>
              </div>
            )}
            <button ref={moreBtnRef} onClick={toggleMore}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg"
              style={{ border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              More Actions <MI name="keyboard_arrow_down" size={14} color="#6B7280" />
            </button>
            {morePos && (
              <>
                <div onClick={() => setMorePos(null)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
                <div style={{ position: 'fixed', top: morePos.top, right: morePos.right, zIndex: 9999, width: 200, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 4 }}>
                  {[
                    { label: 'Print Label', icon: 'print', disabled: !sample, run: () => setStickerPickerOpen(true) },
                    { label: 'View Full History', icon: 'history', disabled: !sample, run: () => setHistoryOpen(true) },
                    { label: 'Clear Sample', icon: 'close', disabled: !sample, run: () => { setResult(null); setSampleInput(''); setError(''); setPendingLabel(null) } },
                  ].map(item => (
                    <button key={item.label} disabled={item.disabled}
                      onClick={() => { setMorePos(null); item.run() }}
                      className="flex items-center gap-2 w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-gray-50"
                      style={{ background: 'none', border: 'none', color: item.disabled ? '#9CA3AF' : '#374151', cursor: item.disabled ? 'not-allowed' : 'pointer' }}>
                      <MI name={item.icon} size={14} color={item.disabled ? '#9CA3AF' : '#6B7280'} /> {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
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
                { label: 'Sample ID',        val: sampleDisplayId(sample),         isStatus: false, isBarcode: false },
                { label: 'Project / Client', val: sample.client,                   isStatus: false, isBarcode: false },
                { label: 'Sample Type',      val: sample.sample_type,              isStatus: false, isBarcode: false },
                { label: 'Barcode',          val: sample.barcode || sampleDisplayId(sample), isStatus: false, isBarcode: true },
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
                    {sample.barcode || sampleDisplayId(sample)}
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

        {/* Pending storage target */}
        {sample && pendingLabel && (
          <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 mb-4" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <MI name="add_location" size={16} color="#1D4ED8" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', margin: 0 }}>Storage target selected</p>
              <p style={{ fontSize: 11, color: '#374151', margin: 0 }}>
                {pendingLabel.path.join(' / ')}
                {pendingLabel.location_type !== 'slot' && pendingLabel.next_free_slot ? ` → Slot ${pendingLabel.next_free_slot.slot_id}` : ''}
                {' '}({pendingLabel.label_code})
              </p>
            </div>
            <button onClick={() => setPendingLabel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Clear target">
              <MI name="close" size={14} color="#6B7280" />
            </button>
          </div>
        )}

        {/* Action buttons */}
        {sample && (
          <div className="flex items-center gap-2">
            <button onClick={() => setScanOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              <MI name="qr_code_scanner" size={15} color="#374151" /> Scan Barcode
            </button>
            <button onClick={() => openAssign('assign')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              <MI name="add_location" size={15} color="#374151" /> Assign Storage
            </button>
            <button onClick={() => openAssign('transfer')} disabled={!loc}
              title={loc ? undefined : 'Sample is not currently in storage'}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ border: '1px solid #D1D5DB', color: loc ? '#374151' : '#9CA3AF', backgroundColor: '#fff', cursor: loc ? 'pointer' : 'not-allowed', opacity: loc ? 1 : 0.6 }}>
              <MI name="swap_horiz" size={15} color={loc ? '#374151' : '#9CA3AF'} /> Transfer Custody
            </button>
            <button onClick={handleConfirm} disabled={!pendingLabel || confirming}
              title={pendingLabel ? undefined : 'Scan or assign a storage location first'}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white ml-auto"
              style={{ backgroundColor: '#0154FC', cursor: !pendingLabel || confirming ? 'not-allowed' : 'pointer', border: 'none', opacity: !pendingLabel || confirming ? 0.5 : 1 }}>
              <MI name="check_circle" size={15} color="#fff" /> {confirming ? 'Storing…' : 'Confirm Storage'}
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
          <button onClick={() => setHistoryOpen(true)} disabled={events.length === 0}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-medium"
            style={{ border: '1px solid #E5E7EB', color: events.length ? '#374151' : '#9CA3AF', backgroundColor: '#fff', cursor: events.length ? 'pointer' : 'not-allowed', opacity: events.length ? 1 : 0.6 }}>
            <MI name="history" size={14} color="#6B7280" /> View Full History
          </button>
        </div>
      </div>

      {/* ── Assign / Transfer storage modal ── */}
      {assignOpen && sample && (
        <div onClick={e => { if (e.currentTarget === e.target) setAssignOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(17,24,39,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="bg-white rounded-2xl" style={{ width: 420, maxWidth: '92vw', padding: 20 }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                {assignMode === 'transfer' ? 'Transfer Custody' : 'Assign Storage'}
              </span>
              <button onClick={() => setAssignOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <MI name="close" size={16} color="#6B7280" />
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 14px' }}>
              {assignMode === 'transfer'
                ? `Enter the label code of the new location for ${sampleDisplayId(sample)}. Confirming will move the sample out of its current slot.`
                : `Enter a storage label code (box, rack or slot) for ${sampleDisplayId(sample)}.`}
            </p>
            <div className="flex gap-2">
              <input autoFocus value={labelInput}
                onChange={e => { setLabelInput(e.target.value); setResolveErr('') }}
                onKeyDown={e => e.key === 'Enter' && handleResolve()}
                placeholder="e.g. BOX-A-01 or SLOT-A-01-05"
                className="flex-1 outline-none text-sm px-3 py-2.5 rounded-xl"
                style={{ border: `1px solid ${resolveErr ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }} />
              <button onClick={handleResolve} disabled={!labelInput.trim() || resolving}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: '#0154FC', border: 'none', cursor: !labelInput.trim() || resolving ? 'not-allowed' : 'pointer', opacity: !labelInput.trim() || resolving ? 0.6 : 1 }}>
                {resolving ? 'Checking…' : 'Select'}
              </button>
            </div>
            {resolveErr && <p className="text-xs mt-2" style={{ color: '#EF4444' }}>{resolveErr}</p>}
            <button onClick={() => { setAssignOpen(false); setScanOpen(true) }}
              className="flex items-center gap-1.5 text-xs mt-3"
              style={{ color: '#0154FC', background: 'none', border: 'none', cursor: 'pointer' }}>
              <MI name="qr_code_scanner" size={14} color="#0154FC" /> Scan a location label instead
            </button>
          </div>
        </div>
      )}

      {/* ── Camera scan for storage location ── */}
      {scanOpen && (
        <QrScanModal
          title="Scan Storage Label"
          hint="Point the camera at the storage box / slot label."
          onClose={() => setScanOpen(false)}
          onDecode={handleScanDecode}
        />
      )}

      {/* ── Full history modal ── */}
      {historyOpen && (
        <div onClick={e => { if (e.currentTarget === e.target) setHistoryOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(17,24,39,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="bg-white rounded-2xl flex flex-col" style={{ width: 560, maxWidth: '94vw', maxHeight: '84vh', overflow: 'hidden' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
              <div className="flex items-center gap-2">
                <MI name="history" size={16} color="#0154FC" />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                  Full Custody History{sample ? ` — ${sampleDisplayId(sample)}` : ''}
                </span>
              </div>
              <button onClick={() => setHistoryOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <MI name="close" size={18} color="#6B7280" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto" style={{ padding: '16px 20px' }}>
              {events.map(ev => {
                const meta = eventMeta(ev)
                const rows = eventRows(ev, sample)
                const changes = (ev.details?.changes as Array<{ field: string; old: string | null; new: string | null }>) ?? []
                return (
                  <div key={ev.id} className="flex gap-3 mb-4">
                    <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: meta.color + '1A', border: `2px solid ${meta.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <MI name={meta.icon} size={13} color={meta.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-start justify-between gap-2">
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{meta.label}</span>
                        <span style={{ fontSize: 10, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{fmtDateShort(ev.timestamp)} • {fmtTime(ev.timestamp)}</span>
                      </div>
                      {rows.map(row => (
                        <div key={row.key} style={{ display: 'flex', gap: 8 }}>
                          <span style={{ fontSize: 10, color: '#9CA3AF', minWidth: 64 }}>{row.key}</span>
                          <span style={{ fontSize: 10, fontWeight: 500, color: '#111827', wordBreak: 'break-word' }}>{row.value}</span>
                        </div>
                      ))}
                      {changes.map((c, ci) => (
                        <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6B7280' }}>
                          <span style={{ color: '#9CA3AF', minWidth: 64 }}>{c.field.replace(/_/g, ' ')}</span>
                          <span style={{ color: '#EF4444' }}>{c.old || '—'}</span>
                          <MI name="arrow_forward" size={10} color="#9CA3AF" />
                          <span style={{ color: '#22C55E' }}>{c.new || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, backgroundColor: toast.ok ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${toast.ok ? '#BBF7D0' : '#FECACA'}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={16} color={toast.ok ? '#16A34A' : '#DC2626'} />
          <span style={{ fontSize: 12, fontWeight: 500, color: toast.ok ? '#166534' : '#991B1B' }}>{toast.msg}</span>
        </div>
      )}
    </div>
  )
}

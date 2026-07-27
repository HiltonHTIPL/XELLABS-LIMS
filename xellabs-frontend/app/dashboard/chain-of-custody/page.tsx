'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  lookupChainOfCustody, resolveStorageLabel, assignSampleByLabel,
  type ChainOfCustodyResult, type ResolvedLabel,
} from '@/app/actions/storage'
import { logCustodyEvent, signCustodyEvent, type CustodyAction, type CustodyCondition, type SealStatus } from '@/app/actions/chain-of-custody'
import { getStaffUsers, type StaffUser } from '@/app/actions/users'
import { STICKER_TEMPLATES, renderSticker, stickerPageCss, printSticker, type StickerTemplate } from '@/app/lib/stickerTemplates'
import QrScanModal from '@/app/dashboard/_components/QrScanModal'
import { sampleDisplayId } from '@/app/lib/sampleDisplay'
import { MI, CustodyTimelineList, FullHistoryModal, eventMeta, fmtDateShort, fmtTime } from './_components/CustodyTimeline'

const CUSTODY_ACTIONS: { value: CustodyAction; label: string }[] = [
  { value: 'collected', label: 'Collected' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'received', label: 'Received' },
  { value: 'analysed', label: 'Released for Analysis' },
  { value: 'retrieved', label: 'Retrieved from Storage' },
  { value: 'stored', label: 'Returned to Storage' },
  { value: 'completed', label: 'Sample Completed' },
]

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
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
    disposed:        { bg: '#F3F4F6', color: '#374151', label: 'Disposed' },
  }
  return map[status] ?? { bg: '#F3F4F6', color: '#374151', label: status }
}

export default function ChainOfCustodyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo')
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

  // Log Custody Event modal — the actual write-side for a manual handoff
  // (collector -> courier -> accessioner -> analyst -> storage), separate
  // from "Transfer Custody" above which only moves a storage slot.
  const [custodyOpen, setCustodyOpen] = useState(false)
  const [custodySaving, setCustodySaving] = useState(false)
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([])
  const [custodyForm, setCustodyForm] = useState({
    action: 'transferred' as CustodyAction,
    fromLocation: '', toLocation: '', receivedById: '',
    temperatureC: '', condition: '' as CustodyCondition | '', sealStatus: '' as SealStatus | '',
    purpose: '', notes: '', password: '',
  })
  const [custodyErrors, setCustodyErrors] = useState<Record<string, string>>({})
  function resetCustodyForm() {
    setCustodyForm({ action: 'transferred', fromLocation: '', toLocation: '', receivedById: '', temperatureC: '', condition: '', sealStatus: '', purpose: '', notes: '', password: '' })
    setCustodyErrors({})
  }
  async function openCustodyModal() {
    setCustodyOpen(true)
    if (staffUsers.length === 0) setStaffUsers(await getStaffUsers())
  }
  // Any handoff that plausibly opens the sample container (received into the
  // lab, released for lab prep/analysis) must have its seal condition
  // recorded — this is what makes "any breaking of this seal must be
  // rigorously logged" an enforced requirement rather than an optional field
  // nobody fills in.
  const SEAL_REQUIRED_ACTIONS: CustodyAction[] = ['received', 'analysed']
  async function submitCustodyEvent() {
    if (!sample || custodySaving) return
    const errors: Record<string, string> = {}
    if (SEAL_REQUIRED_ACTIONS.includes(custodyForm.action) && !custodyForm.sealStatus) {
      errors.sealStatus = 'Seal status must be recorded for this action.'
    }
    if (!custodyForm.password) {
      errors.password = 'Your password is required to sign this custody event.'
    }
    if (Object.keys(errors).length) { setCustodyErrors(errors); return }

    setCustodySaving(true)
    const res = await logCustodyEvent({
      sampleId: sample.sample_id,
      action: custodyForm.action,
      fromLocation: custodyForm.fromLocation || undefined,
      toLocation: custodyForm.toLocation || undefined,
      receivedById: custodyForm.receivedById ? Number(custodyForm.receivedById) : undefined,
      temperatureC: custodyForm.temperatureC || undefined,
      condition: custodyForm.condition || undefined,
      sealStatus: custodyForm.sealStatus || undefined,
      purpose: custodyForm.purpose || undefined,
      notes: custodyForm.notes || undefined,
    })
    if (!res.success || !res.id) {
      setCustodySaving(false)
      showToast(false, res.message ?? 'Failed to log custody event.')
      return
    }
    // Sign the just-created record — a failed signature (wrong password)
    // leaves the custody row logged but unsigned, matching Approvals' own
    // "decision applied, e-signature attempt separate" precedent, and telling
    // the user exactly what went wrong rather than silently dropping it.
    const actionLabel = CUSTODY_ACTIONS.find(a => a.value === custodyForm.action)?.label ?? custodyForm.action
    const sig = await signCustodyEvent(
      res.id, custodyForm.purpose || `${actionLabel} — ${sampleDisplayId(sample)}`, custodyForm.password,
    )
    setCustodySaving(false)
    if (!sig.success) {
      setCustodyErrors({ password: sig.message ?? 'Incorrect password — the event was logged but not signed.' })
      return
    }
    showToast(true, 'Custody event logged and signed.')
    setCustodyOpen(false)
    resetCustodyForm()
    await handleLookup(sample.sample_id)
  }

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

  // Arriving from a sample's own detail page (e.g. its "Chain of Custody"
  // button) passes ?sample=<id> — auto-run the same lookup instead of making
  // the user retype/rescan an id they just navigated away from.
  useEffect(() => {
    const sid = searchParams.get('sample')
    if (sid) handleLookup(sid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    if (!stickerPickerOpen || !sample) {
      // Clear the preview immediately when there's nothing to render, rather
      // than leaving stale HTML on screen until the next async render below.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStickerPreviewDocHtml('')
      return
    }
    const template = STICKER_TEMPLATES.find(t => t.id === stickerTemplateId)!
    let cancelled = false
    renderSticker(template, sample).then(html => {
      if (!cancelled) setStickerPreviewDocHtml(stickerPreviewDoc(html, template))
    })
    return () => { cancelled = true }
  }, [stickerPickerOpen, stickerTemplateId, sample])

  // Formal COC document — the printable record meant to physically travel
  // with the sample: Sample ID, source location, collection date/time,
  // collector's name, required analyses, and every logged handoff with who
  // performed it and when, so a reviewer can see the unbroken chain at a
  // glance without opening the app.
  function handlePrintCocDocument() {
    if (!sample) return
    const rows = events.map(ev => {
      const meta = eventMeta(ev)
      return `<tr>
        <td>${fmtDateShort(ev.timestamp)} ${fmtTime(ev.timestamp)}</td>
        <td>${meta.label}</td>
        <td>${ev.user || '—'}</td>
        <td>${(ev.details?.from_location as string) || (ev.details?.to_location as string) || '—'}</td>
      </tr>`
    }).join('')
    const analysesHtml = sample.required_analyses.length
      ? sample.required_analyses.map(a => `<li>${a}</li>`).join('')
      : '<li style="color:#666">None on file</li>'
    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) { showToast(false, 'Pop-up blocked — allow pop-ups to print the COC document.'); return }
    w.document.write(`<!doctype html><html><head><title>Chain of Custody — ${sampleDisplayId(sample)}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:32px;color:#111;font-size:13px}
        h1{font-size:18px;margin:0 0 4px}
        .sub{color:#555;margin:0 0 20px;font-size:12px}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:12px}
        th{background:#f3f4f6}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin-bottom:16px}
        .grid div span.k{color:#555;display:block;font-size:11px}
        .grid div span.v{font-weight:700}
        .sig{margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:24px}
        .sig div{border-top:1px solid #333;padding-top:4px;font-size:11px;color:#555}
        @media print{ .noprint{display:none} }
      </style>
      </head><body>
      <h1>Chain of Custody Record</h1>
      <p class="sub">Formal custody document — must accompany the physical sample at all times.</p>
      <div class="grid">
        <div><span class="k">Sample ID</span><span class="v">${sampleDisplayId(sample)}</span></div>
        <div><span class="k">Barcode</span><span class="v">${sample.barcode || sampleDisplayId(sample)}</span></div>
        <div><span class="k">Source Location</span><span class="v">${sample.sample_point || '—'}</span></div>
        <div><span class="k">Client / Project</span><span class="v">${sample.client || '—'}</span></div>
        <div><span class="k">Date &amp; Time of Collection</span><span class="v">${sample.collection_date ? fmtDateShort(sample.collection_date) + ' ' + fmtTime(sample.collection_date) : '—'}</span></div>
        <div><span class="k">Collector's Name</span><span class="v">${sample.collector || '—'}</span></div>
      </div>
      <p style="font-size:12px;font-weight:700;margin-bottom:4px">Required Analyses</p>
      <ul style="margin:0 0 16px 20px;font-size:12px">${analysesHtml}</ul>
      <p style="font-size:12px;font-weight:700;margin-bottom:4px">Custody Log — Every Individual Who Assumed Possession</p>
      <table><thead><tr><th>Date / Time</th><th>Action</th><th>By</th><th>Location</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#888">No custody events recorded yet.</td></tr>'}</tbody></table>
      <div class="sig">
        <div>Released by (signature / date)</div>
        <div>Received by (signature / date)</div>
      </div>
      <p style="margin-top:24px;font-size:10px;color:#888">Generated ${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })} UTC — entries marked "Sign &amp; Log Event" in the system carry a password-verified electronic signature on file.</p>
      <button class="noprint" onclick="window.print()" style="margin-top:16px;padding:8px 16px;cursor:pointer">Print</button>
      </body></html>`)
    w.document.close()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', height: '100%', fontFamily: 'Inter, sans-serif', backgroundColor: '#F8F9FB', overflow: 'hidden' }}>

      {/* ══ MAIN ══ */}
      <div style={{ overflowY: 'auto', padding: '20px 20px 28px 24px' }}>

        {/* Breadcrumb + actions */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#374151' }}>
            {returnTo ? (
              <button onClick={() => router.push(decodeURIComponent(returnTo))}
                className="p-1 rounded-lg hover:bg-gray-100 shrink-0 mr-0.5" style={{ border: '1px solid #E8EAF2', background: 'none', cursor: 'pointer' }}
                title="Back">
                <MI name="arrow_back" size={14} color="#374151" />
              </button>
            ) : (
              <Link href="/dashboard/admin" className="p-1 rounded-lg hover:bg-gray-100 shrink-0 mr-0.5" style={{ border: '1px solid #E8EAF2' }}>
                <MI name="arrow_back" size={14} color="#374151" />
              </Link>
            )}
            <span style={{ cursor: 'pointer', color: '#0154FC' }}>Samples</span>
            {sample && <><MI name="chevron_right" size={14} color="#374151" />
              <span style={{ cursor: 'pointer', color: '#0154FC' }}>{sampleDisplayId(sample)}</span></>}
            <MI name="chevron_right" size={14} color="#374151" />
            <span style={{ color: '#374151' }}>Store Sample</span>
          </div>
          <div className="flex items-center gap-2" style={{ position: 'relative' }}>
            <button
              onClick={() => sample && setStickerPickerOpen(v => !v)}
              disabled={!sample}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg"
              style={{ border: '1px solid #E5E7EB', color: sample ? '#374151' : '#374151', backgroundColor: '#fff', cursor: sample ? 'pointer' : 'not-allowed', opacity: sample ? 1 : 0.5 }}>
              <MI name="print" size={14} color={sample ? '#374151' : '#374151'} /> Print Label
            </button>
            {stickerPickerOpen && sample && (
              <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 20, width: 280, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Print Sticker</div>
                <label style={{ fontSize: 11, color: '#374151', display: 'block', marginBottom: 4 }}>Template</label>
                <select
                  value={stickerTemplateId}
                  onChange={e => setStickerTemplateId(e.target.value)}
                  style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, marginBottom: 10 }}>
                  {STICKER_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <label style={{ fontSize: 11, color: '#374151', display: 'block', marginBottom: 4 }}>Copies</label>
                <input
                  type="number" min={1} max={50} value={stickerCopies}
                  onChange={e => setStickerCopies(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, marginBottom: 10 }} />

                <label style={{ fontSize: 11, color: '#374151', display: 'block', marginBottom: 4 }}>Preview</label>
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
                        <span style={{ fontSize: 11, color: '#374151' }}>Loading preview…</span>
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
              More Actions <MI name="keyboard_arrow_down" size={14} color="#374151" />
            </button>
            {morePos && (
              <>
                <div onClick={() => setMorePos(null)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
                <div style={{ position: 'fixed', top: morePos.top, right: morePos.right, zIndex: 9999, width: 200, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 4 }}>
                  {[
                    { label: 'Print Label', icon: 'print', disabled: !sample, run: () => setStickerPickerOpen(true) },
                    { label: 'Print COC Document', icon: 'description', disabled: !sample, run: () => handlePrintCocDocument() },
                    { label: 'Log Custody Event', icon: 'swap_horiz', disabled: !sample, run: () => openCustodyModal() },
                    { label: 'View Full History', icon: 'history', disabled: !sample, run: () => setHistoryOpen(true) },
                    { label: 'Clear Sample', icon: 'close', disabled: !sample, run: () => { setResult(null); setSampleInput(''); setError(''); setPendingLabel(null) } },
                  ].map(item => (
                    <button key={item.label} disabled={item.disabled}
                      onClick={() => { setMorePos(null); item.run() }}
                      className="flex items-center gap-2 w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-gray-50"
                      style={{ background: 'none', border: 'none', color: item.disabled ? '#374151' : '#374151', cursor: item.disabled ? 'not-allowed' : 'pointer' }}>
                      <MI name={item.icon} size={14} color={item.disabled ? '#374151' : '#374151'} /> {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '2px 0 4px' }}>Store Sample</h1>
        <p style={{ fontSize: 12, color: '#374151', margin: '0 0 20px' }}>Store the sample in designated storage and update chain of custody.</p>

        {/* ── Sample lookup bar ── */}
        {!sample && (
          <div className="bg-white rounded-2xl mb-4 p-4" style={{ border: '1px solid #E5E7EB' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Enter Sample ID or Scan Barcode</p>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 flex-1 rounded-xl px-3 py-2.5"
                style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, backgroundColor: '#FAFAFA' }}>
                <MI name="qr_code_scanner" size={16} color="#374151" />
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
                className="ml-auto flex items-center gap-1 text-xs" style={{ color: '#374151', background: 'none', border: 'none', cursor: 'pointer' }}>
                <MI name="close" size={13} color="#374151" /> Clear
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
                  <p style={{ fontSize: 10, color: '#374151', marginBottom: 3 }}>{f.label}</p>
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
            {/* Formal-COC fields: collection date/time, collector, and source
                (collection point) location — required per the Chain of
                Custody compliance spec ("record the sample ID, source
                location, date and time of collection, collector's name"). */}
            <div className="mt-3 pt-3 flex flex-wrap gap-x-8 gap-y-1" style={{ borderTop: '1px solid #F3F4F6' }}>
              {sample.collection_date && <><span style={{ fontSize: 10, color: '#374151' }}>Collected</span><span style={{ fontSize: 10, fontWeight: 500, color: '#374151' }}>{fmtDate(sample.collection_date)}</span></>}
              {sample.collector       && <><span style={{ fontSize: 10, color: '#374151', marginLeft: 16 }}>Collector</span><span style={{ fontSize: 10, fontWeight: 500, color: '#374151' }}>{sample.collector}</span></>}
              {sample.sample_point    && <><span style={{ fontSize: 10, color: '#374151', marginLeft: 16 }}>Source Location</span><span style={{ fontSize: 10, fontWeight: 500, color: '#374151' }}>{sample.sample_point}</span></>}
            </div>
            <div className="mt-1.5 pt-1.5 flex flex-wrap gap-x-8 gap-y-1">
              {sample.received_date && <><span style={{ fontSize: 10, color: '#374151' }}>Received</span><span style={{ fontSize: 10, fontWeight: 500, color: '#374151' }}>{fmtDate(sample.received_date)}</span></>}
              {sample.received_by  && <><span style={{ fontSize: 10, color: '#374151', marginLeft: 16 }}>Received by</span><span style={{ fontSize: 10, fontWeight: 500, color: '#374151' }}>{sample.received_by}</span></>}
              {sample.condition    && <><span style={{ fontSize: 10, color: '#374151', marginLeft: 16 }}>Condition</span><span style={{ fontSize: 10, fontWeight: 500, color: '#374151' }}>{sample.condition}</span></>}
              {sample.priority     && <><span style={{ fontSize: 10, color: '#374151', marginLeft: 16 }}>Priority</span><span style={{ fontSize: 10, fontWeight: 500, color: '#374151' }}>{sample.priority}</span></>}
              {sample.batch_id     && <><span style={{ fontSize: 10, color: '#374151', marginLeft: 16 }}>Batch</span><span style={{ fontSize: 10, fontWeight: 500, color: '#374151' }}>{sample.batch_id}{sample.batch_sub_group ? ` (${sample.batch_sub_group})` : ''}</span></>}
              {sample.hold_for_qa  && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, backgroundColor: '#FEF3C7', color: '#92400E', marginLeft: 16 }}>QA Hold</span>}
            </div>
            {sample.required_analyses.length > 0 && (
              <div className="mt-2 pt-2 flex flex-wrap items-center gap-1.5" style={{ borderTop: '1px solid #F3F4F6' }}>
                <span style={{ fontSize: 10, color: '#374151', marginRight: 4 }}>Required Analyses</span>
                {sample.required_analyses.map(name => (
                  <span key={name} style={{ fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 999, backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>{name}</span>
                ))}
              </div>
            )}
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
                  <MI name="view_week" size={22} color="#374151" />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 3 }}>Barcode Scan</p>
                  <p style={{ fontSize: 11, color: '#374151', margin: '0 0 2px' }}>Scan the storage container barcode</p>
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
                    ? <p style={{ fontSize: 11, color: '#374151', margin: 0 }}>{loc.storage_path.split(' / ').slice(-2).join(' / ')} • Slot {loc.slot_id}</p>
                    : <p style={{ fontSize: 11, color: '#374151', margin: 0 }}>Not currently in storage</p>}
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
                <MI name="inventory_2" size={15} color="#374151" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Selected Storage</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, alignItems: 'start' }}>
              {/* Location */}
              <div>
                <p style={{ fontSize: 10, color: '#374151', marginBottom: 4 }}>Location</p>
                <p style={{ fontSize: 11, color: '#0154FC', marginBottom: 2 }}>
                  {loc.storage_path.split(' / ').slice(0, -2).join(' > ') || '—'}
                </p>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>
                  {loc.storage_path.split(' / ').slice(-2, -1)[0] ?? loc.slot_name}
                </p>
              </div>
              {/* Container / Slot */}
              <div>
                <p style={{ fontSize: 10, color: '#374151', marginBottom: 4 }}>Container / Slot</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 5 }}>{loc.slot_name}</p>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 12px', borderRadius: 999, backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                  Slot {loc.slot_id}
                </span>
              </div>
              {/* Temperature */}
              {loc.temperature ? (
                <div>
                  <p style={{ fontSize: 10, color: '#374151', marginBottom: 4 }}>Temperature</p>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 14px', borderRadius: 999, backgroundColor: '#CCFBF1', color: '#0F766E' }}>
                    {loc.temperature}
                  </span>
                </div>
              ) : <div />}
              {/* Capacity: occupied vs free */}
              <div>
                <p style={{ fontSize: 10, color: '#374151', marginBottom: 4 }}>Capacity</p>
                {cap ? (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                      {cap.occupied} / {cap.total}
                      <span style={{ fontSize: 10, fontWeight: 400, color: '#374151', marginLeft: 4 }}>
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
                        <span style={{ fontSize: 9, color: '#374151' }}>{cap.occupied} occupied</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: '#22C55E' }} />
                        <span style={{ fontSize: 9, color: '#374151' }}>{cap.free} free</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: '#374151' }}>—</span>
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
                <MI name="edit_note" size={15} color="#374151" />
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
                  Storage Notes <span style={{ fontWeight: 400, color: '#374151' }}>(optional)</span>
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
              <MI name="close" size={14} color="#374151" />
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
              style={{ border: '1px solid #D1D5DB', color: loc ? '#374151' : '#374151', backgroundColor: '#fff', cursor: loc ? 'pointer' : 'not-allowed', opacity: loc ? 1 : 0.6 }}>
              <MI name="swap_horiz" size={15} color={loc ? '#374151' : '#374151'} /> Transfer Custody
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
            <MI name="info_outline" size={14} color="#374151" />
          </div>
          {loc && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 999, backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
              Current Custody
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto" style={{ padding: '16px 16px 8px' }}>
          {events.length === 0 && !result ? (
            <div className="flex flex-col items-center justify-center h-full py-10">
              <MI name="history" size={30} color="#D1D5DB" />
              <p className="mt-3 text-xs text-center" style={{ color: '#9CA3AF', lineHeight: 1.6, maxWidth: 160 }}>
                {result ? 'No custody events recorded yet.' : 'Scan a sample barcode to view the full custody trail.'}
              </p>
            </div>
          ) : (
            <CustodyTimelineList events={events} sample={sample} />
          )}
        </div>

        <div className="px-4 py-3" style={{ borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
          <button onClick={() => setHistoryOpen(true)} disabled={events.length === 0}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-medium"
            style={{ border: '1px solid #E5E7EB', color: events.length ? '#374151' : '#374151', backgroundColor: '#fff', cursor: events.length ? 'pointer' : 'not-allowed', opacity: events.length ? 1 : 0.6 }}>
            <MI name="history" size={14} color="#374151" /> View Full History
          </button>
        </div>
      </div>

      {/* ── Assign / Transfer storage modal ── */}
      {assignOpen && sample && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
          <div onClick={() => setAssignOpen(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(17,24,39,0.55)' }} />
          <div className="bg-white" style={{ position: 'absolute', top: 'var(--dashboard-header-h)', right: 0, bottom: 'var(--dashboard-footer-h)', width: 420, maxWidth: '92vw', padding: 20, boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                {assignMode === 'transfer' ? 'Transfer Custody' : 'Assign Storage'}
              </span>
              <button onClick={() => setAssignOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <MI name="close" size={16} color="#374151" />
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#374151', margin: '0 0 14px' }}>
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

      {/* ── Log Custody Event modal ── */}
      {custodyOpen && sample && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
          <div onClick={() => setCustodyOpen(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(17,24,39,0.55)' }} />
          <div className="bg-white" style={{ position: 'absolute', top: 'var(--dashboard-header-h)', right: 0, bottom: 'var(--dashboard-footer-h)', width: 440, maxWidth: '92vw', padding: 20, boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Log Custody Event</span>
              <button onClick={() => setCustodyOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <MI name="close" size={16} color="#374151" />
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#374151', margin: '0 0 14px' }}>
              Record a handoff for {sampleDisplayId(sample)} — who released it, who received it, where it moved, and its condition.
            </p>

            <div className="space-y-3">
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Action</label>
                <select value={custodyForm.action} onChange={e => setCustodyForm(p => ({ ...p, action: e.target.value as CustodyAction }))}
                  className="w-full outline-none text-sm px-3 py-2 rounded-lg" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                  {CUSTODY_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>From</label>
                  <input value={custodyForm.fromLocation} onChange={e => setCustodyForm(p => ({ ...p, fromLocation: e.target.value }))}
                    placeholder="e.g. Field site, Receiving"
                    className="w-full outline-none text-sm px-3 py-2 rounded-lg" style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>To</label>
                  <input value={custodyForm.toLocation} onChange={e => setCustodyForm(p => ({ ...p, toLocation: e.target.value }))}
                    placeholder="e.g. FZ-02/R3/B12"
                    className="w-full outline-none text-sm px-3 py-2 rounded-lg" style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Received By</label>
                <select value={custodyForm.receivedById} onChange={e => setCustodyForm(p => ({ ...p, receivedById: e.target.value }))}
                  className="w-full outline-none text-sm px-3 py-2 rounded-lg" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                  <option value="">— Not specified —</option>
                  {staffUsers.map(u => <option key={u.id} value={u.id}>{u.full_name || u.username}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Purpose</label>
                <input value={custodyForm.purpose} onChange={e => setCustodyForm(p => ({ ...p, purpose: e.target.value }))}
                  placeholder="e.g. Released for testing, Courier transfer"
                  className="w-full outline-none text-sm px-3 py-2 rounded-lg" style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Condition</label>
                  <select value={custodyForm.condition} onChange={e => setCustodyForm(p => ({ ...p, condition: e.target.value as CustodyCondition | '' }))}
                    className="w-full outline-none text-sm px-3 py-2 rounded-lg" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                    <option value="">— Not specified —</option>
                    <option value="intact">Intact</option>
                    <option value="damaged">Damaged</option>
                    <option value="compromised">Compromised</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Seal Status
                    {SEAL_REQUIRED_ACTIONS.includes(custodyForm.action) && <span style={{ color: '#EF4444' }}> *</span>}
                  </label>
                  <select value={custodyForm.sealStatus}
                    onChange={e => { setCustodyForm(p => ({ ...p, sealStatus: e.target.value as SealStatus | '' })); setCustodyErrors(p => { const n = { ...p }; delete n.sealStatus; return n }) }}
                    className="w-full outline-none text-sm px-3 py-2 rounded-lg"
                    style={{ border: `1px solid ${custodyErrors.sealStatus ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}>
                    <option value="">— Not specified —</option>
                    <option value="intact">Seal Intact</option>
                    <option value="broken">Seal Broken</option>
                    <option value="not_sealed">Not Sealed</option>
                  </select>
                  {custodyErrors.sealStatus && <p className="mt-1" style={{ fontSize: 10, color: '#EF4444' }}>{custodyErrors.sealStatus}</p>}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Temperature (°C) <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input value={custodyForm.temperatureC} onChange={e => setCustodyForm(p => ({ ...p, temperatureC: e.target.value }))}
                  placeholder="e.g. 4.2"
                  className="w-full outline-none text-sm px-3 py-2 rounded-lg" style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Notes <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <textarea rows={2} value={custodyForm.notes} onChange={e => setCustodyForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full outline-none text-sm px-3 py-2 rounded-lg resize-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
              </div>

              <div className="pt-2" style={{ borderTop: '1px solid #F3F4F6' }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  Sign to confirm you are assuming/releasing custody <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input type="password" value={custodyForm.password}
                  onChange={e => { setCustodyForm(p => ({ ...p, password: e.target.value })); setCustodyErrors(p => { const n = { ...p }; delete n.password; return n }) }}
                  placeholder="Enter your account password to sign"
                  className="w-full outline-none text-sm px-3 py-2 rounded-lg"
                  style={{ border: `1px solid ${custodyErrors.password ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }} />
                {custodyErrors.password
                  ? <p className="mt-1" style={{ fontSize: 10, color: '#EF4444' }}>{custodyErrors.password}</p>
                  : <p className="mt-1" style={{ fontSize: 10, color: '#374151' }}>This creates a permanent, timestamped electronic signature attesting you took custody of this sample.</p>}
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setCustodyOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={submitCustodyEvent} disabled={custodySaving}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: '#0154FC', border: 'none', cursor: custodySaving ? 'not-allowed' : 'pointer', opacity: custodySaving ? 0.6 : 1 }}>
                {custodySaving ? 'Signing…' : 'Sign & Log Event'}
              </button>
            </div>
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
        <FullHistoryModal
          events={events}
          sample={sample}
          sampleLabel={sample ? sampleDisplayId(sample) : undefined}
          onClose={() => setHistoryOpen(false)}
        />
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

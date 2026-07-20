'use client'
import { useState, useMemo, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  transitionWorksheet, submitWorksheetResult, verifyWorksheetAnalysis,
  addAnalysesToWorksheet, removeAnalysesFromWorksheet, addDuplicateToWorksheet,
  addReferenceToWorksheet, updateWorksheetFields,
  type WorksheetInfo, type UnassignedAnalysis, type ReferenceSampleOption, type LabAnalyst,
} from '@/app/actions/senaite-worksheets'
import type { RefOption } from '@/app/dashboard/_components/AdminRefShell'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const STATE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  open:           { bg: '#DBEAFE', color: '#1E40AF', label: 'Open' },
  to_be_verified: { bg: '#FEF3C7', color: '#92400E', label: 'To be verified' },
  verified:       { bg: '#DCFCE7', color: '#166534', label: 'Verified' },
  rejected:       { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
}
const TYPE_LABEL: Record<string, string> = { a: 'Analysis', b: 'Blank', c: 'Control', d: 'Duplicate' }
const TYPE_COLOR: Record<string, string> = { a: '#0154FC', b: '#7C3AED', c: '#059669', d: '#D97706' }

const TRANSITIONS: Record<string, { id: string; label: string; icon: string; kind: 'primary' | 'danger' | 'neutral' }[]> = {
  to_be_verified: [
    { id: 'verify', label: 'Verify', icon: 'verified', kind: 'primary' },
    { id: 'retract', label: 'Retract', icon: 'undo', kind: 'neutral' },
    { id: 'reject', label: 'Reject', icon: 'block', kind: 'danger' },
  ],
  verified: [{ id: 'retract', label: 'Retract', icon: 'undo', kind: 'neutral' }],
}

// RemarksField stores an audit-formatted string ("=== <ts> (<user>)\n<p>text</p>").
// Show the human text of the most recent entry only.
function latestRemark(raw: string): string {
  if (!raw) return ''
  const parts = raw.split('===').map(p => p.trim()).filter(Boolean)
  const last = parts[parts.length - 1] ?? raw
  return last.replace(/^[\d:TZ+\-.\s]*\([^)]*\)/, '').replace(/<[^>]+>/g, '').trim()
}

export default function WorksheetDetailShell({
  worksheet, unassigned, instruments, methods, references, analysts,
}: {
  worksheet: WorksheetInfo
  unassigned: UnassignedAnalysis[]
  instruments: RefOption[]
  methods: RefOption[]
  references: ReferenceSampleOption[]
  analysts: LabAnalyst[]
}) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  const isOpen = worksheet.reviewState === 'open'
  const badge = STATE_BADGE[worksheet.reviewState] ?? { bg: '#F3F4F6', color: '#6B7280', label: worksheet.reviewState || '—' }
  const actions = TRANSITIONS[worksheet.reviewState] ?? []
  const slots = useMemo(() => [...worksheet.slots].sort((a, b) => a.position - b.position), [worksheet.slots])
  const routinePositions = useMemo(
    () => Array.from(new Set(slots.filter(s => s.type === 'a' && s.analysis).map(s => s.position))).sort((a, b) => a - b),
    [slots],
  )

  const [results, setResults] = useState<Record<string, string>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [analyst, setAnalyst] = useState(worksheet.analyst)
  // Show the member's full name where we can resolve it; fall back to the raw
  // stored value (a member id or a legacy free-text analyst).
  const analystLabel = analysts.find(a => a.id === worksheet.analyst)?.fullname || worksheet.analyst
  const hasEditable = useMemo(() => worksheet.slots.some(s => s.analysis?.reviewState === 'assigned'), [worksheet.slots])
  const [instrumentUid, setInstrumentUid] = useState(worksheet.instrumentUid)
  const [methodUid, setMethodUid] = useState(worksheet.methodUid)
  const [remarks, setRemarks] = useState(latestRemark(worksheet.remarks))
  const [dupSlot, setDupSlot] = useState('')
  const [refUid, setRefUid] = useState('')

  function addReference() {
    const ref = references.find(r => r.uid === refUid)
    if (!ref) return
    run(
      () => addReferenceToWorksheet(worksheet.path, worksheet.id, ref.uid, ref.serviceUids),
      `${ref.blank ? 'Blank' : 'Control'} QC added.`,
    )
    setRefUid('')
  }

  function setResult(uid: string, v: string) { setResults(p => ({ ...p, [uid]: v })) }

  function run(fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const r = await fn()
      if (r.success) { setToast({ ok: true, msg: okMsg }); router.refresh() }
      else { setToast({ ok: false, msg: r.error ?? 'Action failed.' }) }
      setTimeout(() => setToast(null), 5000)
    })
  }

  const pickedUids = Object.keys(picked).filter(u => picked[u])

  function saveDetails() {
    // Send all four fields, including empty instrument/method — the
    // @@update-worksheet view now clears the field cleanly when the value is
    // empty (setInstrument("") used to crash in api.get_object, so clearing was
    // previously skipped; the view now sets the field to None directly).
    run(
      () => updateWorksheetFields(worksheet.path, worksheet.id, {
        analyst, remarks, instrument: instrumentUid, method: methodUid,
      }),
      'Worksheet updated.',
    )
  }

  function addSelected() {
    run(() => addAnalysesToWorksheet(worksheet.path, worksheet.id, pickedUids), 'Analyses added.')
    setPicked({}); setShowAdd(false)
  }

  const importRef = useRef<HTMLInputElement>(null)

  // Parse one CSV line into fields, honouring simple double-quote quoting.
  function parseCsvLine(line: string): string[] {
    const out: string[] = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQ) {
        if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false }
        else cur += ch
      } else if (ch === '"') inQ = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out
  }

  // Import an instrument/results CSV and pre-fill the editable result inputs.
  // Accepts the file this page's "Export CSV" produces (Position + Result
  // columns) — fill in the Result column, re-import, review, then Submit.
  // Matches rows to worksheet positions; only staged onto `assigned` rows.
  async function importCsv(file: File) {
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
    if (lines.length < 2) { setToast({ ok: false, msg: 'CSV has no data rows.' }); return }
    const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase())
    const posIdx = header.indexOf('position')
    const resIdx = header.indexOf('result')
    if (posIdx === -1 || resIdx === -1) {
      setToast({ ok: false, msg: 'CSV needs "Position" and "Result" columns (use the Export CSV format).' })
      return
    }
    const byPos = new Map(slots.filter(s => s.analysis?.reviewState === 'assigned').map(s => [s.position, s.analysisUid]))
    const staged: Record<string, string> = {}
    let matched = 0
    for (const line of lines.slice(1)) {
      const cells = parseCsvLine(line)
      const pos = Number((cells[posIdx] ?? '').trim())
      const val = (cells[resIdx] ?? '').trim()
      const uid = byPos.get(pos)
      if (uid && val) { staged[uid] = val; matched++ }
    }
    if (!matched) { setToast({ ok: false, msg: 'No results matched an editable position.' }); return }
    setResults(p => ({ ...p, ...staged }))
    setToast({ ok: true, msg: `Imported ${matched} result${matched !== 1 ? 's' : ''} — review, then Submit.` })
    setTimeout(() => setToast(null), 5000)
  }

  // Submit every editable row that has a (staged or typed) result.
  function submitAll() {
    const pending = slots.filter(s => s.analysis?.reviewState === 'assigned' && (results[s.analysisUid] ?? '').trim())
    if (!pending.length) { setToast({ ok: false, msg: 'No entered results to submit.' }); return }
    startTransition(async () => {
      let ok = 0
      for (const s of pending) {
        const r = await submitWorksheetResult(worksheet.id, s.analysisUid, results[s.analysisUid] ?? '')
        if (r.success) ok++
      }
      setToast({ ok: ok > 0, msg: `Submitted ${ok}/${pending.length} result${pending.length !== 1 ? 's' : ''}.` })
      router.refresh()
      setTimeout(() => setToast(null), 5000)
    })
  }

  function exportCsv() {
    const rows = [['Position', 'Type', 'Analysis', 'Sample', 'Result', 'State']]
    for (const s of slots) {
      rows.push([
        String(s.position), TYPE_LABEL[s.type] ?? s.type,
        s.analysis?.title ?? '', s.analysis?.sampleId ?? '',
        s.analysis?.result ?? '', s.analysis?.reviewState ?? '',
      ])
    }
    const csv = rows.map(r => r.map(c => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${worksheet.id}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function btnStyle(kind: 'primary' | 'danger' | 'neutral') {
    if (kind === 'primary') return { backgroundColor: '#0154FC', color: '#fff', border: 'none' }
    if (kind === 'danger') return { backgroundColor: '#fff', color: '#DC2626', border: '1px solid #FCA5A5' }
    return { backgroundColor: '#fff', color: '#374151', border: '1px solid #E8EAF2' }
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/worksheets" className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="arrow_back" size={16} color="#6B7280" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>{worksheet.id}</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full" style={{ backgroundColor: badge.bg, color: badge.color, fontSize: 11, fontWeight: 600 }}>{badge.label}</span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
              {worksheet.templateTitle ? `From template: ${worksheet.templateTitle}` : 'Blank worksheet'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isOpen && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ fontSize: 11, color: '#6B7280', backgroundColor: '#F3F4F6', border: '1px solid #E8EAF2' }}>
              <MI name="info" size={13} color="#9CA3AF" />
              Submits for review automatically once every result is entered
            </span>
          )}
          {actions.map(a => (
            <button key={a.id} onClick={() => run(() => transitionWorksheet(worksheet.path, worksheet.id, a.id), `Worksheet ${a.id}ed.`)} disabled={busy} className="flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1, ...btnStyle(a.kind) }}>
              <MI name={a.icon} size={14} color={a.kind === 'primary' ? '#fff' : a.kind === 'danger' ? '#DC2626' : '#374151'} />
              {a.label}
            </button>
          ))}
          <a href={`/dashboard/worksheets/${worksheet.id}/print`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 8, backgroundColor: '#fff', color: '#374151', border: '1px solid #E8EAF2' }}>
            <MI name="print" size={14} color="#374151" /> Print
          </a>
          <button onClick={exportCsv} className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 8, backgroundColor: '#fff', color: '#374151', border: '1px solid #E8EAF2', cursor: 'pointer' }}>
            <MI name="download" size={14} color="#374151" /> Export CSV
          </button>
          {hasEditable && (
            <>
              <input ref={importRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = '' }} />
              <button onClick={() => importRef.current?.click()} disabled={busy} title="Import results from an instrument/export CSV"
                className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 8, backgroundColor: '#fff', color: '#374151', border: '1px solid #E8EAF2', cursor: 'pointer' }}>
                <MI name="upload" size={14} color="#374151" /> Import results
              </button>
              <button onClick={submitAll} disabled={busy}
                className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                <MI name="done_all" size={14} color="#fff" /> Submit all
              </button>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* Worksheet properties: editable when open, read-only otherwise */}
      <div className="bg-white rounded-xl px-4 py-4 mb-4" style={{ border: '1px solid #E8EAF2' }}>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div>
            <label className="block mb-1" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Analyst</label>
            {isOpen ? (
              <select value={analyst} onChange={e => setAnalyst(e.target.value)} className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                <option value="">Unassigned</option>
                {analysts.map(a => <option key={a.id} value={a.id}>{a.fullname}</option>)}
                {/* Preserve a current analyst not in the lab-member list */}
                {analyst && !analysts.some(a => a.id === analyst) && <option value={analyst}>{analystLabel}</option>}
              </select>
            ) : <p className="text-sm font-semibold" style={{ color: '#111827' }}>{analystLabel || '—'}</p>}
          </div>
          <div>
            <label className="block mb-1" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instrument</label>
            {isOpen ? (
              <select value={instrumentUid} onChange={e => setInstrumentUid(e.target.value)} className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                <option value="">None</option>
                {instruments.map(i => <option key={i.uid} value={i.uid}>{i.title}</option>)}
              </select>
            ) : <p className="text-sm font-semibold" style={{ color: '#111827' }}>{worksheet.instrumentTitle || '—'}</p>}
          </div>
          <div>
            <label className="block mb-1" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Method</label>
            {isOpen ? (
              <select value={methodUid} onChange={e => setMethodUid(e.target.value)} className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                <option value="">None</option>
                {methods.map(m => <option key={m.uid} value={m.uid}>{m.title}</option>)}
              </select>
            ) : <p className="text-sm font-semibold" style={{ color: '#111827' }}>{worksheet.methodTitle || '—'}</p>}
          </div>
          <div className="flex items-end gap-3">
            <div><span style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>Routine</span><p className="text-sm font-semibold" style={{ color: '#111827' }}>{worksheet.numRegularAnalyses}</p></div>
            <div><span style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>QC</span><p className="text-sm font-semibold" style={{ color: '#111827' }}>{worksheet.numQcAnalyses}</p></div>
          </div>
        </div>
        <div className="mt-3">
          <label className="block mb-1" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remarks</label>
          {isOpen ? (
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} placeholder="Worksheet notes…" className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none resize-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
          ) : <p className="text-xs" style={{ color: '#374151' }}>{latestRemark(worksheet.remarks) || '—'}</p>}
        </div>
        {isOpen && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={saveDetails}
              disabled={busy} className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              <MI name="save" size={13} color="#fff" /> Save details
            </button>
          </div>
        )}
      </div>

      {/* Add analyses / duplicate controls (open only) */}
      {isOpen && (
        <div className="bg-white rounded-xl mb-4" style={{ border: '1px solid #E8EAF2' }}>
          <button onClick={() => setShowAdd(v => !v)} className="w-full flex items-center justify-between px-4 py-3" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#111827' }}>
              <MI name="playlist_add" size={16} color="#0154FC" /> Add analyses
              <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>{unassigned.length} available</span>
            </span>
            <MI name={showAdd ? 'expand_less' : 'expand_more'} size={18} color="#9CA3AF" />
          </button>
          {showAdd && (
            <div className="px-4 pb-4">
              {unassigned.length === 0 ? (
                <p className="text-xs" style={{ color: '#9CA3AF' }}>No pending analyses. Receive samples to make their analyses available here.</p>
              ) : (
                <>
                  <div className="rounded-lg" style={{ border: '1px solid #E8EAF2', maxHeight: 220, overflowY: 'auto' }}>
                    {unassigned.map(a => (
                      <label key={a.uid} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer" style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <input type="checkbox" checked={!!picked[a.uid]} onChange={e => setPicked(p => ({ ...p, [a.uid]: e.target.checked }))} style={{ accentColor: '#0154FC' }} />
                        <span className="text-xs" style={{ color: '#111827', flex: 1 }}>{a.title}</span>
                        <span className="text-xs" style={{ color: '#6B7280' }}>{a.sampleId}</span>
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>{a.clientTitle}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button onClick={addSelected} disabled={busy || pickedUids.length === 0} className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: 'pointer', opacity: busy || pickedUids.length === 0 ? 0.5 : 1 }}>
                      <MI name="add" size={13} color="#fff" /> Add {pickedUids.length || ''} selected
                    </button>
                  </div>
                </>
              )}
              {routinePositions.length > 0 && (
                <div className="mt-3 pt-3 flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid #F3F4F6' }}>
                  <span className="text-xs font-medium" style={{ color: '#374151' }}>Add duplicate QC of position</span>
                  <select value={dupSlot} onChange={e => setDupSlot(e.target.value)} className="px-2 py-1 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                    <option value="">Select…</option>
                    {routinePositions.map(p => <option key={p} value={p}>Position {p}</option>)}
                  </select>
                  <button onClick={() => run(() => addDuplicateToWorksheet(worksheet.path, worksheet.id, Number(dupSlot)), 'Duplicate added.')} disabled={busy || !dupSlot} className="flex items-center gap-1" style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, backgroundColor: '#fff', color: '#D97706', border: '1px solid #FCD34D', cursor: 'pointer', opacity: busy || !dupSlot ? 0.5 : 1 }}>
                    <MI name="content_copy" size={12} color="#D97706" /> Add Duplicate
                  </button>
                </div>
              )}
              {/* Blank / Control QC from a reference sample */}
              <div className="mt-3 pt-3 flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid #F3F4F6' }}>
                <span className="text-xs font-medium" style={{ color: '#374151' }}>Add Blank/Control QC</span>
                <select value={refUid} onChange={e => setRefUid(e.target.value)} className="px-2 py-1 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827', minWidth: 220 }}>
                  <option value="">Select reference sample…</option>
                  {references.map(r => (
                    <option key={r.uid} value={r.uid}>
                      {r.blank ? '[Blank] ' : '[Control] '}{r.title}{r.supplierTitle ? ` — ${r.supplierTitle}` : ''}
                    </option>
                  ))}
                </select>
                <button onClick={addReference} disabled={busy || !refUid} className="flex items-center gap-1" style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, backgroundColor: '#fff', color: '#059669', border: '1px solid #6EE7B7', cursor: 'pointer', opacity: busy || !refUid ? 0.5 : 1 }}>
                  <MI name="science" size={12} color="#059669" /> Add QC
                </button>
                {references.length === 0 && (
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                    No reference samples yet — add them under Administration → Reference Samples.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Layout / results grid */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Worksheet Layout</h2>
        </div>
        {slots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <MI name="grid_off" size={32} color="#D1D5DB" />
            <p className="mt-2 text-sm" style={{ color: '#6B7280' }}>No positions assigned</p>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Use “Add analyses” above, or apply a template</p>
          </div>
        ) : (
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Pos', 'Type', 'Analysis', 'Sample', 'Result', 'State', ''].map((h, hi) => (
                  <th key={hi} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((s, i) => {
                const a = s.analysis
                const state = a?.reviewState ?? ''
                const editable = state === 'assigned'
                return (
                  <tr key={`${s.position}-${s.analysisUid || i}`} style={{ borderBottom: i < slots.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                    <td className="px-3 py-2.5">
                      <span className="inline-block w-7 text-center text-xs font-semibold rounded" style={{ color: '#0154FC', backgroundColor: '#EFF6FF', padding: '3px 0' }}>{s.position}</span>
                    </td>
                    <td className="px-3 py-2.5"><span className="text-xs font-medium" style={{ color: TYPE_COLOR[s.type] ?? '#6B7280' }}>{TYPE_LABEL[s.type] ?? s.type}</span></td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#111827' }}>{a?.title ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{a?.sampleId || '—'}</td>
                    <td className="px-3 py-2.5">
                      {editable ? (
                        <input value={results[s.analysisUid] ?? ''} onChange={e => setResult(s.analysisUid, e.target.value)} placeholder="Enter result…" className="px-2 py-1 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827', width: 110 }} />
                      ) : <span className="text-xs font-medium" style={{ color: '#111827' }}>{a?.result || '—'}</span>}
                    </td>
                    <td className="px-3 py-2.5"><span className="text-xs" style={{ color: state === 'verified' ? '#166534' : state === 'to_be_verified' ? '#92400E' : '#9CA3AF' }}>{state || '—'}</span></td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {editable && a && (
                        <>
                          <button onClick={() => run(() => submitWorksheetResult(worksheet.id, s.analysisUid, results[s.analysisUid] ?? ''), 'Result submitted.')} disabled={busy || !(results[s.analysisUid] ?? '').trim()}
                            className="inline-flex items-center gap-1 mr-1" style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 6, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: 'pointer', opacity: busy || !(results[s.analysisUid] ?? '').trim() ? 0.5 : 1 }}>
                            <MI name="send" size={12} color="#fff" /> Submit
                          </button>
                          {isOpen && (
                            <button onClick={() => run(() => removeAnalysesFromWorksheet(worksheet.path, worksheet.id, [s.analysisUid]), 'Analysis removed.')} disabled={busy} title="Remove from worksheet"
                              className="inline-flex items-center p-1 rounded" style={{ border: '1px solid #FECACA', background: '#fff', cursor: 'pointer' }}>
                              <MI name="close" size={12} color="#DC2626" />
                            </button>
                          )}
                        </>
                      )}
                      {state === 'to_be_verified' && a && (
                        <button onClick={() => run(() => verifyWorksheetAnalysis(worksheet.id, s.analysisUid), 'Analysis verified.')} disabled={busy}
                          className="inline-flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 6, backgroundColor: '#fff', color: '#166534', border: '1px solid #86EFAC', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
                          <MI name="verified" size={12} color="#166534" /> Verify
                        </button>
                      )}
                      {state === 'verified' && <MI name="check_circle" size={16} color="#22C55E" />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

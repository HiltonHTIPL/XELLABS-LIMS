'use client'
import { useState, useMemo, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import {
  transitionWorksheet, submitWorksheetResult, submitWorksheetInterimResult, verifyWorksheetAnalysis,
  transitionWorksheetAnalysis, removeAnalysesFromWorksheet, addDuplicateToWorksheet,
  addReferenceToWorksheet, updateWorksheetFields, removeWorksheet,
  type ReferenceSampleOption,
} from '@/app/actions/senaite-worksheets'
import type { WorksheetInfo, UnassignedAnalysis, LabAnalyst } from '@/app/lib/senaite-worksheets'
import type { RefOption } from '@/app/dashboard/_components/AdminRefShell'
import DataTable, { type DataTableColumn } from '../../../_components/DataTable'

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
  const badge = STATE_BADGE[worksheet.reviewState] ?? { bg: '#F3F4F6', color: '#374151', label: worksheet.reviewState || '—' }
  const actions = TRANSITIONS[worksheet.reviewState] ?? []
  const slots = useMemo(() => [...worksheet.slots].sort((a, b) => a.position - b.position), [worksheet.slots])
  const routinePositions = useMemo(
    () => Array.from(new Set(slots.filter(s => s.type === 'a' && s.analysis).map(s => s.position))).sort((a, b) => a - b),
    [slots],
  )

  type SlotRow = (typeof slots)[number] & { id: string }
  const slotRows: SlotRow[] = slots.map((s, i) => ({ ...s, id: `${s.position}-${s.analysisUid || i}` }))

  const [results, setResults] = useState<Record<string, string>>({})
  // Per-analysis, per-interim-keyword raw readings (e.g. CA/MG for Soil
  // Calcium and Magnesium) — keyed by analysisUid then keyword. Only
  // populated for the handful of Calculation-backed rows; a plain-Result row
  // never touches this.
  const [interimValues, setInterimValues] = useState<Record<string, Record<string, string>>>({})
  function setInterim(analysisUid: string, keyword: string, v: string) {
    setInterimValues(p => ({ ...p, [analysisUid]: { ...p[analysisUid], [keyword]: v } }))
  }
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
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([])
  // SENAITE results layout toggle (Classic list vs Transposed matrix).
  const [layout, setLayout] = useState<'classic' | 'transposed'>('classic')
  // Autofill-interims bar state (only shown when the worksheet has interim fields).
  const [afKeyword, setAfKeyword] = useState('')
  const [afValue, setAfValue] = useState('')
  const [afOnlyEmpty, setAfOnlyEmpty] = useState(true)

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

  // Apply a workflow transition to every selected row that allows it in its
  // current state (SENAITE analysis workflow); rows that don't allow it are
  // skipped. `unassign` uses the remove-from-worksheet path.
  function bulkTransition(tx: 'verify' | 'retract' | 'reject' | 'unassign', label: string) {
    const allowed = (state: string) =>
      tx === 'verify' ? state === 'to_be_verified'
        : tx === 'retract' ? (state === 'to_be_verified' || state === 'verified')
          : tx === 'reject' ? (state === 'assigned' || state === 'to_be_verified')
            : state === 'assigned'
    const targets = slotRows.filter(r => selectedIds.includes(r.id) && r.analysis && allowed(r.analysis.reviewState))
    if (!targets.length) {
      setToast({ ok: false, msg: `No selected rows can be ${label.toLowerCase()}.` })
      setTimeout(() => setToast(null), 5000)
      return
    }
    startTransition(async () => {
      let ok = 0
      for (const r of targets) {
        const a = r.analysis!
        const meta = a.sampleId ? { sampleId: a.sampleId, title: a.title } : undefined
        const res = tx === 'unassign'
          ? await removeAnalysesFromWorksheet(worksheet.path, worksheet.id, [r.analysisUid], a.sampleId ? [{ uid: r.analysisUid, sampleId: a.sampleId, title: a.title }] : undefined)
          : await transitionWorksheetAnalysis(worksheet.id, r.analysisUid, tx, meta)
        if (res.success) ok++
      }
      setToast({ ok: ok > 0, msg: `${label}: ${ok}/${targets.length} row${targets.length !== 1 ? 's' : ''}.` })
      router.refresh()
      setTimeout(() => setToast(null), 5000)
    })
  }

  // Bulk-fill one interim field across every editable row that has it — the
  // SENAITE "Autofill" wide-interims bar. `afOnlyEmpty` skips cells that already
  // hold a non-empty, non-zero value.
  function applyAutofill() {
    if (!afKeyword) { setToast({ ok: false, msg: 'Pick an interim field to autofill.' }); setTimeout(() => setToast(null), 5000); return }
    let filled = 0
    setInterimValues(prev => {
      const next = { ...prev }
      for (const s of slots) {
        if (s.analysis?.reviewState !== 'assigned') continue
        if (!(s.analysis?.interimFields ?? []).some(f => f.keyword === afKeyword)) continue
        const cur = (next[s.analysisUid]?.[afKeyword] ?? '').trim()
        if (afOnlyEmpty && cur !== '' && cur !== '0') continue
        next[s.analysisUid] = { ...next[s.analysisUid], [afKeyword]: afValue }
        filled++
      }
      return next
    })
    setToast({ ok: true, msg: `Autofilled ${filled} row${filled !== 1 ? 's' : ''} — review, then Submit.` })
    setTimeout(() => setToast(null), 5000)
  }

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

  // Read a CSV or Excel (.xlsx/.xls) file into plain rows-of-cells, so the
  // matching logic below (header lookup + Position/Result mapping) is shared
  // by both formats instead of duplicated per-format.
  async function fileToRows(file: File): Promise<string[][]> {
    const isExcel = /\.xlsx?$/i.test(file.name)
    if (isExcel) {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' })
      return rows.map(r => r.map(c => String(c ?? '')))
    }
    const text = await file.text()
    return text.split(/\r?\n/).filter(l => l.trim() !== '').map(parseCsvLine)
  }

  // Union of every distinct interim keyword used across this worksheet's rows
  // (e.g. CA/MG for Soil Calcium and Magnesium, FE/ZN/MN/CU for Soil Available
  // Minerals) — most worksheets have none; a mixed worksheet gets one column
  // per keyword, blank on rows that don't use it.
  const interimKeywords = useMemo(() => {
    const seen: string[] = []
    for (const s of slots) {
      for (const f of s.analysis?.interimFields ?? []) {
        if (!seen.includes(f.keyword)) seen.push(f.keyword)
      }
    }
    return seen
  }, [slots])

  // Import an instrument/results CSV or Excel file and pre-fill the editable
  // inputs. Accepts the file this page's Export/Template downloads produce
  // (Position + Result, plus one column per interim keyword when this
  // worksheet has any Calculation-backed rows) — fill in, re-import, review,
  // then Submit. Matches rows to worksheet positions; only staged onto
  // `assigned` rows.
  async function importFile(file: File) {
    const lines = await fileToRows(file)
    if (lines.length < 2) { setToast({ ok: false, msg: 'File has no data rows.' }); return }
    const header = lines[0].map(h => h.trim().toLowerCase())
    const posIdx = header.indexOf('position')
    const resIdx = header.indexOf('result')
    if (posIdx === -1 || resIdx === -1) {
      setToast({ ok: false, msg: 'File needs "Position" and "Result" columns (use Export or Download Template).' })
      return
    }
    const interimIdx = new Map<string, number>(
      interimKeywords
        .map((kw): [string, number] => [kw, header.indexOf(kw.toLowerCase())])
        .filter(([, i]) => i !== -1),
    )
    const byPos = new Map(slots.filter(s => s.analysis?.reviewState === 'assigned').map(s => [s.position, s]))
    const stagedResults: Record<string, string> = {}
    const stagedInterims: Record<string, Record<string, string>> = {}
    let matched = 0
    for (const cells of lines.slice(1)) {
      const pos = Number((cells[posIdx] ?? '').trim())
      const slot = byPos.get(pos)
      if (!slot?.analysis) continue
      const hasInterims = (slot.analysis.interimFields ?? []).length > 0
      if (hasInterims) {
        const row: Record<string, string> = {}
        let any = false
        for (const [kw, idx] of interimIdx) {
          const v = (cells[idx] ?? '').trim()
          if (v) { row[kw] = v; any = true }
        }
        if (any) { stagedInterims[slot.analysisUid] = row; matched++ }
      } else {
        const val = (cells[resIdx] ?? '').trim()
        if (val) { stagedResults[slot.analysisUid] = val; matched++ }
      }
    }
    if (!matched) { setToast({ ok: false, msg: 'No results matched an editable position.' }); return }
    setResults(p => ({ ...p, ...stagedResults }))
    setInterimValues(p => {
      const next = { ...p }
      for (const [uid, row] of Object.entries(stagedInterims)) next[uid] = { ...next[uid], ...row }
      return next
    })
    setToast({ ok: true, msg: `Imported ${matched} result${matched !== 1 ? 's' : ''} — review, then Submit.` })
    setTimeout(() => setToast(null), 5000)
  }

  // Submit every editable row that has a (staged or typed) result — plain
  // Result rows via submitWorksheetResult, Calculation-backed rows via
  // submitWorksheetInterimResult (real SENAITE engine computes the Result).
  function submitAll() {
    const pending = slots.filter(s => {
      if (s.analysis?.reviewState !== 'assigned') return false
      const fields = s.analysis?.interimFields ?? []
      if (fields.length > 0) return fields.every(f => (interimValues[s.analysisUid]?.[f.keyword] ?? '').trim())
      return !!(results[s.analysisUid] ?? '').trim()
    })
    if (!pending.length) { setToast({ ok: false, msg: 'No entered results to submit.' }); return }
    startTransition(async () => {
      let ok = 0
      for (const s of pending) {
        const fields = s.analysis?.interimFields ?? []
        const sampleMeta = s.analysis?.sampleId ? { sampleId: s.analysis.sampleId, title: s.analysis.title } : undefined
        const r = fields.length > 0
          ? await submitWorksheetInterimResult(worksheet.id, s.analysisUid, s.analysis!.path, fields.map(f => ({ keyword: f.keyword, value: interimValues[s.analysisUid]?.[f.keyword] ?? '' })), sampleMeta)
          : await submitWorksheetResult(worksheet.id, s.analysisUid, results[s.analysisUid] ?? '', sampleMeta)
        if (r.success) ok++
      }
      setToast({ ok: ok > 0, msg: `Submitted ${ok}/${pending.length} result${pending.length !== 1 ? 's' : ''}.` })
      router.refresh()
      setTimeout(() => setToast(null), 5000)
    })
  }

  // Shared row shape for CSV export, Excel export, and the result-entry
  // template — one column layout, one place it's defined (DRY), reused by all
  // three actions below. `blankResult`: the template is meant to be filled in
  // fresh, so it always clears Result/interim values even if the worksheet
  // already has them.
  function buildExportRows(blankResult: boolean): string[][] {
    const rows = [['Position', 'Type', 'Analysis', 'Sample', ...interimKeywords, 'Result', 'Unit', 'State']]
    for (const s of slots) {
      const fieldByKw = new Map((s.analysis?.interimFields ?? []).map(f => [f.keyword, f]))
      const interimCells = interimKeywords.map(kw => {
        const f = fieldByKw.get(kw)
        if (!f) return ''
        return blankResult ? '' : f.value
      })
      rows.push([
        String(s.position), TYPE_LABEL[s.type] ?? s.type,
        s.analysis?.title ?? '', s.analysis?.sampleId ?? '',
        ...interimCells,
        blankResult ? '' : (s.analysis?.result ?? ''),
        '', s.analysis?.reviewState ?? '',
      ])
    }
    return rows
  }

  function downloadCsv(rows: string[][], filename: string) {
    const csv = rows.map(r => r.map(c => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  function downloadXlsx(rows: string[][], filename: string, sheetName: string) {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, filename)
  }

  function exportCsv() { downloadCsv(buildExportRows(false), `${worksheet.id}.csv`) }
  function exportXlsx() { downloadXlsx(buildExportRows(false), `${worksheet.id}.xlsx`, 'Results') }

  // Generic (same shape for every instrument, per design decision) result-entry
  // template — Position/Analysis/Sample/Unit pre-filled, Result left blank for
  // the lab tech or instrument export to fill in, then re-import above.
  function downloadTemplate() { downloadXlsx(buildExportRows(true), `${worksheet.id}-result-template.xlsx`, 'Template') }

  function btnStyle(kind: 'primary' | 'danger' | 'neutral') {
    if (kind === 'primary') return { backgroundColor: '#0154FC', color: '#fff', border: 'none' }
    if (kind === 'danger') return { backgroundColor: '#fff', color: '#DC2626', border: '1px solid #FCA5A5' }
    return { backgroundColor: '#fff', color: '#374151', border: '1px solid #E8EAF2' }
  }

  // Result cell — shared by the Classic grid column and the Transposed matrix
  // (DRY): editable input(s) for an `assigned` row (interim boxes for a
  // Calculation-backed analysis, else a single Result box), else the stored
  // result text.
  function resultCell(s: SlotRow) {
    const editable = (s.analysis?.reviewState ?? '') === 'assigned'
    const interimFields = s.analysis?.interimFields ?? []
    if (editable && interimFields.length > 0) {
      return (
        <div className="flex flex-wrap items-center gap-1">
          {interimFields.map(f => (
            <input
              key={f.keyword}
              value={interimValues[s.analysisUid]?.[f.keyword] ?? ''}
              onChange={e => setInterim(s.analysisUid, f.keyword, e.target.value)}
              placeholder={f.keyword}
              title={`${f.title}${f.unit ? ` (${f.unit})` : ''}`}
              className="px-1.5 py-1 text-xs rounded-lg outline-none"
              style={{ border: '1px solid #D1D5DB', color: '#111827', width: 52 }}
            />
          ))}
        </div>
      )
    }
    return editable ? (
      <input value={results[s.analysisUid] ?? ''} onChange={e => setResult(s.analysisUid, e.target.value)} placeholder="Enter result…" className="px-2 py-1 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827', width: 110 }} />
    ) : <span className="text-xs font-medium" style={{ color: '#111827' }}>{s.analysis?.result || '—'}</span>
  }

  // Columns reproduce the previous hand-rolled cells exactly (same badges /
  // editable result input / action buttons), migrated to the shared <DataTable>.
  const slotColumns: DataTableColumn<SlotRow>[] = [
    {
      // Rich Position slot header (SENAITE slot_header): routine rows show
      // Sample ID / Client / Sample Type · Point · Received; QC rows show the
      // QC type, Reference Sample + Supplier, or "Dup of #N" for a duplicate.
      id: 'position', label: 'Position', sortable: true, minWidth: 200,
      render: s => {
        const a = s.analysis
        const isQc = s.type !== 'a'
        const dupPos = a?.dupSourceUid ? slots.find(x => x.analysisUid === a.dupSourceUid)?.position : undefined
        return (
          <div className="flex items-start gap-2">
            <span className="inline-block w-7 text-center text-xs font-semibold rounded shrink-0" style={{ color: '#0154FC', backgroundColor: '#EFF6FF', padding: '3px 0' }}>{s.position}</span>
            <div className="min-w-0">
              {isQc ? (
                <>
                  <div className="text-xs font-semibold" style={{ color: TYPE_COLOR[s.type] ?? '#111827' }}>{TYPE_LABEL[s.type] ?? s.type}</div>
                  {a?.referenceTitle && <div className="text-xs truncate" style={{ color: '#111827' }}>{a.referenceTitle}</div>}
                  {a?.supplierTitle && <div className="text-xs truncate" style={{ color: '#6B7280' }}>{a.supplierTitle}</div>}
                  {s.type === 'd' && (dupPos || a?.sampleId) ? <div className="text-xs" style={{ color: '#6B7280' }}>Dup of {dupPos ? `#${dupPos}` : a?.sampleId}</div> : null}
                </>
              ) : (
                <>
                  <div className="text-xs font-medium truncate" style={{ color: '#111827' }}>{a?.sampleId || '—'}</div>
                  {a?.clientTitle && <div className="text-xs truncate" style={{ color: '#6B7280' }}>{a.clientTitle}</div>}
                  {(a?.sampleType || a?.samplePoint || a?.dateReceived) && (
                    <div className="text-xs truncate" style={{ color: '#9CA3AF' }}>
                      {[a?.sampleType, a?.samplePoint, a?.dateReceived ? a.dateReceived.slice(0, 10) : ''].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )
      },
    },
    {
      id: 'analysis', label: 'Analysis', sortable: true, minWidth: 180,
      render: s => <span className="text-xs" style={{ color: '#111827' }}>{s.analysis?.title ?? '—'}</span>,
    },
    {
      id: 'result', label: 'Result', minWidth: 140,
      render: s => resultCell(s),
    },
    {
      id: 'dl', label: 'DL', minWidth: 60,
      render: s => <span className="text-xs" style={{ color: '#374151' }}>{s.analysis?.dl || '—'}</span>,
    },
    {
      id: 'uncertainty', label: 'Uncertainty', sortable: true, minWidth: 100,
      render: s => <span className="text-xs" style={{ color: '#374151' }}>{s.analysis?.uncertainty || '—'}</span>,
    },
    {
      id: 'specification', label: 'Spec (min–max)', minWidth: 120,
      render: s => <span className="text-xs" style={{ color: '#374151' }}>{s.analysis?.specification || '—'}</span>,
    },
    {
      id: 'method', label: 'Method', sortable: true, minWidth: 130,
      render: s => <span className="text-xs" style={{ color: '#374151' }}>{s.analysis?.methodTitle || '—'}</span>,
    },
    {
      id: 'instrument', label: 'Instrument', sortable: true, minWidth: 130,
      render: s => <span className="text-xs" style={{ color: '#374151' }}>{s.analysis?.instrumentTitle || '—'}</span>,
    },
    {
      id: 'captured', label: 'Captured', sortable: true, minWidth: 110,
      render: s => <span className="text-xs" style={{ color: '#374151' }}>{s.analysis?.captured ? s.analysis.captured.slice(0, 10) : '—'}</span>,
    },
    {
      id: 'due', label: 'Due', sortable: true, minWidth: 110,
      render: s => <span className="text-xs" style={{ color: '#374151' }}>{s.analysis?.dueDate ? s.analysis.dueDate.slice(0, 10) : '—'}</span>,
    },
    {
      id: 'retested', label: 'Retested', minWidth: 80,
      render: s => s.analysis?.retested ? <span className="text-xs" style={{ color: '#B45309' }}>Yes</span> : <span className="text-xs" style={{ color: '#9CA3AF' }}>—</span>,
    },
    {
      id: 'attachments', label: 'Att.', minWidth: 60,
      render: s => <span className="text-xs" style={{ color: '#374151' }}>{s.analysis?.attachmentsCount ? s.analysis.attachmentsCount : '—'}</span>,
    },
    {
      id: 'remarks', label: 'Remarks', minWidth: 160,
      render: s => <span className="text-xs truncate inline-block" style={{ color: '#374151', maxWidth: 220 }} title={s.analysis?.remarks || ''}>{s.analysis?.remarks || '—'}</span>,
    },
    {
      id: 'state', label: 'State', sortable: true, minWidth: 120,
      render: s => {
        const state = s.analysis?.reviewState ?? ''
        return <span className="text-xs" style={{ color: state === 'verified' ? '#166534' : state === 'to_be_verified' ? '#92400E' : '#374151' }}>{state || '—'}</span>
      },
    },
    {
      id: 'status', label: 'Status', minWidth: 160,
      render: s => {
        const a = s.analysis
        // Nothing to grade yet — no result submitted (or row not editable's
        // opposite, i.e. still 'unassigned').
        if (!a || !a.result) return <span className="text-xs" style={{ color: '#9CA3AF' }}>—</span>
        const chips: { label: string; bg: string; color: string }[] = []
        chips.push(
          a.outOfRange
            ? { label: 'Failed', bg: '#FEE2E2', color: '#991B1B' }
            : { label: 'Passed', bg: '#DCFCE7', color: '#166534' },
        )
        if (a.belowLod) chips.push({ label: '< LOD', bg: '#FEF3C7', color: '#92400E' })
        if (a.aboveUdl) chips.push({ label: '> UDL', bg: '#FEF3C7', color: '#92400E' })
        if (a.belowLoq) chips.push({ label: '< LOQ', bg: '#E0E7FF', color: '#3730A3' })
        if (a.aboveUoq) chips.push({ label: '> ULOQ', bg: '#E0E7FF', color: '#3730A3' })
        return (
          <div className="flex flex-wrap items-center gap-1">
            {chips.map(c => (
              <span key={c.label} className="text-xs font-semibold rounded-full" style={{ padding: '2px 8px', backgroundColor: c.bg, color: c.color }}>
                {c.label}
              </span>
            ))}
          </div>
        )
      },
    },
  ]

  function slotRowActions(s: SlotRow) {
    const a = s.analysis
    const state = a?.reviewState ?? ''
    const editable = state === 'assigned'
    const interimFields = a?.interimFields ?? []
    const hasInterims = interimFields.length > 0
    const interimVals = interimValues[s.analysisUid] ?? {}
    const interimsFilled = hasInterims && interimFields.every(f => (interimVals[f.keyword] ?? '').trim())
    const canSubmit = hasInterims ? interimsFilled : !!(results[s.analysisUid] ?? '').trim()
    const sampleMeta = a?.sampleId ? { sampleId: a.sampleId, title: a.title } : undefined
    function submitRow() {
      if (hasInterims && a) {
        const payload = interimFields.map(f => ({ keyword: f.keyword, value: interimVals[f.keyword] ?? '' }))
        return submitWorksheetInterimResult(worksheet.id, s.analysisUid, a.path, payload, sampleMeta)
      }
      return submitWorksheetResult(worksheet.id, s.analysisUid, results[s.analysisUid] ?? '', sampleMeta)
    }
    const unassignMeta = a?.sampleId ? [{ uid: s.analysisUid, sampleId: a.sampleId, title: a.title }] : undefined
    return (
      <div className="whitespace-nowrap flex items-center gap-1">
        {editable && a && (
          <button onClick={() => run(submitRow, 'Result submitted.')} disabled={busy || !canSubmit}
            className="inline-flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 6, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: 'pointer', opacity: busy || !canSubmit ? 0.5 : 1 }}>
            <MI name="send" size={12} color="#fff" /> Submit
          </button>
        )}
        {state === 'to_be_verified' && a && (
          <button onClick={() => run(() => verifyWorksheetAnalysis(worksheet.id, s.analysisUid, sampleMeta), 'Analysis verified.')} disabled={busy}
            className="inline-flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 6, backgroundColor: '#fff', color: '#166534', border: '1px solid #86EFAC', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
            <MI name="verified" size={12} color="#166534" /> Verify
          </button>
        )}
        {/* Retract — to_be_verified or verified (SENAITE analysis workflow) */}
        {a && (state === 'to_be_verified' || state === 'verified') && (
          <button onClick={() => run(() => transitionWorksheetAnalysis(worksheet.id, s.analysisUid, 'retract', sampleMeta), 'Analysis retracted.')} disabled={busy} title="Retract"
            className="inline-flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, padding: '5px 8px', borderRadius: 6, backgroundColor: '#fff', color: '#B45309', border: '1px solid #FCD34D', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
            <MI name="undo" size={12} color="#B45309" /> Retract
          </button>
        )}
        {/* Reject — assigned or to_be_verified */}
        {a && (state === 'assigned' || state === 'to_be_verified') && (
          <button onClick={() => run(() => transitionWorksheetAnalysis(worksheet.id, s.analysisUid, 'reject', sampleMeta), 'Analysis rejected.')} disabled={busy} title="Reject"
            className="inline-flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, padding: '5px 8px', borderRadius: 6, backgroundColor: '#fff', color: '#B91C1C', border: '1px solid #FCA5A5', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
            <MI name="block" size={12} color="#B91C1C" /> Reject
          </button>
        )}
        {/* Unassign — assigned only, on an open worksheet */}
        {a && state === 'assigned' && isOpen && (
          <button onClick={() => run(() => removeAnalysesFromWorksheet(worksheet.path, worksheet.id, [s.analysisUid], unassignMeta), 'Analysis unassigned.')} disabled={busy} title="Unassign from worksheet"
            className="inline-flex items-center p-1 rounded" style={{ border: '1px solid #E8EAF2', background: '#fff', cursor: 'pointer' }}>
            <MI name="link_off" size={12} color="#374151" />
          </button>
        )}
        {state === 'verified' && <MI name="check_circle" size={16} color="#22C55E" />}
      </div>
    )
  }

  // Transposed matrix (SENAITE's Transposed layout): one row per analysis
  // service, one dynamic column per position — still a shared <DataTable>, just
  // laid out the other way. Result cells reuse resultCell() (DRY).
  type TransRow = { id: string; title: string }
  const transposed = useMemo(() => {
    const order: string[] = []
    const posSet = new Set<number>()
    const byKey = new Map<string, SlotRow>()
    for (const s of slotRows) {
      const title = s.analysis?.title ?? `Slot ${s.position}`
      if (!order.includes(title)) order.push(title)
      posSet.add(s.position)
      byKey.set(`${title}||${s.position}`, s)
    }
    return { positions: [...posSet].sort((a, b) => a - b), rows: order.map(t => ({ id: t, title: t })), byKey }
  }, [slotRows])

  const transColumns: DataTableColumn<TransRow>[] = [
    { id: 'title', label: 'Analysis', sortable: true, minWidth: 180, render: r => <span className="text-xs font-medium" style={{ color: '#111827' }}>{r.title}</span> },
    ...transposed.positions.map((pos): DataTableColumn<TransRow> => {
      const head = slotRows.find(s => s.position === pos)
      const a = head?.analysis
      const isQc = head ? head.type !== 'a' : false
      const primary = isQc ? (a?.referenceTitle || (head ? TYPE_LABEL[head.type] : '')) : (a?.sampleId || '')
      const secondary = isQc ? (a?.supplierTitle || '') : (a?.clientTitle || a?.sampleType || '')
      return {
        id: `pos-${pos}`, label: `#${pos}${primary ? ` · ${primary}` : ''}${secondary ? ` (${secondary})` : ''}`, minWidth: 150,
        render: (r: TransRow) => {
          const slot = transposed.byKey.get(`${r.title}||${pos}`)
          return slot?.analysis ? resultCell(slot) : <span style={{ color: '#D1D5DB' }}>—</span>
        },
      }
    }),
  ]

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/worksheets" className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="arrow_back" size={16} color="#374151" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>{worksheet.id}</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full" style={{ backgroundColor: badge.bg, color: badge.color, fontSize: 11, fontWeight: 600 }}>{badge.label}</span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#374151' }}>
              {worksheet.templateTitle ? `From template: ${worksheet.templateTitle}` : 'Blank worksheet'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isOpen && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ fontSize: 11, color: '#374151', backgroundColor: '#F3F4F6', border: '1px solid #E8EAF2' }}>
              <MI name="info" size={13} color="#374151" />
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
          {/* Remove — SENAITE allows removing an empty worksheet (open + no
              analyses). Navigates back to the list once removed. */}
          {isOpen && slots.length === 0 && (
            <button onClick={() => run(async () => {
              const r = await removeWorksheet(worksheet.path, worksheet.id)
              if (r.success) router.push('/dashboard/worksheets')
              return r
            }, 'Worksheet removed.')} disabled={busy} className="flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer', backgroundColor: '#fff', color: '#DC2626', border: '1px solid #FCA5A5' }}>
              <MI name="delete" size={14} color="#DC2626" /> Remove
            </button>
          )}
          <a href={`/dashboard/worksheets/${worksheet.id}/print`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 8, backgroundColor: '#fff', color: '#374151', border: '1px solid #E8EAF2' }}>
            <MI name="print" size={14} color="#374151" /> Print
          </a>
          <button onClick={exportCsv} className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 8, backgroundColor: '#fff', color: '#374151', border: '1px solid #E8EAF2', cursor: 'pointer' }}>
            <MI name="download" size={14} color="#374151" /> Export CSV
          </button>
          <button onClick={exportXlsx} className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 8, backgroundColor: '#fff', color: '#374151', border: '1px solid #E8EAF2', cursor: 'pointer' }}>
            <MI name="download" size={14} color="#374151" /> Export Excel
          </button>
          {hasEditable && (
            <>
              <button onClick={downloadTemplate} title="Download a blank result-entry template for this worksheet"
                className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 8, backgroundColor: '#fff', color: '#374151', border: '1px solid #E8EAF2', cursor: 'pointer' }}>
                <MI name="description" size={14} color="#374151" /> Download Template
              </button>
              <input ref={importRef} type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
              <button onClick={() => importRef.current?.click()} disabled={busy} title="Import results from an instrument export (CSV or Excel)"
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
            <label className="block mb-1" style={{ fontSize: 10, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Analyst</label>
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
            <label className="block mb-1" style={{ fontSize: 10, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instrument</label>
            {isOpen ? (
              <select value={instrumentUid} onChange={e => setInstrumentUid(e.target.value)} className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                <option value="">None</option>
                {instruments.map(i => <option key={i.uid} value={i.uid}>{i.title}</option>)}
              </select>
            ) : <p className="text-sm font-semibold" style={{ color: '#111827' }}>{worksheet.instrumentTitle || '—'}</p>}
          </div>
          <div>
            <label className="block mb-1" style={{ fontSize: 10, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Method</label>
            {isOpen ? (
              <select value={methodUid} onChange={e => setMethodUid(e.target.value)} className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                <option value="">None</option>
                {methods.map(m => <option key={m.uid} value={m.uid}>{m.title}</option>)}
              </select>
            ) : <p className="text-sm font-semibold" style={{ color: '#111827' }}>{worksheet.methodTitle || '—'}</p>}
          </div>
          <div className="flex items-end gap-3">
            <div><span style={{ fontSize: 10, fontWeight: 600, color: '#374151', textTransform: 'uppercase' }}>Routine</span><p className="text-sm font-semibold" style={{ color: '#111827' }}>{worksheet.numRegularAnalyses}</p></div>
            <div><span style={{ fontSize: 10, fontWeight: 600, color: '#374151', textTransform: 'uppercase' }}>QC</span><p className="text-sm font-semibold" style={{ color: '#111827' }}>{worksheet.numQcAnalyses}</p></div>
          </div>
        </div>
        <div className="mt-3">
          <label className="block mb-1" style={{ fontSize: 10, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remarks</label>
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

      {/* Add-to-worksheet controls (open only). Routine analyses are added on
          the dedicated Add-Analyses screen (SENAITE's add_analyses); this panel
          keeps the QC controls (Duplicate / Blank / Control). */}
      {isOpen && (
        <div className="bg-white rounded-xl mb-4 px-4 py-4" style={{ border: '1px solid #E8EAF2' }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#111827' }}>
              <MI name="playlist_add" size={16} color="#0154FC" /> Add analyses
              <span style={{ fontSize: 11, color: '#374151', fontWeight: 400 }}>{unassigned.length} pending available</span>
            </span>
            <Link href={`/dashboard/worksheets/${worksheet.id}/add`} className="flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff' }}>
              <MI name="add" size={13} color="#fff" /> Add analyses
            </Link>
          </div>
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
              <span style={{ fontSize: 11, color: '#374151' }}>
                No reference samples yet — add them under Administration → Reference Samples.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Layout / results grid */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
        <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Worksheet Layout</h2>
            {/* Classic ⇄ Transposed layout toggle (SENAITE resultslayout) */}
            {slots.length > 0 && (
              <div className="inline-flex rounded-lg overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
                {(['classic', 'transposed'] as const).map(l => (
                  <button key={l} onClick={() => setLayout(l)}
                    className="text-xs font-semibold px-2.5 py-1"
                    style={{ backgroundColor: layout === l ? '#0154FC' : '#fff', color: layout === l ? '#fff' : '#374151', border: 'none', cursor: 'pointer' }}>
                    {l === 'classic' ? 'Classic' : 'Transposed'}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Bulk workflow action bar — Classic view only (selection lives there) */}
          {layout === 'classic' && selectedIds.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium mr-1" style={{ color: '#374151' }}>{selectedIds.length} selected</span>
              <button onClick={() => bulkTransition('verify', 'Verified')} disabled={busy} className="inline-flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 6, background: '#fff', color: '#166534', border: '1px solid #86EFAC', cursor: 'pointer' }}>
                <MI name="verified" size={12} color="#166534" /> Verify
              </button>
              <button onClick={() => bulkTransition('retract', 'Retracted')} disabled={busy} className="inline-flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 6, background: '#fff', color: '#B45309', border: '1px solid #FCD34D', cursor: 'pointer' }}>
                <MI name="undo" size={12} color="#B45309" /> Retract
              </button>
              <button onClick={() => bulkTransition('reject', 'Rejected')} disabled={busy} className="inline-flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 6, background: '#fff', color: '#B91C1C', border: '1px solid #FCA5A5', cursor: 'pointer' }}>
                <MI name="block" size={12} color="#B91C1C" /> Reject
              </button>
              {isOpen && (
                <button onClick={() => bulkTransition('unassign', 'Unassigned')} disabled={busy} className="inline-flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 6, background: '#fff', color: '#374151', border: '1px solid #E8EAF2', cursor: 'pointer' }}>
                  <MI name="link_off" size={12} color="#374151" /> Unassign
                </button>
              )}
            </div>
          )}
        </div>

        {/* Autofill interims bar — only when the worksheet has interim fields */}
        {isOpen && interimKeywords.length > 0 && (
          <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap" style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFBFF' }}>
            <span className="text-xs font-semibold" style={{ color: '#374151' }}>Autofill</span>
            <select value={afKeyword} onChange={e => setAfKeyword(e.target.value)} className="px-2 py-1 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
              <option value="">Field…</option>
              {interimKeywords.map(kw => <option key={kw} value={kw}>{kw}</option>)}
            </select>
            <input value={afValue} onChange={e => setAfValue(e.target.value)} placeholder="Value" className="px-2 py-1 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827', width: 100 }} />
            <label className="flex items-center gap-1 text-xs" style={{ color: '#374151' }}>
              <input type="checkbox" checked={afOnlyEmpty} onChange={e => setAfOnlyEmpty(e.target.checked)} style={{ accentColor: '#0154FC' }} />
              Only to empty or zero fields
            </label>
            <button onClick={applyAutofill} disabled={busy || !afKeyword} className="inline-flex items-center gap-1" style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6, backgroundColor: '#fff', color: '#0154FC', border: '1px solid #93C5FD', cursor: busy || !afKeyword ? 'not-allowed' : 'pointer', opacity: busy || !afKeyword ? 0.5 : 1 }}>
              <MI name="bolt" size={12} color="#0154FC" /> Apply
            </button>
          </div>
        )}

        {slots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <MI name="grid_off" size={32} color="#D1D5DB" />
            <p className="mt-2 text-sm" style={{ color: '#374151' }}>No positions assigned</p>
            <p className="text-xs mt-0.5" style={{ color: '#374151' }}>Use “Add analyses” above, or apply a template</p>
          </div>
        ) : layout === 'classic' ? (
          <DataTable<SlotRow>
            data={slotRows}
            columns={slotColumns}
            selectable
            searchable
            persistKey="worksheet-layout"
            emptyMessage="No positions assigned."
            onSelectionChange={setSelectedIds}
            rowActions={slotRowActions}
          />
        ) : (
          <DataTable<TransRow>
            data={transposed.rows}
            columns={transColumns}
            paginated={false}
            persistKey="worksheet-transposed"
            emptyMessage="No positions assigned."
          />
        )}
      </div>
    </div>
  )
}

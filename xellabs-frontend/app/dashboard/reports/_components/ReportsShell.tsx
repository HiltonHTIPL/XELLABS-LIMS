'use client'
import { useState, useActionState, useEffect, useCallback, useRef } from 'react'
import {
  createAndGenerateReport,
  triggerGenerate,
  cancelReport,
  regenerateReport,
  bulkGenerateReports,
  pollReport,
  type Report,
  type ReportFormState,
  type ReportType,
} from '@/app/actions/reports'
import { type LabSample } from '@/app/actions/lab-samples'
import { type DjangoClient } from '@/app/actions/clients'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({
  label, name, error, children, required,
}: { label: string; name: string; error?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      {children}
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  coa: 'Certificate of Analysis (COA)',
  worksheet: 'Worksheet Report',
  qc: 'QC Report',
  inventory: 'Inventory Report',
  instrument: 'Instrument Report',
  custom: 'Custom Report',
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft:      { bg: '#FEF9C3', color: '#854D0E', label: 'Draft' },
  final:      { bg: '#DCFCE7', color: '#166534', label: 'Final' },
  cancelled:  { bg: '#F3F4F6', color: '#6B7280', label: 'Cancelled' },
  generating: { bg: '#DBEAFE', color: '#1D4ED8', label: 'Generating…' },
  failed:     { bg: '#FEE2E2', color: '#991B1B', label: 'Failed' },
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function SampleTooltip({ sample }: { sample: LabSample }) {
  return (
    <div style={{
      position: 'absolute', left: 0, top: '100%', marginTop: 4, zIndex: 200,
      backgroundColor: '#1F2937', borderRadius: 8, padding: '8px 12px',
      minWidth: 220, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      pointerEvents: 'none',
    }}>
      <p style={{ fontSize: 11, color: '#F9FAFB', fontWeight: 600, marginBottom: 4 }}>{sample.sample_id}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px', fontSize: 10, color: '#D1D5DB' }}>
        <span style={{ color: '#9CA3AF' }}>Client</span>     <span>{sample.client_name || '—'}</span>
        <span style={{ color: '#9CA3AF' }}>Type</span>       <span>{sample.sample_type_name || '—'}</span>
        <span style={{ color: '#9CA3AF' }}>Collected</span>  <span>{sample.collection_date ? new Date(sample.collection_date).toLocaleDateString('en-GB') : '—'}</span>
        <span style={{ color: '#9CA3AF' }}>Status</span>     <span style={{ textTransform: 'capitalize' }}>{sample.status}</span>
      </div>
    </div>
  )
}

// ── PDF Viewer slide-over ─────────────────────────────────────────────────────
function PdfViewer({ reportId, title, onClose }: { reportId: number; title: string; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: 'var(--dashboard-header-h)', bottom: 'var(--dashboard-footer-h)', left: 0, right: 0, zIndex: 500, display: 'flex',
      backgroundColor: 'rgba(0,0,0,0.5)',
    }} onClick={e => { if (e.currentTarget === e.target) onClose() }}>
      <div style={{ marginLeft: 'auto', width: '55%', minWidth: 520, backgroundColor: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <div className="flex items-center gap-2">
            <MI name="picture_as_pdf" size={18} color="#EF4444" />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#111827' }}>{title}</p>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>PDF Preview</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/report-download/${reportId}`}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ backgroundColor: '#0154FC', color: '#fff', textDecoration: 'none' }}
            >
              <MI name="download" size={13} color="#fff" />
              Download
            </a>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
              <MI name="close" size={16} color="#9CA3AF" />
            </button>
          </div>
        </div>
        {/* PDF iframe */}
        <iframe
          src={`/api/report-download/${reportId}?inline=1`}
          style={{ flex: 1, border: 'none', backgroundColor: '#F3F4F6' }}
          title={title}
        />
      </div>
    </div>
  )
}

// ── New Report Modal ──────────────────────────────────────────────────────────
function NewReportModal({
  samples,
  onClose,
  onCreated,
}: {
  samples: LabSample[]
  onClose: () => void
  onCreated: (report: Report) => void
}) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [selectedSampleId, setSelectedSampleId] = useState('')
  const [autoTitle, setAutoTitle] = useState('')
  const [reportType, setReportType] = useState<ReportType>('coa')
  const [hoveredSampleId, setHoveredSampleId] = useState<string | null>(null)

  const action = async (prev: ReportFormState, fd: FormData): Promise<ReportFormState> => {
    const result = await createAndGenerateReport(prev, fd)
    if (result.success && result.report) {
      onCreated(result.report)
      onClose()
    }
    return result
  }

  const [state, formAction, pending] = useActionState(action, {})

  useEffect(() => {
    if (state.errors) {
      const fe: Record<string, string> = {}
      for (const [k, msgs] of Object.entries(state.errors)) { if (msgs?.length) fe[k] = msgs[0] }
      // fieldErrors is independently cleared per-field on change below, so it can't be
      // a plain derived value — it needs its own lifecycle synced from state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFieldErrors(fe)
    }
  }, [state])

  function handleSampleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setSelectedSampleId(val)
    setFieldErrors(p => { const n = {...p}; delete n.sample; return n })
    if (val) {
      const s = samples.find(s => String(s.id) === val)
      if (s) setAutoTitle(`${REPORT_TYPE_LABELS[reportType]} — ${s.sample_id}`)
    } else {
      setAutoTitle('')
    }
  }

  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const t = e.target.value as ReportType
    setReportType(t)
    if (selectedSampleId) {
      const s = samples.find(s => String(s.id) === selectedSampleId)
      if (s) setAutoTitle(`${REPORT_TYPE_LABELS[t]} — ${s.sample_id}`)
    }
  }

  const inputStyle = (err?: string): React.CSSProperties => ({
    width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8, outline: 'none',
    border: `1px solid ${err ? '#EF4444' : '#D1D5DB'}`, color: '#111827', background: '#fff',
  })

  const hoveredSample = hoveredSampleId ? samples.find(s => String(s.id) === hoveredSampleId) : null

  return (
    <div
      onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', top: 'var(--dashboard-header-h)', bottom: 'var(--dashboard-footer-h)', left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}
    >
      <div style={{ backgroundColor: '#fff', width: 480, height: '100%', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
              <MI name="description" size={16} color="#0154FC" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>New Report</h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>Generate a report for a lab sample</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <MI name="close" size={16} color="#9CA3AF" />
          </button>
        </div>

        <form action={formAction} className="px-5 py-4 flex flex-col gap-3" style={{ flex: 1 }}>
          {/* Report type */}
          <Field label="Report Type" name="report_type" required>
            <select name="report_type" value={reportType} onChange={handleTypeChange} style={inputStyle()}>
              {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map(t => (
                <option key={t} value={t}>{REPORT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </Field>

          {/* Sample picker with tooltip */}
          <Field label="Sample" name="sample" error={fieldErrors.sample} required>
            <div style={{ position: 'relative' }}>
              <select
                name="sample"
                value={selectedSampleId}
                onChange={handleSampleChange}
                style={inputStyle(fieldErrors.sample)}
              >
                <option value="">— Select a sample —</option>
                {samples.map(s => (
                  <option
                    key={s.id}
                    value={s.id}
                    onMouseEnter={() => setHoveredSampleId(String(s.id))}
                    onMouseLeave={() => setHoveredSampleId(null)}
                  >
                    {s.sample_id} — {s.client_name} ({s.sample_type_name})
                  </option>
                ))}
              </select>
              {/* Tooltip for selected sample */}
              {selectedSampleId && (() => {
                const s = samples.find(x => String(x.id) === selectedSampleId)
                if (!s) return null
                return (
                  <div className="mt-1.5 px-2.5 py-2 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 11 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px', color: '#374151' }}>
                      <span style={{ color: '#9CA3AF' }}>Type</span>       <span>{s.sample_type_name || '—'}</span>
                      <span style={{ color: '#9CA3AF' }}>Collected</span>  <span>{s.collection_date ? new Date(s.collection_date).toLocaleDateString('en-GB') : '—'}</span>
                      <span style={{ color: '#9CA3AF' }}>Status</span>     <span style={{ textTransform: 'capitalize' }}>{s.status}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </Field>

          {/* Title */}
          <Field label="Report Title" name="title" error={fieldErrors.title} required>
            <input
              name="title"
              value={autoTitle}
              onChange={e => { setAutoTitle(e.target.value); setFieldErrors(p => { const n={...p}; delete n.title; return n }) }}
              placeholder="Auto-filled when sample is selected"
              style={inputStyle(fieldErrors.title)}
            />
          </Field>

          {reportType === 'coa' && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <MI name="info" size={13} color="#2563EB" />
              <p style={{ fontSize: 11, color: '#1D4ED8', lineHeight: 1.5 }}>
                A PDF Certificate of Analysis will be generated automatically. You can download or preview it once it&apos;s ready.
              </p>
            </div>
          )}

          {state.message && !state.success && (
            <p className="text-xs" style={{ color: '#DC2626' }}>{state.message}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button
              type="button" onClick={onClose} disabled={pending}
              style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit" disabled={pending}
              className="flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}
            >
              <MI name={pending ? 'hourglass_top' : 'description'} size={13} color="#fff" />
              {pending ? 'Creating…' : 'Create Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.draft
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

// ── Report row ────────────────────────────────────────────────────────────────
function ReportRow({
  report: initial,
  selected,
  onSelect,
  onGenerate,
  onCancel,
  onRegenerate,
  onPreview,
  showToast,
}: {
  report: Report
  selected: boolean
  onSelect: (id: number, checked: boolean) => void
  onGenerate: (id: number) => void
  onCancel: (id: number) => void
  onRegenerate: (id: number) => void
  onPreview: (report: Report) => void
  showToast: (ok: boolean, msg: string) => void
}) {
  const [report, setReport] = useState(initial)
  // Polling starts ONLY when the user explicitly triggers generate/regenerate
  // (those handlers call setPolling(true)). Auto-polling every draft COA on
  // mount made idle drafts flash "Generating…" then "Failed" on page load.
  const [polling, setPolling] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    // report gets its own independent updates from polling below, so this can't be a
    // plain derived value — it needs resyncing whenever a new `initial` prop arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReport(initial)
  }, [initial])

  useEffect(() => {
    if (!polling) return
    // Resets the timeout flag each time polling (re)starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimedOut(false)
    const controller = new AbortController()
    let cancelled = false

    async function finish(refetch: boolean) {
      if (cancelled) return
      if (refetch) {
        const updated = await pollReport(report.id)
        if (!cancelled && updated) setReport(updated)
      }
      if (!cancelled) setPolling(false)
    }

    async function run() {
      try {
        const res = await fetch(`/api/report-status-stream/${report.id}`, { signal: controller.signal })
        if (!res.body) throw new Error('No stream body')
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.trim() || cancelled) continue
            const event = JSON.parse(line) as { type: string; status?: string }
            if (event.type === 'update' && (event.status === 'final' || event.status === 'cancelled' || event.status === 'failed')) {
              await finish(true)
              return
            }
            if (event.type === 'timeout' || event.type === 'error') {
              if (!cancelled) setTimedOut(true)
              await finish(false)
              return
            }
          }
        }
      } catch {
        await finish(true)
      }
    }

    run()
    return () => { cancelled = true; controller.abort() }
  }, [polling, report.id])

  async function handleGenerate() {
    setGenerating(true)
    setTimedOut(false)
    await onGenerate(report.id)
    setPolling(true)
    setGenerating(false)
  }

  async function handleCancel() {
    setCancelling(true)
    await onCancel(report.id)
    setCancelling(false)
  }

  async function handleRegenerate() {
    setGenerating(true)
    setTimedOut(false)
    await onRegenerate(report.id)
    setPolling(true)
    setGenerating(false)
  }

  const displayStatus = polling ? 'generating' : timedOut ? 'failed' : report.status
  const canGenerate = !polling && report.status === 'draft' && report.report_type === 'coa'
  const canCancel   = !polling && (report.status === 'draft' || report.status === 'failed')
  const canRetry    = !polling && (report.status === 'failed' || timedOut) && report.report_type === 'coa'
  const canRegen    = !polling && report.status === 'final' && report.report_type === 'coa'
  const canPreview  = report.status === 'final' && !!report.file

  return (
    <tr style={{ borderBottom: '1px solid #F9FAFB' }} className="hover:bg-gray-50">
      <td className="px-3 py-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={e => onSelect(report.id, e.target.checked)}
          style={{ cursor: 'pointer' }}
        />
      </td>
      <td className="px-3 py-2.5">
        <span className="font-mono text-xs font-semibold" style={{ color: '#0154FC' }}>{report.report_id}</span>
      </td>
      <td className="px-3 py-2.5 text-xs" style={{ color: '#374151' }}>
        {REPORT_TYPE_LABELS[report.report_type] ?? report.report_type}
      </td>
      <td className="px-3 py-2.5">
        <p className="text-xs font-medium" style={{ color: '#111827' }}>{report.title}</p>
        {report.client_name && (
          <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{report.client_name}</p>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          <StatusBadge status={displayStatus} />
          {polling && <MI name="sync" size={12} color="#2563EB" />}
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs" style={{ color: '#9CA3AF' }}>
        {new Date(report.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      </td>
      <td className="px-3 py-2.5">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Primary actions — always left-anchored in this order */}
          {canPreview && (
            <button onClick={() => onPreview(report)} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', border: 'none', cursor: 'pointer' }} title="Preview PDF">
              <MI name="visibility" size={12} color="#1D4ED8" />View
            </button>
          )}
          {canPreview && (
            <a href={`/api/report-download/${report.id}`} download className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: '#DCFCE7', color: '#166534', textDecoration: 'none' }} title="Download PDF">
              <MI name="download" size={12} color="#166534" />PDF
            </a>
          )}
          {canRegen && (
            <button onClick={handleRegenerate} disabled={generating} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: 'none', cursor: 'pointer', opacity: generating ? 0.6 : 1 }} title="Regenerate with latest template">
              <MI name="refresh" size={12} color="#92400E" />Regen
            </button>
          )}
          {canGenerate && !canRetry && (
            <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', border: 'none', cursor: 'pointer', opacity: generating ? 0.6 : 1 }} title="Generate PDF">
              <MI name={generating ? 'hourglass_top' : 'play_arrow'} size={12} color="#1D4ED8" />{generating ? '…' : 'Generate'}
            </button>
          )}
          {canRetry && (
            <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: '#FEE2E2', color: '#991B1B', border: 'none', cursor: 'pointer', opacity: generating ? 0.6 : 1 }} title="Retry generation">
              <MI name="refresh" size={12} color="#991B1B" />Retry
            </button>
          )}
          {polling && <span className="text-xs" style={{ color: '#6B7280' }}>Generating…</span>}
          {/* Cancel — always rightmost, separated by auto margin so it never displaces primary actions */}
          {canCancel && (
            <button onClick={handleCancel} disabled={cancelling} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: cancelling ? 0.5 : 0.6, lineHeight: 1 }} title="Cancel report">
              <MI name="close" size={14} color="#9CA3AF" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function exportToCsv(reports: Report[]) {
  const headers = ['Report ID', 'Type', 'Title', 'Client', 'Status', 'Created', 'Published']
  const rows = reports.map(r => [
    r.report_id,
    REPORT_TYPE_LABELS[r.report_type] ?? r.report_type,
    `"${r.title.replace(/"/g, '""')}"`,
    r.client_name ?? '',
    r.status,
    new Date(r.created_at).toLocaleDateString('en-GB'),
    r.published_at ? new Date(r.published_at).toLocaleDateString('en-GB') : '',
  ])
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Main shell ────────────────────────────────────────────────────────────────
export default function ReportsShell({
  initialReports,
  samples,
  clients,
}: {
  initialReports: Report[]
  samples: LabSample[]
  clients: DjangoClient[]
}) {
  const [reports, setReports]     = useState(initialReports)
  const [showModal, setShowModal] = useState(false)
  const [toast, setToast]         = useState<{ ok: boolean; msg: string } | null>(null)
  const [previewReport, setPreviewReport] = useState<Report | null>(null)
  const [selected, setSelected]   = useState<Set<number>>(new Set())
  const [bulkWorking, setBulkWorking] = useState(false)

  // Filters
  const [filterStatus, setFilterStatus] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterType,   setFilterType]   = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo,   setFilterDateTo]   = useState('')

  // Keyboard shortcut: N = open new report modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.shiftKey && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).tagName !== 'SELECT') {
        setShowModal(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 5000)
  }

  function handleCreated(report: Report) {
    setReports(prev => [report, ...prev])
    showToast(true, `Report ${report.report_id} created. PDF is generating…`)
  }

  const handleGenerate = useCallback(async (id: number) => {
    const res = await triggerGenerate(id)
    if (!res.ok) showToast(false, res.message)
  }, [])

  const handleCancel = useCallback(async (id: number) => {
    const res = await cancelReport(id)
    if (res.ok && res.report) {
      setReports(prev => prev.map(r => r.id === id ? res.report! : r))
      showToast(true, 'Report cancelled.')
    } else {
      showToast(false, res.message ?? 'Failed to cancel.')
    }
  }, [])

  const handleRegenerate = useCallback(async (id: number) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'draft' as const, file: null } : r))
    const res = await regenerateReport(id)
    if (!res.ok) showToast(false, res.message)
  }, [])

  function handleSelect(id: number, checked: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  // Filter logic
  const filtered = reports.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false
    if (filterClient && String(r.client_id) !== filterClient) return false
    if (filterType   && r.report_type !== filterType)   return false
    if (filterSearch) {
      const q = filterSearch.toLowerCase()
      if (!r.report_id.toLowerCase().includes(q) && !r.title.toLowerCase().includes(q)) return false
    }
    if (filterDateFrom && new Date(r.created_at) < new Date(filterDateFrom)) return false
    if (filterDateTo   && new Date(r.created_at) > new Date(filterDateTo + 'T23:59:59')) return false
    return true
  })

  // Bulk generate: only draft/failed COA reports
  const bulkEligible = Array.from(selected).filter(id => {
    const r = reports.find(x => x.id === id)
    return r && r.report_type === 'coa' && (r.status === 'draft' || r.status === 'failed')
  })

  async function handleBulkGenerate() {
    if (!bulkEligible.length) return
    setBulkWorking(true)
    const { failed } = await bulkGenerateReports(bulkEligible)
    if (failed.length) showToast(false, `${failed.length} report(s) failed to start.`)
    else showToast(true, `${bulkEligible.length} report(s) queued for generation.`)
    setSelected(new Set())
    setBulkWorking(false)
  }

  const coaCount   = reports.filter(r => r.report_type === 'coa').length
  const finalCount = reports.filter(r => r.status === 'final').length
  const draftCount = reports.filter(r => r.status === 'draft').length

  const hasFilters = filterStatus || filterClient || filterType || filterSearch || filterDateFrom || filterDateTo
  const inputBase: React.CSSProperties = { fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', outline: 'none' }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* PDF Viewer */}
      {previewReport && (
        <PdfViewer
          reportId={previewReport.id}
          title={previewReport.title}
          onClose={() => setPreviewReport(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4" style={{ flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Reports</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Generate and manage laboratory reports and Certificates of Analysis</p>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <button
              onClick={() => exportToCsv(filtered)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', color: '#374151', cursor: 'pointer' }}
              title="Export visible rows to CSV"
            >
              <MI name="download" size={14} color="#6B7280" />
              Export CSV
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#0154FC' }}
            title="New report (N)"
          >
            <MI name="add" size={15} color="#fff" />
            New Report
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4" style={{ flexShrink: 0 }}>
        {[
          { label: 'Total Reports', value: reports.length, icon: 'description',  bg: '#DBEAFE', color: '#1D4ED8' },
          { label: 'COA Reports',   value: coaCount,       icon: 'verified',     bg: '#DCFCE7', color: '#166534' },
          { label: 'Published',     value: finalCount,     icon: 'check_circle', bg: '#F0FDF4', color: '#15803D' },
          { label: 'Pending',       value: draftCount,     icon: 'hourglass_top',bg: '#FEF9C3', color: '#854D0E' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl px-4 py-3 flex items-center gap-3" style={{ border: '1px solid #E8EAF2' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: stat.bg }}>
              <MI name={stat.icon} size={18} color={stat.color} />
            </div>
            <div>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{stat.value}</p>
              <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-xl px-4 py-3 mb-3 flex flex-wrap items-center gap-2" style={{ border: '1px solid #E8EAF2', flexShrink: 0 }}>
        <MI name="search" size={16} color="#9CA3AF" />
        <input
          type="text"
          placeholder="Search by ID or title…"
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          style={{ ...inputBase, minWidth: 180 }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputBase}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_STYLES).filter(([k]) => k !== 'generating').map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={inputBase}>
          <option value="">All types</option>
          {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map(t => (
            <option key={t} value={t}>{REPORT_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={inputBase}>
          <option value="">All clients</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>From</span>
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ ...inputBase, fontSize: 11 }} />
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>To</span>
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ ...inputBase, fontSize: 11 }} />
        </div>
        {hasFilters && (
          <button
            onClick={() => { setFilterStatus(''); setFilterClient(''); setFilterType(''); setFilterSearch(''); setFilterDateFrom(''); setFilterDateTo('') }}
            className="flex items-center gap-1 text-xs"
            style={{ color: '#6B7280', cursor: 'pointer', background: 'none', border: 'none', padding: '4px 6px', borderRadius: 6 }}
          >
            <MI name="close" size={13} color="#6B7280" />
            Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF' }}>
          {filtered.length} of {reports.length}
        </span>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{
            backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2',
            border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`,
            color: toast.ok ? '#0154FC' : '#991B1B',
            flexShrink: 0,
          }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#1D4ED8', fontWeight: 600 }}>{selected.size} selected</span>
          <button
            onClick={handleBulkGenerate}
            disabled={bulkWorking || bulkEligible.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: bulkEligible.length ? '#0154FC' : '#E5E7EB', color: bulkEligible.length ? '#fff' : '#9CA3AF', border: 'none', cursor: bulkEligible.length ? 'pointer' : 'not-allowed', opacity: bulkWorking ? 0.7 : 1 }}
            title={bulkEligible.length === 0 ? 'No eligible COA reports selected' : `Generate ${bulkEligible.length} COA report(s)`}
          >
            <MI name={bulkWorking ? 'hourglass_top' : 'play_arrow'} size={13} color={bulkEligible.length ? '#fff' : '#9CA3AF'} />
            {bulkWorking ? 'Starting…' : `Generate ${bulkEligible.length} COA`}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs"
            style={{ color: '#6B7280', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <NewReportModal
          samples={samples}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-16" style={{ border: '1px solid #E8EAF2' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#EFF6FF' }}>
            <MI name={hasFilters ? 'filter_list_off' : 'description'} size={28} color="#93C5FD" />
          </div>
          <p className="text-sm font-semibold" style={{ color: '#374151' }}>{hasFilters ? 'No reports match your filters' : 'No reports yet'}</p>
          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
            {hasFilters ? 'Try adjusting the filters above' : 'Generate your first Certificate of Analysis to get started'}
          </p>
          {!hasFilters && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: '#0154FC' }}
            >
              <MI name="add" size={13} color="#fff" />
              New Report
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '18%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={e => setSelected(e.target.checked ? new Set(filtered.map(r => r.id)) : new Set())}
                  />
                </th>
                {['Report ID', 'Type', 'Title / Client', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide"
                    style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <ReportRow
                  key={r.id}
                  report={r}
                  selected={selected.has(r.id)}
                  onSelect={handleSelect}
                  onGenerate={handleGenerate}
                  onCancel={handleCancel}
                  onRegenerate={handleRegenerate}
                  onPreview={setPreviewReport}
                  showToast={showToast}
                />
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 flex items-center justify-between" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{filtered.length} report{filtered.length !== 1 ? 's' : ''}</p>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>Press <kbd style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>N</kbd> to create a new report</p>
            {draftCount > 0 && (
              <p style={{ fontSize: 10, color: '#D97706' }}>
                <MI name="hourglass_top" size={11} color="#D97706" /> {draftCount} pending generation
              </p>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

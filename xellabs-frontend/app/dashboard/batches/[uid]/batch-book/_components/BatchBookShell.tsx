'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb, PageHeader } from '@/app/dashboard/_components/ui'
import { exportRowsToCsv } from '@/app/lib/exportCsv'
import type { SenaiteBatch, SenaiteSample, SenaiteAnalysisFull } from '@/app/lib/senaite'
import { getBatchBookAnalyses, saveBatchBookResult } from '@/app/actions/batches'
import DataTable, { type DataTableColumn } from '@/app/dashboard/_components/DataTable'

// DataTable's own row key must be `id` — alias SenaiteSample's uid there and
// keep the human-readable sample code separately (same pattern already used
// by BatchDetailShell's own sample table).
type BatchBookRow = SenaiteSample & { id: string; sampleCode: string }

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Matches SENAITE's own Batch Book exactly: one row per sample, one column
// per distinct analysis service requested anywhere in the batch, an editable
// cell per sample×service that HAS that service. "Please note that
// submitting the results for verification is only possible within samples
// or worksheets" — Save here only writes the raw value (saveAnalysisResult,
// no workflow transition), never submits.
export default function BatchBookShell({ batch, samples }: {
  batch: SenaiteBatch
  samples: SenaiteSample[]
}) {
  const router = useRouter()
  const backHref = `/dashboard/batches/${batch.uid}`
  const [loading, setLoading] = useState(true)
  const [analyses, setAnalyses] = useState<SenaiteAnalysisFull[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getBatchBookAnalyses(batch.uid).then(list => {
      if (cancelled) return
      setAnalyses(list)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [batch.uid])

  // Columns = every distinct service (by Keyword) present anywhere in the batch.
  const services = useMemo(() => {
    const seen = new Map<string, string>()
    for (const a of analyses) if (!seen.has(a.Keyword)) seen.set(a.Keyword, a.title || a.Keyword)
    return Array.from(seen.entries()).map(([keyword, title]) => ({ keyword, title }))
  }, [analyses])

  // sampleId -> keyword -> analysis, so each cell can find its own uid/unit.
  const bySampleAndService = useMemo(() => {
    const map = new Map<string, Map<string, SenaiteAnalysisFull>>()
    for (const a of analyses) {
      if (!map.has(a.sampleId)) map.set(a.sampleId, new Map())
      map.get(a.sampleId)!.set(a.Keyword, a)
    }
    return map
  }, [analyses])

  function cellValue(a: SenaiteAnalysisFull) {
    return values[a.uid] ?? a.Result ?? ''
  }

  const rows: BatchBookRow[] = samples.map(s => ({ ...s, id: s.uid, sampleCode: s.id }))
  // Sample/Sample Type/Date Sampled/State are read-only display columns; only
  // the per-service result cells (one per distinct analysis in the batch) are
  // editable — matches SENAITE's own Batch Book exactly.
  const columns: DataTableColumn<BatchBookRow>[] = [
    {
      id: 'sampleCode', label: 'Sample', sortable: true, minWidth: 110,
      render: row => <span className="text-xs font-mono font-semibold" style={{ color: '#2563EB' }}>{row.sampleCode || row.title}</span>,
    },
    { id: 'SampleTypeTitle', label: 'Sample Type', sortable: true, minWidth: 110, render: row => <span className="text-xs" style={{ color: '#374151' }}>{row.SampleTypeTitle || '—'}</span> },
    { id: 'DateSampled', label: 'Date Sampled', sortable: true, minWidth: 110, render: row => <span className="text-xs" style={{ color: '#374151' }}>{fmtDate(row.DateSampled)}</span> },
    { id: 'review_state', label: 'State', sortable: true, minWidth: 100, render: row => <span className="text-xs" style={{ color: '#374151' }}>{row.review_state}</span> },
    ...services.map(svc => ({
      id: svc.keyword, label: svc.title, minWidth: 110,
      render: (row: BatchBookRow) => {
        const a = bySampleAndService.get(row.sampleCode)?.get(svc.keyword)
        if (!a) return null
        return (
          <input
            value={cellValue(a)}
            onChange={e => setValues(prev => ({ ...prev, [a.uid]: e.target.value }))}
            className="text-xs rounded outline-none"
            style={{ border: '1px solid #D1D5DB', padding: '5px 8px', width: 90 }}
          />
        )
      },
    })),
  ]

  async function handleSave() {
    const changed = analyses.filter(a => values[a.uid] !== undefined && values[a.uid] !== (a.Result ?? ''))
    if (changed.length === 0) { router.push(backHref); return }
    setSaving(true)
    const outcomes = await Promise.all(changed.map(a => saveBatchBookResult(a.uid, values[a.uid])))
    const failed = outcomes.filter(o => !o.success)
    setSaving(false)
    if (failed.length > 0) {
      setToast({ ok: false, msg: `${failed.length} of ${changed.length} value(s) failed to save: ${failed[0].message ?? ''}` })
      setTimeout(() => setToast(null), 5000)
    } else {
      router.push(backHref)
      router.refresh()
    }
  }

  function handleExport() {
    exportRowsToCsv(
      [
        { key: 'sample', label: 'Sample' },
        { key: 'sampleType', label: 'Sample Type' },
        { key: 'dateSampled', label: 'Date Sampled' },
        { key: 'state', label: 'State' },
        ...services.map(s => ({ key: s.keyword, label: s.title })),
      ],
      samples.map(s => {
        const row: Record<string, string> = {
          sample: s.id || s.title, sampleType: s.SampleTypeTitle, dateSampled: fmtDate(s.DateSampled), state: s.review_state,
        }
        for (const svc of services) {
          const a = bySampleAndService.get(s.id)?.get(svc.keyword)
          row[svc.keyword] = a ? cellValue(a) : ''
        }
        return row
      }),
      `batch-book-${batch.id}`,
    )
  }

  return (
    <div style={{ padding: 24, backgroundColor: '#F7F8FC', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <Breadcrumb items={[
        { label: 'Batches', href: '/dashboard/batches' },
        { label: `View Batch (${batch.id})`, href: backHref },
        { label: 'Batch Book' },
      ]} />

      <PageHeader
        title={
          <span>
            Batch Book <span style={{ fontWeight: 400, color: '#6B7280', margin: '0 4px' }}>•</span> <span style={{ fontWeight: 500, color: '#0154FC' }}>{batch.title}</span>
          </span>
        }
        subtitle="Introduce analysis results for all samples in this batch. Submitting results for verification is only possible within samples or worksheets."
        backHref={backHref}
        right={
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ color: '#374151', border: '1px solid #D1D5DB', backgroundColor: '#fff' }}>
            <MI name="download" size={15} color="#374151" /> Export
          </button>
        }
      />

      {toast && (
        <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', flexShrink: 0 }}>
          {toast.msg}
        </div>
      )}

      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: 1, overflow: 'auto', padding: loading ? 0 : 12 }}>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <p style={{ fontSize: 12, color: '#374151' }}>Loading batch book…</p>
            </div>
          ) : (
            <DataTable<BatchBookRow>
              data={rows}
              columns={columns}
              searchable
              bare
              paginated={false}
              persistKey="batch-book"
              emptyMessage="No samples in batch."
            />
          )}
        </div>

        <div className="px-4 py-3 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#fff', flexShrink: 0 }}>
          <button onClick={() => router.push(backHref)} disabled={saving} style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || loading}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

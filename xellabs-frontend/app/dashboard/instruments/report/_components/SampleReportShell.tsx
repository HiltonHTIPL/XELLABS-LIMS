'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { getSampleReport, type SampleReport } from '@/app/actions/instrument-import'
import {
  PageHeader, Card, Btn, StatusChip, Chip, EmptyState, MI, T,
  thStyle, tdStyle, inputStyle,
} from '@/app/dashboard/_components/ui'

function fmtDate(d: string | null | undefined, withTime = false) {
  if (!d) return '-'
  const date = new Date(d)
  return withTime ? date.toLocaleString() : date.toLocaleDateString()
}

const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  #instrument-report, #instrument-report * { visibility: visible !important; }
  #instrument-report { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
  .no-print { display: none !important; }
}`

function HeaderRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>{label}</p>
      <p style={{ fontSize: 13.5, fontWeight: 600, color: T.heading }}>{value || '-'}</p>
    </div>
  )
}

function ReportBody({ report }: { report: SampleReport }) {
  const multi = report.instruments.length >= 2
  return (
    <div id="instrument-report">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: T.heading }}>Sample {report.sample.sample_id}</h2>
          <p style={{ fontSize: 12.5, color: T.muted }}>Multi-instrument result report</p>
        </div>
        <div className="text-right">
          <StatusChip status={report.sample.status} />
          <p style={{ fontSize: 11, color: T.faint, marginTop: 4 }}>Generated {fmtDate(report.generated_at, true)}</p>
        </div>
      </div>

      {multi && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs mb-4"
          style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: T.primary }}>
          <MI name="hub" size={16} color={T.primary} />
          <span>
            Results from <strong>{report.instruments.length} instruments</strong> are combined on this sample record.
            Instrument provenance comes from the backed-up import files.
          </span>
        </div>
      )}

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 14 }}>
        <HeaderRow label="Client" value={report.sample.client_name} />
        <HeaderRow label="Sample Type" value={report.sample.sample_type} />
        <HeaderRow label="Collected" value={fmtDate(report.sample.collection_date)} />
        <HeaderRow label="Received" value={fmtDate(report.sample.received_date)} />
      </div>

      {report.instruments.length > 0 && (
        <div className="mb-4">
          <p style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 8 }}>
            Contributing instruments ({report.instruments.length})
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {report.instruments.map(inst => (
              <Chip key={inst.code} tone="blue">
                {inst.name} ({inst.code}){inst.method ? ` · ${inst.method}` : ''}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {report.results.length === 0 ? (
        <EmptyState icon="science" title="No results yet" sub="This sample has no recorded results" />
      ) : (
        <div style={{ overflowX: 'auto', border: `1px solid ${T.cardBorder}`, borderRadius: 12 }}>
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Test', 'Method', 'Result', 'Unit', 'Status', 'Instrument', 'Imported'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.results.map((r, i) => (
                <tr key={`${r.test_code}-${i}`}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600, color: T.heading }}>{r.test_name}</span>
                    <span style={{ color: T.faint, fontSize: 11.5, marginLeft: 6 }}>{r.test_code}</span>
                  </td>
                  <td style={tdStyle}>{r.method || '-'}</td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 700, color: r.is_out_of_range ? T.danger : T.text }}>{r.value || '-'}</span>
                    {r.is_out_of_range && <span style={{ color: T.danger, fontSize: 11, marginLeft: 6 }}>out of range</span>}
                  </td>
                  <td style={tdStyle}>{r.unit || '-'}</td>
                  <td style={tdStyle}><StatusChip status={r.result_status} /></td>
                  <td style={tdStyle}>
                    {r.source === 'instrument' ? (
                      <span style={{ color: T.text }}>{r.instrument_name} <span style={{ color: T.faint, fontSize: 11.5 }}>({r.instrument_code})</span></span>
                    ) : (
                      <span style={{ color: T.faint }}>Manual entry</span>
                    )}
                  </td>
                  <td style={tdStyle}>{r.source === 'instrument' ? fmtDate(r.import_date) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function SampleReportShell({ initialSampleId }: { initialSampleId: string }) {
  const [sampleId, setSampleId] = useState(initialSampleId)
  const [report, setReport] = useState<SampleReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()
  const autoLoaded = useRef(false)

  function load(id: string) {
    setError(null)
    startTransition(async () => {
      const r = await getSampleReport(id)
      if (!r.ok || !r.report) { setReport(null); setError(r.message ?? 'Report could not be loaded.'); return }
      setReport(r.report)
    })
  }

  useEffect(() => {
    if (initialSampleId && !autoLoaded.current) {
      autoLoaded.current = true
      load(initialSampleId)
    }
  }, [initialSampleId])

  return (
    <div style={{ padding: 20, backgroundColor: T.pageBg, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{PRINT_CSS}</style>
      <div className="no-print" style={{ flexShrink: 0 }}>
        <PageHeader
          title="Multi-Instrument Sample Report"
          subtitle="One printable report for a sample: every result across instruments, with source instrument and import date per row."
          right={(
            <div className="flex items-center gap-2">
              <Link href="/dashboard/instruments/import" style={{ textDecoration: 'none' }}>
                <Btn variant="outline" icon="upload_file">Import results</Btn>
              </Link>
              {report ? <Btn variant="outline" icon="print" onClick={() => window.print()}>Print report</Btn> : null}
            </div>
          )}
        />

        <Card className="mb-5">
          <form className="flex items-end gap-3 flex-wrap" onSubmit={e => { e.preventDefault(); if (sampleId.trim()) load(sampleId) }}>
            <div style={{ flex: '1 1 240px' }}>
              <label className="block mb-1.5" style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Sample ID</label>
              <input value={sampleId} onChange={e => setSampleId(e.target.value)} placeholder="e.g. WS-0001" style={{ ...inputStyle, width: '100%' }} />
            </div>
            <Btn variant="primary" icon={busy ? 'hourglass_top' : 'search'} disabled={busy || !sampleId.trim()}>
              {busy ? 'Loading…' : 'Load report'}
            </Btn>
          </form>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs mt-3"
              style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
              <MI name="error" size={14} color="#DC2626" /> {error}
            </div>
          )}
        </Card>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {busy && !report && (
          <Card><div className="flex items-center gap-2" style={{ color: T.muted, fontSize: 13 }}>
            <MI name="hourglass_top" size={16} color={T.muted} /> Loading report…
          </div></Card>
        )}

        {report && (
          <Card><ReportBody report={report} /></Card>
        )}

        {!report && !busy && !error && (
          <Card><EmptyState icon="summarize" title="Enter a sample ID" sub="Load a sample to see all instrument results in one report" /></Card>
        )}
      </div>
    </div>
  )
}

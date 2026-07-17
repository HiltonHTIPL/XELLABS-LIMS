'use client'
import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  previewImport, commitImport,
  type PreviewResult, type CommitResult,
} from '@/app/actions/instrument-import'
import type { InstrumentOption, InstrumentResultImport } from '@/app/actions/instrument-maintenance'
import {
  PageHeader, Card, Btn, Field, MI, T, selectStyle,
} from '@/app/dashboard/_components/ui'
import ImportPreviewTable from '@/app/dashboard/_components/ImportPreviewTable'
import ImportHistory from './ImportHistory'

type Step = 'select' | 'preview' | 'done'
type Fmt = 'csv' | 'xml'

function Banner({ tone, children }: { tone: 'error' | 'info'; children: React.ReactNode }) {
  const err = tone === 'error'
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-3"
      style={{ backgroundColor: err ? '#FEF2F2' : '#EFF6FF', border: `1px solid ${err ? '#FECACA' : '#BFDBFE'}`, color: err ? '#991B1B' : T.primary }}>
      <MI name={err ? 'error' : 'info'} size={14} color={err ? '#DC2626' : T.primary} />
      {children}
    </div>
  )
}

function Dropzone({ file, dragOver, onPick, onDrag, onDrop }: {
  file: File | null; dragOver: boolean
  onPick: () => void
  onDrag: (over: boolean) => void
  onDrop: (e: React.DragEvent) => void
}) {
  return (
    <button type="button" onClick={onPick}
      onDragOver={e => { e.preventDefault(); onDrag(true) }}
      onDragLeave={() => onDrag(false)}
      onDrop={onDrop}
      className="w-full flex flex-col items-center justify-center gap-2 text-center"
      style={{
        border: `2px dashed ${dragOver ? T.primary : T.inputBorder}`,
        backgroundColor: dragOver ? '#EFF6FF' : '#FAFBFE',
        borderRadius: 12, padding: '28px 16px', cursor: 'pointer',
      }}>
      <div className="flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF' }}>
        <MI name={file ? 'description' : 'upload_file'} size={22} color={T.primary} />
      </div>
      {file ? (
        <p style={{ fontSize: 13.5, fontWeight: 700, color: T.heading }}>{file.name}</p>
      ) : (
        <>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: T.heading }}>Drop a result file here</p>
          <p style={{ fontSize: 12, color: T.faint }}>or click to browse. CSV and XML instrument exports are supported.</p>
        </>
      )}
    </button>
  )
}

export default function InstrumentImportShell({ instruments, history }: {
  instruments: InstrumentOption[]; history: InstrumentResultImport[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('select')
  const [instrument, setInstrument] = useState('')
  const [fileFormat, setFileFormat] = useState<Fmt>('csv')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [commitRes, setCommitRes] = useState<CommitResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  function acceptFile(f: File | null) {
    if (!f) return
    setFile(f)
    setError(null)
    if (f.name.toLowerCase().endsWith('.xml')) setFileFormat('xml')
    else if (f.name.toLowerCase().endsWith('.csv')) setFileFormat('csv')
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    acceptFile(e.dataTransfer.files?.[0] ?? null)
  }

  function buildForm(): FormData {
    const fd = new FormData()
    if (file) fd.append('file', file)
    fd.append('file_format', fileFormat)
    fd.append('instrument', instrument)
    return fd
  }

  function runPreview() {
    if (!instrument) { setError('Select the instrument that produced this file.'); return }
    if (!file) { setError('Choose a result file to import.'); return }
    setError(null)
    startTransition(async () => {
      const r = await previewImport(buildForm())
      if (!r.ok) { setError(r.message ?? 'Preview failed.'); return }
      setPreview(r)
      setStep('preview')
    })
  }

  function runCommit() {
    setError(null)
    startTransition(async () => {
      const r = await commitImport(buildForm())
      if (!r.ok) { setError(r.message ?? 'Import failed.'); return }
      setCommitRes(r)
      setStep('done')
      router.refresh()
    })
  }

  function reset() {
    setStep('select')
    setFile(null)
    setPreview(null)
    setCommitRes(null)
    setError(null)
    setInstrument('')
  }

  const validCount = preview?.summary?.valid ?? 0

  return (
    <div style={{ padding: 20, backgroundColor: T.pageBg, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0 }}>
      <PageHeader
        title="Import Instrument Results"
        subtitle="Upload an instrument export, map rows to sample records, then commit. The original file is stored as the backup of record."
        right={<Link href="/dashboard/instruments/report" style={{ textDecoration: 'none' }}><Btn variant="outline" icon="summarize">Multi-Instrument Report</Btn></Link>}
      />

      {error && <Banner tone="error">{error}</Banner>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

      {step === 'select' && (
        <>
          <Card title="File format" icon="description" className="mb-4">
            <p style={{ fontSize: 13, color: T.text, marginBottom: 10 }}>
              CSV columns (required): <code style={{ fontWeight: 700 }}>sample_id</code>,{' '}
              <code style={{ fontWeight: 700 }}>test_code</code>,{' '}
              <code style={{ fontWeight: 700 }}>value</code>. Optional: <code>unit</code>, <code>flags</code>.
              Each row needs an open worksheet assignment for that sample and test.
            </p>
            <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 12 }}>
              Demo tip: import twice with different instruments (use the A and B templates), then open the multi-instrument report for the same sample ID.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <a href="/demo/tc6-instrument-a.csv" download style={{ textDecoration: 'none' }}>
                <Btn variant="outline" icon="download">Template A (instrument 1)</Btn>
              </a>
              <a href="/demo/tc6-instrument-b.csv" download style={{ textDecoration: 'none' }}>
                <Btn variant="outline" icon="download">Template B (instrument 2)</Btn>
              </a>
            </div>
          </Card>

          <Card title="Upload result file" icon="upload_file">
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <Field label="Instrument" required>
                <select value={instrument} onChange={e => setInstrument(e.target.value)} style={selectStyle}>
                  <option value="" disabled>Select instrument…</option>
                  <optgroup label="Usable">
                    {instruments.filter(i => i.is_usable || i.usability === 'valid').map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.instrument_id})</option>
                    ))}
                  </optgroup>
                  {instruments.some(i => !(i.is_usable || i.usability === 'valid')) && (
                    <optgroup label="Not currently usable">
                      {instruments.filter(i => !(i.is_usable || i.usability === 'valid')).map(i => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.instrument_id}) — {i.usability ?? i.status ?? 'unavailable'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {(() => {
                  const chosen = instruments.find(i => String(i.id) === instrument)
                  if (!chosen || chosen.is_usable || chosen.usability === 'valid') return null
                  return (
                    <p style={{ fontSize: 11, color: '#D97706', marginTop: 6 }}>
                      This instrument is not currently usable ({chosen.usability ?? chosen.status}). You can continue, but results may be flagged.
                    </p>
                  )
                })()}
              </Field>
              <Field label="File Format" required>
                <select value={fileFormat} onChange={e => setFileFormat(e.target.value as Fmt)} style={selectStyle}>
                  <option value="csv">CSV</option>
                  <option value="xml">XML</option>
                </select>
              </Field>
            </div>
            <div className="mt-3">
              <Dropzone file={file} dragOver={dragOver} onPick={() => inputRef.current?.click()} onDrag={setDragOver} onDrop={onDrop} />
              <input ref={inputRef} type="file" accept=".csv,.xml,text/csv,application/xml,text/xml" className="hidden"
                onChange={e => acceptFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <Btn variant="primary" icon={busy ? 'hourglass_top' : 'preview'} disabled={busy} onClick={runPreview}>
                {busy ? 'Reading file…' : 'Preview import'}
              </Btn>
            </div>
          </Card>
        </>
      )}

      {step === 'preview' && preview?.summary && preview.rows && (
        <Card title="Review mapping" icon="fact_check"
          action={<span style={{ fontSize: 12, color: T.muted }}>{file?.name}</span>}>
          <ImportPreviewTable rows={preview.rows} summary={preview.summary} />
          <div className="flex items-center justify-between gap-2 mt-4">
            <Btn variant="ghost" icon="arrow_back" disabled={busy} onClick={() => setStep('select')}>Back</Btn>
            <Btn variant="primary" icon={busy ? 'hourglass_top' : 'check'} disabled={busy || validCount === 0} onClick={runCommit}>
              {busy ? 'Applying…' : `Confirm import (${validCount})`}
            </Btn>
          </div>
          {validCount === 0 && (
            <div className="mt-3"><Banner tone="info">No rows are ready to import. Fix the file or check that matching samples have open worksheet assignments.</Banner></div>
          )}
        </Card>
      )}

      {step === 'done' && commitRes && (
        <Card title="Import complete" icon="task_alt">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="inline-flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 700, color: T.success }}>
              <MI name="check_circle" size={18} color={T.success} />
              {(commitRes.created ?? 0) + (commitRes.updated ?? 0)} results written to sample records
            </span>
          </div>
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            {[
              { label: 'Created', value: commitRes.created ?? 0 },
              { label: 'Updated', value: commitRes.updated ?? 0 },
              { label: 'Skipped', value: commitRes.skipped ?? 0 },
              { label: 'Errors', value: commitRes.errors ?? 0 },
            ].map(s => (
              <div key={s.label} style={{ border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>{s.label}</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: T.heading }}>{s.value}</p>
              </div>
            ))}
          </div>
          {(commitRes.sample_ids?.length ?? 0) > 0 && (
            <div className="mb-4">
              <p style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 8 }}>Affected samples</p>
              <div className="flex items-center gap-2 flex-wrap">
                {commitRes.sample_ids!.map(sid => (
                  <Link key={sid} href={`/dashboard/instruments/report?sample_id=${encodeURIComponent(sid)}`}
                    className="inline-flex items-center gap-1.5 hover:underline"
                    style={{ color: T.primary, fontSize: 13, fontWeight: 600, border: `1px solid ${T.inputBorder}`, borderRadius: 8, padding: '5px 10px' }}>
                    <MI name="open_in_new" size={14} color={T.primary} /> {sid}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {(commitRes.sample_ids?.length ?? 0) === 1 && (
              <Link href={`/dashboard/instruments/report?sample_id=${encodeURIComponent(commitRes.sample_ids![0])}`}
                style={{ textDecoration: 'none' }}>
                <Btn variant="primary" icon="summarize">Open multi-instrument report</Btn>
              </Link>
            )}
            <Btn variant="outline" icon="restart_alt" onClick={reset}>Import another file</Btn>
          </div>
        </Card>
      )}

      <div className="mt-5">
        <Card title="Import history" icon="history">
          <ImportHistory imports={history} instruments={instruments} />
        </Card>
      </div>
      </div>
    </div>
  )
}

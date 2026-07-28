'use client'
import { useRef, useState, useTransition } from 'react'
import {
  previewResultImport, commitResultImport,
  type QualityPreviewRow, type QualityCommitResult,
} from '@/app/actions/quality-result-import'
import type { PreviewSummary } from '@/app/actions/instrument-import'
import { Card, Btn, MI, T } from '@/app/dashboard/_components/ui'
import ImportPreviewTable from '@/app/dashboard/_components/ImportPreviewTable'

type Step = 'select' | 'preview' | 'done'

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-3"
      style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
      <MI name="error" size={14} color="#DC2626" />
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
          <p style={{ fontSize: 13.5, fontWeight: 700, color: T.heading }}>Drop a results CSV here</p>
          <p style={{ fontSize: 12, color: T.faint }}>or click to browse.</p>
        </>
      )}
    </button>
  )
}

export default function QualityResultImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('select')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [rows, setRows] = useState<QualityPreviewRow[] | null>(null)
  const [summary, setSummary] = useState<PreviewSummary | null>(null)
  const [commitRes, setCommitRes] = useState<QualityCommitResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  function acceptFile(f: File | null) {
    if (!f) return
    setFile(f)
    setError(null)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    acceptFile(e.dataTransfer.files?.[0] ?? null)
  }

  function runPreview() {
    if (!file) { setError('Choose a results CSV to import.'); return }
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('file', file)
      const r = await previewResultImport(fd)
      if (!r.ok || !r.rows || !r.summary) { setError(r.message ?? 'Preview failed.'); return }
      setRows(r.rows)
      setSummary(r.summary)
      setStep('preview')
    })
  }

  function runCommit() {
    if (!rows) return
    setError(null)
    startTransition(async () => {
      const r = await commitResultImport(rows)
      if (!r.ok) { setError(r.message ?? 'Import failed.'); return }
      setCommitRes(r)
      setStep('done')
    })
  }

  function reset() {
    setStep('select')
    setFile(null)
    setRows(null)
    setSummary(null)
    setCommitRes(null)
    setError(null)
  }

  const validCount = summary?.valid ?? 0

  return (
    <div>
      {error && <Banner>{error}</Banner>}

      {step === 'select' && (
        <Card title="Upload results file" icon="upload_file">
          <p style={{ fontSize: 13, color: T.text, marginBottom: 10 }}>
            CSV columns (required): <code style={{ fontWeight: 700 }}>sample_id</code>,{' '}
            <code style={{ fontWeight: 700 }}>test_code</code>,{' '}
            <code style={{ fontWeight: 700 }}>value</code>. Optional: <code>unit</code>, <code>flags</code>.{' '}
            <code>test_code</code> must match an Analysis Service Keyword. Results write directly to SENAITE,
            so they appear immediately in Sample Detail, Worksheets, and Reports.
          </p>
          <div className="mt-3">
            <Dropzone file={file} dragOver={dragOver} onPick={() => inputRef.current?.click()} onDrag={setDragOver} onDrop={onDrop} />
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={e => acceptFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex items-center justify-end gap-2 mt-4">
            <Btn variant="primary" icon={busy ? 'hourglass_top' : 'preview'} disabled={busy} onClick={runPreview}>
              {busy ? 'Reading file…' : 'Preview import'}
            </Btn>
          </div>
        </Card>
      )}

      {step === 'preview' && rows && summary && (
        <Card title="Review mapping" icon="fact_check"
          action={<span style={{ fontSize: 12, color: T.muted }}>{file?.name}</span>}>
          <ImportPreviewTable rows={rows} summary={summary} />
          <div className="flex items-center justify-between gap-2 mt-4">
            <Btn variant="ghost" icon="arrow_back" disabled={busy} onClick={() => setStep('select')}>Back</Btn>
            <Btn variant="primary" icon={busy ? 'hourglass_top' : 'check'} disabled={busy || validCount === 0} onClick={runCommit}>
              {busy ? 'Submitting…' : `Confirm import (${validCount})`}
            </Btn>
          </div>
          {validCount === 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: T.primary }}>
                <MI name="info" size={14} color={T.primary} />
                No rows are ready to import. Check that sample_id/test_code match a live sample and Analysis Service Keyword.
              </div>
            </div>
          )}
        </Card>
      )}

      {step === 'done' && commitRes && (
        <Card title="Import complete" icon="task_alt">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="inline-flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 700, color: T.success }}>
              <MI name="check_circle" size={18} color={T.success} />
              {commitRes.updated ?? 0} results submitted to SENAITE
            </span>
          </div>
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            {[
              { label: 'Submitted', value: commitRes.updated ?? 0 },
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
                  <span key={sid} className="inline-flex items-center gap-1.5"
                    style={{ color: T.text, fontSize: 13, fontWeight: 600, border: `1px solid ${T.inputBorder}`, borderRadius: 8, padding: '5px 10px' }}>
                    <MI name="science" size={14} color={T.primary} /> {sid}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
                Search for these Sample IDs on Samples Overview to view the updated results.
              </p>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <Btn variant="outline" icon="restart_alt" onClick={reset}>Import another file</Btn>
          </div>
        </Card>
      )}
    </div>
  )
}

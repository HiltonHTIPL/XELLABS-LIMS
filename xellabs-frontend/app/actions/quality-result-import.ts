'use server'
import { fetchAllAnalyses, submitAnalysisResult } from '@/app/lib/senaite'
import { serverToken } from '@/app/lib/senaite-auth'
import { parseDictCsv } from '@/app/lib/csv'
import type { PreviewRow, PreviewSummary } from './instrument-import'

// Bulk sample-results import for the Quality section — writes straight to
// SENAITE (submitAnalysisResult, the same call the live Worksheets/Batches
// UI already uses), unlike Instrument Result Import which writes to the
// Django Result/WorksheetAssignment mirror. Row shape matches both that
// feature's CSV convention AND SENAITE's own native results importer
// (Sample ID + Analysis Service Keyword + Result value) — confirmed via
// senaite.core's exportimport/instruments/{parser,importer}.py.
const REQUIRED_COLUMNS = ['sample_id', 'test_code', 'value']

// review_state values that mean "already has a result" — matches the
// no-overwrite guard Instrument Import uses for Result.status.
const RESULTED_STATES = new Set(['to_be_verified', 'verified', 'published'])

export type QualityPreviewRow = PreviewRow & { analysisUid: string }
export type QualityPreviewResult = { ok: boolean; message?: string; summary?: PreviewSummary; rows?: QualityPreviewRow[] }
export type QualityCommitResult = { ok: boolean; message?: string; updated?: number; errors?: number; sample_ids?: string[] }

export async function previewResultImport(formData: FormData): Promise<QualityPreviewResult> {
  const file = formData.get('file') as File | null
  if (!file) return { ok: false, message: 'Choose a result file to import.' }

  const text = await file.text()
  const { header, rows: rawRows } = parseDictCsv(text)
  if (header.length === 0) return { ok: false, message: 'Empty or unreadable CSV file.' }
  const missing = REQUIRED_COLUMNS.filter(c => !header.includes(c))
  if (missing.length) return { ok: false, message: `Missing required columns: ${missing.join(', ')}` }

  const analyses = await fetchAllAnalyses(serverToken())
  const index = new Map<string, (typeof analyses)[number]>()
  for (const a of analyses) {
    if (!a.sampleId || !a.Keyword) continue
    index.set(`${a.sampleId}::${a.Keyword}`.toLowerCase(), a)
  }

  const rows: QualityPreviewRow[] = []
  let valid = 0, invalid = 0, skipped = 0

  rawRows.forEach((r, i) => {
    const row = i + 2 // header is row 1
    const sample_id = r.sample_id ?? ''
    const test_code = r.test_code ?? ''
    const value = r.value ?? ''
    const unit = r.unit ?? ''
    const flags = r.flags ?? ''
    const base = { row, sample_id, test_code, value, unit, flags, analysisUid: '' }

    if (!sample_id || !test_code) {
      invalid++
      rows.push({ ...base, test_name: '', sample_status: '', status: 'error', detail: 'sample_id and test_code are required.' })
      return
    }
    const match = index.get(`${sample_id}::${test_code}`.toLowerCase())
    if (!match) {
      invalid++
      rows.push({ ...base, test_name: '', sample_status: '', status: 'error', detail: 'No matching sample/analysis found.' })
      return
    }
    if (RESULTED_STATES.has(match.review_state)) {
      skipped++
      rows.push({
        ...base, analysisUid: match.uid, test_name: match.title, sample_status: match.review_state,
        status: 'skip', detail: `Result already ${match.review_state.replace(/_/g, ' ')} — not overwritten.`,
      })
      return
    }
    valid++
    rows.push({
      ...base, analysisUid: match.uid, test_name: match.title, sample_status: match.review_state,
      status: 'valid', detail: '',
    })
  })

  return { ok: true, summary: { total: rows.length, valid, invalid, skipped }, rows }
}

export async function commitResultImport(rows: QualityPreviewRow[]): Promise<QualityCommitResult> {
  const token = serverToken()
  const ready = rows.filter(r => r.status === 'valid' && r.analysisUid)
  let updated = 0, errors = 0
  const sampleIds = new Set<string>()

  for (const r of ready) {
    const res = await submitAnalysisResult(token, r.analysisUid, r.value)
    if (res.success) { updated++; sampleIds.add(r.sample_id) } else errors++
  }

  return { ok: true, updated, errors, sample_ids: [...sampleIds] }
}

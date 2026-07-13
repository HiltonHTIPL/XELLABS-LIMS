'use server'
import { djangoFetch } from '@/app/lib/django'

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type PreviewRowStatus = 'valid' | 'error'

export type PreviewRow = {
  row: number
  sample_id: string
  test_code: string
  value: string
  unit: string
  flags: string
  test_name: string
  sample_status: string
  status: PreviewRowStatus
  detail: string
}

export type PreviewSummary = { total: number; valid: number; invalid: number }

export type PreviewResult = {
  ok: boolean
  message?: string
  summary?: PreviewSummary
  rows?: PreviewRow[]
}

export type CommitResult = {
  ok: boolean
  message?: string
  import_id?: number
  created?: number
  updated?: number
  skipped?: number
  errors?: number
  sample_ids?: string[]
  status?: string
}

export type ReportResultRow = {
  test_code: string
  test_name: string
  method: string
  value: string
  unit: string
  result_status: string
  is_out_of_range: boolean
  instrument_name: string | null
  instrument_code: string | null
  import_date: string | null
  file_format: string | null
  source: 'instrument' | 'manual'
}

export type ReportInstrument = {
  name: string
  code: string
  method: string
  import_date: string | null
}

export type SampleReport = {
  sample: {
    sample_id: string
    client_name: string
    sample_type: string
    status: string
    collection_date: string | null
    received_date: string | null
    description: string
  }
  results: ReportResultRow[]
  instruments: ReportInstrument[]
  generated_at: string
}

export type ReportResult = {
  ok: boolean
  message?: string
  report?: SampleReport
}

/* ------------------------------------------------------------------ */
/* Import: preview + commit                                             */
/* ------------------------------------------------------------------ */

export async function previewImport(formData: FormData): Promise<PreviewResult> {
  try {
    const res = await djangoFetch('/api/instruments/result-imports/preview/', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json().catch(() => ({})) as PreviewResult & { detail?: string }
    if (!res.ok) {
      return { ok: false, message: data.detail ?? 'The file could not be parsed.' }
    }
    return { ok: true, summary: data.summary, rows: data.rows }
  } catch (e) {
    return { ok: false, message: String(e) }
  }
}

export async function commitImport(formData: FormData): Promise<CommitResult> {
  try {
    const res = await djangoFetch('/api/instruments/result-imports/commit/', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json().catch(() => ({})) as CommitResult & { detail?: string }
    if (!res.ok) {
      return { ok: false, message: data.detail ?? 'The import could not be applied.' }
    }
    return {
      ok: true,
      import_id: data.import_id,
      created: data.created,
      updated: data.updated,
      skipped: data.skipped,
      errors: data.errors,
      sample_ids: data.sample_ids,
      status: data.status,
    }
  } catch (e) {
    return { ok: false, message: String(e) }
  }
}

/* ------------------------------------------------------------------ */
/* Aggregated sample report                                             */
/* ------------------------------------------------------------------ */

export async function getSampleReport(sampleId: string): Promise<ReportResult> {
  const trimmed = sampleId.trim()
  if (!trimmed) return { ok: false, message: 'Enter a sample ID.' }
  try {
    const res = await djangoFetch(`/api/instruments/sample-report/?sample_id=${encodeURIComponent(trimmed)}`)
    const data = await res.json().catch(() => ({})) as SampleReport & { detail?: string }
    if (!res.ok) {
      return { ok: false, message: data.detail ?? 'Report could not be loaded.' }
    }
    return { ok: true, report: data }
  } catch (e) {
    return { ok: false, message: String(e) }
  }
}

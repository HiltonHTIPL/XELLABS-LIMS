'use server'
import { fetchAllAnalyses } from '@/app/lib/senaite'
import { listSenaiteWorksheets, fetchWorksheetInfo } from '@/app/lib/senaite-worksheets'
import { serverToken } from '@/app/lib/senaite-auth'

/**
 * Cross-sample Result search/view — sourced live from SENAITE.
 *
 * Previously this page read a Django-native `Result` model tied to
 * `WorksheetAssignment` — but the real result-entry flow (Worksheets page)
 * writes directly to SENAITE and never touches that Django model, so it
 * always stayed empty/stale for anything actually resulted. Rebuilt to read
 * the live SENAITE Analysis catalog instead (`fetchAllAnalyses`, already
 * proven — used by Batches and Quality Result Import).
 *
 * Two real SENAITE limitations, confirmed by reading its source (not
 * guessed), shape what this page can show:
 * - No Worksheet reference exists on the Analysis object itself. Resolved by
 *   fetching every Worksheet's own slot layout and joining by analysis uid.
 * - No exact "verified at" timestamp field exists anywhere on Analysis — only
 *   `getLastVerificator` (who). So there's a "Verified by" name, not a date.
 * - `ResultsRange` (min/max) IS a genuine per-Analysis field
 *   (bika.lims.content.abstractroutineanalysis.getResultsRange) — out-of-range
 *   is computed directly from it, no extra join needed.
 *
 * In SENAITE, "Sample" and "AnalysisRequest" are the same content object (no
 * separate AR id concept like the old Django split had), so there is only
 * one id column here, not a separate Sample/AR pair.
 */

export type EnrichedResult = {
  id: string // Analysis uid — DataTable's row key
  test_name: string
  sample_id: string
  ws_id: string
  value: string
  unit: string
  status: string
  is_out_of_range: boolean
  submitted_by_name: string
  verified_by_name: string
  submitted_at: string | null
}

export type ResultFilters = {
  search?: string
  status?: string
  is_out_of_range?: '' | 'true' | 'false'
  date_from?: string
  date_to?: string
}

/** Analysis uid -> worksheet id (e.g. "WS-011" — the same id the worksheet
 *  detail route resolves by). Worksheet has no reverse index by analysis, so
 *  every worksheet's own layout must be fetched and joined. */
async function buildWorksheetMap(token: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const list = await listSenaiteWorksheets(token)
  await Promise.all(list.map(async ws => {
    const info = await fetchWorksheetInfo(token, ws.path)
    if (!info) return
    for (const slot of info.slots) {
      if (slot.analysisUid) map.set(slot.analysisUid, info.id)
    }
  }))
  return map
}

export async function getResults(filters: ResultFilters = {}): Promise<EnrichedResult[]> {
  const token = serverToken()
  const [analyses, wsMap] = await Promise.all([
    fetchAllAnalyses(token),
    buildWorksheetMap(token),
  ])

  let enriched: EnrichedResult[] = analyses
    // "unassigned" = not yet placed on any worksheet — nothing to show as a
    // result row yet. Everything from "assigned" onward is real activity.
    .filter(a => a.review_state && a.review_state !== 'unassigned')
    .map(a => {
      const resultNum = Number(a.Result)
      const hasRange = a.resultsRangeMin !== null && a.resultsRangeMax !== null
      const isOutOfRange = hasRange && a.Result !== '' && Number.isFinite(resultNum) &&
        (resultNum < (a.resultsRangeMin as number) || resultNum > (a.resultsRangeMax as number))
      return {
        id: a.uid,
        test_name: a.title,
        sample_id: a.sampleId,
        ws_id: wsMap.get(a.uid) ?? '',
        value: a.Result,
        unit: a.Unit,
        status: a.review_state,
        is_out_of_range: isOutOfRange,
        submitted_by_name: a.submittedBy,
        verified_by_name: a.verifiedBy,
        submitted_at: a.resultCaptureDate,
      }
    })

  if (filters.status) enriched = enriched.filter(r => r.status === filters.status)
  if (filters.is_out_of_range) enriched = enriched.filter(r => String(r.is_out_of_range) === filters.is_out_of_range)

  if (filters.search) {
    const q = filters.search.trim().toLowerCase()
    if (q) {
      enriched = enriched.filter(r =>
        r.sample_id.toLowerCase().includes(q) ||
        r.ws_id.toLowerCase().includes(q) ||
        r.test_name.toLowerCase().includes(q)
      )
    }
  }

  if (filters.date_from) {
    const from = new Date(filters.date_from).getTime()
    enriched = enriched.filter(r => r.submitted_at && new Date(r.submitted_at).getTime() >= from)
  }
  if (filters.date_to) {
    const to = new Date(filters.date_to).getTime() + 24 * 60 * 60 * 1000 - 1
    enriched = enriched.filter(r => r.submitted_at && new Date(r.submitted_at).getTime() <= to)
  }

  return enriched
}

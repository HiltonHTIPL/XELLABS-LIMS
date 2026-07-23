'use server'
import { revalidatePath } from 'next/cache'
import { fetchSenaiteAnalysisServices } from '@/app/lib/senaite'
import { serverToken } from '@/app/lib/senaite-auth'
import {
  createSenaiteWorksheet, updateWorksheet, addWorksheetAnalyses, addWorksheetReference,
} from '@/app/lib/senaite-worksheets'
import { getBatchSamples, getAnalysesByUids } from '@/app/actions/batches'
import { getReferenceSampleOptions } from '@/app/actions/senaite-worksheets'
import { logExternalAuditEvent } from '@/app/actions/audit-trail'
import { getLabSamples } from '@/app/actions/lab-samples'
import { getAnalysisRequestsForSample, updateARStatus } from '@/app/actions/analysis-requests'

// Batch → Worksheet orchestration (Adapter Pattern: every SENAITE call reuses
// the existing single-worksheet primitives in senaite-worksheets.ts — this file
// only coordinates them, it never talks to SENAITE directly). One worksheet is
// created per distinct analysis service requested across the batch's samples.

export type BatchWorksheetGroup = {
  keyword: string
  serviceTitle: string
  analysisCount: number
  sampleCount: number
}

/** Only analyses still at review_state "unassigned" can be put on a worksheet
 * — same criterion the existing Worksheets page uses (fetchUnassignedAnalyses). */
function isAddable(reviewState: string): boolean {
  return reviewState === 'unassigned'
}

/** SenaiteSample.Analyses from the LIST fetch (fetchSenaiteSamples, what
 * getBatchSamples uses) is left as bare {uid} refs — title/Keyword/review_state
 * are never populated there (confirmed in senaite.ts's fetchSenaiteSample
 * comment; only the SINGULAR per-sample fetch resolves them). Cross-reference
 * every uid against getAnalysesByUids() — the same proven fix this page's own
 * "Enter Results"/"Multi Results" flow already uses for this exact gap — instead
 * of trusting the bare ref's empty fields. */
async function resolveBatchAnalyses(samples: Awaited<ReturnType<typeof getBatchSamples>>) {
  const uids = Array.from(new Set(samples.flatMap(s => s.Analyses.map(a => a.uid))))
  const full = await getAnalysesByUids(uids)
  return new Map(full.map(a => [a.uid, a]))
}

/** Preview for the wizard's first step: how many worksheets would be created,
 * and how many samples/analyses land on each. Pure read, no side effects. */
export async function getBatchWorksheetPreview(batchUid: string): Promise<BatchWorksheetGroup[]> {
  const samples = await getBatchSamples(batchUid)
  const byUid = await resolveBatchAnalyses(samples)
  const groups = new Map<string, { title: string; analysisCount: number; sampleUids: Set<string> }>()

  for (const sample of samples) {
    for (const ref of sample.Analyses) {
      const a = byUid.get(ref.uid)
      if (!a || !isAddable(a.review_state)) continue
      const key = a.Keyword || a.title
      const g = groups.get(key) ?? { title: a.title, analysisCount: 0, sampleUids: new Set<string>() }
      g.analysisCount += 1
      g.sampleUids.add(sample.uid)
      groups.set(key, g)
    }
  }

  return Array.from(groups.entries())
    .map(([keyword, g]) => ({
      keyword, serviceTitle: g.title, analysisCount: g.analysisCount, sampleCount: g.sampleUids.size,
    }))
    .sort((a, b) => a.serviceTitle.localeCompare(b.serviceTitle))
}

export type BatchWorksheetResult = {
  keyword: string
  serviceTitle: string
  success: boolean
  worksheetId?: string
  worksheetPath?: string
  analysisCount: number
  qcAdded: boolean
  warning?: string
  error?: string
}

/** Create one worksheet per distinct analysis service requested across the
 * batch's samples: auto-fills Instrument/Method from the service's configured
 * defaults (left blank if the service has none), adds every addable analysis
 * of that service, and auto-adds the most-recently-created active Reference
 * Sample (QC) that carries expected results for that service. */
export async function createWorksheetsForBatch(
  batchUid: string,
  analystId: string,
): Promise<{ success: boolean; results: BatchWorksheetResult[]; message: string }> {
  const token = serverToken()
  const [samples, services, referenceOptions] = await Promise.all([
    getBatchSamples(batchUid),
    fetchSenaiteAnalysisServices(token),
    getReferenceSampleOptions(),
  ])

  const serviceByKeyword = new Map(services.map(s => [s.Keyword, s]))
  const byUid = await resolveBatchAnalyses(samples)

  // Group addable analysis uids by service keyword, tracking which samples
  // contribute to each group (needed below to advance their Django AR status).
  const groups = new Map<string, { title: string; uids: string[]; sampleUids: Set<string> }>()
  for (const sample of samples) {
    for (const ref of sample.Analyses) {
      const a = byUid.get(ref.uid)
      if (!a || !isAddable(a.review_state)) continue
      const key = a.Keyword || a.title
      const g = groups.get(key) ?? { title: a.title, uids: [], sampleUids: new Set<string>() }
      g.uids.push(a.uid)
      g.sampleUids.add(sample.uid)
      groups.set(key, g)
    }
  }

  if (groups.size === 0) {
    return { success: false, results: [], message: 'No addable analyses found on this batch — every analysis is already on a worksheet or in a later stage.' }
  }

  // SENAITE review_state and Django's own AnalysisRequest.status are two
  // separate fields (per the earlier Sample.status sync gap this session) —
  // advance the latter to "in_progress" for every touched sample once its
  // analyses land on a worksheet, so Sample Detail's Requested Analyses table
  // stops reading "Not Started" forever. Best-effort: a failure here doesn't
  // fail the worksheet, since SENAITE remains the source of truth either way.
  const labSamples = await getLabSamples()
  const djangoIdByUid = new Map(labSamples.filter(s => s.senaite_uid).map(s => [s.senaite_uid as string, s.id]))
  async function advanceArStatus(sampleUids: Set<string>) {
    for (const uid of sampleUids) {
      const djangoId = djangoIdByUid.get(uid)
      if (!djangoId) continue
      const ars = await getAnalysisRequestsForSample(djangoId)
      for (const ar of ars) {
        if (ar.status === 'pending') await updateARStatus(ar.id, 'in_progress')
      }
    }
  }

  const results: BatchWorksheetResult[] = []

  for (const [keyword, group] of groups) {
    const service = serviceByKeyword.get(keyword)

    const created = await createSenaiteWorksheet(token, { analyst: analystId })
    if (!created.success || !created.info) {
      results.push({ keyword, serviceTitle: group.title, success: false, analysisCount: group.uids.length, qcAdded: false, error: created.error ?? 'Failed to create worksheet.' })
      continue
    }
    const path = created.info.path
    const worksheetId = created.info.id

    // Auto-fill Instrument/Method from the service's configured defaults —
    // left blank (per spec) if the service has neither set.
    if (service?.DefaultInstrumentUid || service?.DefaultMethodUid) {
      await updateWorksheet(token, path, {
        ...(service.DefaultInstrumentUid ? { instrument: service.DefaultInstrumentUid } : {}),
        ...(service.DefaultMethodUid ? { method: service.DefaultMethodUid } : {}),
      })
    }

    const added = await addWorksheetAnalyses(token, path, group.uids)
    if (!added.success) {
      results.push({ keyword, serviceTitle: group.title, success: false, worksheetId, worksheetPath: path, analysisCount: group.uids.length, qcAdded: false, error: added.error ?? 'Worksheet created, but adding analyses failed.' })
      continue
    }
    await advanceArStatus(group.sampleUids)

    // Auto-pick QC: the most-recently-created active Reference Sample whose
    // ReferenceResults cover this service — skipped (not failed) if none match,
    // since a service with no configured QC material is a data-setup gap, not
    // a worksheet-creation error.
    let qcAdded = false
    let warning: string | undefined
    if (service) {
      const matches = referenceOptions
        .filter(r => r.serviceUids.includes(service.uid))
        .sort((a, b) => (b.created || '').localeCompare(a.created || ''))
      const pick = matches[0]
      if (pick) {
        const qc = await addWorksheetReference(token, path, pick.uid, [service.uid])
        qcAdded = qc.success
        if (!qc.success) warning = `QC reference "${pick.title}" could not be added: ${qc.error ?? 'unknown error'}`
      } else {
        warning = 'No active Reference Sample (QC material) covers this service yet — add one manually.'
      }
    } else {
      warning = 'Analysis service details not found — Instrument/Method/QC could not be auto-mapped.'
    }

    logExternalAuditEvent('create', worksheetId, { source: 'batch', batchUid, service: group.title, analysisCount: group.uids.length }, 'worksheet')
    results.push({ keyword, serviceTitle: group.title, success: true, worksheetId, worksheetPath: path, analysisCount: group.uids.length, qcAdded, warning })
  }

  revalidatePath('/dashboard/worksheets')
  revalidatePath(`/dashboard/batches/${batchUid}`)
  revalidatePath('/dashboard/samples-overview')

  const failed = results.filter(r => !r.success)
  const okCount = results.length - failed.length
  const message = failed.length === 0
    ? `${okCount} worksheet${okCount === 1 ? '' : 's'} created.`
    : `${okCount} of ${results.length} worksheet(s) created; ${failed.length} failed.`
  return { success: failed.length === 0, results, message }
}

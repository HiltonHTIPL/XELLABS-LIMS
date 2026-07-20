'use server'
import { revalidatePath } from 'next/cache'
import { serverToken, sessionToken } from '@/app/lib/senaite-auth'
import { getSession } from '@/app/lib/session'
import {
  createSenaiteWorksheet, applyTemplateToWorksheet, fetchWorksheetInfo,
  listSenaiteWorksheets, transitionSenaiteWorksheet,
  submitAnalysisResult, transitionAnalysis,
  addWorksheetAnalyses, removeWorksheetAnalyses, addWorksheetDuplicate,
  addWorksheetReference, updateWorksheet, fetchUnassignedAnalyses, fetchLabAnalysts,
  type WorksheetInfo, type WorksheetListItem, type UnassignedAnalysis, type LabAnalyst,
} from '@/app/lib/senaite-worksheets'
import {
  listWorksheetTemplates, listInstrumentOptions, listMethodOptions,
} from '@/app/actions/worksheet-templates'
import { listReferenceSamples } from '@/app/actions/reference-samples'
import { SENAITE_SITE_PATH } from '@/app/lib/senaite'
import type { RefOption } from '@/app/dashboard/_components/AdminRefShell'

// A QC material selectable on a worksheet. `serviceUids` are the analysis
// services the sample carries expected results for — the services QC gets
// added for when the sample is dropped onto the worksheet.
export type ReferenceSampleOption = {
  uid: string; title: string; supplierTitle: string; blank: boolean; serviceUids: string[]
}

export type { UnassignedAnalysis, LabAnalyst } from '@/app/lib/senaite-worksheets'

// Lab members eligible to be assigned as worksheet analyst.
export async function getLabAnalysts(): Promise<LabAnalyst[]> {
  return fetchLabAnalysts(serverToken())
}

export type { WorksheetInfo, WorksheetListItem } from '@/app/lib/senaite-worksheets'

// ── Reads ────────────────────────────────────────────────────────────────────
export async function getSenaiteWorksheets(): Promise<WorksheetListItem[]> {
  return listSenaiteWorksheets(serverToken())
}

export async function getSenaiteWorksheetDetail(path: string): Promise<WorksheetInfo | null> {
  return fetchWorksheetInfo(serverToken(), path)
}

// Fetch by worksheet id (e.g. "WS-009") — builds the object path from the
// configured SENAITE site path so callers don't hardcode "/senaite".
export async function getSenaiteWorksheetDetailById(id: string): Promise<WorksheetInfo | null> {
  return fetchWorksheetInfo(serverToken(), `${SENAITE_SITE_PATH}/worksheets/${id}`)
}

// Templates the create flow can apply (active only), as {uid,title}.
export async function getWorksheetTemplateOptions(): Promise<RefOption[]> {
  const rows = await listWorksheetTemplates()
  return rows.map(r => ({ uid: r.uid, title: r.title }))
}

export async function getWorksheetInstrumentOptions(): Promise<RefOption[]> {
  return listInstrumentOptions()
}

export async function getWorksheetMethodOptions(): Promise<RefOption[]> {
  return listMethodOptions()
}

// Unassigned routine analyses available to add to a worksheet.
export async function getUnassignedAnalyses(): Promise<UnassignedAnalysis[]> {
  return fetchUnassignedAnalyses(serverToken())
}

// Active QC materials (reference samples) selectable as Blank/Control on a
// worksheet, each with the analysis-service uids it carries expected results
// for. Sourced from the Reference Samples admin module (Adapter Pattern reuse).
export async function getReferenceSampleOptions(): Promise<ReferenceSampleOption[]> {
  const rows = await listReferenceSamples()
  return rows.map(r => ({
    uid: r.uid,
    title: r.title,
    supplierTitle: r.supplierTitle,
    blank: r.blank,
    serviceUids: r.results.map(x => x.uid).filter(Boolean),
  }))
}

// ── Writes ───────────────────────────────────────────────────────────────────
export type WorksheetActionResult = { success: boolean; path?: string; id?: string; error?: string }

export async function createWorksheet(
  opts: { analyst?: string; instrument?: string; template?: string },
): Promise<WorksheetActionResult> {
  const r = await createSenaiteWorksheet(serverToken(), opts)
  if (!r.success || !r.info) return { success: false, error: r.error ?? 'Failed to create worksheet.' }
  revalidatePath('/dashboard/worksheets')
  return { success: true, path: r.info.path, id: r.info.id }
}

export async function applyWorksheetTemplate(
  path: string,
  template: string,
): Promise<WorksheetActionResult> {
  const r = await applyTemplateToWorksheet(serverToken(), path, template)
  if (!r.success || !r.info) return { success: false, error: r.error ?? 'Failed to apply template.' }
  revalidatePath('/dashboard/worksheets')
  revalidatePath(`/dashboard/worksheets/${r.info.id}`)
  return { success: true, path: r.info.path, id: r.info.id }
}

// Verify/Retract/Reject are identity-sensitive (SENAITE's self-verification
// guard checks the acting SENAITE user) — use the logged-in user's own
// SENAITE token, not the shared service account, or SENAITE would see every
// transition as coming from the same identity regardless of who's logged in.
export async function transitionWorksheet(
  path: string,
  id: string,
  transition: string,
): Promise<WorksheetActionResult> {
  const session = await getSession()
  const r = await transitionSenaiteWorksheet(sessionToken(session), path, transition)
  if (!r.success) return { success: false, error: r.error ?? `Failed to ${transition}.` }
  revalidatePath('/dashboard/worksheets')
  revalidatePath(`/dashboard/worksheets/${id}`)
  return { success: true }
}

// Enter a result on a worksheet analysis and submit it (assigned -> to_be_verified).
export async function submitWorksheetResult(
  id: string,
  analysisUid: string,
  result: string,
): Promise<WorksheetActionResult> {
  const trimmed = (result ?? '').trim()
  if (!trimmed) return { success: false, error: 'Enter a result first.' }
  const session = await getSession()
  const r = await submitAnalysisResult(sessionToken(session), analysisUid, trimmed)
  if (!r.success) return { success: false, error: r.error ?? 'Failed to submit result.' }
  revalidatePath(`/dashboard/worksheets/${id}`)
  return { success: true }
}

// Verify a single worksheet analysis (to_be_verified -> verified).
export async function verifyWorksheetAnalysis(
  id: string,
  analysisUid: string,
): Promise<WorksheetActionResult> {
  const session = await getSession()
  const r = await transitionAnalysis(sessionToken(session), analysisUid, 'verify')
  if (!r.success) return { success: false, error: r.error ?? 'Failed to verify.' }
  revalidatePath(`/dashboard/worksheets/${id}`)
  return { success: true }
}

// ── Manual worksheet building ──────────────────────────────────────────────
function revalidateWs(id: string) {
  revalidatePath('/dashboard/worksheets')
  revalidatePath(`/dashboard/worksheets/${id}`)
}

export async function addAnalysesToWorksheet(
  path: string, id: string, analysisUids: string[],
): Promise<WorksheetActionResult> {
  if (!analysisUids.length) return { success: false, error: 'Select at least one analysis.' }
  const r = await addWorksheetAnalyses(serverToken(), path, analysisUids)
  if (!r.success) return { success: false, error: r.error ?? 'Failed to add analyses.' }
  revalidateWs(id)
  return { success: true }
}

export async function removeAnalysesFromWorksheet(
  path: string, id: string, analysisUids: string[],
): Promise<WorksheetActionResult> {
  if (!analysisUids.length) return { success: false, error: 'Nothing to remove.' }
  const r = await removeWorksheetAnalyses(serverToken(), path, analysisUids)
  if (!r.success) return { success: false, error: r.error ?? 'Failed to remove analyses.' }
  revalidateWs(id)
  return { success: true }
}

export async function addDuplicateToWorksheet(
  path: string, id: string, srcSlot: number,
): Promise<WorksheetActionResult> {
  const r = await addWorksheetDuplicate(serverToken(), path, srcSlot)
  if (!r.success) return { success: false, error: r.error ?? 'Failed to add duplicate.' }
  revalidateWs(id)
  return { success: true }
}

export async function addReferenceToWorksheet(
  path: string, id: string, referenceUid: string, serviceUids: string[],
): Promise<WorksheetActionResult> {
  if (!referenceUid) return { success: false, error: 'Pick a reference sample.' }
  const r = await addWorksheetReference(serverToken(), path, referenceUid, serviceUids)
  if (!r.success) return { success: false, error: r.error ?? 'Failed to add QC.' }
  revalidateWs(id)
  return { success: true }
}

export async function updateWorksheetFields(
  path: string, id: string,
  fields: { analyst?: string; instrument?: string; method?: string; remarks?: string },
): Promise<WorksheetActionResult> {
  const r = await updateWorksheet(serverToken(), path, fields)
  if (!r.success) return { success: false, error: r.error ?? 'Failed to update worksheet.' }
  revalidateWs(id)
  return { success: true }
}

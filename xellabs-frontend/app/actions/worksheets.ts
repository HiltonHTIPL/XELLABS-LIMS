'use server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/lib/session'
import {
  fetchSenaiteWorksheets,
  createSenaiteWorksheet,
  fetchUnassignedAnalyses,
  fetchWorksheetAnalyses,
  assignAnalysesToWorksheet,
  submitAnalysisResult,
  type SenaiteWorksheet,
  type SenaiteAnalysis,
} from '@/app/lib/senaite'


import { serverToken, sessionToken } from '@/app/lib/senaite-auth'

export async function getWorksheets(): Promise<SenaiteWorksheet[]> {
  const session = await getSession()
  return fetchSenaiteWorksheets(sessionToken(session))
}

export async function getWorksheetAnalyses(worksheetUid: string): Promise<SenaiteAnalysis[]> {
  const session = await getSession()
  return fetchWorksheetAnalyses(sessionToken(session), worksheetUid)
}

export async function getUnassignedAnalyses(): Promise<SenaiteAnalysis[]> {
  const session = await getSession()
  return fetchUnassignedAnalyses(sessionToken(session))
}

export async function createWorksheet(): Promise<{ success: boolean; message: string; uid?: string; id?: string }> {
  // Use the service account: worksheet creation needs LabManager rights in the
  // lab system, and a session token from a user without a matching lab-system
  // account silently fetched an empty analysis list (auth failures return []),
  // which surfaced as a misleading "no unassigned analyses" error.
  const token = serverToken()

  // SENAITE requires at least one analysis when creating a worksheet.
  // Check before attempting creation so we can return a clear error.
  const unassigned = await fetchUnassignedAnalyses(token)
  if (unassigned.length === 0) {
    return {
      success: false,
      message: 'No unassigned analyses available. Please register samples with analyses in XelLabs first, then create a worksheet.',
    }
  }

  const result = await createSenaiteWorksheet(token, unassigned.map(a => a.uid))
  if (!result.success) return { success: false, message: result.error ?? 'Failed to create worksheet.' }

  // Also call assignAnalysesToWorksheet after creation to ensure the getWorksheetUID
  // catalog index on each analysis is updated so fetchWorksheetAnalyses can find them.
  if (result.uid && unassigned.length > 0) {
    await assignAnalysesToWorksheet(token, result.uid, unassigned.map(a => a.uid))
  }

  revalidatePath('/dashboard/worksheets')
  return { success: true, message: `Worksheet ${result.id} created.`, uid: result.uid, id: result.id }
}

export async function assignAnalyses(
  worksheetUid: string,
  analysisUids: string[]
): Promise<{ success: boolean; message: string }> {
  const session = await getSession()
  const result = await assignAnalysesToWorksheet(sessionToken(session), worksheetUid, analysisUids)
  if (!result.success) return { success: false, message: result.error ?? 'Failed to assign analyses.' }
  revalidatePath(`/dashboard/worksheets/${worksheetUid}`)
  return { success: true, message: `${analysisUids.length} analysis/analyses assigned.` }
}

export async function submitResult(
  worksheetUid: string,
  analysisUid: string,
  resultValue: string
): Promise<{ success: boolean; message: string }> {
  const session = await getSession()
  const result = await submitAnalysisResult(sessionToken(session), analysisUid, resultValue)
  if (!result.success) return { success: false, message: result.error ?? 'Failed to submit result.' }
  revalidatePath(`/dashboard/worksheets/${worksheetUid}`)
  return { success: true, message: 'Result submitted.' }
}

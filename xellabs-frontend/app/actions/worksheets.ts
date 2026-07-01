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

const SENAITE_USER = process.env.SENAITE_ADMIN_USER ?? 'admin'
const SENAITE_PASS = process.env.SENAITE_ADMIN_PASS ?? 'admin'

function serverToken(): string {
  return Buffer.from(`${SENAITE_USER}:${SENAITE_PASS}`).toString('base64')
}

function sessionToken(session: { senaiteToken?: string } | null): string {
  return session?.senaiteToken ?? serverToken()
}

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
  const session = await getSession()
  const result = await createSenaiteWorksheet(sessionToken(session))
  if (!result.success) return { success: false, message: result.error ?? 'Failed to create worksheet.' }
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

'use server'
import { revalidatePath } from 'next/cache'
import {
  fetchSenaiteBatches,
  createSenaiteBatch,
  setSenaiteBatchState,
  fetchSenaiteClients,
  fetchSenaiteSamples,
  fetchAllAnalyses,
  submitAnalysisResult,
  updateSenaiteSample,
  type SenaiteBatch,
  type SenaiteSample,
  type SenaiteAnalysisFull,
} from '@/app/lib/senaite'
import { serverToken } from '@/app/lib/senaite-auth'

export async function getBatchesList(): Promise<SenaiteBatch[]> {
  return fetchSenaiteBatches(serverToken())
}

export async function getBatch(uid: string): Promise<SenaiteBatch | null> {
  const batches = await fetchSenaiteBatches(serverToken())
  return batches.find(b => b.uid === uid) ?? null
}

export async function getBatchSamples(uid: string): Promise<SenaiteSample[]> {
  // SENAITE's AnalysisRequest search silently ignores an unrecognized `Batch`
  // query param instead of filtering (confirmed via direct testing — even a
  // nonsense UID returned every sample) — filter client-side against each
  // sample's own resolved Batch reference instead of trusting the server to.
  const all = await fetchSenaiteSamples(serverToken(), { limit: '1000' })
  return all.filter(s => s.BatchUID === uid)
}

/** Fetch full analysis details (title, Result, Unit) for a known set of
 * analysis uids — pass each selected sample's own `Analyses[].uid` list,
 * trusted data straight from the object itself, not a broken search filter. */
export async function getAnalysesByUids(uids: string[]): Promise<SenaiteAnalysisFull[]> {
  if (uids.length === 0) return []
  const all = await fetchAllAnalyses(serverToken())
  const wanted = new Set(uids)
  return all.filter(a => wanted.has(a.uid))
}

export async function submitBatchResult(
  analysisUid: string,
  result: string
): Promise<{ success: boolean; message?: string }> {
  const r = await submitAnalysisResult(serverToken(), analysisUid, result)
  return { success: r.success, message: r.error }
}

/** Samples with no Batch assigned yet — scoped to the batch's own client when
 * it has one, otherwise every unassigned sample across all clients. */
export async function getUnassignedSamples(clientUid?: string): Promise<SenaiteSample[]> {
  const all = await fetchSenaiteSamples(serverToken(), { limit: '1000' })
  return all.filter(s => !s.BatchUID && (!clientUid || s.ClientUID === clientUid))
}

export async function assignSamplesToBatch(
  batchUid: string,
  sampleUids: string[]
): Promise<{ success: boolean; message: string }> {
  if (sampleUids.length === 0) return { success: true, message: 'No samples selected.' }
  const results = await Promise.all(sampleUids.map(uid => updateSenaiteSample(serverToken(), uid, { Batch: batchUid })))
  const failed = results.filter(r => !r.success)
  revalidatePath(`/dashboard/batches/${batchUid}`)
  if (failed.length > 0) {
    return { success: false, message: `${failed.length} of ${sampleUids.length} sample(s) failed: ${failed[0].error ?? 'unknown error'}` }
  }
  return { success: true, message: `${sampleUids.length} sample${sampleUids.length > 1 ? 's' : ''} added to batch.` }
}

export async function getBatchClientOptions(): Promise<{ uid: string; title: string }[]> {
  const clients = await fetchSenaiteClients(serverToken())
  return clients.map(c => ({ uid: c.uid, title: c.title }))
}

export type BatchFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function createBatch(
  _state: BatchFormState,
  formData: FormData
): Promise<BatchFormState> {
  const title         = (formData.get('title') as string)?.trim()
  const clientUid      = (formData.get('client_uid') as string)?.trim()
  const clientBatchId  = (formData.get('client_batch_id') as string)?.trim()
  const remarks        = (formData.get('remarks') as string)?.trim()
  const description    = (formData.get('description') as string)?.trim()
  const batchDate      = (formData.get('batch_date') as string)?.trim()
  const batchLabels    = (formData.get('batch_labels') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!title) errors.title = ['Batch name is required']
  if (Object.keys(errors).length) return { errors }

  const result = await createSenaiteBatch(serverToken(), {
    title,
    ...(clientUid ? { ClientUID: clientUid } : {}),
    ...(clientBatchId ? { ClientBatchID: clientBatchId } : {}),
    ...(remarks ? { Remarks: remarks } : {}),
    ...(description ? { description } : {}),
    ...(batchDate ? { BatchDate: batchDate } : {}),
    ...(batchLabels ? { BatchLabels: batchLabels.split(',').map(s => s.trim()).filter(Boolean) } : {}),
  })

  if (!result.success) {
    return { message: result.error ?? 'Failed to create batch.' }
  }

  revalidatePath('/dashboard/batches')
  return { success: true, message: `Batch "${title}" created.` }
}

export async function setBatchState(
  uid: string,
  transition: 'close' | 'open' | 'cancel'
): Promise<{ success: boolean; message: string }> {
  const result = await setSenaiteBatchState(serverToken(), uid, transition)
  if (!result.success) {
    return { success: false, message: result.error ?? 'Failed to update batch status.' }
  }
  revalidatePath('/dashboard/batches')
  const LABELS = { close: 'Batch closed.', open: 'Batch reopened.', cancel: 'Batch cancelled.' }
  return { success: true, message: LABELS[transition] }
}

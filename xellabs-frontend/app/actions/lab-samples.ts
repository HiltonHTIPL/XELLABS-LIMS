'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'
import { createSenaiteSample, senaiteWorkflowAction } from '@/app/lib/senaite'
import { getSession } from '@/app/lib/session'

const SENAITE_USER = process.env.SENAITE_ADMIN_USER
const SENAITE_PASS = process.env.SENAITE_ADMIN_PASS

if (!SENAITE_USER || !SENAITE_PASS) {
  throw new Error('SENAITE_ADMIN_USER and SENAITE_ADMIN_PASS env vars are required')
}

function serverToken(): string {
  return Buffer.from(`${SENAITE_USER}:${SENAITE_PASS}`).toString('base64')
}

async function senaiteToken(): Promise<string> {
  const session = await getSession()
  return session?.senaiteToken ?? serverToken()
}

export type DjangoSampleType = {
  id: number
  name: string
  prefix: string
  senaite_uid?: string
}

export async function getDjangoSampleTypes(): Promise<DjangoSampleType[]> {
  try {
    const res = await djangoFetch('/api/lims/sample-types/?ordering=name')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export type LabSample = {
  id: number
  sample_id: string
  client: number | null
  client_name: string
  sample_type: number | null
  sample_type_name: string
  description: string
  collection_date: string | null
  received_date: string | null
  expiry_date: string | null
  status: string
  condition: string
  priority: string
  hold_for_qa: boolean
  storage_location: string
  preferred_storage_location: string
  preferred_storage_label_code: string
  barcode: string
  is_locked: boolean
  received_by_name: string
  created_at: string
  // Extended intake fields
  contact_name: string
  cc_contact: string
  cc_emails: string
  batch_id: string
  batch_sub_group: string
  container_type: string
  preservation: string
  analysis_specification: string
  sample_point: string
  environmental_conditions: string
  composite: boolean
  internal_use: boolean
  client_order_number: string
  client_reference: string
  client_sample_id: string
}

export type NewSamplePayload = {
  client: number
  sample_type: number
  priority: string
  condition: string
  collection_date?: string
  expiry_date?: string
  description?: string
  preferred_storage_location?: string
  preferred_storage_label_code?: string
  contact_name?: string
  cc_contact?: string
  cc_emails?: string
  batch_id?: string
  batch_sub_group?: string
  container_type?: string
  preservation?: string
  analysis_specification?: string
  sample_point?: string
  environmental_conditions?: string
  composite?: boolean
  internal_use?: boolean
  client_order_number?: string
  client_reference?: string
  client_sample_id?: string
  client_senaite_uid?: string
  sample_type_senaite_uid?: string
}

function senaitePriority(priority: string): string {
  if (priority === 'high') return '2'
  if (priority === 'low') return '4'
  return '3'
}

export async function createSampleWithAnalyses(
  payload: NewSamplePayload,
  testIds: number[],
  testSenaiteUids: string[] = [],
): Promise<{ success: boolean; message: string; sample_id?: string }> {
  try {
    // Step 1: Create the sample
    const sampleRes = await djangoFetch('/api/lims/samples/', {
      method: 'POST',
      body: JSON.stringify({ ...payload, client_senaite_uid: undefined, sample_type_senaite_uid: undefined, status: 'registered', is_active: true }),
    })
    const sampleData = await sampleRes.json().catch(() => ({})) as Record<string, unknown>
    if (!sampleRes.ok) {
      const msg = (sampleData.client as string[])?.[0]
        ?? (sampleData.sample_type as string[])?.[0]
        ?? (sampleData.detail as string)
        ?? 'Failed to create sample.'
      return { success: false, message: msg }
    }
    const sampleId = sampleData.id as number
    const sampleDisplayId = sampleData.sample_id as string

    // Step 2: Create analysis request if tests selected
    if (testIds.length > 0) {
      const arRes = await djangoFetch('/api/lims/analysis-requests/', {
        method: 'POST',
        body: JSON.stringify({
          sample: sampleId,
          tests: testIds,
          status: 'pending',
          priority: payload.priority === 'high' ? 'high' : payload.priority === 'low' ? 'low' : 'normal',
        }),
      })
      if (!arRes.ok) {
        const arError = await arRes.json().catch(() => ({})) as Record<string, unknown>
        const arMsg = (arError.detail as string) ?? 'Failed to create analysis request.'
        return { success: false, message: `Sample ${sampleDisplayId} created, but analysis request failed: ${arMsg}` }
      }
    }

    // Step 3: Mirror the sample into SENAITE so it becomes visible to Worksheets.
    // Registration only creates it in SENAITE's not-yet-received state ("sample_due") —
    // it is transitioned to "received" in SENAITE only when the sample is physically
    // received (see receiveLabSample below), matching the same registered→received gate
    // this app already enforces on the Django side.
    if (payload.client_senaite_uid && payload.sample_type_senaite_uid && testSenaiteUids.length > 0) {
      try {
        const token = await senaiteToken()
        const result = await createSenaiteSample(token, {
          Client: payload.client_senaite_uid,
          SampleType: payload.sample_type_senaite_uid,
          DateSampled: payload.collection_date ?? new Date().toISOString(),
          Analyses: testSenaiteUids,
          Priority: senaitePriority(payload.priority),
          ClientSampleID: sampleDisplayId,
        })
        if (result.success && result.sample) {
          await djangoFetch(`/api/lims/samples/${sampleId}/`, {
            method: 'PATCH',
            body: JSON.stringify({ senaite_uid: result.sample.uid, senaite_ar_id: result.sample.id }),
          })
        } else {
          // SENAITE sync failed — log for admin review
          console.error('[SENAITE_SYNC_FAILED]', {
            sample_id: sampleDisplayId,
            sample_pk: sampleId,
            error: result.error,
            timestamp: new Date().toISOString(),
          })
        }
      } catch (e) {
        // SENAITE sync exception — log for admin review
        console.error('[SENAITE_SYNC_ERROR]', {
          sample_id: sampleDisplayId,
          sample_pk: sampleId,
          error: String(e),
          timestamp: new Date().toISOString(),
        })
      }
    }

    revalidatePath('/dashboard/samples-overview')
    revalidatePath('/dashboard/analysis-requests')
    return { success: true, message: `Sample ${sampleDisplayId} logged successfully.`, sample_id: sampleDisplayId }
  } catch (e) {
    console.error('[SAMPLE_CREATE_ERROR]', e)
    return { success: false, message: 'An unexpected error occurred. Please try again.' }
  }
}

export type SampleStats = {
  logged: number
  received: number
  in_process: number
  to_be_verified: number
  on_hold_for_qa: number
  completed: number
  overdue: number
}

export async function getSampleStats(): Promise<SampleStats> {
  try {
    const res = await djangoFetch('/api/lims/samples/stats/')
    if (!res.ok) return { logged: 0, received: 0, in_process: 0, to_be_verified: 0, on_hold_for_qa: 0, completed: 0, overdue: 0 }
    return await res.json()
  } catch { return { logged: 0, received: 0, in_process: 0, to_be_verified: 0, on_hold_for_qa: 0, completed: 0, overdue: 0 } }
}

export type LabSampleFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export type TatTrendPoint = { week_start: string; avg_tat_days: number | null; sample_count: number }

export async function getTatTrend(): Promise<TatTrendPoint[]> {
  try {
    const res = await djangoFetch('/api/lims/samples/tat_trend/')
    if (!res.ok) return []
    return await res.json()
  } catch { return [] }
}

export async function getLabSamples(): Promise<LabSample[]> {
  try {
    // DRF paginates at PAGE_SIZE=50 — page through every page so the list
    // matches the true total (e.g. the "Logged" stat card), not just page 1.
    const all: LabSample[] = []
    let url: string | null = '/api/lims/samples/?ordering=-created_at'
    while (url) {
      const res = await djangoFetch(url)
      if (!res.ok) break
      const data = await res.json()
      all.push(...(data.results ?? []))
      const next: string | null = data.next ?? null
      url = next ? next.replace(/^https?:\/\/[^/]+/, '') : null
    }
    return all
  } catch { return [] }
}

export async function createLabSample(_state: LabSampleFormState, formData: FormData): Promise<LabSampleFormState> {
  const sample_id        = (formData.get('sample_id') as string)?.trim()
  const client           = (formData.get('client') as string)?.trim()
  const sample_type      = (formData.get('sample_type') as string)?.trim()
  const description      = (formData.get('description') as string)?.trim()
  const collection_date  = (formData.get('collection_date') as string)?.trim()
  const received_date    = (formData.get('received_date') as string)?.trim()
  const expiry_date      = (formData.get('expiry_date') as string)?.trim()
  const status           = (formData.get('status') as string)?.trim() || 'registered'
  const storage_location = (formData.get('storage_location') as string)?.trim()
  const barcode          = (formData.get('barcode') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!client)      errors.client      = ['Client is required']
  if (!sample_type) errors.sample_type = ['Sample type is required']
  if (Object.keys(errors).length) return { errors }

  const body: Record<string, unknown> = {
    status,
    is_active: true,
    ...(sample_id        ? { sample_id }                         : {}),
    ...(client           ? { client: Number(client) }            : {}),
    ...(sample_type      ? { sample_type: Number(sample_type) }  : {}),
    ...(description      ? { description }                       : {}),
    ...(collection_date  ? { collection_date }                   : {}),
    ...(received_date    ? { received_date }                     : {}),
    ...(expiry_date      ? { expiry_date }                       : {}),
    ...(storage_location ? { storage_location }                  : {}),
    ...(barcode          ? { barcode }                           : {}),
  }

  try {
    const res = await djangoFetch('/api/lims/samples/', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) {
      return { message: (data.sample_id as string[])?.[0] ?? (data.client as string[])?.[0] ?? (data.detail as string) ?? 'Failed to register sample.' }
    }
    revalidatePath('/dashboard/lab-samples')
    return { success: true, message: `Sample ${data.sample_id} registered successfully.` }
  } catch (e) { return { message: String(e) } }
}

export async function getLabSample(id: number): Promise<LabSample | null> {
  try {
    const res = await djangoFetch(`/api/lims/samples/${id}/`)
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

export type ReceiptFormState = {
  success?: boolean
  message?: string
}

export async function receiveLabSample(id: number, data: {
  condition: string
  seal_condition: string
  seal_number: string
  quantity_received: string
  quantity_unit: string
  sampling_deviation: string
  storage_requirement: string
  priority: string
  hold_for_qa: boolean
  collector: string
  location: string
  notes: string
}): Promise<ReceiptFormState> {
  try {
    const body: Record<string, unknown> = {
      condition:           data.condition,
      seal_condition:      data.seal_condition,
      seal_number:         data.seal_number,
      quantity_unit:       data.quantity_unit,
      sampling_deviation:  data.sampling_deviation,
      storage_requirement: data.storage_requirement,
      priority:            data.priority,
      hold_for_qa:         data.hold_for_qa,
      collector:           data.collector,
      location:            data.location,
      notes:               data.notes,
      ...(data.quantity_received ? { quantity_received: parseFloat(data.quantity_received) } : {}),
    }
    const res = await djangoFetch(`/api/lims/samples/${id}/receive/`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const resData = await res.json().catch(() => ({})) as { detail?: string; sample_id?: string; senaite_uid?: string }
    if (!res.ok) {
      return { message: resData.detail ?? 'Failed to receive sample.' }
    }

    // If this sample has a SENAITE mirror (created at registration time), transition
    // it to "received" now — the exact physical-receipt moment — so its analyses
    // move from "sample_due" into "unassigned" and become visible to Worksheets.
    if (resData.senaite_uid) {
      try {
        const token = await senaiteToken()
        await senaiteWorkflowAction(token, resData.senaite_uid, 'receive')
      } catch { /* non-fatal — Django receipt already succeeded */ }
    }

    revalidatePath('/dashboard/lab-samples')
    revalidatePath('/dashboard/sample-receipts')
    return { success: true, message: `Sample ${resData.sample_id ?? ''} marked as received.` }
  } catch (e) { return { message: String(e) } }
}

export async function uploadSampleAttachment(sampleId: string, formData: FormData): Promise<{ ok: boolean; attachment_url?: string }> {
  try {
    const res = await djangoFetch(`/api/lims/samples/${sampleId}/upload-attachment/`, {
      method: 'PATCH',
      body: formData,
    })
    if (!res.ok) return { ok: false }
    const data = await res.json().catch(() => ({})) as { attachment_url?: string }
    revalidatePath('/dashboard/samples-overview')
    return { ok: true, attachment_url: data.attachment_url }
  } catch { return { ok: false } }
}

export async function syncSampleTypesFromSenaite(): Promise<void> {
  try {
    await djangoFetch('/api/lims/sample-types/sync-from-senaite/', { method: 'POST' })
  } catch { /* non-fatal — new sample page still loads */ }
}

export async function patchLabSample(id: number, patch: Record<string, unknown>): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await djangoFetch(`/api/lims/samples/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { detail?: string }
      return { ok: false, message: d.detail ?? `Error ${res.status}` }
    }
    revalidatePath('/dashboard/samples-overview')
    return { ok: true }
  } catch (e) { return { ok: false, message: String(e) } }
}

export async function updateLabSample(id: number, _state: LabSampleFormState, formData: FormData): Promise<LabSampleFormState> {
  const description      = (formData.get('description') as string)?.trim()
  const collection_date  = (formData.get('collection_date') as string)?.trim()
  const received_date    = (formData.get('received_date') as string)?.trim()
  const expiry_date      = (formData.get('expiry_date') as string)?.trim()
  const status           = (formData.get('status') as string)?.trim()
  const storage_location = (formData.get('storage_location') as string)?.trim()
  const barcode          = (formData.get('barcode') as string)?.trim()

  const body: Record<string, unknown> = {
    ...(description      ? { description }      : {}),
    ...(collection_date  ? { collection_date }  : {}),
    ...(received_date    ? { received_date }    : {}),
    ...(expiry_date      ? { expiry_date }      : {}),
    ...(status           ? { status }           : {}),
    ...(storage_location ? { storage_location } : {}),
    ...(barcode          ? { barcode }          : {}),
  }

  try {
    const res = await djangoFetch(`/api/lims/samples/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { detail?: string }
      return { message: data.detail ?? 'Failed to update sample.' }
    }
    revalidatePath('/dashboard/lab-samples')
    return { success: true, message: 'Sample updated.' }
  } catch (e) { return { message: String(e) } }
}


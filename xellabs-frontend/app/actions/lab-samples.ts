'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type DjangoSampleType = {
  id: number
  name: string
  prefix: string
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
  storage_location: string
  barcode: string
  is_locked: boolean
  created_at: string
}

export type LabSampleFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function getLabSamples(): Promise<LabSample[]> {
  try {
    const res = await djangoFetch('/api/lims/samples/?ordering=-created_at')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
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
    const resData = await res.json().catch(() => ({})) as { detail?: string; sample_id?: string }
    if (!res.ok) {
      return { message: resData.detail ?? 'Failed to receive sample.' }
    }
    revalidatePath('/dashboard/lab-samples')
    revalidatePath('/dashboard/sample-receipts')
    return { success: true, message: `Sample ${resData.sample_id ?? ''} marked as received.` }
  } catch (e) { return { message: String(e) } }
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


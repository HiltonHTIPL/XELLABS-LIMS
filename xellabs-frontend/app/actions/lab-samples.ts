'use server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/lib/session'

const DJANGO_API = process.env.DJANGO_API_URL ?? 'http://django:8001'

async function resolveDjangoToken(): Promise<string> {
  const session = await getSession()
  return session?.djangoToken || process.env.DJANGO_SERVICE_TOKEN || ''
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
  const token = await resolveDjangoToken()
  try {
    const res = await fetch(`${DJANGO_API}/api/lims/samples/?ordering=-created_at`, {
      headers: { Authorization: `Token ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export async function createLabSample(_state: LabSampleFormState, formData: FormData): Promise<LabSampleFormState> {
  const token = await resolveDjangoToken()
  const sample_id     = (formData.get('sample_id') as string)?.trim()
  const client        = (formData.get('client') as string)?.trim()
  const sample_type   = (formData.get('sample_type') as string)?.trim()
  const description   = (formData.get('description') as string)?.trim()
  const collection_date = (formData.get('collection_date') as string)?.trim()
  const received_date = (formData.get('received_date') as string)?.trim()
  const expiry_date   = (formData.get('expiry_date') as string)?.trim()
  const status        = (formData.get('status') as string)?.trim() || 'registered'
  const storage_location = (formData.get('storage_location') as string)?.trim()
  const barcode       = (formData.get('barcode') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!client)      errors.client      = ['Client is required']
  if (!sample_type) errors.sample_type = ['Sample type is required']
  if (Object.keys(errors).length) return { errors }

  const body: Record<string, unknown> = {
    status,
    is_active: true,
    ...(sample_id        ? { sample_id }        : {}),
    ...(client           ? { client: Number(client) }          : {}),
    ...(sample_type      ? { sample_type: Number(sample_type) } : {}),
    ...(description      ? { description }      : {}),
    ...(collection_date  ? { collection_date }  : {}),
    ...(received_date    ? { received_date }    : {}),
    ...(expiry_date      ? { expiry_date }      : {}),
    ...(storage_location ? { storage_location } : {}),
    ...(barcode          ? { barcode }          : {}),
  }

  try {
    const res = await fetch(`${DJANGO_API}/api/lims/samples/`, {
      method: 'POST',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) {
      return { message: data.sample_id?.[0] ?? data.client?.[0] ?? data.detail ?? 'Failed to register sample.' }
    }
    revalidatePath('/dashboard/lab-samples')
    return { success: true, message: `Sample ${data.sample_id} registered successfully.` }
  } catch (e) { return { message: String(e) } }
}

export async function updateLabSample(id: number, _state: LabSampleFormState, formData: FormData): Promise<LabSampleFormState> {
  const token = await resolveDjangoToken()
  const description   = (formData.get('description') as string)?.trim()
  const collection_date = (formData.get('collection_date') as string)?.trim()
  const received_date = (formData.get('received_date') as string)?.trim()
  const expiry_date   = (formData.get('expiry_date') as string)?.trim()
  const status        = (formData.get('status') as string)?.trim()
  const storage_location = (formData.get('storage_location') as string)?.trim()
  const barcode       = (formData.get('barcode') as string)?.trim()

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
    const res = await fetch(`${DJANGO_API}/api/lims/samples/${id}/`, {
      method: 'PATCH',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    if (!res.ok) {
      const data = await res.json()
      return { message: data.detail ?? 'Failed to update sample.' }
    }
    revalidatePath('/dashboard/lab-samples')
    return { success: true, message: 'Sample updated.' }
  } catch (e) { return { message: String(e) } }
}

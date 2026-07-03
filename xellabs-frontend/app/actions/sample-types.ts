'use server'
import { revalidatePath } from 'next/cache'
import {
  fetchSenaiteSampleTypes,
  createSenaiteSampleType,
  updateSenaiteSampleType,
  SenaiteSampleType,
} from '@/app/lib/senaite'
import { djangoFetch } from '@/app/lib/django'

const SENAITE_USER = process.env.SENAITE_ADMIN_USER ?? 'admin'
const SENAITE_PASS = process.env.SENAITE_ADMIN_PASS ?? 'admin'

function serverToken(): string {
  return Buffer.from(`${SENAITE_USER}:${SENAITE_PASS}`).toString('base64')
}

export async function getSampleTypesList(): Promise<SenaiteSampleType[]> {
  return fetchSenaiteSampleTypes(serverToken())
}

export type SampleTypeFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function createSampleType(
  _state: SampleTypeFormState,
  formData: FormData
): Promise<SampleTypeFormState> {
  const title         = (formData.get('title') as string)?.trim()
  const prefix        = (formData.get('Prefix') as string)?.trim()
  const minimumVolume = (formData.get('MinimumVolume') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!title)  errors.title  = ['Name is required']
  if (!prefix) errors.Prefix = ['Prefix is required']
  if (Object.keys(errors).length) return { errors }

  const result = await createSenaiteSampleType(serverToken(), {
    title,
    Prefix: prefix,
    ...(minimumVolume ? { MinimumVolume: minimumVolume } : {}),
  })

  if (!result.success) {
    // SENAITE returns field errors as JSON strings e.g. {"prefix": "No whitespaces in prefix allowed"}
    const raw = result.error ?? 'Failed to create sample type.'
    try {
      const parsed = JSON.parse(raw) as Record<string, string>
      const errors: Record<string, string[]> = {}
      if (parsed.prefix) errors.Prefix = [parsed.prefix]
      if (parsed.title)  errors.title  = [parsed.title]
      if (Object.keys(errors).length) return { errors }
    } catch { /* not JSON — fall through to message */ }
    return { message: raw }
  }

  // Mirror into Django so it appears in Lab Sample registration dropdowns
  await djangoFetch('/api/lims/sample-types/', {
    method: 'POST',
    body: JSON.stringify({ name: title, prefix, description: minimumVolume ?? '' }),
  }).catch(() => null) // non-fatal — SENAITE is the source of truth

  revalidatePath('/dashboard/sample-types')
  revalidatePath('/dashboard/lab-samples')
  return { success: true, message: `Sample type "${title}" created.` }
}

export async function updateSampleType(
  uid: string,
  _state: SampleTypeFormState,
  formData: FormData
): Promise<SampleTypeFormState> {
  const title         = (formData.get('title') as string)?.trim()
  const prefix        = (formData.get('Prefix') as string)?.trim()
  const minimumVolume = (formData.get('MinimumVolume') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!title)  errors.title  = ['Name is required']
  if (!prefix) errors.Prefix = ['Prefix is required']
  if (Object.keys(errors).length) return { errors }

  const result = await updateSenaiteSampleType(serverToken(), uid, {
    title,
    Prefix: prefix,
    ...(minimumVolume ? { MinimumVolume: minimumVolume } : {}),
  })

  if (!result.success) {
    const raw = result.error ?? 'Failed to update sample type.'
    try {
      const parsed = JSON.parse(raw) as Record<string, string>
      const errors: Record<string, string[]> = {}
      if (parsed.prefix) errors.Prefix = [parsed.prefix]
      if (parsed.title)  errors.title  = [parsed.title]
      if (Object.keys(errors).length) return { errors }
    } catch { /* not JSON */ }
    return { message: raw }
  }
  revalidatePath('/dashboard/sample-types')
  revalidatePath('/dashboard/lab-samples')
  return { success: true, message: `Sample type "${title}" updated.` }
}

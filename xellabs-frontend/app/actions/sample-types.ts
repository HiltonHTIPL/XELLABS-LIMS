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
  const retentionRaw  = (formData.get('retention_days') as string)?.trim()
  const retentionDays = Math.max(1, Number.parseInt(retentionRaw || '14', 10) || 14)

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
      const fieldErrs: Record<string, string[]> = {}
      if (parsed.prefix) fieldErrs.Prefix = [parsed.prefix]
      if (parsed.title)  fieldErrs.title  = [parsed.title]
      if (Object.keys(fieldErrs).length) return { errors: fieldErrs }
    } catch { /* not JSON — fall through to message */ }
    return { message: raw }
  }

  // Mirror into Django so it appears in Lab Sample registration dropdowns
  await djangoFetch('/api/lims/sample-types/', {
    method: 'POST',
    body: JSON.stringify({
      name: title,
      prefix,
      description: minimumVolume ?? '',
      retention_days: retentionDays,
    }),
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
  const retentionRaw  = (formData.get('retention_days') as string)?.trim()
  const retentionDays = Math.max(1, Number.parseInt(retentionRaw || '14', 10) || 14)

  const errors: Record<string, string[]> = {}
  if (!title)  errors.title  = ['Name is required']
  if (!prefix) errors.Prefix = ['Prefix is required']
  if (Object.keys(errors).length) return { errors }

  const result = await updateSenaiteSampleType(serverToken(), uid, {
    title,
    Prefix: prefix,
    ...(minimumVolume ? { MinimumVolume: minimumVolume, min_volume: minimumVolume } : {}),
  })

  if (!result.success) {
    const raw = result.error ?? 'Failed to update sample type.'
    try {
      const parsed = JSON.parse(raw) as Record<string, string>
      const fieldErrs: Record<string, string[]> = {}
      if (parsed.prefix) fieldErrs.Prefix = [parsed.prefix]
      if (parsed.title)  fieldErrs.title  = [parsed.title]
      if (Object.keys(fieldErrs).length) return { errors: fieldErrs }
    } catch { /* not JSON */ }
    return { message: raw }
  }

  // Keep Django retention period in sync for New UI due dates / Past Retention filter
  try {
    const listRes = await djangoFetch(`/api/lims/sample-types/?search=${encodeURIComponent(title)}`)
    if (listRes.ok) {
      const data = await listRes.json() as { results?: Array<{ id: number; name: string }> } | Array<{ id: number; name: string }>
      const rows = Array.isArray(data) ? data : (data.results ?? [])
      const match = rows.find(r => r.name === title) ?? rows[0]
      if (match) {
        await djangoFetch(`/api/lims/sample-types/${match.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: title,
            prefix,
            description: minimumVolume ?? '',
            retention_days: retentionDays,
          }),
        })
      }
    }
  } catch { /* non-fatal */ }

  revalidatePath('/dashboard/sample-types')
  revalidatePath('/dashboard/lab-samples')
  return { success: true, message: `Sample type "${title}" updated.` }
}

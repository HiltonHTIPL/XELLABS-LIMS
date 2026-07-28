'use server'
import { revalidatePath } from 'next/cache'
import {
  fetchSenaiteSampleTypes,
  fetchSenaiteSampleMatrices,
  fetchSenaiteContainerTypes,
  createSenaiteSampleType,
  updateSenaiteSampleType,
  createSenaiteContainerType,
  createSenaiteSampleMatrix,
  SenaiteSampleType,
  SenaiteRefOption,
  SampleTypePayload,
} from '@/app/lib/senaite'
import { djangoFetch } from '@/app/lib/django'
import { serverToken } from '@/app/lib/senaite-auth'

export async function getSampleTypesList(): Promise<SenaiteSampleType[]> {
  return fetchSenaiteSampleTypes(serverToken())
}

export type SampleTypesPageData = {
  sampleTypes: SenaiteSampleType[]
  sampleMatrices: SenaiteRefOption[]
  containerTypes: SenaiteRefOption[]
}

export async function getSampleTypesPageData(): Promise<SampleTypesPageData> {
  const token = serverToken()
  const [sampleTypes, sampleMatrices, containerTypes] = await Promise.all([
    fetchSenaiteSampleTypes(token),
    fetchSenaiteSampleMatrices(token),
    fetchSenaiteContainerTypes(token),
  ])
  return { sampleTypes, sampleMatrices, containerTypes }
}

export type SampleTypeFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

function parseFormPayload(formData: FormData): { payload: SampleTypePayload; errors: Record<string, string[]> } {
  const title       = (formData.get('title') as string)?.trim()
  const prefix      = (formData.get('Prefix') as string)?.trim()
  const minVolume   = (formData.get('MinimumVolume') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const hazardous   = formData.get('hazardous') === 'on'
  const sampleMatrixUid  = (formData.get('sampleMatrixUid') as string)?.trim()
  const containerTypeUid = (formData.get('containerTypeUid') as string)?.trim()
  const retentionDays    = Number(formData.get('retentionDays') ?? 0) || 0
  const retentionHours   = Number(formData.get('retentionHours') ?? 0) || 0
  const retentionMinutes = Number(formData.get('retentionMinutes') ?? 0) || 0
  const admittedStickers = formData.getAll('admittedStickers') as string[]
  const smallDefaultSticker = (formData.get('smallDefaultSticker') as string)?.trim()
  const largeDefaultSticker = (formData.get('largeDefaultSticker') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!title)  errors.title  = ['Name is required']
  if (!prefix) errors.Prefix = ['Prefix is required']

  return {
    payload: {
      title, Prefix: prefix,
      ...(minVolume ? { MinimumVolume: minVolume } : {}),
      description,
      retentionPeriod: { days: retentionDays, hours: retentionHours, minutes: retentionMinutes },
      hazardous,
      ...(sampleMatrixUid ? { sampleMatrixUid } : {}),
      ...(containerTypeUid ? { containerTypeUid } : {}),
      stickerTemplates: { admitted: admittedStickers, smallDefault: smallDefaultSticker, largeDefault: largeDefaultSticker },
    },
    errors,
  }
}

function parseSenaiteFieldErrors(raw: string): Record<string, string[]> | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    const errors: Record<string, string[]> = {}
    if (parsed.Prefix ?? parsed.prefix) errors.Prefix = [parsed.Prefix ?? parsed.prefix]
    if (parsed.title)  errors.title  = [parsed.title]
    return Object.keys(errors).length ? errors : null
  } catch { return null }
}

export async function createSampleType(
  _state: SampleTypeFormState,
  formData: FormData
): Promise<SampleTypeFormState> {
  const isImport = formData.get('_is_import') === 'true'
  formData.delete('_is_import')

  const { payload, errors } = parseFormPayload(formData)
  if (Object.keys(errors).length) return { errors }

  const result = await createSenaiteSampleType(serverToken(), payload)
  if (!result.success) {
    const raw = result.error ?? 'Failed to create sample type.'
    const fieldErrors = parseSenaiteFieldErrors(raw)
    if (fieldErrors) return { errors: fieldErrors }
    return { message: raw }
  }

  // Mirror into Django so it appears in Lab Sample registration dropdowns.
  // SENAITE remains the source of truth for every other field — this mirror
  // only carries what Django's own Sample-registration flow reads.
  await djangoFetch('/api/lims/sample-types/', {
    method: 'POST',
    auditSource: isImport ? 'import' : undefined,
    body: JSON.stringify({ name: payload.title, prefix: payload.Prefix, description: payload.description ?? '' }),
  }).catch(() => null) // non-fatal — SENAITE is the source of truth

  revalidatePath('/dashboard/sample-types')
  revalidatePath('/dashboard/samples-overview')
  const warning = result.warning ? ` Warning: retention period / sticker templates did not save (${result.warning}).` : ''
  return { success: true, message: `Sample type "${payload.title}" created.${warning}` }
}

export async function updateSampleType(
  uid: string,
  _state: SampleTypeFormState,
  formData: FormData
): Promise<SampleTypeFormState> {
  const { payload, errors } = parseFormPayload(formData)
  if (Object.keys(errors).length) return { errors }

  const result = await updateSenaiteSampleType(serverToken(), uid, payload)
  if (!result.success) {
    const raw = result.error ?? 'Failed to update sample type.'
    const fieldErrors = parseSenaiteFieldErrors(raw)
    if (fieldErrors) return { errors: fieldErrors }
    return { message: raw }
  }
  revalidatePath('/dashboard/sample-types')
  revalidatePath('/dashboard/samples-overview')
  const warning = result.warning ? ` Warning: retention period / sticker templates did not save (${result.warning}).` : ''
  return { success: true, message: `Sample type "${payload.title}" updated.${warning}` }
}

export type CreateRefOptionState = {
  success?: boolean
  message?: string
  option?: SenaiteRefOption
}

export async function createContainerType(
  _state: CreateRefOptionState,
  formData: FormData
): Promise<CreateRefOptionState> {
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  if (!title) return { message: 'Name is required.' }

  const result = await createSenaiteContainerType(serverToken(), { title, description })
  if (!result.success || !result.option) {
    return { message: result.error ?? 'Failed to create container type.' }
  }
  revalidatePath('/dashboard/sample-types')
  return { success: true, message: `Container type "${title}" created.`, option: result.option }
}

export async function createSampleMatrix(
  _state: CreateRefOptionState,
  formData: FormData
): Promise<CreateRefOptionState> {
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  if (!title) return { message: 'Name is required.' }

  const result = await createSenaiteSampleMatrix(serverToken(), { title, description })
  if (!result.success || !result.option) {
    return { message: result.error ?? 'Failed to create sample matrix.' }
  }
  revalidatePath('/dashboard/sample-types')
  return { success: true, message: `Sample matrix "${title}" created.`, option: result.option }
}

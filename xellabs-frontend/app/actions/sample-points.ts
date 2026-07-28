'use server'
import { revalidatePath } from 'next/cache'
import {
  fetchSenaiteSamplePointsFull,
  fetchSenaiteSampleTypes,
  createSenaiteSamplePointFull,
  updateSenaiteSamplePointFull,
  setSenaiteSamplePointActive,
  type SenaiteSamplePoint,
  type SenaiteRefOption,
  type SamplePointPayload,
  type SamplePointAttachment,
} from '@/app/lib/senaite'
import { serverToken } from '@/app/lib/senaite-auth'

export type SamplePointsPageData = {
  samplePoints: SenaiteSamplePoint[]
  sampleTypes: SenaiteRefOption[]
}

export async function getSamplePointsPageData(): Promise<SamplePointsPageData> {
  const token = serverToken()
  const [samplePoints, sampleTypes] = await Promise.all([
    fetchSenaiteSamplePointsFull(token),
    fetchSenaiteSampleTypes(token),
  ])
  return { samplePoints, sampleTypes: sampleTypes.map(t => ({ uid: t.uid, title: t.title })) }
}

export type SamplePointFormState = {
  success?: boolean
  message?: string
  warning?: string
  errors?: Record<string, string[]>
}

async function fileToAttachment(file: FormDataEntryValue | null): Promise<SamplePointAttachment | undefined> {
  if (!(file instanceof File) || file.size === 0) return undefined
  const buffer = Buffer.from(await file.arrayBuffer())
  return { data: buffer.toString('base64'), filename: file.name, contentType: file.type || 'application/octet-stream' }
}

function parsePayload(formData: FormData): { payload: SamplePointPayload; errors: Record<string, string[]> } {
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const elevation = (formData.get('elevation') as string)?.trim()
  const latitude = (formData.get('latitude') as string)?.trim()
  const longitude = (formData.get('longitude') as string)?.trim()
  const days = Number(formData.get('frequencyDays')) || 0
  const hours = Number(formData.get('frequencyHours')) || 0
  const minutes = Number(formData.get('frequencyMinutes')) || 0
  const composite = formData.get('composite') === 'on'
  const sampleTypeUidsRaw = (formData.get('sampleTypeUids') as string)?.trim()
  const sampleTypeUids = sampleTypeUidsRaw ? JSON.parse(sampleTypeUidsRaw) as string[] : []

  const errors: Record<string, string[]> = {}
  if (!title) errors.title = ['Name is required']

  return {
    payload: {
      title, description, elevation, latitude, longitude,
      samplingFrequency: { days, hours, minutes },
      sampleTypeUids, composite,
    },
    errors,
  }
}

export async function createSamplePointFull(
  _state: SamplePointFormState,
  formData: FormData,
): Promise<SamplePointFormState> {
  const { payload, errors } = parsePayload(formData)
  if (Object.keys(errors).length) return { errors }

  const attachment = await fileToAttachment(formData.get('attachment'))
  const result = await createSenaiteSamplePointFull(serverToken(), payload, attachment)
  if (!result.success) return { message: result.error ?? 'Failed to create sample point.' }

  revalidatePath('/dashboard/sample-points')
  return { success: true, message: `Sample point "${payload.title}" created.`, warning: result.warning }
}

export async function updateSamplePointFull(
  uid: string,
  url: string,
  _state: SamplePointFormState,
  formData: FormData,
): Promise<SamplePointFormState> {
  const { payload, errors } = parsePayload(formData)
  if (Object.keys(errors).length) return { errors }

  const attachment = await fileToAttachment(formData.get('attachment'))
  const result = await updateSenaiteSamplePointFull(serverToken(), uid, url, payload, attachment)
  if (!result.success) return { message: result.error ?? 'Failed to update sample point.' }

  revalidatePath('/dashboard/sample-points')
  return { success: true, message: `Sample point "${payload.title}" updated.`, warning: result.warning }
}

export type ToggleSamplePointState = { success: boolean; message: string }

export async function toggleSamplePointActiveFull(url: string, active: boolean): Promise<ToggleSamplePointState> {
  const result = await setSenaiteSamplePointActive(serverToken(), url, active)
  if (!result.success) return { success: false, message: result.error ?? 'Failed to update status.' }
  revalidatePath('/dashboard/sample-points')
  return { success: true, message: active ? 'Sample point activated.' : 'Sample point deactivated.' }
}

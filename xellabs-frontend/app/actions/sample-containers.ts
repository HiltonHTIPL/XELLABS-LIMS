'use server'
import { revalidatePath } from 'next/cache'
import {
  fetchSenaiteSampleContainersFull,
  fetchSenaiteContainerTypes,
  fetchSenaitePreservations,
  createSenaiteSampleContainerFull,
  updateSenaiteSampleContainer,
  createSenaiteContainerType,
  createSenaiteSamplePreservation,
  SenaiteSampleContainer,
  SenaiteRefOption,
  SampleContainerPayload,
} from '@/app/lib/senaite'
import { serverToken } from '@/app/lib/senaite-auth'

export type SampleContainersPageData = {
  sampleContainers: SenaiteSampleContainer[]
  containerTypes: SenaiteRefOption[]
  preservations: SenaiteRefOption[]
}

export async function getSampleContainersPageData(): Promise<SampleContainersPageData> {
  const token = serverToken()
  const [sampleContainers, containerTypes, preservations] = await Promise.all([
    fetchSenaiteSampleContainersFull(token),
    fetchSenaiteContainerTypes(token),
    fetchSenaitePreservations(token),
  ])
  return { sampleContainers, containerTypes, preservations }
}

export type SampleContainerFormState = {
  success?: boolean
  message?: string
  warning?: string
  errors?: Record<string, string[]>
}

function parsePayload(formData: FormData): { payload: SampleContainerPayload; errors: Record<string, string[]> } {
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const capacity = (formData.get('capacity') as string)?.trim()
  const containerTypeUid = (formData.get('containerTypeUid') as string)?.trim()
  const preservationUid = (formData.get('preservationUid') as string)?.trim()
  const prePreserved = formData.get('prePreserved') === 'on'
  const securitySealIntact = formData.get('securitySealIntact') === 'on'

  const errors: Record<string, string[]> = {}
  if (!title) errors.title = ['Name is required']
  if (prePreserved && !preservationUid) errors.preservationUid = ['Preservation is required for pre-preserved containers']

  return {
    payload: {
      title, description, capacity,
      ...(containerTypeUid ? { containerTypeUid } : {}),
      ...(preservationUid ? { preservationUid } : {}),
      prePreserved, securitySealIntact,
    },
    errors,
  }
}

export async function createSampleContainerFull(
  _state: SampleContainerFormState,
  formData: FormData
): Promise<SampleContainerFormState> {
  const { payload, errors } = parsePayload(formData)
  if (Object.keys(errors).length) return { errors }

  const result = await createSenaiteSampleContainerFull(serverToken(), payload)
  if (!result.success) return { message: result.error ?? 'Failed to create sample container.' }

  revalidatePath('/dashboard/sample-containers')
  return { success: true, message: `Sample container "${payload.title}" created.`, warning: result.warning }
}

export async function updateSampleContainerFull(
  uid: string,
  url: string,
  _state: SampleContainerFormState,
  formData: FormData
): Promise<SampleContainerFormState> {
  const { payload, errors } = parsePayload(formData)
  if (Object.keys(errors).length) return { errors }

  const result = await updateSenaiteSampleContainer(serverToken(), uid, url, payload)
  if (!result.success) return { message: result.error ?? 'Failed to update sample container.' }

  revalidatePath('/dashboard/sample-containers')
  return { success: true, message: `Sample container "${payload.title}" updated.`, warning: result.warning }
}

export type CreateRefOptionState = {
  success?: boolean
  message?: string
  option?: SenaiteRefOption
}

export async function createContainerTypeInline(
  _state: CreateRefOptionState,
  formData: FormData
): Promise<CreateRefOptionState> {
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  if (!title) return { message: 'Name is required.' }
  const result = await createSenaiteContainerType(serverToken(), { title, description })
  if (!result.success || !result.option) return { message: result.error ?? 'Failed to create container type.' }
  revalidatePath('/dashboard/sample-containers')
  return { success: true, message: `Container type "${title}" created.`, option: result.option }
}

export async function createPreservationInline(
  _state: CreateRefOptionState,
  formData: FormData
): Promise<CreateRefOptionState> {
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  if (!title) return { message: 'Name is required.' }
  const result = await createSenaiteSamplePreservation(serverToken(), { title, description })
  if (!result.success || !result.option) return { message: result.error ?? 'Failed to create preservation.' }
  revalidatePath('/dashboard/sample-containers')
  return { success: true, message: `Preservation "${title}" created.`, option: result.option }
}

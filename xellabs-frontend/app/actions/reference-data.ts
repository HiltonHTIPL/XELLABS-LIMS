'use server'
import { revalidatePath } from 'next/cache'
import {
  fetchSenaiteSampleContainers,
  fetchSenaitePreservations,
  fetchSenaiteSamplePoints,
  fetchSenaiteSamplingDeviations,
  createSenaiteSampleContainer,
  createSenaiteSamplePreservation,
  createSenaiteSamplingDeviation,
  updateSenaiteSamplePreservation,
  updateSenaiteSamplingDeviation,
  setSenaiteSamplePreservationActive,
  setSenaiteSamplingDeviationActive,
  type SenaiteRefOption,
} from '@/app/lib/senaite'
import { serverToken } from '@/app/lib/senaite-auth'

export type CreateRefOptionState = {
  success?: boolean
  message?: string
  option?: SenaiteRefOption
}

export type ToggleRefOptionState = { success: boolean; message: string }

function parseRefFormData(formData: FormData): { title: string; description: string } {
  return {
    title: (formData.get('title') as string)?.trim() ?? '',
    description: (formData.get('description') as string)?.trim() ?? '',
  }
}

export async function getSampleContainers(): Promise<SenaiteRefOption[]> {
  return fetchSenaiteSampleContainers(serverToken())
}

export async function createSampleContainer(_state: CreateRefOptionState, formData: FormData): Promise<CreateRefOptionState> {
  const { title, description } = parseRefFormData(formData)
  if (!title) return { message: 'Name is required.' }
  const result = await createSenaiteSampleContainer(serverToken(), { title, description })
  if (!result.success || !result.option) return { message: result.error ?? 'Failed to create container.' }
  return { success: true, message: `Container "${title}" created.`, option: result.option }
}

export async function getPreservations(): Promise<SenaiteRefOption[]> {
  return fetchSenaitePreservations(serverToken())
}

export async function createPreservation(_state: CreateRefOptionState, formData: FormData): Promise<CreateRefOptionState> {
  const { title, description } = parseRefFormData(formData)
  if (!title) return { message: 'Name is required.' }
  const result = await createSenaiteSamplePreservation(serverToken(), { title, description })
  if (!result.success || !result.option) return { message: result.error ?? 'Failed to create preservation.' }
  return { success: true, message: `Preservation "${title}" created.`, option: result.option }
}

export async function updatePreservation(uid: string, _state: CreateRefOptionState, formData: FormData): Promise<CreateRefOptionState> {
  const { title, description } = parseRefFormData(formData)
  if (!title) return { message: 'Name is required.' }
  const result = await updateSenaiteSamplePreservation(serverToken(), uid, { title, description })
  if (!result.success) return { message: result.error ?? 'Failed to update preservation.' }
  revalidatePath('/dashboard/preservations')
  return { success: true, message: `Preservation "${title}" updated.`, option: { uid, title, description } }
}

export async function togglePreservationActive(url: string, active: boolean): Promise<ToggleRefOptionState> {
  const result = await setSenaiteSamplePreservationActive(serverToken(), url, active)
  if (!result.success) return { success: false, message: result.error ?? 'Failed to update status.' }
  revalidatePath('/dashboard/preservations')
  return { success: true, message: active ? 'Preservation activated.' : 'Preservation deactivated.' }
}

// Simple ref-list read only — used for the New Sample page's Sample Point
// dropdown. The Sample Points admin page itself has its own richer full-CRUD
// action set (app/actions/sample-points.ts), since it needs SENAITE-native
// fields beyond name+description (Sampling Frequency, Sample Types, Composite,
// Attachment, Location) that this generic shell shape doesn't carry.
export async function getSamplePoints(): Promise<SenaiteRefOption[]> {
  return fetchSenaiteSamplePoints(serverToken())
}

export async function getSamplingDeviations(): Promise<SenaiteRefOption[]> {
  return fetchSenaiteSamplingDeviations(serverToken())
}

export async function createSamplingDeviation(_state: CreateRefOptionState, formData: FormData): Promise<CreateRefOptionState> {
  const { title, description } = parseRefFormData(formData)
  if (!title) return { message: 'Name is required.' }
  const result = await createSenaiteSamplingDeviation(serverToken(), { title, description })
  if (!result.success || !result.option) return { message: result.error ?? 'Failed to create sampling deviation.' }
  return { success: true, message: `Sampling deviation "${title}" created.`, option: result.option }
}

export async function updateSamplingDeviation(uid: string, _state: CreateRefOptionState, formData: FormData): Promise<CreateRefOptionState> {
  const { title, description } = parseRefFormData(formData)
  if (!title) return { message: 'Name is required.' }
  const result = await updateSenaiteSamplingDeviation(serverToken(), uid, { title, description })
  if (!result.success) return { message: result.error ?? 'Failed to update sampling deviation.' }
  revalidatePath('/dashboard/sampling-deviations')
  return { success: true, message: `Sampling deviation "${title}" updated.`, option: { uid, title, description } }
}

export async function toggleSamplingDeviationActive(url: string, active: boolean): Promise<ToggleRefOptionState> {
  const result = await setSenaiteSamplingDeviationActive(serverToken(), url, active)
  if (!result.success) return { success: false, message: result.error ?? 'Failed to update status.' }
  revalidatePath('/dashboard/sampling-deviations')
  return { success: true, message: active ? 'Sampling deviation activated.' : 'Sampling deviation deactivated.' }
}

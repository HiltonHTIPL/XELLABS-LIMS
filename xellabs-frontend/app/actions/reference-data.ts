'use server'
import {
  fetchSenaiteSampleContainers,
  fetchSenaitePreservations,
  fetchSenaiteSamplePoints,
  createSenaiteSampleContainer,
  createSenaiteSamplePreservation,
  createSenaiteSamplePoint,
  type SenaiteRefOption,
} from '@/app/lib/senaite'
import { serverToken } from '@/app/lib/senaite-auth'

export type { SenaiteRefOption }

export type CreateRefOptionState = {
  success?: boolean
  message?: string
  option?: SenaiteRefOption
}

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

export async function getSamplePoints(): Promise<SenaiteRefOption[]> {
  return fetchSenaiteSamplePoints(serverToken())
}

export async function createSamplePoint(_state: CreateRefOptionState, formData: FormData): Promise<CreateRefOptionState> {
  const { title, description } = parseRefFormData(formData)
  if (!title) return { message: 'Name is required.' }
  const result = await createSenaiteSamplePoint(serverToken(), { title, description })
  if (!result.success || !result.option) return { message: result.error ?? 'Failed to create sample point.' }
  return { success: true, message: `Sample point "${title}" created.`, option: result.option }
}

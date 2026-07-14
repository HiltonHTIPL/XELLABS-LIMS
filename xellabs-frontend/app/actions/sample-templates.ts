'use server'
import { revalidatePath } from 'next/cache'
import {
  fetchSenaiteSampleTemplates,
  createSenaiteSampleTemplate,
  updateSenaiteSampleTemplate,
  deleteSenaiteSampleTemplate,
  fetchSenaiteSampleTypes,
  fetchSenaiteSamplePoints,
  fetchSenaiteSampleContainers,
  fetchSenaitePreservations,
  fetchSenaiteAnalysisServices,
  createSenaiteSampleContainer,
  createSenaiteSamplePreservation,
  createSenaiteSamplePoint,
  type SenaiteSampleTemplate,
  type SampleTemplatePayload,
  type SampleTemplatePartition,
  type SampleTemplateService,
  type SenaiteSampleType,
  type SenaiteRefOption,
  type SenaiteAnalysisService,
} from '@/app/lib/senaite'
import { serverToken } from '@/app/lib/senaite-auth'

export type SampleTemplatesPageData = {
  sampleTemplates: SenaiteSampleTemplate[]
  sampleTypes: SenaiteSampleType[]
  samplePoints: SenaiteRefOption[]
  sampleContainers: SenaiteRefOption[]
  preservations: SenaiteRefOption[]
  analysisServices: SenaiteAnalysisService[]
}

export async function getSampleTemplatesPageData(): Promise<SampleTemplatesPageData> {
  const token = serverToken()
  const [sampleTemplates, sampleTypes, samplePoints, sampleContainers, preservations, analysisServices] =
    await Promise.all([
      fetchSenaiteSampleTemplates(token),
      fetchSenaiteSampleTypes(token),
      fetchSenaiteSamplePoints(token),
      fetchSenaiteSampleContainers(token),
      fetchSenaitePreservations(token),
      fetchSenaiteAnalysisServices(token),
    ])
  return { sampleTemplates, sampleTypes, samplePoints, sampleContainers, preservations, analysisServices }
}

export type SampleTemplateFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, unknown>
}

function parsePayload(formData: FormData): { payload: SampleTemplatePayload; errors: Record<string, string[]> } {
  const title            = (formData.get('title') as string)?.trim()
  const description       = (formData.get('description') as string)?.trim() ?? ''
  const sampleTypeUid     = (formData.get('sampleTypeUid') as string)?.trim()
  const samplePointUid    = (formData.get('samplePointUid') as string)?.trim() ?? ''
  const composite         = formData.get('composite') === 'on'
  const samplingRequired  = formData.get('samplingRequired') === 'on'
  const autoPartition     = formData.get('autoPartition') === 'on'
  const partitions        = JSON.parse((formData.get('partitions') as string) || '[]') as SampleTemplatePartition[]
  const services          = JSON.parse((formData.get('services') as string) || '[]') as SampleTemplateService[]

  const errors: Record<string, string[]> = {}
  if (!title) errors.title = ['Template name is required']

  return {
    errors,
    payload: {
      title,
      description,
      sampleTypeUid,
      samplePointUid,
      composite,
      samplingRequired,
      autoPartition,
      partitions,
      services,
    },
  }
}

export async function createSampleTemplate(
  _state: SampleTemplateFormState,
  formData: FormData
): Promise<SampleTemplateFormState> {
  const { errors, payload } = parsePayload(formData)
  if (Object.keys(errors).length) return { errors }

  const result = await createSenaiteSampleTemplate(serverToken(), payload)
  if (!result.success) {
    return { message: result.error ?? 'Failed to create sample template.' }
  }
  revalidatePath('/dashboard/sample-templates')
  revalidatePath('/dashboard/samples/new')
  return { success: true, message: `Sample template "${payload.title}" created.` }
}

export async function updateSampleTemplate(
  url: string,
  _state: SampleTemplateFormState,
  formData: FormData
): Promise<SampleTemplateFormState> {
  const { errors, payload } = parsePayload(formData)
  if (Object.keys(errors).length) return { errors }

  const result = await updateSenaiteSampleTemplate(serverToken(), url, payload)
  if (!result.success) {
    return { message: result.error ?? 'Failed to update sample template.' }
  }
  revalidatePath('/dashboard/sample-templates')
  revalidatePath('/dashboard/samples/new')
  return { success: true, message: `Sample template "${payload.title}" updated.` }
}

export async function deleteSampleTemplate(url: string): Promise<{ success: boolean; message?: string }> {
  const result = await deleteSenaiteSampleTemplate(serverToken(), url)
  if (!result.success) {
    return { success: false, message: result.error ?? 'Failed to delete sample template.' }
  }
  revalidatePath('/dashboard/sample-templates')
  revalidatePath('/dashboard/samples/new')
  return { success: true }
}

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

export async function createSampleContainer(_state: CreateRefOptionState, formData: FormData): Promise<CreateRefOptionState> {
  const { title, description } = parseRefFormData(formData)
  if (!title) return { message: 'Name is required.' }
  const result = await createSenaiteSampleContainer(serverToken(), { title, description })
  if (!result.success || !result.option) return { message: result.error ?? 'Failed to create container.' }
  return { success: true, message: `Container "${title}" created.`, option: result.option }
}

export async function createPreservation(_state: CreateRefOptionState, formData: FormData): Promise<CreateRefOptionState> {
  const { title, description } = parseRefFormData(formData)
  if (!title) return { message: 'Name is required.' }
  const result = await createSenaiteSamplePreservation(serverToken(), { title, description })
  if (!result.success || !result.option) return { message: result.error ?? 'Failed to create preservation.' }
  return { success: true, message: `Preservation "${title}" created.`, option: result.option }
}

export async function createSamplePoint(_state: CreateRefOptionState, formData: FormData): Promise<CreateRefOptionState> {
  const { title, description } = parseRefFormData(formData)
  if (!title) return { message: 'Name is required.' }
  const result = await createSenaiteSamplePoint(serverToken(), { title, description })
  if (!result.success || !result.option) return { message: result.error ?? 'Failed to create sample point.' }
  return { success: true, message: `Sample point "${title}" created.`, option: result.option }
}

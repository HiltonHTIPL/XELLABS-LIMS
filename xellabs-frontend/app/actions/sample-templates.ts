'use server'
import { revalidatePath } from 'next/cache'
import {
  fetchSenaiteSampleTemplates,
  createSenaiteSampleTemplate,
  updateSenaiteSampleTemplate,
  deleteSenaiteSampleTemplate,
  fetchSenaiteSampleTypes,
  fetchSenaiteAnalysisServices,
  type SenaiteSampleTemplate,
  type SampleTemplatePayload,
  type SampleTemplatePartition,
  type SampleTemplateService,
  type SenaiteSampleType,
  type SenaiteRefOption,
  type SenaiteAnalysisService,
} from '@/app/lib/senaite'
import { serverToken } from '@/app/lib/senaite-auth'
import { getSampleContainers, getPreservations, getSamplePoints } from '@/app/actions/reference-data'

export type SampleTemplatesPageData = {
  sampleTemplates: SenaiteSampleTemplate[]
  sampleTypes: SenaiteSampleType[]
  samplePoints: SenaiteRefOption[]
  sampleContainers: SenaiteRefOption[]
  preservations: SenaiteRefOption[]
  analysisServices: SenaiteAnalysisService[]
}

// `includeSampleTypesAndServices` defaults true for callers (e.g. the Sample
// Templates admin page) that need those two fields from this function's own
// return value. Pass false when the caller already fetches sample types and
// analysis services itself elsewhere in the same page load (e.g. New Sample) —
// skips two redundant `complete=true` SENAITE calls that were previously
// fetched here and then never read from this function's result.
export async function getSampleTemplatesPageData(includeSampleTypesAndServices = true): Promise<SampleTemplatesPageData> {
  const token = serverToken()
  const [sampleTemplates, sampleTypes, samplePoints, sampleContainers, preservations, analysisServices] =
    await Promise.all([
      fetchSenaiteSampleTemplates(token),
      includeSampleTypesAndServices ? fetchSenaiteSampleTypes(token) : Promise.resolve([]),
      getSamplePoints(),
      getSampleContainers(),
      getPreservations(),
      includeSampleTypesAndServices ? fetchSenaiteAnalysisServices(token) : Promise.resolve([]),
    ])
  return { sampleTemplates, sampleTypes, samplePoints, sampleContainers, preservations, analysisServices }
}

/**
 * Lean variant for callers that only need sampleTemplates + sampleContainers
 * (both New Sample pages, and the Samples list) — the full
 * `getSampleTemplatesPageData` above also fetches the FULL sampleTypes list
 * (fetchSenaiteSampleTypes does one extra restapi round-trip PER sample type)
 * and the FULL analysisServices list (complete=true), purely for the Sample
 * Templates admin page's own edit form. Those three callers threw both away
 * unused — this skips fetching them at all.
 */
export async function getSampleTemplatesForNewSample(): Promise<Pick<SampleTemplatesPageData, 'sampleTemplates' | 'sampleContainers'>> {
  const token = serverToken()
  const [sampleTemplates, sampleContainers] = await Promise.all([
    fetchSenaiteSampleTemplates(token),
    getSampleContainers(),
  ])
  return { sampleTemplates, sampleContainers }
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
  return {
    success: true,
    message: result.warning
      ? `Sample template "${payload.title}" created, but: ${result.warning}`
      : `Sample template "${payload.title}" created.`,
  }
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


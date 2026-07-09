'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type AnalysisServiceRef = { uid: string; title: string }

export type SampleTemplate = {
  id: number
  name: string
  sample_type_uid: string
  sample_type_name: string
  analysis_services: AnalysisServiceRef[]
  container: string
  is_active: boolean
}

export async function getSampleTemplates(): Promise<SampleTemplate[]> {
  const res = await djangoFetch('/api/lims/sample-templates/?is_active=true&ordering=name')
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : (data.results ?? [])
}

export type SampleTemplateFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

function parsePayload(formData: FormData) {
  const name           = (formData.get('name') as string)?.trim()
  const sampleTypeUid   = (formData.get('sample_type_uid') as string)?.trim()
  const sampleTypeName  = (formData.get('sample_type_name') as string)?.trim()
  const container        = (formData.get('container') as string)?.trim() ?? ''
  const analysisServices = JSON.parse((formData.get('analysis_services') as string) || '[]')

  const errors: Record<string, string[]> = {}
  if (!name) errors.name = ['Template name is required']
  if (!sampleTypeUid) errors.sample_type_uid = ['Sample type is required']

  return {
    errors,
    payload: {
      name,
      sample_type_uid: sampleTypeUid,
      sample_type_name: sampleTypeName,
      container,
      analysis_services: analysisServices,
    },
  }
}

export async function createSampleTemplate(
  _state: SampleTemplateFormState,
  formData: FormData
): Promise<SampleTemplateFormState> {
  const { errors, payload } = parsePayload(formData)
  if (Object.keys(errors).length) return { errors }

  const res = await djangoFetch('/api/lims/sample-templates/', {
    method: 'POST',
    body: JSON.stringify({ ...payload, is_active: true }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as Record<string, string[]>
    return { errors: data, message: 'Failed to create sample template.' }
  }
  revalidatePath('/dashboard/sample-templates')
  revalidatePath('/dashboard/samples/new')
  return { success: true, message: `Sample template "${payload.name}" created.` }
}

export async function updateSampleTemplate(
  id: number,
  _state: SampleTemplateFormState,
  formData: FormData
): Promise<SampleTemplateFormState> {
  const { errors, payload } = parsePayload(formData)
  if (Object.keys(errors).length) return { errors }

  const res = await djangoFetch(`/api/lims/sample-templates/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as Record<string, string[]>
    return { errors: data, message: 'Failed to update sample template.' }
  }
  revalidatePath('/dashboard/sample-templates')
  revalidatePath('/dashboard/samples/new')
  return { success: true, message: `Sample template "${payload.name}" updated.` }
}

export async function deleteSampleTemplate(id: number): Promise<{ success: boolean; message?: string }> {
  const res = await djangoFetch(`/api/lims/sample-templates/${id}/`, { method: 'DELETE' })
  if (!res.ok) return { success: false, message: 'Failed to delete sample template.' }
  revalidatePath('/dashboard/sample-templates')
  revalidatePath('/dashboard/samples/new')
  return { success: true }
}

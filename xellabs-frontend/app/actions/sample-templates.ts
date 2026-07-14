'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type AnalysisServiceRef = { uid: string; title: string; hidden?: boolean }

export type TemplatePartition = {
  part_id: string
  container_uid: string
  container_name: string
  preservation_uid: string
  preservation_name: string
  sample_type_uid: string
  sample_type_name: string
  services: AnalysisServiceRef[]
}

export type SampleTemplate = {
  id: number
  name: string
  description: string
  sample_type_uid: string
  sample_type_name: string
  sample_point_uid: string
  sample_point_name: string
  composite: boolean
  sampling_required: boolean
  auto_partition: boolean
  partitions: TemplatePartition[]
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
  const name              = (formData.get('name') as string)?.trim()
  const description       = (formData.get('description') as string)?.trim() ?? ''
  const sampleTypeUid     = (formData.get('sample_type_uid') as string)?.trim()
  const sampleTypeName    = (formData.get('sample_type_name') as string)?.trim()
  const samplePointUid    = (formData.get('sample_point_uid') as string)?.trim() ?? ''
  const samplePointName   = (formData.get('sample_point_name') as string)?.trim() ?? ''
  const composite         = formData.get('composite') === 'true'
  const samplingRequired  = formData.get('sampling_required') === 'true'
  const autoPartition     = formData.get('auto_partition') === 'true'
  const partitions        = JSON.parse((formData.get('partitions') as string) || '[]')

  const errors: Record<string, string[]> = {}
  if (!name) errors.name = ['Template name is required']
  if (!sampleTypeUid) errors.sample_type_uid = ['Sample type is required']

  return {
    errors,
    payload: {
      name,
      description,
      sample_type_uid: sampleTypeUid,
      sample_type_name: sampleTypeName,
      sample_point_uid: samplePointUid,
      sample_point_name: samplePointName,
      composite,
      sampling_required: samplingRequired,
      auto_partition: autoPartition,
      partitions,
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

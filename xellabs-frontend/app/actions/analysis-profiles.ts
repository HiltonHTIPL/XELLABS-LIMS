'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type AnalysisServiceRef = { uid: string; title: string }

export type AnalysisProfile = {
  id: number
  name: string
  analysis_services: AnalysisServiceRef[]
  is_active: boolean
}

export async function getAnalysisProfiles(): Promise<AnalysisProfile[]> {
  const res = await djangoFetch('/api/lims/analysis-profiles/?is_active=true&ordering=name')
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : (data.results ?? [])
}

export type AnalysisProfileFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

function parsePayload(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  const analysisServices = JSON.parse((formData.get('analysis_services') as string) || '[]')

  const errors: Record<string, string[]> = {}
  if (!name) errors.name = ['Profile name is required']
  if (!Array.isArray(analysisServices) || analysisServices.length === 0) {
    errors.analysis_services = ['Select at least one analysis']
  }

  return { errors, payload: { name, analysis_services: analysisServices } }
}

export async function createAnalysisProfile(
  _state: AnalysisProfileFormState,
  formData: FormData
): Promise<AnalysisProfileFormState> {
  const { errors, payload } = parsePayload(formData)
  if (Object.keys(errors).length) return { errors }

  const res = await djangoFetch('/api/lims/analysis-profiles/', {
    method: 'POST',
    body: JSON.stringify({ ...payload, is_active: true }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as Record<string, string[]>
    return { errors: data, message: 'Failed to create analysis profile.' }
  }
  revalidatePath('/dashboard/analysis-profiles')
  revalidatePath('/dashboard/samples/new')
  return { success: true, message: `Analysis profile "${payload.name}" created.` }
}

export async function updateAnalysisProfile(
  id: number,
  _state: AnalysisProfileFormState,
  formData: FormData
): Promise<AnalysisProfileFormState> {
  const { errors, payload } = parsePayload(formData)
  if (Object.keys(errors).length) return { errors }

  const res = await djangoFetch(`/api/lims/analysis-profiles/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as Record<string, string[]>
    return { errors: data, message: 'Failed to update analysis profile.' }
  }
  revalidatePath('/dashboard/analysis-profiles')
  revalidatePath('/dashboard/samples/new')
  return { success: true, message: `Analysis profile "${payload.name}" updated.` }
}

export async function deleteAnalysisProfile(id: number): Promise<{ success: boolean; message?: string }> {
  const res = await djangoFetch(`/api/lims/analysis-profiles/${id}/`, { method: 'DELETE' })
  if (!res.ok) return { success: false, message: 'Failed to delete analysis profile.' }
  revalidatePath('/dashboard/analysis-profiles')
  revalidatePath('/dashboard/samples/new')
  return { success: true }
}

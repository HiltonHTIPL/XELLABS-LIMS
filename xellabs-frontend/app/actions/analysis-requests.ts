'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type AnalysisRequestAnalysis = {
  id?: number
  senaite_service_uid: string
  senaite_service_name: string
}

export type AnalysisRequest = {
  id: number
  ar_id: string
  sample: number
  sample_id: string
  analyses: AnalysisRequestAnalysis[]
  status: string
  priority: string
  due_date: string | null
  notes: string
  created_by_name: string
  created_at: string
}

export type ARFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function getAnalysisRequests(): Promise<AnalysisRequest[]> {
  try {
    const res = await djangoFetch('/api/lims/analysis-requests/?ordering=-created_at')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export async function getAnalysisRequestsForSample(sampleId: number): Promise<AnalysisRequest[]> {
  try {
    const res = await djangoFetch(`/api/lims/analysis-requests/?sample=${sampleId}&ordering=-created_at`)
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

function parseAnalyses(formData: FormData): AnalysisRequestAnalysis[] {
  try {
    return JSON.parse((formData.get('analyses_json') as string) || '[]')
  } catch { return [] }
}

export async function createAnalysisRequest(_state: ARFormState, formData: FormData): Promise<ARFormState> {
  const sample   = (formData.get('sample') as string)?.trim()
  const analyses = parseAnalyses(formData)
  const status   = (formData.get('status') as string)?.trim() || 'pending'
  const priority = (formData.get('priority') as string)?.trim() || 'normal'
  const due_date = (formData.get('due_date') as string)?.trim()
  const notes    = (formData.get('notes') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!sample)          errors.sample   = ['Sample is required']
  if (!analyses.length) errors.analyses = ['At least one test is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch('/api/lims/analysis-requests/', {
      method: 'POST',
      body: JSON.stringify({
        sample: Number(sample),
        analyses,
        status,
        priority,
        ...(due_date ? { due_date } : {}),
        ...(notes    ? { notes }    : {}),
      }),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) {
      return { message: (data.sample as string[])?.[0] ?? (data.analyses as string[])?.[0] ?? (data.detail as string) ?? 'Failed to create analysis request.' }
    }
    revalidatePath('/dashboard/analysis-requests')
    return { success: true, message: `Analysis request ${data.ar_id} created.` }
  } catch (e) {
    console.error('[AR_CREATE_ERROR]', e)
    return { message: 'An unexpected error occurred. Please try again.' }
  }
}

export async function updateAnalysisRequest(id: number, _state: ARFormState, formData: FormData): Promise<ARFormState> {
  const analyses = parseAnalyses(formData)
  const priority = (formData.get('priority') as string)?.trim() || 'normal'
  const due_date = (formData.get('due_date') as string)?.trim()
  const notes    = (formData.get('notes') as string)?.trim()

  if (!analyses.length) return { errors: { analyses: ['At least one test is required'] } }

  try {
    const res = await djangoFetch(`/api/lims/analysis-requests/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({
        analyses,
        priority,
        due_date: due_date || null,
        notes: notes ?? '',
      }),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) {
      const msg =
        (Array.isArray(data) ? String(data[0]) : undefined) ??
        (data.analyses as string[])?.[0] ??
        (data.detail as string) ??
        Object.values(data).flat().map(String)[0] ??
        'Failed to update analysis request.'
      return { message: msg }
    }
    revalidatePath('/dashboard/analysis-requests')
    return { success: true, message: `Analysis request ${data.ar_id} updated.` }
  } catch (e) {
    console.error('[AR_EDIT_ERROR]', e)
    return { message: 'An unexpected error occurred. Please try again.' }
  }
}

export async function updateARStatus(id: number, status: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/lims/analysis-requests/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      const msg = (data.status as string[])?.[0] ?? (data.detail as string) ?? `Failed to update status (${res.status}).`
      return { success: false, message: msg }
    }
    revalidatePath('/dashboard/analysis-requests')
    return { success: true, message: 'Status updated.' }
  } catch (e) {
    console.error('[AR_UPDATE_ERROR]', e)
    return { success: false, message: 'An unexpected error occurred. Please try again.' }
  }
}

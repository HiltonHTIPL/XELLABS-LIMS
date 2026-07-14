'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type SpecificationRow = {
  id?: number
  test: number
  min_value: string | null
  max_value: string | null
  min_operator: string
  max_operator: string
  min_warn: string | null
  max_warn: string | null
  out_of_range_low: string
  out_of_range_high: string
  out_of_range_comment: string
  is_active: boolean
}

export type AnalysisSpecification = {
  id: number
  title: string
  description: string
  sample_type: number
  dynamic_spec: number | null
  is_active: boolean
  created_at: string
  rows: SpecificationRow[]
}

export type SpecificationFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function getAnalysisSpecifications(): Promise<AnalysisSpecification[]> {
  try {
    const res = await djangoFetch('/api/lims/analysis-specifications/')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

// Rows are a dynamic per-test grid — submitted as one JSON blob in a hidden
// field (same convention as SampleTemplate.partitions elsewhere in this app)
// rather than indexed FormData keys, since the row count is variable.
function parsePayload(formData: FormData) {
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() ?? ''
  const sample_type = Number(formData.get('sample_type'))
  const dynamicSpecRaw = (formData.get('dynamic_spec') as string)?.trim()
  const is_active = formData.get('is_active') === 'on' || formData.get('is_active') === 'true'
  let rows: SpecificationRow[] = []
  try {
    rows = JSON.parse((formData.get('rows_json') as string) || '[]')
  } catch { rows = [] }

  return {
    title,
    description,
    sample_type,
    dynamic_spec: dynamicSpecRaw ? Number(dynamicSpecRaw) : null,
    is_active,
    rows,
  }
}

function validate(payload: ReturnType<typeof parsePayload>) {
  const errors: Record<string, string[]> = {}
  if (!payload.title) errors.title = ['Title is required']
  if (!payload.sample_type) errors.sample_type = ['Sample type is required']
  if (payload.rows.length === 0) errors.rows = ['At least one test row is required']
  return errors
}

export async function createAnalysisSpecification(_state: SpecificationFormState, formData: FormData): Promise<SpecificationFormState> {
  const payload = parsePayload(formData)
  const errors = validate(payload)
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch('/api/lims/analysis-specifications/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const d = data as Record<string, string[] | string>
      const firstError = Object.values(d).flat().find(Boolean) as string | undefined
      return { message: firstError ?? 'Failed to create specification.' }
    }
    revalidatePath('/dashboard/specifications')
    return { success: true, message: 'Specification created.' }
  } catch (e) { return { message: String(e) } }
}

export async function updateAnalysisSpecification(id: number, _state: SpecificationFormState, formData: FormData): Promise<SpecificationFormState> {
  const payload = parsePayload(formData)
  const errors = validate(payload)
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch(`/api/lims/analysis-specifications/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const d = data as Record<string, string[] | string>
      const firstError = Object.values(d).flat().find(Boolean) as string | undefined
      return { message: firstError ?? 'Failed to update specification.' }
    }
    revalidatePath('/dashboard/specifications')
    return { success: true, message: 'Specification updated.' }
  } catch (e) { return { message: String(e) } }
}

export async function deleteAnalysisSpecification(id: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/lims/analysis-specifications/${id}/`, { method: 'DELETE' })
    revalidatePath('/dashboard/specifications')
    return { success: res.ok, message: res.ok ? 'Specification deleted.' : 'Failed to delete specification.' }
  } catch (e) { return { success: false, message: String(e) } }
}

'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type Specification = {
  id: number
  test: number
  sample_type: number
  min_value: string | null
  max_value: string | null
  min_operator: string
  max_operator: string
  is_active: boolean
}

export type SpecificationFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function getSpecifications(): Promise<Specification[]> {
  try {
    const res = await djangoFetch('/api/lims/specifications/')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

function parsePayload(formData: FormData) {
  const test = Number(formData.get('test'))
  const sample_type = Number(formData.get('sample_type'))
  const min_operator = ((formData.get('min_operator') as string) || '>=').trim()
  const max_operator = ((formData.get('max_operator') as string) || '<=').trim()
  const minRaw = (formData.get('min_value') as string)?.trim()
  const maxRaw = (formData.get('max_value') as string)?.trim()
  const is_active = formData.get('is_active') === 'on' || formData.get('is_active') === 'true'

  return {
    test,
    sample_type,
    min_operator,
    max_operator,
    min_value: minRaw ? minRaw : null,
    max_value: maxRaw ? maxRaw : null,
    is_active,
  }
}

function validate(payload: ReturnType<typeof parsePayload>) {
  const errors: Record<string, string[]> = {}
  if (!payload.test) errors.test = ['Test is required']
  if (!payload.sample_type) errors.sample_type = ['Sample type is required']
  if (!payload.min_value && !payload.max_value) {
    errors.min_value = ['At least one of min or max value is required']
  }
  return errors
}

export async function createSpecification(_state: SpecificationFormState, formData: FormData): Promise<SpecificationFormState> {
  const payload = parsePayload(formData)
  const errors = validate(payload)
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch('/api/lims/specifications/', {
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

export async function updateSpecification(id: number, _state: SpecificationFormState, formData: FormData): Promise<SpecificationFormState> {
  const payload = parsePayload(formData)
  const errors = validate(payload)
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch(`/api/lims/specifications/${id}/`, {
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

export async function deleteSpecification(id: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/lims/specifications/${id}/`, { method: 'DELETE' })
    revalidatePath('/dashboard/specifications')
    return { success: res.ok, message: res.ok ? 'Specification deleted.' : 'Failed to delete specification.' }
  } catch (e) { return { success: false, message: String(e) } }
}

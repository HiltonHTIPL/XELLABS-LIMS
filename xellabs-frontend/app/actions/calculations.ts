'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type Calculation = {
  id: number
  name: string
  code: string
  formula: string
  description: string
  is_active: boolean
  created_at: string
}

export type CalculationFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function getCalculations(): Promise<Calculation[]> {
  try {
    const res = await djangoFetch('/api/lims/calculations/?ordering=name')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export async function createCalculation(_state: CalculationFormState, formData: FormData): Promise<CalculationFormState> {
  const name = (formData.get('name') as string)?.trim()
  const code = (formData.get('code') as string)?.trim()
  const formula = (formData.get('formula') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!name) errors.name = ['Name is required']
  if (!code) errors.code = ['Code is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch('/api/lims/calculations/', {
      method: 'POST',
      body: JSON.stringify({ name, code, formula: formula || '', description: description || '', is_active: true }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { message: (data as Record<string,string[]>).code?.[0] ?? (data as Record<string,string[]>).name?.[0] ?? (data as {detail?: string}).detail ?? 'Failed to create calculation.' }
    }
    revalidatePath('/dashboard/methods')
    return { success: true, message: `Calculation "${name}" created.` }
  } catch (e) { return { message: String(e) } }
}

export async function updateCalculation(id: number, _state: CalculationFormState, formData: FormData): Promise<CalculationFormState> {
  const name = (formData.get('name') as string)?.trim()
  const code = (formData.get('code') as string)?.trim()
  const formula = (formData.get('formula') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!name) errors.name = ['Name is required']
  if (!code) errors.code = ['Code is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch(`/api/lims/calculations/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ name, code, formula: formula || '', description: description || '' }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { detail?: string }
      return { message: data.detail ?? 'Failed to update calculation.' }
    }
    revalidatePath('/dashboard/methods')
    return { success: true, message: `Calculation "${name}" updated.` }
  } catch (e) { return { message: String(e) } }
}

export async function toggleCalculationActive(id: number, is_active: boolean): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/lims/calculations/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    })
    revalidatePath('/dashboard/methods')
    return { success: res.ok, message: res.ok ? (is_active ? 'Calculation activated.' : 'Calculation deactivated.') : 'Failed to update.' }
  } catch (e) { return { success: false, message: String(e) } }
}

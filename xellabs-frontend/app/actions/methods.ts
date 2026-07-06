'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type Method = {
  id: number
  name: string
  code: string
  description: string
  is_active: boolean
  created_at: string
}

export type MethodFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function getMethods(): Promise<Method[]> {
  try {
    const res = await djangoFetch('/api/lims/methods/?ordering=name')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export async function createMethod(_state: MethodFormState, formData: FormData): Promise<MethodFormState> {
  const name = (formData.get('name') as string)?.trim()
  const code = (formData.get('code') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!name) errors.name = ['Name is required']
  if (!code) errors.code = ['Code is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch('/api/lims/methods/', {
      method: 'POST',
      body: JSON.stringify({ name, code, description: description || '', is_active: true }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { message: (data as Record<string,string[]>).code?.[0] ?? (data as Record<string,string[]>).name?.[0] ?? (data as {detail?: string}).detail ?? 'Failed to create method.' }
    }
    revalidatePath('/dashboard/methods')
    return { success: true, message: `Method "${name}" created.` }
  } catch (e) { return { message: String(e) } }
}

export async function updateMethod(id: number, _state: MethodFormState, formData: FormData): Promise<MethodFormState> {
  const name = (formData.get('name') as string)?.trim()
  const code = (formData.get('code') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!name) errors.name = ['Name is required']
  if (!code) errors.code = ['Code is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch(`/api/lims/methods/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ name, code, description: description || '' }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { detail?: string }
      return { message: data.detail ?? 'Failed to update method.' }
    }
    revalidatePath('/dashboard/methods')
    return { success: true, message: `Method "${name}" updated.` }
  } catch (e) { return { message: String(e) } }
}

export async function toggleMethodActive(id: number, is_active: boolean): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/lims/methods/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    })
    revalidatePath('/dashboard/methods')
    return { success: res.ok, message: res.ok ? (is_active ? 'Method activated.' : 'Method deactivated.') : 'Failed to update.' }
  } catch (e) { return { success: false, message: String(e) } }
}

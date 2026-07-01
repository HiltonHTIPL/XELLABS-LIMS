'use server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/lib/session'

const DJANGO_API = process.env.DJANGO_API_URL ?? 'http://django:8001'

async function resolveDjangoToken(): Promise<string> {
  const session = await getSession()
  return session?.djangoToken || process.env.DJANGO_SERVICE_TOKEN || ''
}

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
  const token = await resolveDjangoToken()
  try {
    const res = await fetch(`${DJANGO_API}/api/lims/methods/?ordering=name`, {
      headers: { Authorization: `Token ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export async function createMethod(_state: MethodFormState, formData: FormData): Promise<MethodFormState> {
  const token = await resolveDjangoToken()
  const name = (formData.get('name') as string)?.trim()
  const code = (formData.get('code') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!name) errors.name = ['Name is required']
  if (!code) errors.code = ['Code is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await fetch(`${DJANGO_API}/api/lims/methods/`, {
      method: 'POST',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name, code, description: description || '', is_active: true }),
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) {
      return { message: data.code?.[0] ?? data.name?.[0] ?? data.detail ?? 'Failed to create method.' }
    }
    revalidatePath('/dashboard/methods')
    return { success: true, message: `Method "${name}" created.` }
  } catch (e) { return { message: String(e) } }
}

export async function updateMethod(id: number, _state: MethodFormState, formData: FormData): Promise<MethodFormState> {
  const token = await resolveDjangoToken()
  const name = (formData.get('name') as string)?.trim()
  const code = (formData.get('code') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!name) errors.name = ['Name is required']
  if (!code) errors.code = ['Code is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await fetch(`${DJANGO_API}/api/lims/methods/${id}/`, {
      method: 'PATCH',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name, code, description: description || '' }),
      cache: 'no-store',
    })
    if (!res.ok) {
      const data = await res.json()
      return { message: data.detail ?? 'Failed to update method.' }
    }
    revalidatePath('/dashboard/methods')
    return { success: true, message: `Method "${name}" updated.` }
  } catch (e) { return { message: String(e) } }
}

export async function toggleMethodActive(id: number, is_active: boolean): Promise<{ success: boolean; message: string }> {
  const token = await resolveDjangoToken()
  try {
    const res = await fetch(`${DJANGO_API}/api/lims/methods/${id}/`, {
      method: 'PATCH',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ is_active }),
      cache: 'no-store',
    })
    revalidatePath('/dashboard/methods')
    return { success: res.ok, message: res.ok ? (is_active ? 'Method activated.' : 'Method deactivated.') : 'Failed to update.' }
  } catch (e) { return { success: false, message: String(e) } }
}

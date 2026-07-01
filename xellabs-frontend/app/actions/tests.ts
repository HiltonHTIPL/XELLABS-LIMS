'use server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/lib/session'

const DJANGO_API = process.env.DJANGO_API_URL ?? 'http://django:8001'

async function resolveDjangoToken(): Promise<string> {
  const session = await getSession()
  return session?.djangoToken || process.env.DJANGO_SERVICE_TOKEN || ''
}

export type LimsTest = {
  id: number
  name: string
  code: string
  description: string
  unit: string
  method: number | null
  method_name: string
  is_active: boolean
  created_at: string
}

export type TestFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function getTests(): Promise<LimsTest[]> {
  const token = await resolveDjangoToken()
  try {
    const res = await fetch(`${DJANGO_API}/api/lims/tests/?ordering=name`, {
      headers: { Authorization: `Token ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export async function createTest(_state: TestFormState, formData: FormData): Promise<TestFormState> {
  const token = await resolveDjangoToken()
  const name = (formData.get('name') as string)?.trim()
  const code = (formData.get('code') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const unit = (formData.get('unit') as string)?.trim()
  const methodId = (formData.get('method') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!name) errors.name = ['Name is required']
  if (!code) errors.code = ['Code is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await fetch(`${DJANGO_API}/api/lims/tests/`, {
      method: 'POST',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name, code,
        description: description || '',
        unit: unit || '',
        method: methodId ? Number(methodId) : null,
        is_active: true,
      }),
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) {
      return { message: data.code?.[0] ?? data.name?.[0] ?? data.detail ?? 'Failed to create test.' }
    }
    revalidatePath('/dashboard/tests')
    return { success: true, message: `Test "${name}" created.` }
  } catch (e) { return { message: String(e) } }
}

export async function updateTest(id: number, _state: TestFormState, formData: FormData): Promise<TestFormState> {
  const token = await resolveDjangoToken()
  const name = (formData.get('name') as string)?.trim()
  const code = (formData.get('code') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const unit = (formData.get('unit') as string)?.trim()
  const methodId = (formData.get('method') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!name) errors.name = ['Name is required']
  if (!code) errors.code = ['Code is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await fetch(`${DJANGO_API}/api/lims/tests/${id}/`, {
      method: 'PATCH',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name, code,
        description: description || '',
        unit: unit || '',
        method: methodId ? Number(methodId) : null,
      }),
      cache: 'no-store',
    })
    if (!res.ok) {
      const data = await res.json()
      return { message: data.detail ?? 'Failed to update test.' }
    }
    revalidatePath('/dashboard/tests')
    return { success: true, message: `Test "${name}" updated.` }
  } catch (e) { return { message: String(e) } }
}

'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

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
  try {
    const res = await djangoFetch('/api/lims/tests/?ordering=name')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export async function createTest(_state: TestFormState, formData: FormData): Promise<TestFormState> {
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
    const res = await djangoFetch('/api/lims/tests/', {
      method: 'POST',
      body: JSON.stringify({
        name, code,
        description: description || '',
        unit: unit || '',
        method: methodId ? Number(methodId) : null,
        is_active: true,
      }),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) {
      return { message: (data.code as string[])?.[0] ?? (data.name as string[])?.[0] ?? (data.detail as string) ?? 'Failed to create test.' }
    }
    revalidatePath('/dashboard/tests')
    return { success: true, message: `Test "${name}" created.` }
  } catch (e) { return { message: String(e) } }
}

export async function updateTest(id: number, _state: TestFormState, formData: FormData): Promise<TestFormState> {
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
    const res = await djangoFetch(`/api/lims/tests/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({
        name, code,
        description: description || '',
        unit: unit || '',
        method: methodId ? Number(methodId) : null,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { detail?: string }
      return { message: data.detail ?? 'Failed to update test.' }
    }
    revalidatePath('/dashboard/tests')
    return { success: true, message: `Test "${name}" updated.` }
  } catch (e) { return { message: String(e) } }
}

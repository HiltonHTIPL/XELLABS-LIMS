'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type DynamicAnalysisSpecification = {
  id: number
  name: string
  summary: string
  file: string
  senaite_uid: string
  is_active: boolean
  created_at: string
}

export type DynamicSpecFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function getDynamicAnalysisSpecifications(): Promise<DynamicAnalysisSpecification[]> {
  try {
    const res = await djangoFetch('/api/lims/dynamic-analysis-specifications/')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export async function createDynamicAnalysisSpecification(
  _state: DynamicSpecFormState,
  formData: FormData
): Promise<DynamicSpecFormState> {
  const name = (formData.get('name') as string)?.trim()
  const summary = (formData.get('summary') as string)?.trim() ?? ''
  const file = formData.get('file') as File | null

  const errors: Record<string, string[]> = {}
  if (!name) errors.name = ['Name is required']
  if (!file || file.size === 0) errors.file = ['A specification file is required']
  else if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
    errors.file = ['Only Excel files (.xlsx, .xls) are supported']
  }
  if (Object.keys(errors).length) return { errors }

  const body = new FormData()
  body.set('name', name)
  body.set('summary', summary)
  body.set('file', file as File)

  const res = await djangoFetch('/api/lims/dynamic-analysis-specifications/', {
    method: 'POST',
    body,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>
    const detail = (err.detail as string) ?? (err.name as string[])?.[0] ?? (err.file as string[])?.[0]
      ?? 'Failed to create dynamic analysis specification.'
    return { message: detail }
  }

  revalidatePath('/dashboard/dynamic-analysis-specifications')
  return { success: true, message: `"${name}" created.` }
}

export async function deleteDynamicAnalysisSpecification(id: number): Promise<{ success: boolean; message: string }> {
  const res = await djangoFetch(`/api/lims/dynamic-analysis-specifications/${id}/`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>
    return { success: false, message: (err.detail as string) ?? 'Failed to delete.' }
  }
  revalidatePath('/dashboard/dynamic-analysis-specifications')
  return { success: true, message: 'Deleted.' }
}

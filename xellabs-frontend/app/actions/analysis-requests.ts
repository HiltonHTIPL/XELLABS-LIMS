'use server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/lib/session'

const DJANGO_API = process.env.DJANGO_API_URL ?? 'http://django:8001'

async function resolveDjangoToken(): Promise<string> {
  const session = await getSession()
  return session?.djangoToken || process.env.DJANGO_SERVICE_TOKEN || ''
}

export type AnalysisRequest = {
  id: number
  ar_id: string
  sample: number
  sample_id: string
  tests: number[]
  test_names: string[]
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
  const token = await resolveDjangoToken()
  try {
    const res = await fetch(`${DJANGO_API}/api/lims/analysis-requests/?ordering=-created_at`, {
      headers: { Authorization: `Token ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export async function createAnalysisRequest(_state: ARFormState, formData: FormData): Promise<ARFormState> {
  const token = await resolveDjangoToken()
  const sample   = (formData.get('sample') as string)?.trim()
  const tests    = formData.getAll('tests') as string[]
  const status   = (formData.get('status') as string)?.trim() || 'pending'
  const priority = (formData.get('priority') as string)?.trim() || 'normal'
  const due_date = (formData.get('due_date') as string)?.trim()
  const notes    = (formData.get('notes') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!sample)        errors.sample = ['Sample is required']
  if (!tests.length)  errors.tests  = ['At least one test is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await fetch(`${DJANGO_API}/api/lims/analysis-requests/`, {
      method: 'POST',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sample: Number(sample),
        tests: tests.map(Number),
        status,
        priority,
        ...(due_date ? { due_date } : {}),
        ...(notes    ? { notes }    : {}),
      }),
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) {
      return { message: data.sample?.[0] ?? data.tests?.[0] ?? data.detail ?? 'Failed to create analysis request.' }
    }
    revalidatePath('/dashboard/analysis-requests')
    return { success: true, message: `Analysis request ${data.ar_id} created.` }
  } catch (e) { return { message: String(e) } }
}

export async function updateARStatus(id: number, status: string): Promise<{ success: boolean; message: string }> {
  const token = await resolveDjangoToken()
  try {
    const res = await fetch(`${DJANGO_API}/api/lims/analysis-requests/${id}/`, {
      method: 'PATCH',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ status }),
      cache: 'no-store',
    })
    revalidatePath('/dashboard/analysis-requests')
    return { success: res.ok, message: res.ok ? 'Status updated.' : 'Failed to update status.' }
  } catch (e) { return { success: false, message: String(e) } }
}

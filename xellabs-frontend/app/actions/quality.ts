'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type QCSample = {
  id: number
  qc_id: string
  qc_type: 'blank' | 'control' | 'spike' | 'duplicate' | 'reference' | 'calibrator'
  test: number
  worksheet: number | null
  lot_number: string
  expiry_date: string | null
  target_value: string | null
  tolerance_percent: string | null
  actual_value: string | null
  status: 'pending' | 'passed' | 'failed' | 'warning'
  notes: string
  run_by: number | null
  run_by_name: string | null
  run_at: string | null
  reviewed_by: number | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  review_notes: string
  is_reviewed: boolean
  created_at: string
  updated_at: string
}

export type QCWorksheet = {
  id: number
  ws_id: string
  status: string
}

export type QCSampleFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function getQCSamples(): Promise<QCSample[]> {
  try {
    const res = await djangoFetch('/api/lims/qc-samples/?ordering=-created_at')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export async function getQCWorksheets(): Promise<QCWorksheet[]> {
  try {
    const res = await djangoFetch('/api/lims/worksheets/?ordering=-created_at')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

function buildPayload(formData: FormData) {
  const qc_type = (formData.get('qc_type') as string)?.trim()
  const test = (formData.get('test') as string)?.trim()
  const worksheet = (formData.get('worksheet') as string)?.trim()
  const lot_number = (formData.get('lot_number') as string)?.trim()
  const expiry_date = (formData.get('expiry_date') as string)?.trim()
  const target_value = (formData.get('target_value') as string)?.trim()
  const tolerance_percent = (formData.get('tolerance_percent') as string)?.trim()
  const actual_value = (formData.get('actual_value') as string)?.trim()
  const status = (formData.get('status') as string)?.trim()
  const notes = (formData.get('notes') as string)?.trim()
  const qc_id = (formData.get('qc_id') as string)?.trim()

  return {
    qc_id, qc_type,
    test: test ? Number(test) : null,
    worksheet: worksheet ? Number(worksheet) : null,
    lot_number: lot_number || '',
    expiry_date: expiry_date || null,
    target_value: target_value || null,
    tolerance_percent: tolerance_percent || null,
    actual_value: actual_value || null,
    status: status || 'pending',
    notes: notes || '',
  }
}

function validate(formData: FormData): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  const qc_id = (formData.get('qc_id') as string)?.trim()
  const qc_type = (formData.get('qc_type') as string)?.trim()
  const test = (formData.get('test') as string)?.trim()
  const target_value = (formData.get('target_value') as string)?.trim()
  const tolerance_percent = (formData.get('tolerance_percent') as string)?.trim()
  const actual_value = (formData.get('actual_value') as string)?.trim()

  if (!qc_id) errors.qc_id = ['QC ID is required']
  if (!qc_type) errors.qc_type = ['QC type is required']
  if (!test) errors.test = ['Test is required']
  if (target_value && Number.isNaN(Number(target_value))) errors.target_value = ['Must be a number']
  if (tolerance_percent && Number.isNaN(Number(tolerance_percent))) errors.tolerance_percent = ['Must be a number']
  if (actual_value && Number.isNaN(Number(actual_value))) errors.actual_value = ['Must be a number']
  return errors
}

function extractErrorMessage(data: Record<string, unknown>, fallback: string): string {
  for (const key of ['qc_id', 'test', 'qc_type', 'detail']) {
    const v = data[key]
    if (Array.isArray(v) && v.length) return String(v[0])
    if (typeof v === 'string') return v
  }
  return fallback
}

export async function createQCSample(_state: QCSampleFormState, formData: FormData): Promise<QCSampleFormState> {
  const errors = validate(formData)
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch('/api/lims/qc-samples/', {
      method: 'POST',
      body: JSON.stringify(buildPayload(formData)),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) {
      return { message: extractErrorMessage(data, 'Failed to create QC sample.') }
    }
    revalidatePath('/dashboard/quality')
    return { success: true, message: 'QC sample created.' }
  } catch (e) { return { message: String(e) } }
}

export async function updateQCSample(id: number, _state: QCSampleFormState, formData: FormData): Promise<QCSampleFormState> {
  const errors = validate(formData)
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch(`/api/lims/qc-samples/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(buildPayload(formData)),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) {
      return { message: extractErrorMessage(data, 'Failed to update QC sample.') }
    }
    revalidatePath('/dashboard/quality')
    return { success: true, message: 'QC sample updated.' }
  } catch (e) { return { message: String(e) } }
}

export async function deleteQCSample(id: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/lims/qc-samples/${id}/`, { method: 'DELETE' })
    revalidatePath('/dashboard/quality')
    return { success: res.ok, message: res.ok ? 'QC sample deleted.' : 'Failed to delete QC sample.' }
  } catch (e) { return { success: false, message: String(e) } }
}

export async function reviewQCSample(id: number, reviewNotes: string, actionType: 'accept' | 'reanalyze'): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/lims/qc-samples/${id}/review/`, {
      method: 'POST',
      body: JSON.stringify({ review_notes: reviewNotes, action_type: actionType }),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) {
      return { success: false, message: extractErrorMessage(data, 'Failed to review QC sample.') }
    }
    revalidatePath('/dashboard/quality')
    return { success: true, message: String(data.detail || 'QC sample signed off.') }
  } catch (e) { return { success: false, message: String(e) } }
}

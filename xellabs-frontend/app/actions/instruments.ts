'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type Instrument = {
  id: number
  name: string
  instrument_id: string
  model: string
  manufacturer: string
  serial_number: string
  location: string
  status: 'active' | 'inactive' | 'maintenance' | 'retired'
  purchase_date: string | null
  last_calibration: string | null
  next_calibration: string | null
  last_maintenance: string | null
  next_maintenance: string | null
  notes: string
  created_at: string
}

export type InstrumentFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

const REVALIDATE_PATH = '/dashboard/instruments'

export async function getInstruments(): Promise<Instrument[]> {
  try {
    const res = await djangoFetch('/api/instruments/instruments/?ordering=name')
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : (data.results ?? [])
  } catch { return [] }
}

function instrumentBody(formData: FormData) {
  return {
    name: (formData.get('name') as string)?.trim(),
    instrument_id: (formData.get('instrument_id') as string)?.trim(),
    model: ((formData.get('model') as string) || '').trim(),
    manufacturer: ((formData.get('manufacturer') as string) || '').trim(),
    serial_number: ((formData.get('serial_number') as string) || '').trim(),
    location: ((formData.get('location') as string) || '').trim(),
    status: (formData.get('status') as string) || 'active',
    purchase_date: (formData.get('purchase_date') as string) || null,
    notes: ((formData.get('notes') as string) || '').trim(),
  }
}

function validate(formData: FormData): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  if (!(formData.get('name') as string)?.trim()) errors.name = ['Name is required']
  if (!(formData.get('instrument_id') as string)?.trim()) errors.instrument_id = ['Instrument ID is required']
  return errors
}

export async function createInstrument(_state: InstrumentFormState, formData: FormData): Promise<InstrumentFormState> {
  const errors = validate(formData)
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch('/api/instruments/instruments/', {
      method: 'POST',
      body: JSON.stringify(instrumentBody(formData)),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) {
      if (data.instrument_id) return { errors: { instrument_id: data.instrument_id as string[] } }
      return { message: (data.detail as string) ?? 'Failed to create instrument.' }
    }
    revalidatePath(REVALIDATE_PATH)
    revalidatePath('/dashboard/instrument-maintenance')
    return { success: true, message: 'Instrument created.' }
  } catch (e) { return { message: String(e) } }
}

export async function updateInstrument(id: number, _state: InstrumentFormState, formData: FormData): Promise<InstrumentFormState> {
  const errors = validate(formData)
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch(`/api/instruments/instruments/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(instrumentBody(formData)),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) {
      if (data.instrument_id) return { errors: { instrument_id: data.instrument_id as string[] } }
      return { message: (data.detail as string) ?? 'Failed to update instrument.' }
    }
    revalidatePath(REVALIDATE_PATH)
    revalidatePath('/dashboard/instrument-maintenance')
    return { success: true, message: 'Instrument updated.' }
  } catch (e) { return { message: String(e) } }
}

export async function deleteInstrument(id: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/instruments/instruments/${id}/`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { detail?: string }
      return { success: false, message: data.detail ?? 'Failed to delete instrument.' }
    }
    revalidatePath(REVALIDATE_PATH)
    revalidatePath('/dashboard/instrument-maintenance')
    return { success: true, message: 'Instrument deleted.' }
  } catch (e) { return { success: false, message: String(e) } }
}

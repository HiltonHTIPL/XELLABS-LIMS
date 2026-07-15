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
  instrument_type: number | null
  instrument_type_name: string
  instrument_location: number | null
  instrument_location_name: string
  supplier: string
  asset_number: string
  location: string
  status: 'active' | 'inactive' | 'maintenance' | 'retired'
  purchase_date: string | null
  installation_date: string | null
  data_interface: string
  import_data_interface: string
  result_files_folder: string
  dispose_until_next_calibration: boolean
  inlab_calibration_procedure: string
  preventive_maintenance_procedure: string
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
  const disposeRaw = (formData.get('dispose_until_next_calibration') as string | null) ?? ''
  return {
    name: (formData.get('name') as string)?.trim(),
    instrument_id: (formData.get('instrument_id') as string)?.trim(),
    model: ((formData.get('model') as string) || '').trim(),
    manufacturer: ((formData.get('manufacturer') as string) || '').trim(),
    serial_number: ((formData.get('serial_number') as string) || '').trim(),
    instrument_type: (formData.get('instrument_type') as string) ? Number(formData.get('instrument_type')) : null,
    instrument_location: (formData.get('instrument_location') as string) ? Number(formData.get('instrument_location')) : null,
    supplier: ((formData.get('supplier') as string) || '').trim(),
    asset_number: ((formData.get('asset_number') as string) || '').trim(),
    location: ((formData.get('location') as string) || '').trim(),
    status: (formData.get('status') as string) || 'active',
    purchase_date: (formData.get('purchase_date') as string) || null,
    installation_date: (formData.get('installation_date') as string) || null,
    data_interface: ((formData.get('data_interface') as string) || '').trim(),
    import_data_interface: ((formData.get('import_data_interface') as string) || '').trim(),
    result_files_folder: ((formData.get('result_files_folder') as string) || '').trim(),
    dispose_until_next_calibration: disposeRaw === 'on' || disposeRaw === 'true' || disposeRaw === '1',
    inlab_calibration_procedure: ((formData.get('inlab_calibration_procedure') as string) || '').trim(),
    preventive_maintenance_procedure: ((formData.get('preventive_maintenance_procedure') as string) || '').trim(),
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

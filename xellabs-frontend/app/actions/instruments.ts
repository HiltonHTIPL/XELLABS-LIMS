'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type InstrumentStatus =
  | 'active'
  | 'inactive'
  | 'under_maintenance'
  | 'out_of_service'
  | 'retired'

export type InstrumentUsability = 'valid' | 'expired' | 'out_of_service'

export type Instrument = {
  id: number
  name: string
  instrument_id: string
  model: string
  manufacturer: string
  manufacturer_org: number | null
  manufacturer_org_name: string
  serial_number: string
  instrument_type: number | null
  instrument_type_name: string
  instrument_location: number | null
  instrument_location_name: string
  supplier: string
  supplier_org: number | null
  supplier_org_name: string
  asset_number: string
  location: string
  status: InstrumentStatus
  usability: InstrumentUsability
  is_usable: boolean
  method_ids: number[]
  purchase_date: string | null
  installation_date: string | null
  photo: string | null
  installation_certificate: string | null
  data_interface: string
  import_data_interface: string
  result_files_folder: string
  data_interface_options: string
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
  id?: number
  errors?: Record<string, string[]>
}

const REVALIDATE_PATH = '/dashboard/instruments'

export async function getInstruments(params?: {
  status?: string
  usability?: string
}): Promise<Instrument[]> {
  try {
    const qs = new URLSearchParams({ ordering: 'name' })
    if (params?.status) qs.set('status', params.status)
    if (params?.usability) qs.set('usability', params.usability)
    const res = await djangoFetch(`/api/instruments/instruments/?${qs.toString()}`)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : (data.results ?? [])
  } catch { return [] }
}

function instrumentBody(formData: FormData) {
  const disposeRaw = (formData.get('dispose_until_next_calibration') as string | null) ?? ''
  const methodRaw = (formData.get('method_ids') as string | null) ?? ''
  const method_ids = methodRaw
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isFinite(n) && n > 0)

  return {
    name: (formData.get('name') as string)?.trim(),
    instrument_id: (formData.get('instrument_id') as string)?.trim(),
    model: ((formData.get('model') as string) || '').trim(),
    manufacturer_org: (formData.get('manufacturer_org') as string) ? Number(formData.get('manufacturer_org')) : null,
    serial_number: ((formData.get('serial_number') as string) || '').trim(),
    instrument_type: (formData.get('instrument_type') as string) ? Number(formData.get('instrument_type')) : null,
    instrument_location: (formData.get('instrument_location') as string) ? Number(formData.get('instrument_location')) : null,
    supplier_org: (formData.get('supplier_org') as string) ? Number(formData.get('supplier_org')) : null,
    asset_number: ((formData.get('asset_number') as string) || '').trim(),
    location: ((formData.get('location') as string) || '').trim(),
    status: (formData.get('status') as string) || 'active',
    purchase_date: (formData.get('purchase_date') as string) || null,
    installation_date: (formData.get('installation_date') as string) || null,
    data_interface: ((formData.get('data_interface') as string) || '').trim(),
    import_data_interface: ((formData.get('import_data_interface') as string) || '').trim(),
    result_files_folder: ((formData.get('result_files_folder') as string) || '').trim(),
    data_interface_options: ((formData.get('data_interface_options') as string) || '').trim(),
    dispose_until_next_calibration: disposeRaw === 'on' || disposeRaw === 'true' || disposeRaw === '1',
    inlab_calibration_procedure: ((formData.get('inlab_calibration_procedure') as string) || '').trim(),
    preventive_maintenance_procedure: ((formData.get('preventive_maintenance_procedure') as string) || '').trim(),
    notes: ((formData.get('notes') as string) || '').trim(),
    method_ids,
  }
}

function validate(formData: FormData): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  if (!(formData.get('name') as string)?.trim()) errors.name = ['Name is required']
  if (!(formData.get('instrument_id') as string)?.trim()) errors.instrument_id = ['Instrument ID is required']
  return errors
}

async function uploadInstrumentFiles(id: number, formData: FormData): Promise<string | null> {
  const photo = formData.get('photo')
  const cert = formData.get('installation_certificate')
  const hasPhoto = photo instanceof File && photo.size > 0
  const hasCert = cert instanceof File && cert.size > 0
  if (!hasPhoto && !hasCert) return null

  const fd = new FormData()
  if (hasPhoto) fd.append('photo', photo)
  if (hasCert) fd.append('installation_certificate', cert)

  const res = await djangoFetch(`/api/instruments/instruments/${id}/`, { method: 'PATCH', body: fd })
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    return (data.detail as string) ?? 'Instrument saved, but file upload failed.'
  }
  return null
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
    const id = Number(data.id)
    const uploadErr = id ? await uploadInstrumentFiles(id, formData) : null
    revalidatePath(REVALIDATE_PATH)
    revalidatePath('/dashboard/instrument-maintenance')
    if (uploadErr) return { success: true, id, message: uploadErr }
    return { success: true, id, message: 'Instrument created.' }
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
    const uploadErr = await uploadInstrumentFiles(id, formData)
    revalidatePath(REVALIDATE_PATH)
    revalidatePath(`/dashboard/instruments/${id}`)
    revalidatePath('/dashboard/instrument-maintenance')
    if (uploadErr) return { success: true, id, message: uploadErr }
    return { success: true, id, message: 'Instrument updated.' }
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

export type InstrumentTransition =
  | 'activate'
  | 'deactivate'
  | 'set-under-maintenance'
  | 'set-out-of-service'
  | 'return-to-service'
  | 'retire'

export async function transitionInstrument(
  id: number,
  action: InstrumentTransition,
): Promise<{ ok: boolean; message: string; instrument?: Instrument }> {
  try {
    const res = await djangoFetch(`/api/instruments/instruments/${id}/${action}/`, { method: 'POST' })
    const data = await res.json().catch(() => ({})) as Instrument & { detail?: string }
    if (!res.ok) {
      return { ok: false, message: data.detail ?? `Transition failed (${res.status})` }
    }
    revalidatePath(REVALIDATE_PATH)
    revalidatePath(`/dashboard/instruments/${id}`)
    revalidatePath('/dashboard/instrument-maintenance')
    return { ok: true, message: 'Status updated.', instrument: data }
  } catch (e) {
    return { ok: false, message: String(e) }
  }
}

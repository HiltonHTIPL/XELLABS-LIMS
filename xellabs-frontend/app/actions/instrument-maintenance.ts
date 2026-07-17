'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type InstrumentOption = {
  id: number
  name: string
  instrument_id: string
  status?: string
  usability?: 'valid' | 'expired' | 'out_of_service'
  is_usable?: boolean
}

export type Calibration = {
  id: number
  instrument: number
  calibration_date: string
  next_due: string | null
  status: 'passed' | 'failed' | 'pending'
  performed_by: number
  certificate: string | null
  notes: string
  created_at: string
}

export type Maintenance = {
  id: number
  instrument: number
  maintenance_date: string
  next_due: string | null
  maintenance_type: 'routine' | 'corrective' | 'preventive'
  performed_by: number
  notes: string
  created_at: string
}

export type InstrumentRun = {
  id: number
  instrument: number
  run_date: string
  method: number | null
  operator: number
  notes: string
  created_at: string
}

export type InstrumentResultImport = {
  id: number
  instrument: number
  file: string | null
  file_format: 'csv' | 'xml' | 'txt'
  status: 'pending' | 'processed' | 'failed'
  imported_by: number
  error_log: string
  created_at: string
}

export type FormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function unwrap<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  const obj = data as { results?: T[] }
  return obj?.results ?? []
}

const REVALIDATE_PATH = '/dashboard/instrument-maintenance'

/* ------------------------------------------------------------------ */
/* Instruments dropdown                                                 */
/* ------------------------------------------------------------------ */

export async function getInstrumentOptions(params?: {
  usableOnly?: boolean
}): Promise<InstrumentOption[]> {
  try {
    const qs = new URLSearchParams({ ordering: 'name' })
    if (params?.usableOnly) qs.set('usability', 'valid')
    const res = await djangoFetch(`/api/instruments/instruments/?${qs.toString()}`)
    if (!res.ok) return []
    const data = await res.json()
    const rows = unwrap<InstrumentOption>(data)
    // Prefer usable instruments first for picker UX; keep non-usable available (warn on select).
    return [...rows].sort((a, b) => {
      const au = a.is_usable || a.usability === 'valid' ? 0 : 1
      const bu = b.is_usable || b.usability === 'valid' ? 0 : 1
      if (au !== bu) return au - bu
      return a.name.localeCompare(b.name)
    })
  } catch { return [] }
}

/* ------------------------------------------------------------------ */
/* Calibrations                                                         */
/* ------------------------------------------------------------------ */

export async function getCalibrations(): Promise<Calibration[]> {
  try {
    const res = await djangoFetch('/api/instruments/calibrations/?ordering=-calibration_date')
    if (!res.ok) return []
    return unwrap<Calibration>(await res.json())
  } catch { return [] }
}

export async function createCalibration(_state: FormState, formData: FormData): Promise<FormState> {
  const instrument = formData.get('instrument') as string
  const calibration_date = formData.get('calibration_date') as string
  const next_due = (formData.get('next_due') as string) || null
  const status = (formData.get('status') as string) || 'pending'
  const notes = ((formData.get('notes') as string) || '').trim()

  const errors: Record<string, string[]> = {}
  if (!instrument) errors.instrument = ['Instrument is required']
  if (!calibration_date) errors.calibration_date = ['Calibration date is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch('/api/instruments/calibrations/', {
      method: 'POST',
      body: JSON.stringify({
        instrument: Number(instrument), calibration_date, next_due, status, notes,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { message: (data as { detail?: string }).detail ?? 'Failed to create calibration record.' }
    }
    revalidatePath(REVALIDATE_PATH)
    return { success: true, message: 'Calibration record created.' }
  } catch (e) { return { message: String(e) } }
}

export async function updateCalibration(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const instrument = formData.get('instrument') as string
  const calibration_date = formData.get('calibration_date') as string
  const next_due = (formData.get('next_due') as string) || null
  const status = (formData.get('status') as string) || 'pending'
  const notes = ((formData.get('notes') as string) || '').trim()

  const errors: Record<string, string[]> = {}
  if (!instrument) errors.instrument = ['Instrument is required']
  if (!calibration_date) errors.calibration_date = ['Calibration date is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch(`/api/instruments/calibrations/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({
        instrument: Number(instrument), calibration_date, next_due, status, notes,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { detail?: string }
      return { message: data.detail ?? 'Failed to update calibration record.' }
    }
    revalidatePath(REVALIDATE_PATH)
    return { success: true, message: 'Calibration record updated.' }
  } catch (e) { return { message: String(e) } }
}

export async function deleteCalibration(id: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/instruments/calibrations/${id}/`, { method: 'DELETE' })
    revalidatePath(REVALIDATE_PATH)
    return { success: res.ok, message: res.ok ? 'Calibration record deleted.' : 'Failed to delete.' }
  } catch (e) { return { success: false, message: String(e) } }
}

/* ------------------------------------------------------------------ */
/* Maintenances                                                         */
/* ------------------------------------------------------------------ */

export async function getMaintenances(): Promise<Maintenance[]> {
  try {
    const res = await djangoFetch('/api/instruments/maintenances/?ordering=-maintenance_date')
    if (!res.ok) return []
    return unwrap<Maintenance>(await res.json())
  } catch { return [] }
}

export async function createMaintenance(_state: FormState, formData: FormData): Promise<FormState> {
  const instrument = formData.get('instrument') as string
  const maintenance_date = formData.get('maintenance_date') as string
  const next_due = (formData.get('next_due') as string) || null
  const maintenance_type = (formData.get('maintenance_type') as string) || 'routine'
  const notes = ((formData.get('notes') as string) || '').trim()

  const errors: Record<string, string[]> = {}
  if (!instrument) errors.instrument = ['Instrument is required']
  if (!maintenance_date) errors.maintenance_date = ['Maintenance date is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch('/api/instruments/maintenances/', {
      method: 'POST',
      body: JSON.stringify({
        instrument: Number(instrument), maintenance_date, next_due, maintenance_type, notes,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { message: (data as { detail?: string }).detail ?? 'Failed to create maintenance record.' }
    }
    revalidatePath(REVALIDATE_PATH)
    return { success: true, message: 'Maintenance record created.' }
  } catch (e) { return { message: String(e) } }
}

export async function updateMaintenance(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const instrument = formData.get('instrument') as string
  const maintenance_date = formData.get('maintenance_date') as string
  const next_due = (formData.get('next_due') as string) || null
  const maintenance_type = (formData.get('maintenance_type') as string) || 'routine'
  const notes = ((formData.get('notes') as string) || '').trim()

  const errors: Record<string, string[]> = {}
  if (!instrument) errors.instrument = ['Instrument is required']
  if (!maintenance_date) errors.maintenance_date = ['Maintenance date is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch(`/api/instruments/maintenances/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({
        instrument: Number(instrument), maintenance_date, next_due, maintenance_type, notes,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { detail?: string }
      return { message: data.detail ?? 'Failed to update maintenance record.' }
    }
    revalidatePath(REVALIDATE_PATH)
    return { success: true, message: 'Maintenance record updated.' }
  } catch (e) { return { message: String(e) } }
}

export async function deleteMaintenance(id: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/instruments/maintenances/${id}/`, { method: 'DELETE' })
    revalidatePath(REVALIDATE_PATH)
    return { success: res.ok, message: res.ok ? 'Maintenance record deleted.' : 'Failed to delete.' }
  } catch (e) { return { success: false, message: String(e) } }
}

/* ------------------------------------------------------------------ */
/* Instrument Runs                                                      */
/* ------------------------------------------------------------------ */

export async function getInstrumentRuns(): Promise<InstrumentRun[]> {
  try {
    const res = await djangoFetch('/api/instruments/runs/?ordering=-run_date')
    if (!res.ok) return []
    return unwrap<InstrumentRun>(await res.json())
  } catch { return [] }
}

export async function createInstrumentRun(_state: FormState, formData: FormData): Promise<FormState> {
  const instrument = formData.get('instrument') as string
  const run_date = formData.get('run_date') as string
  const notes = ((formData.get('notes') as string) || '').trim()

  const errors: Record<string, string[]> = {}
  if (!instrument) errors.instrument = ['Instrument is required']
  if (!run_date) errors.run_date = ['Run date/time is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch('/api/instruments/runs/', {
      method: 'POST',
      body: JSON.stringify({ instrument: Number(instrument), run_date, notes }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { message: (data as { detail?: string }).detail ?? 'Failed to create run record.' }
    }
    revalidatePath(REVALIDATE_PATH)
    return { success: true, message: 'Run record created.' }
  } catch (e) { return { message: String(e) } }
}

export async function updateInstrumentRun(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const instrument = formData.get('instrument') as string
  const run_date = formData.get('run_date') as string
  const notes = ((formData.get('notes') as string) || '').trim()

  const errors: Record<string, string[]> = {}
  if (!instrument) errors.instrument = ['Instrument is required']
  if (!run_date) errors.run_date = ['Run date/time is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch(`/api/instruments/runs/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ instrument: Number(instrument), run_date, notes }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { detail?: string }
      return { message: data.detail ?? 'Failed to update run record.' }
    }
    revalidatePath(REVALIDATE_PATH)
    return { success: true, message: 'Run record updated.' }
  } catch (e) { return { message: String(e) } }
}

export async function deleteInstrumentRun(id: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/instruments/runs/${id}/`, { method: 'DELETE' })
    revalidatePath(REVALIDATE_PATH)
    return { success: res.ok, message: res.ok ? 'Run record deleted.' : 'Failed to delete.' }
  } catch (e) { return { success: false, message: String(e) } }
}

/* ------------------------------------------------------------------ */
/* Result Imports                                                       */
/* ------------------------------------------------------------------ */

export async function getInstrumentResultImports(): Promise<InstrumentResultImport[]> {
  try {
    const res = await djangoFetch('/api/instruments/result-imports/?ordering=-created_at')
    if (!res.ok) return []
    return unwrap<InstrumentResultImport>(await res.json())
  } catch { return [] }
}

export async function createInstrumentResultImport(_state: FormState, formData: FormData): Promise<FormState> {
  const instrument = formData.get('instrument') as string
  const file_format = (formData.get('file_format') as string) || 'csv'

  const errors: Record<string, string[]> = {}
  if (!instrument) errors.instrument = ['Instrument is required']
  if (Object.keys(errors).length) return { errors }

  // NOTE: file upload of the actual binary is out of scope here — the backend
  // FileField is required, but we record the intent (format + instrument) so
  // the row can be created and processed later via the "process" action.
  try {
    const fd = new FormData()
    fd.append('instrument', instrument)
    fd.append('file_format', file_format)
    const fileEntry = formData.get('file')
    if (fileEntry instanceof File && fileEntry.size > 0) {
      fd.append('file', fileEntry)
    } else {
      return { message: 'A file is required to create an import record.' }
    }
    const res = await djangoFetch('/api/instruments/result-imports/', {
      method: 'POST',
      body: fd,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { message: (data as { detail?: string }).detail ?? 'Failed to create import record.' }
    }
    revalidatePath(REVALIDATE_PATH)
    return { success: true, message: 'Import record created.' }
  } catch (e) { return { message: String(e) } }
}

export async function deleteInstrumentResultImport(id: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/instruments/result-imports/${id}/`, { method: 'DELETE' })
    revalidatePath(REVALIDATE_PATH)
    return { success: res.ok, message: res.ok ? 'Import record deleted.' : 'Failed to delete.' }
  } catch (e) { return { success: false, message: String(e) } }
}

export async function processInstrumentResultImport(id: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/instruments/result-imports/${id}/process/`, { method: 'POST' })
    const data = await res.json().catch(() => ({})) as { detail?: string }
    revalidatePath(REVALIDATE_PATH)
    return { success: res.ok, message: res.ok ? 'Import queued for processing.' : (data.detail ?? 'Failed to queue import.') }
  } catch (e) { return { success: false, message: String(e) } }
}

'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

// SENAITE-parity instrument sub-workflows: certifications, scheduled tasks,
// validations (per-instrument records) plus the InstrumentType / InstrumentLocation
// setup catalogs. One generic list/create pair keeps this DRY across record types.

export type RecordRow = Record<string, unknown> & { id: number }

async function listByInstrument(resource: string, instrumentId: number): Promise<RecordRow[]> {
  try {
    const res = await djangoFetch(`/api/instruments/${resource}/?instrument=${instrumentId}&ordering=-id`)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : (data.results ?? [])
  } catch { return [] }
}

// Records are submitted as multipart FormData so file fields (e.g. a certification
// document) upload alongside the scalar fields in one request. DRF's default
// parsers accept multipart, and djangoFetch leaves the Content-Type unset so the
// browser adds the multipart boundary.
async function createRecordForm(resource: string, fd: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/instruments/${resource}/`, { method: 'POST', body: fd })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      const firstErr = Object.values(data)[0]
      const msg = Array.isArray(firstErr) ? String(firstErr[0]) : (data.detail as string) ?? 'Failed to save.'
      return { ok: false, message: msg }
    }
    revalidatePath('/dashboard/instruments')
    return { ok: true, message: 'Saved.' }
  } catch (e) { return { ok: false, message: String(e) } }
}

// ── Per-instrument records ───────────────────────────────────────────────
export async function getCertifications(instrumentId: number) { return listByInstrument('certifications', instrumentId) }
export async function getScheduledTasks(instrumentId: number) { return listByInstrument('scheduled-tasks', instrumentId) }
export async function getValidations(instrumentId: number) { return listByInstrument('validations', instrumentId) }
export async function getCalibrations(instrumentId: number) { return listByInstrument('calibrations', instrumentId) }
export async function getMaintenances(instrumentId: number) { return listByInstrument('maintenances', instrumentId) }

export async function createCertification(fd: FormData) { return createRecordForm('certifications', fd) }
export async function createScheduledTask(fd: FormData) { return createRecordForm('scheduled-tasks', fd) }
export async function createValidation(fd: FormData) { return createRecordForm('validations', fd) }
export async function createCalibration(fd: FormData) { return createRecordForm('calibrations', fd) }
export async function createMaintenance(fd: FormData) { return createRecordForm('maintenances', fd) }

// ── Setup catalogs: InstrumentType / InstrumentLocation ──────────────────
export type NamedItem = { id: number; name: string; description: string }

async function listNamed(resource: string): Promise<NamedItem[]> {
  try {
    const res = await djangoFetch(`/api/instruments/${resource}/?ordering=name`)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : (data.results ?? [])
  } catch { return [] }
}

async function createNamed(resource: string, name: string, description = ''): Promise<{ ok: boolean; message: string; item?: NamedItem }> {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, message: 'Name is required.' }
  try {
    const res = await djangoFetch(`/api/instruments/${resource}/`, {
      method: 'POST',
      body: JSON.stringify({ name: trimmed, description: description.trim() }),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) {
      const firstErr = Object.values(data)[0]
      const msg = Array.isArray(firstErr) ? String(firstErr[0]) : (data.detail as string) ?? 'Failed to add.'
      return { ok: false, message: msg }
    }
    revalidatePath('/dashboard/instruments')
    return { ok: true, message: 'Added.', item: { id: Number(data.id), name: String(data.name), description: String(data.description ?? '') } }
  } catch (e) { return { ok: false, message: String(e) } }
}

export async function getInstrumentTypes() { return listNamed('instrument-types') }
export async function getInstrumentLocations() { return listNamed('instrument-locations') }
export async function getManufacturers() { return listNamed('manufacturers') }
export async function getSuppliers() { return listNamed('suppliers') }

export async function createInstrumentType(name: string, description = '') { return createNamed('instrument-types', name, description) }
export async function createInstrumentLocation(name: string, description = '') { return createNamed('instrument-locations', name, description) }
export async function createManufacturer(name: string, description = '') { return createNamed('manufacturers', name, description) }
export async function createSupplier(name: string, description = '') { return createNamed('suppliers', name, description) }

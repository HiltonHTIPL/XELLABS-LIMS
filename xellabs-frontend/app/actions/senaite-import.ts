'use server'
import { djangoFetch } from '@/app/lib/django'
import {
  fetchSenaiteInstruments,
  fetchSenaiteStorageLocations,
  SenaiteInstrument,
  SenaiteStorageLocation,
} from '@/app/lib/senaite'

const SENAITE_USER = process.env.SENAITE_ADMIN_USER ?? 'admin'
const SENAITE_PASS = process.env.SENAITE_ADMIN_PASS ?? 'admin'

function serverToken(): string {
  return Buffer.from(`${SENAITE_USER}:${SENAITE_PASS}`).toString('base64')
}

export async function getInstrumentsList(): Promise<SenaiteInstrument[]> {
  return fetchSenaiteInstruments(serverToken())
}

export async function getStorageLocationsList(): Promise<SenaiteStorageLocation[]> {
  return fetchSenaiteStorageLocations(serverToken())
}

export type ImportRowResult = {
  row: number
  ok: boolean | null
  title: string | null
  uid?: string
  error?: string
}

export type ImportState = {
  message?: string
  success?: boolean
  result?: {
    created: number
    failed: number
    skipped: number
    rows: ImportRowResult[]
  }
}

async function runImport(endpoint: string, formData: FormData): Promise<ImportState> {
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return { message: 'Please select an .xlsx file to import.' }
  }
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return { message: 'Only .xlsx files are supported.' }
  }

  const fd = new FormData()
  fd.append('file', file, file.name)

  try {
    const res = await djangoFetch(endpoint, { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { message: data.detail ?? 'Import failed.' }
    }
    return { success: true, result: data }
  } catch (e) {
    return { message: String(e) }
  }
}

export async function importInstruments(_state: ImportState, formData: FormData): Promise<ImportState> {
  return runImport('/api/senaite-import/instruments/', formData)
}

export async function importStorageLocations(_state: ImportState, formData: FormData): Promise<ImportState> {
  return runImport('/api/senaite-import/storage-locations/', formData)
}

export type DeleteResult = {
  success: boolean
  deleted: number
  failed: number
  message: string
}

export async function deleteMasterDataRecords(uids: string[]): Promise<DeleteResult> {
  if (uids.length === 0) {
    return { success: false, deleted: 0, failed: 0, message: 'No records selected.' }
  }
  try {
    const res = await djangoFetch('/api/senaite-import/delete/', {
      method: 'POST',
      body: JSON.stringify({ uids }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { success: false, deleted: 0, failed: uids.length, message: data.detail ?? 'Delete failed.' }
    }
    const deleted = data.deleted ?? 0
    const failed = data.failed ?? 0
    return {
      success: failed === 0,
      deleted,
      failed,
      message: failed === 0
        ? `Deleted ${deleted} record${deleted === 1 ? '' : 's'}.`
        : `Deleted ${deleted}, failed ${failed}.`,
    }
  } catch (e) {
    return { success: false, deleted: 0, failed: uids.length, message: String(e) }
  }
}

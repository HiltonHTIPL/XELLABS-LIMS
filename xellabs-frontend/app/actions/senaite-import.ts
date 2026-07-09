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

// Note: the upload flow itself does NOT go through a server action — Server Actions
// can't stream a response back to the client, and the streaming NDJSON progress from
// Django is the whole point (see MasterDataImportShell's useStreamingImport hook,
// which POSTs directly to /api/senaite-import/<x>/, a same-origin Next.js Route
// Handler at app/api/senaite-import/<x>/route.ts that attaches the auth token
// server-side via djangoFetch and pipes Django's streaming response straight back).

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

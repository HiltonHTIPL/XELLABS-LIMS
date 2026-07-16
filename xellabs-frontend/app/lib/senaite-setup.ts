// Generic SENAITE "setup" content CRUD helpers, shared by every Administration
// reference-data page (Analysis Categories, Attachment Types, Batch Labels,
// Instrument Locations/Types, Interpretation Templates, Lab Products, Labels,
// Departments) plus the two Archetypes types that need the custom safe-view
// bypass (Lab Contacts, Laboratory).
//
// DRY: one fetch/create/update trio drives the 9 config-driven Dexterity types;
// each entity's server action supplies its own portal_type, parent path, and
// field body (with its own validation). Reference/number/boolean fields are
// passed straight through in the body — the v1 API accepts field names directly.
//
// Adapter Pattern: this module isolates all SENAITE REST quirks from the UI and
// server actions, exactly like app/lib/senaite.ts does for the rest of the app.
import { SENAITE_URL, SENAITE_SITE_PATH, SENAITE_ORIGIN } from './senaite'

export type SetupRecord = Record<string, unknown>

// asArray: SENAITE's v1 API serializes an empty reference/records field as {}
// (not []) — a bare `?? []` won't catch it. Mirror the helper in senaite.ts.
export function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

const authHeaders = (token: string) => ({
  Authorization: `Basic ${token}`,
  Accept: 'application/json',
})

// Fetch every object of a portal type as raw records (all catalog fields the
// v1 API returns). Callers map to their own typed shape.
export async function fetchSetupList(token: string, portalType: string): Promise<SetupRecord[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/${portalType}?limit=1000&complete=true`, {
      headers: authHeaders(token),
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return asArray<SetupRecord>(data.items).filter(d => (d.uid as string) && (d.title as string))
  } catch { return [] }
}

export type SetupWriteResult = { success: boolean; uid?: string; path?: string; error?: string }

// Writes go through plone.restapi (Dexterity-native), NOT the legacy v1 create/
// update API. The v1 API rejects UIDReferenceField values (department/manager)
// with a "" error and chokes on LabProduct's computed fields ("wrong type");
// restapi handles both natively — it accepts a plain uid string for single refs
// and a uid array for multi refs, and skips computed/readonly fields. Reads
// still use the v1 list API (fetchSetupList) because restapi's @search doesn't
// index SENAITE's SETUP_CATALOG. Same split documented for SampleType (§16b).
function restapiError(data: SetupRecord, status: number): string {
  const m = data.message
  if (typeof m === 'string') return m
  return `HTTP ${status}`
}

export async function createSetupItem(
  token: string,
  portalType: string,
  parentSubPath: string,          // e.g. 'setup/analysiscategories'
  body: SetupRecord,
): Promise<SetupWriteResult> {
  try {
    const res = await fetch(`${SENAITE_ORIGIN}${SENAITE_SITE_PATH}/${parentSubPath}`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ '@type': portalType, ...body }),
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => ({}))) as SetupRecord
    if (!res.ok) return { success: false, error: restapiError(data, res.status) }
    const path = ((data['@id'] as string) ?? '').replace(SENAITE_ORIGIN, '')
    return { success: true, uid: data.UID as string, path }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function updateSetupItem(
  token: string,
  path: string,                   // object physical path, e.g. /senaite/setup/analysiscategories/analysiscategory-1
  body: SetupRecord,
): Promise<SetupWriteResult> {
  try {
    const res = await fetch(`${SENAITE_ORIGIN}${path}`, {
      method: 'PATCH',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    if (res.status === 204) return { success: true, path }
    const data = (await res.json().catch(() => ({}))) as SetupRecord
    if (!res.ok) return { success: false, error: restapiError(data, res.status) }
    return { success: true, path }
  } catch (e) { return { success: false, error: String(e) } }
}

// --- Archetypes safe-view calls (Lab Contacts / Laboratory) -----------------
// These POST to the custom Zope views baked into the SENAITE image
// (senaite-rebrand/labcontact_lab_views.py) which bypass the broken Address
// country/state/district validator. Built with SENAITE_ORIGIN + object path,
// never SENAITE_URL + path (that doubles the /senaite segment and 404s).

export async function createLabContactSafe(
  token: string,
  body: SetupRecord,
): Promise<SetupWriteResult> {
  try {
    const res = await fetch(`${SENAITE_ORIGIN}${SENAITE_SITE_PATH}/bika_setup/bika_labcontacts/@@create-labcontact-safe`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => ({}))) as SetupRecord
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.error as string) ?? `HTTP ${res.status}` }
    }
    return { success: true, uid: data.uid as string, path: data.path as string }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function updateLabContactSafe(
  token: string,
  path: string,                   // object physical path, e.g. /senaite/bika_setup/bika_labcontacts/labcontact-1
  body: SetupRecord,
): Promise<SetupWriteResult> {
  try {
    const res = await fetch(`${SENAITE_ORIGIN}${path}/@@update-labcontact-safe`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => ({}))) as SetupRecord
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.error as string) ?? `HTTP ${res.status}` }
    }
    return { success: true, uid: data.uid as string, path: data.path as string }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function updateLaboratorySafe(
  token: string,
  path: string,
  body: SetupRecord,
): Promise<SetupWriteResult> {
  try {
    const res = await fetch(`${SENAITE_ORIGIN}${path}/@@update-laboratory-safe`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => ({}))) as SetupRecord
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.error as string) ?? `HTTP ${res.status}` }
    }
    return { success: true, uid: data.uid as string, path: data.path as string }
  } catch (e) { return { success: false, error: String(e) } }
}

// Fetch the Laboratory singleton (bika_setup/laboratory) as a raw record via
// plone.restapi (returns all AT fields incl. addresses/accreditation).
export async function fetchLaboratory(token: string): Promise<SetupRecord | null> {
  try {
    const res = await fetch(`${SENAITE_ORIGIN}${SENAITE_SITE_PATH}/bika_setup/laboratory`, {
      headers: authHeaders(token),
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as SetupRecord
  } catch { return null }
}

// Fetch a single object's full record by physical path via plone.restapi
// (used for Lab Contact edit — v1 list omits addresses/refs detail).
export async function fetchByPath(token: string, path: string): Promise<SetupRecord | null> {
  try {
    const res = await fetch(`${SENAITE_ORIGIN}${path}`, { headers: authHeaders(token), cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as SetupRecord
  } catch { return null }
}

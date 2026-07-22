'use server'
import { djangoFetch } from '@/app/lib/django'

export type DataChangeLog = {
  id: number
  audit_event: number
  field_name: string
  old_value: string | null
  new_value: string | null
  reason: string
}

export type AuditEvent = {
  id: number
  user: number | null
  user_display: string | null
  action: string
  source: string
  content_type: number | null
  content_type_label: string | null
  object_id: number | null
  object_repr: string
  ip_address: string | null
  extra_data: Record<string, unknown> | null
  timestamp: string
  changes: DataChangeLog[]
}

export type LoginEvent = {
  id: number
  user: number | null
  username_attempted: string
  success: boolean
  ip_address: string | null
  user_agent: string
  timestamp: string
}

export type SecurityEvent = {
  id: number
  user: number | null
  event_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  ip_address: string | null
  timestamp: string
}

export type RecordVersion = {
  id: number
  content_type: number
  object_id: number
  version_number: number
  data: Record<string, unknown>
  changed_by: number | null
  changed_by_display: string | null
  reason: string
  created_at: string
}

// DRF paginates every list endpoint at PAGE_SIZE=50 with no client-overridable
// page-size param — a plain single fetch silently truncates the Audit Trail
// page to its first 50 rows. Walk every page (via `page=`, not the returned
// `next` URL — that's built from the request's own host, which can differ
// from what djangoFetch resolves internally) so the page always shows the
// complete set, not just the most recent 50.
async function fetchAllPages<T>(basePath: string): Promise<T[]> {
  const results: T[] = []
  let page = 1
  try {
    while (true) {
      const sep = basePath.includes('?') ? '&' : '?'
      const res = await djangoFetch(`${basePath}${sep}page=${page}`)
      if (!res.ok) break
      const data = await res.json()
      const pageResults: T[] = data.results ?? (Array.isArray(data) ? data : [])
      results.push(...pageResults)
      if (!data.next) break
      page++
    }
  } catch { /* return whatever pages were fetched before the failure */ }
  return results
}

export async function getAuditEvents(params?: Record<string, string>): Promise<AuditEvent[]> {
  const query = new URLSearchParams({ ordering: '-timestamp', ...params })
  return fetchAllPages<AuditEvent>(`/api/compliance/audit/events/?${query.toString()}`)
}

export async function getLoginEvents(): Promise<LoginEvent[]> {
  return fetchAllPages<LoginEvent>('/api/compliance/audit/login-events/?ordering=-timestamp')
}

export async function getSecurityEvents(): Promise<SecurityEvent[]> {
  return fetchAllPages<SecurityEvent>('/api/compliance/audit/security-events/')
}

export async function getRecordVersions(): Promise<RecordVersion[]> {
  return fetchAllPages<RecordVersion>('/api/compliance/audit/versions/?ordering=-created_at')
}

// Bridge for SENAITE-native workflow actions — sample receive/verify/publish/
// cancel/create (app/actions/samples.ts) and worksheet transition/submit/verify
// (app/actions/senaite-worksheets.ts) call SENAITE's REST API directly and never
// touch a Django model, so the normal TRACKED_MODELS save-signal never fires
// for them and they left zero audit trail. Call this right after any such
// action succeeds. Best-effort: a logging failure must never fail the action
// it's recording, so this never throws — it only ever returns whether the log
// itself landed, purely for diagnostics.
// `objectRepr` should be the bare id (e.g. "HP-0011", "WS-011") — matching
// how every native TRACKED_MODELS audit row already shows its Object column
// (no "Sample "/"Worksheet " prefix, since `recordType` already conveys that
// via the Record Type column). `recordType` is optional but should be passed
// whenever the object is a sample or worksheet — it resolves to a real
// ContentType server-side so the Audit Trail table shows "Sample"/"Worksheet"
// instead of "—", without requiring a matching Django row to actually exist.
export async function logExternalAuditEvent(
  action: string,
  objectRepr: string,
  extraData?: Record<string, unknown>,
  recordType?: 'sample' | 'worksheet',
): Promise<boolean> {
  try {
    const res = await djangoFetch('/api/compliance/audit/events/log_external/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, object_repr: objectRepr, extra_data: extraData, record_type: recordType }),
    })
    return res.ok
  } catch {
    return false
  }
}

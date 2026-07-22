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

export async function getAuditEvents(): Promise<AuditEvent[]> {
  try {
    const res = await djangoFetch('/api/compliance/audit/events/?ordering=-timestamp')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export async function getLoginEvents(): Promise<LoginEvent[]> {
  try {
    const res = await djangoFetch('/api/compliance/audit/login-events/?ordering=-timestamp')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export async function getSecurityEvents(): Promise<SecurityEvent[]> {
  try {
    const res = await djangoFetch('/api/compliance/audit/security-events/')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export async function getRecordVersions(): Promise<RecordVersion[]> {
  try {
    const res = await djangoFetch('/api/compliance/audit/versions/?ordering=-created_at')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

'use server'
import { getAuditEvents, type AuditEvent } from './audit-trail'

export async function getSampleAuditEvents(sampleId: number | string): Promise<AuditEvent[]> {
  if (!sampleId) return []
  return getAuditEvents({ record_type: 'sample', object_id: String(sampleId) })
}

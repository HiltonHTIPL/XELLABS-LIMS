'use server'
import { getAuditEvents, type AuditEvent } from './audit-trail'

export async function getSampleAuditEvents(sampleId: string): Promise<AuditEvent[]> {
  return getAuditEvents({ object_repr: sampleId })
}

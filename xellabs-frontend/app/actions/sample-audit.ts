'use server'
import { getAuditEvents, type AuditEvent } from './audit-trail'

export async function getSampleAuditEvents(sampleId: string): Promise<AuditEvent[]> {
  const allEvents = await getAuditEvents()
  return allEvents.filter(ev => ev.object_repr === sampleId)
}

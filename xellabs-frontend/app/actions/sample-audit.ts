'use server'
import { getAuditEvents, type AuditEvent } from './audit-trail'

export async function getSampleAuditEvents(sampleId: number | string, sampleCode?: string): Promise<AuditEvent[]> {
  if (!sampleId) return []
  const sampleEvents = await getAuditEvents({ record_type: 'sample', object_id: String(sampleId) })
  if (!sampleCode) return sampleEvents
  const codeEvents = await getAuditEvents({ object_repr_contains: sampleCode })

  const map = new Map<number, AuditEvent>()
  sampleEvents.forEach(e => map.set(e.id, e))
  codeEvents.forEach(e => map.set(e.id, e))

  const combined = Array.from(map.values())
  combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return combined
}

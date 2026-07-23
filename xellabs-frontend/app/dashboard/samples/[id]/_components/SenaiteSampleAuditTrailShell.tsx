import { PageHeader, Card, Breadcrumb } from '@/app/dashboard/_components/ui'
import { AuditEventsTable } from '@/app/dashboard/audit-trail/_components/AuditTrailShell'
import type { AuditEvent } from '@/app/actions/audit-trail'

export default function SenaiteSampleAuditTrailShell({
  sampleUid, sampleLabel, bridgedEvents,
}: {
  sampleUid: string
  sampleLabel: string
  // Real Django AuditEvent rows bridged from actions that happen entirely
  // against SENAITE's REST API (worksheet assignment, result submit, etc.)
  // — same search/filter/export table already used on the Django-mirrored
  // Sample Detail's Audit Trail page.
  bridgedEvents: AuditEvent[]
}) {
  return (
    <div style={{ padding: 24, backgroundColor: '#F7F8FC', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <Breadcrumb items={[
        { label: 'Samples', href: '/dashboard/samples-overview' },
        { label: 'Sample Detail', href: `/dashboard/samples/${sampleUid}` },
        { label: 'Audit Trail' },
      ]} />

      <PageHeader
        title={
          <span>
            Audit Trail <span style={{ fontWeight: 400, color: '#6B7280', margin: '0 4px' }}>•</span> <span style={{ fontWeight: 500, color: '#0154FC' }}>{sampleLabel}</span>
          </span>
        }
        subtitle={`Audit events log for Sample ${sampleLabel}`}
        backHref={`/dashboard/samples/${sampleUid}`}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        <Card pad={false} bodyClassName="p-4">
          <AuditEventsTable events={bridgedEvents} />
        </Card>
      </div>
    </div>
  )
}

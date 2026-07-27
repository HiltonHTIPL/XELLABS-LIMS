import { Breadcrumb, PageHeader, Card } from '@/app/dashboard/_components/ui'
import { AuditEventsTable } from '@/app/dashboard/audit-trail/_components/AuditTrailShell'
import type { AuditEvent } from '@/app/actions/audit-trail'
import type { SenaiteBatch } from '@/app/lib/senaite'

export default function BatchAuditTrailShell({ batch, events }: {
  batch: SenaiteBatch
  events: AuditEvent[]
}) {
  const backHref = `/dashboard/batches/${batch.uid}`
  return (
    <div style={{ padding: 24, backgroundColor: '#F7F8FC', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <Breadcrumb items={[
        { label: 'Batches', href: '/dashboard/batches' },
        { label: `View Batch (${batch.id})`, href: backHref },
        { label: 'Audit Log' },
      ]} />

      <PageHeader
        title={
          <span>
            Audit Log <span style={{ fontWeight: 400, color: '#6B7280', margin: '0 4px' }}>•</span> <span style={{ fontWeight: 500, color: '#0154FC' }}>{batch.title}</span>
          </span>
        }
        subtitle={`Audit events log for Batch ${batch.id}`}
        backHref={backHref}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        <Card pad={false} bodyClassName="p-4">
          <AuditEventsTable events={events} />
        </Card>
      </div>
    </div>
  )
}

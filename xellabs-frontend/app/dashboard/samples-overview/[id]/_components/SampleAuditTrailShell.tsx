'use client'
import Link from 'next/link'
import { PageHeader, Card } from '@/app/dashboard/_components/ui'
import { AuditEventsTable } from '@/app/dashboard/audit-trail/_components/AuditTrailShell'
import type { AuditEvent } from '@/app/actions/audit-trail'
import type { LabSample } from '@/app/actions/lab-samples'
import { sampleDisplayId as displayId } from '@/app/lib/sampleDisplay'

export default function SampleAuditTrailShell({ sample, events }: { sample: LabSample; events: AuditEvent[] }) {
  const sampleLabel = displayId(sample)
  return (
    <div style={{ padding: 24, backgroundColor: '#F7F8FC', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
        <Link href="/dashboard/samples-overview" className="hover:underline" style={{ color: '#6B7280' }}>Samples</Link>
        <span style={{ margin: '0 6px' }}>›</span>
        <Link href={`/dashboard/samples-overview/${sample.id}`} className="hover:underline" style={{ color: '#6B7280' }}>Sample Detail</Link>
        <span style={{ margin: '0 6px' }}>›</span>
        <span style={{ fontWeight: 600, color: '#111827' }}>Audit Trail</span>
      </div>

      <PageHeader
        title={
          <span>
            Audit Trail <span style={{ fontWeight: 400, color: '#6B7280', margin: '0 4px' }}>•</span> <span style={{ fontWeight: 400, color: '#4B5563' }}>{sampleLabel}</span>
          </span>
        }
        subtitle={`Audit events log for Sample ${sampleLabel} (${sample.sample_type_name || 'Sample'})`}
        backHref={`/dashboard/samples-overview/${sample.id}`}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        <Card pad={false} bodyClassName="p-4">
          <AuditEventsTable events={events} />
        </Card>
      </div>
    </div>
  )
}

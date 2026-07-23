import { notFound } from 'next/navigation'
import { getSample } from '@/app/actions/samples'
import { getAuditEvents } from '@/app/actions/audit-trail'
import SenaiteSampleAuditTrailShell from '../_components/SenaiteSampleAuditTrailShell'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sample = await getSample(id)
  if (!sample) notFound()

  const bridgedEvents = sample.id ? await getAuditEvents({ object_repr_contains: sample.id }) : []

  return (
    <SenaiteSampleAuditTrailShell
      sampleUid={sample.uid}
      sampleLabel={sample.id}
      bridgedEvents={bridgedEvents}
    />
  )
}

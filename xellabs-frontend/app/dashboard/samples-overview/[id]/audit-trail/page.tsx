import { notFound } from 'next/navigation'
import { getLabSample } from '@/app/actions/lab-samples'
import { getSampleAuditEvents } from '@/app/actions/sample-audit'
import SampleAuditTrailShell from '../_components/SampleAuditTrailShell'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sampleIdNum = Number(id)
  if (isNaN(sampleIdNum)) notFound()

  const sample = await getLabSample(sampleIdNum)
  if (!sample) notFound()

  const events = await getSampleAuditEvents(sample.id)

  return <SampleAuditTrailShell sample={sample} events={events} />
}

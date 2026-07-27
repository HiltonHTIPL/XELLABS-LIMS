import { notFound } from 'next/navigation'
import { getBatch, getBatchAuditEvents } from '@/app/actions/batches'
import BatchAuditTrailShell from './_components/BatchAuditTrailShell'

export const dynamic = 'force-dynamic'

export default async function BatchAuditTrailPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  const batch = await getBatch(uid)
  if (!batch) notFound()

  const events = await getBatchAuditEvents(batch.id)
  return <BatchAuditTrailShell batch={batch} events={events} />
}

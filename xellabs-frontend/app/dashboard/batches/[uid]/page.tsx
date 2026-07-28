import { notFound } from 'next/navigation'
import { getBatch, getBatchSamples } from '@/app/actions/batches'
import { getLabSamples } from '@/app/actions/lab-samples'
import BatchDetailShell from './_components/BatchDetailShell'

export default async function BatchDetailPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  const batch = await getBatch(uid)
  if (!batch) notFound()

  const [samples, labSamples] = await Promise.all([
    getBatchSamples(uid),
    getLabSamples(),
  ])
  // Map SENAITE uid -> Django numeric id so each sample row can link to its
  // own detail page (/dashboard/samples-overview/[id] expects a Django id,
  // not a SENAITE uid) — samples registered before their Django mirror synced
  // (or that failed to mirror) simply won't have an entry and render unlinked.
  const djangoIdByUid = Object.fromEntries(
    labSamples.filter(s => s.senaite_uid).map(s => [s.senaite_uid as string, s.id])
  )
  return <BatchDetailShell batch={batch} samples={samples} djangoIdByUid={djangoIdByUid} />
}

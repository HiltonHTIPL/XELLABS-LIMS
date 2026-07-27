import { notFound } from 'next/navigation'
import { getBatch, getBatchSamples } from '@/app/actions/batches'
import BatchBookShell from './_components/BatchBookShell'

export const dynamic = 'force-dynamic'

export default async function BatchBookPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  const batch = await getBatch(uid)
  if (!batch) notFound()

  const samples = await getBatchSamples(uid)
  return <BatchBookShell batch={batch} samples={samples} />
}

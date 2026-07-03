import { getLabSample } from '@/app/actions/lab-samples'
import SampleReceiptShell from './_components/SampleReceiptShell'

export default async function SampleReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  const sample = id ? await getLabSample(Number(id)) : null

  return <SampleReceiptShell sample={sample} hasId={!!id} />
}

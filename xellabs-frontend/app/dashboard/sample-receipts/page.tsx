import { getLabSample } from '@/app/actions/lab-samples'
import { getSamplingDeviations } from '@/app/actions/reference-data'
import SampleReceiptShell from './_components/SampleReceiptShell'

export default async function SampleReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  const [sample, samplingDeviations] = await Promise.all([
    id ? getLabSample(Number(id)) : Promise.resolve(null),
    getSamplingDeviations(),
  ])

  return <SampleReceiptShell sample={sample} hasId={!!id} samplingDeviations={samplingDeviations} />
}

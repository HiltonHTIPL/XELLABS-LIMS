import { getSamples } from '@/app/actions/samples'
import SamplesShell from './_components/SamplesShell'

export default async function SamplesPage() {
  const samples = await getSamples()

  return <SamplesShell initialSamples={samples} />
}

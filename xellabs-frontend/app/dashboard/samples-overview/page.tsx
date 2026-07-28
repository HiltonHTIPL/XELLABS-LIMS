import { getLabSamples, getDjangoSampleTypes } from '@/app/actions/lab-samples'
import { getActiveSenaiteClientsForDropdown } from '@/app/actions/senaite-clients'
import SamplesOverviewShell from './_components/SamplesOverviewShell'

export default async function SamplesOverviewPage() {
  const [samples, sampleTypes, clients] = await Promise.all([
    getLabSamples(),
    getDjangoSampleTypes(),
    getActiveSenaiteClientsForDropdown(),
  ])
  return (
    <SamplesOverviewShell
      initialSamples={samples}
      sampleTypes={sampleTypes}
      clients={clients}
    />
  )
}

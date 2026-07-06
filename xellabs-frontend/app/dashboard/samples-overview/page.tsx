import { getLabSamples, getDjangoSampleTypes, getSampleStats } from '@/app/actions/lab-samples'
import { getClients } from '@/app/actions/clients'
import SamplesOverviewShell from './_components/SamplesOverviewShell'

export default async function SamplesOverviewPage() {
  const [samples, sampleTypes, stats, clients] = await Promise.all([
    getLabSamples(),
    getDjangoSampleTypes(),
    getSampleStats(),
    getClients(),
  ])
  return (
    <SamplesOverviewShell
      initialSamples={samples}
      sampleTypes={sampleTypes}
      stats={stats}
      clients={clients}
    />
  )
}

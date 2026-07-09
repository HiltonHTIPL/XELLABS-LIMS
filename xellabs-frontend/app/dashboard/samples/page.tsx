import { getSamples, getSampleTypes, getAnalysisServices } from '@/app/actions/samples'
import { getClients } from '@/app/actions/clients'
import SamplesShell from './_components/SamplesShell'

export default async function SamplesPage() {
  const [samples, clients, sampleTypes, analysisServices] = await Promise.all([
    getSamples(),
    getClients(),
    getSampleTypes(),
    getAnalysisServices(),
  ])

  return (
    <SamplesShell
      initialSamples={samples}
      clients={clients}
      sampleTypes={sampleTypes}
      analysisServices={analysisServices}
    />
  )
}

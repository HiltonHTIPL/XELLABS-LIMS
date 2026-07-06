import { getLabSamples, getDjangoSampleTypes } from '@/app/actions/lab-samples'
import { getClients } from '@/app/actions/clients'
import LabSamplesShell from './_components/LabSamplesShell'

export default async function LabSamplesPage() {
  const [samples, clients, sampleTypes] = await Promise.all([
    getLabSamples(),
    getClients(),
    getDjangoSampleTypes(),
  ])
  return <LabSamplesShell initialSamples={samples} clients={clients} sampleTypes={sampleTypes} />
}

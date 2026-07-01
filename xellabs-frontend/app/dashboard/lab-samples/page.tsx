import { getLabSamples } from '@/app/actions/lab-samples'
import { getClients } from '@/app/actions/clients'
import { getSampleTypes } from '@/app/actions/samples'
import LabSamplesShell from './_components/LabSamplesShell'

export default async function LabSamplesPage() {
  const [samples, clients, sampleTypes] = await Promise.all([
    getLabSamples(),
    getClients(),
    getSampleTypes(),
  ])
  return <LabSamplesShell initialSamples={samples} clients={clients} sampleTypes={sampleTypes} />
}

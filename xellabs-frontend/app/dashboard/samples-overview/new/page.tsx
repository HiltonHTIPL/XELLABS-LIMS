import { getDjangoSampleTypes } from '@/app/actions/lab-samples'
import { getClients } from '@/app/actions/clients'
import { getTests } from '@/app/actions/tests'
import NewSampleShell from './_components/NewSampleShell'

export default async function NewSamplePage() {
  const [sampleTypes, clients, tests] = await Promise.all([
    getDjangoSampleTypes(),
    getClients(),
    getTests(),
  ])
  return <NewSampleShell sampleTypes={sampleTypes} clients={clients} tests={tests.filter(t => t.is_active)} />
}

import { getDjangoSampleTypes, syncSampleTypesFromSenaite } from '@/app/actions/lab-samples'
import { getClients } from '@/app/actions/clients'
import { getTests } from '@/app/actions/tests'
import { getSampleTemplatesPageData } from '@/app/actions/sample-templates'
import { getBatchesList } from '@/app/actions/batches'
import NewSampleShell from './_components/NewSampleShell'

export default async function NewSamplePage() {
  // Sync SENAITE types to Django silently before fetching — ensures all configured types are available
  await syncSampleTypesFromSenaite()

  const [sampleTypes, clients, tests, templateData, batches] = await Promise.all([
    getDjangoSampleTypes(),
    getClients(),
    getTests(),
    getSampleTemplatesPageData(),
    getBatchesList(),
  ])
  return (
    <NewSampleShell
      sampleTypes={sampleTypes}
      clients={clients}
      tests={tests.filter(t => t.is_active)}
      sampleTemplates={templateData.sampleTemplates}
      sampleContainers={templateData.sampleContainers}
      batches={batches}
    />
  )
}

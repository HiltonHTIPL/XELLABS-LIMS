import { getDjangoSampleTypes, syncSampleTypesFromSenaite, syncTestsFromSenaite } from '@/app/actions/lab-samples'
import { getClients } from '@/app/actions/clients'
import { getTests } from '@/app/actions/tests'
import { getSampleTemplatesPageData } from '@/app/actions/sample-templates'
import { getBatchesList } from '@/app/actions/batches'
import { getAnalysisSpecifications } from '@/app/actions/specifications'
import { getPreservations } from '@/app/actions/reference-data'
import NewSampleShell from './_components/NewSampleShell'

export default async function NewSamplePage() {
  // Sync SENAITE types/services to Django silently before fetching — ensures all configured
  // types and analysis services are available for Sample Template / Analysis Specification
  // auto-populate to actually find a match (they match by senaite_uid on the Test row).
  await Promise.all([syncSampleTypesFromSenaite(), syncTestsFromSenaite()])

  const [sampleTypes, clients, tests, templateData, batches, analysisSpecifications, preservations] = await Promise.all([
    getDjangoSampleTypes(),
    getClients(),
    getTests(),
    getSampleTemplatesPageData(),
    getBatchesList(),
    getAnalysisSpecifications(),
    getPreservations(),
  ])
  return (
    <NewSampleShell
      sampleTypes={sampleTypes}
      clients={clients}
      tests={tests.filter(t => t.is_active)}
      sampleTemplates={templateData.sampleTemplates}
      sampleContainers={templateData.sampleContainers}
      batches={batches}
      analysisSpecifications={analysisSpecifications.filter(s => s.is_active)}
      preservations={preservations}
    />
  )
}

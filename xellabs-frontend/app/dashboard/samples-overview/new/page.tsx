import { getDjangoSampleTypes, syncSampleTypesFromSenaite } from '@/app/actions/lab-samples'
import { getClients } from '@/app/actions/clients'
import { getAnalysisServices } from '@/app/actions/samples'
import { getSampleTemplatesPageData } from '@/app/actions/sample-templates'
import { getBatchesList } from '@/app/actions/batches'
import { getAnalysisSpecifications } from '@/app/actions/specifications'
import { getPreservations } from '@/app/actions/reference-data'
import NewSampleShell from './_components/NewSampleShell'

export default async function NewSamplePage() {
  // Sync SENAITE sample types to Django silently before fetching — ensures all
  // configured types are available for Sample Template auto-populate to match
  // (by senaite_uid). Analysis services are fetched live, no sync needed.
  await syncSampleTypesFromSenaite()

  const [sampleTypes, clients, services, templateData, batches, analysisSpecifications, preservations] = await Promise.all([
    getDjangoSampleTypes(),
    getClients(),
    getAnalysisServices(),
    getSampleTemplatesPageData(),
    getBatchesList(),
    getAnalysisSpecifications(),
    getPreservations(),
  ])
  return (
    <NewSampleShell
      sampleTypes={sampleTypes}
      clients={clients}
      services={services}
      sampleTemplates={templateData.sampleTemplates}
      sampleContainers={templateData.sampleContainers}
      batches={batches}
      analysisSpecifications={analysisSpecifications.filter(s => s.is_active)}
      preservations={preservations}
    />
  )
}

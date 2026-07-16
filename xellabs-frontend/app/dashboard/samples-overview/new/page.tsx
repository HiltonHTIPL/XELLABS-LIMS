import { getDjangoSampleTypes, syncSampleTypesFromSenaite, getLabSamples } from '@/app/actions/lab-samples'
import { getClients, syncClientsFromSenaite } from '@/app/actions/clients'
import { getAnalysisServices } from '@/app/actions/samples'
import { getSampleTemplatesPageData } from '@/app/actions/sample-templates'
import { getBatchesList } from '@/app/actions/batches'
import { getAnalysisSpecifications } from '@/app/actions/specifications'
import { getPreservations, getSamplingDeviations, getSamplePoints } from '@/app/actions/reference-data'
import NewSampleShell from './_components/NewSampleShell'

export default async function NewSamplePage() {
  // Sync SENAITE sample types AND clients to Django silently before fetching —
  // ensures all configured types are available for Sample Template
  // auto-populate to match (by senaite_uid), and that every SENAITE client
  // (the CRUD source of truth — see Clients dashboard) has a mirrored Django
  // Client row to attach the created Sample to. Without this, any client
  // created/edited purely via the Clients page never appeared here — Django's
  // own Client table only grows through this sync, not through that page.
  await Promise.all([syncSampleTypesFromSenaite(), syncClientsFromSenaite()])

  const [sampleTypes, clients, services, templateData, batches, analysisSpecifications, preservations, samplingDeviations, samplePoints, existingSamples] = await Promise.all([
    getDjangoSampleTypes(),
    getClients(),
    getAnalysisServices(),
    getSampleTemplatesPageData(),
    getBatchesList(),
    getAnalysisSpecifications(),
    getPreservations(),
    getSamplingDeviations(),
    getSamplePoints(),
    getLabSamples(),
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
      samplingDeviations={samplingDeviations}
      samplePoints={samplePoints}
      existingSamples={existingSamples}
    />
  )
}

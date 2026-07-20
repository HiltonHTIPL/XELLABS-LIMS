import { getDjangoSampleTypes, syncSampleTypesFromSenaite, getRecentLabSamplesForDuplicateCheck } from '@/app/actions/lab-samples'
import { getClients } from '@/app/actions/clients'
import { getAnalysisServices } from '@/app/actions/samples'
import { getSampleTemplatesForNewSample } from '@/app/actions/sample-templates'
import { getBatchesList } from '@/app/actions/batches'
import { getAnalysisSpecifications } from '@/app/actions/specifications'
import { getPreservations, getSamplingDeviations, getSamplePoints } from '@/app/actions/reference-data'
import NewSampleShell from './_components/NewSampleShell'

export default async function NewSamplePage() {
  // Sync SENAITE sample types to Django silently before fetching — ensures all
  // configured types are available for Sample Template auto-populate to match
  // (by senaite_uid). Client sync happens inside getClients() itself below —
  // do not also call syncClientsFromSenaite() here, it would run the same
  // (expensive, sequential per-client) sync twice on every page load.
  await syncSampleTypesFromSenaite()

  const [sampleTypes, clients, services, templateData, batches, analysisSpecifications, preservations, samplingDeviations, samplePoints, existingSamples] = await Promise.all([
    getDjangoSampleTypes(),
    getClients(),
    getAnalysisServices(),
    getSampleTemplatesForNewSample(),
    getBatchesList(),
    getAnalysisSpecifications(),
    getPreservations(),
    getSamplingDeviations(),
    getSamplePoints(),
    getRecentLabSamplesForDuplicateCheck(),
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

import { getLabSample, getDjangoSampleTypes } from '@/app/actions/lab-samples'
import { getAnalysisRequestsForSample } from '@/app/actions/analysis-requests'
import { getAnalysisServices } from '@/app/actions/samples'
import { getClients } from '@/app/actions/clients'
import { getSampleTemplatesForNewSample } from '@/app/actions/sample-templates'
import { getBatchesList } from '@/app/actions/batches'
import { getAnalysisSpecifications } from '@/app/actions/specifications'
import { getPreservations, getSamplingDeviations, getSamplePoints } from '@/app/actions/reference-data'
import SampleOverviewDetail from './_components/SampleOverviewDetail'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sample = await getLabSample(Number(id))
  const [
    analysisRequests, services, sampleTypes, clients, templateData,
    batches, analysisSpecifications, preservations, samplingDeviations, samplePoints,
  ] = await Promise.all([
    sample ? getAnalysisRequestsForSample(sample.id) : Promise.resolve([]),
    getAnalysisServices(),
    getDjangoSampleTypes(),
    getClients(),
    getSampleTemplatesForNewSample(),
    getBatchesList(),
    getAnalysisSpecifications(),
    getPreservations(),
    getSamplingDeviations(),
    getSamplePoints(),
  ])
  return (
    <SampleOverviewDetail
      sample={sample}
      id={id}
      analysisRequests={analysisRequests}
      services={services}
      sampleTypes={sampleTypes}
      clients={clients}
      sampleTemplates={templateData.sampleTemplates}
      sampleContainers={templateData.sampleContainers}
      batches={batches}
      analysisSpecifications={analysisSpecifications.filter(s => s.is_active)}
      preservations={preservations}
      samplingDeviations={samplingDeviations}
      samplePoints={samplePoints}
    />
  )
}

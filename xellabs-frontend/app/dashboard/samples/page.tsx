import { getSamples, getSampleTypes, getAnalysisServices } from '@/app/actions/samples'
import { getClients } from '@/app/actions/clients'
import { getSampleTemplatesPageData } from '@/app/actions/sample-templates'
import { getAnalysisProfiles } from '@/app/actions/analysis-profiles'
import SamplesShell from './_components/SamplesShell'

export default async function SamplesPage() {
  const [samples, clients, sampleTypes, analysisServices, templateData, analysisProfiles] = await Promise.all([
    getSamples(),
    getClients(),
    getSampleTypes(),
    getAnalysisServices(),
    getSampleTemplatesPageData(),
    getAnalysisProfiles(),
  ])

  return (
    <SamplesShell
      initialSamples={samples}
      clients={clients}
      sampleTypes={sampleTypes}
      analysisServices={analysisServices}
      sampleTemplates={templateData.sampleTemplates}
      sampleContainers={templateData.sampleContainers}
      analysisProfiles={analysisProfiles}
    />
  )
}

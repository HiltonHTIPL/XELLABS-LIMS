import { getSampleTemplates } from '@/app/actions/sample-templates'
import { getSampleTypes, getAnalysisServices } from '@/app/actions/samples'
import SampleTemplatesShell from './_components/SampleTemplatesShell'

export default async function SampleTemplatesPage() {
  const [templates, sampleTypes, analysisServices] = await Promise.all([
    getSampleTemplates(),
    getSampleTypes(),
    getAnalysisServices(),
  ])
  return (
    <SampleTemplatesShell
      initialTemplates={templates}
      sampleTypes={sampleTypes}
      analysisServices={analysisServices}
    />
  )
}

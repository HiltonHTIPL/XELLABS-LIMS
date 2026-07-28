import { getSampleTemplatesPageData } from '@/app/actions/sample-templates'
import SampleTemplatesShell from './_components/SampleTemplatesShell'

export default async function SampleTemplatesPage() {
  const data = await getSampleTemplatesPageData()
  return (
    <SampleTemplatesShell
      initialTemplates={data.sampleTemplates}
      sampleTypes={data.sampleTypes}
      analysisServices={data.analysisServices}
      sampleContainers={data.sampleContainers}
      preservations={data.preservations}
      samplePoints={data.samplePoints}
    />
  )
}

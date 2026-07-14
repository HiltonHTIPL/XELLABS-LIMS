import { getSampleTemplates } from '@/app/actions/sample-templates'
import { getSampleTypes, getAnalysisServices } from '@/app/actions/samples'
import { fetchSenaiteContainerTypes, fetchSenaitePreservations, fetchSenaiteSamplePoints } from '@/app/lib/senaite'
import { serverToken } from '@/app/lib/senaite-auth'
import SampleTemplatesShell from './_components/SampleTemplatesShell'

export default async function SampleTemplatesPage() {
  const token = serverToken()
  const [templates, sampleTypes, analysisServices, containerTypes, preservations, samplePoints] = await Promise.all([
    getSampleTemplates(),
    getSampleTypes(),
    getAnalysisServices(),
    fetchSenaiteContainerTypes(token),
    fetchSenaitePreservations(token),
    fetchSenaiteSamplePoints(token),
  ])
  return (
    <SampleTemplatesShell
      initialTemplates={templates}
      sampleTypes={sampleTypes}
      analysisServices={analysisServices}
      containerTypes={containerTypes}
      preservations={preservations}
      samplePoints={samplePoints}
    />
  )
}

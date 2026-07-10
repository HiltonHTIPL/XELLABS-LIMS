import { getSampleTypes, getAnalysisServices } from '@/app/actions/samples'
import { getClients } from '@/app/actions/clients'
import { getSampleTemplates } from '@/app/actions/sample-templates'
import { getAnalysisProfiles } from '@/app/actions/analysis-profiles'
import NewSamplePage from './_components/NewSamplePage'

export default async function NewSamplePageServer() {
  const [clients, sampleTypes, analysisServices, sampleTemplates, analysisProfiles] = await Promise.all([
    getClients(),
    getSampleTypes(),
    getAnalysisServices(),
    getSampleTemplates(),
    getAnalysisProfiles(),
  ])

  const clientOptions = clients
    .filter(c => c.senaite_uid)
    .map(c => ({ uid: c.senaite_uid!, name: c.name, client_id: c.client_id }))

  return (
    <NewSamplePage
      clients={clientOptions}
      sampleTypes={sampleTypes}
      analysisServices={analysisServices}
      sampleTemplates={sampleTemplates}
      analysisProfiles={analysisProfiles}
    />
  )
}

import { getSampleTypes, getAnalysisServices } from '@/app/actions/samples'
import { getSenaiteClients } from '@/app/actions/senaite-clients'
import { getSampleTemplatesPageData } from '@/app/actions/sample-templates'
import { getAnalysisProfiles } from '@/app/actions/analysis-profiles'
import NewSamplePage from './_components/NewSamplePage'

export default async function NewSamplePageServer() {
  const [clients, sampleTypes, analysisServices, templateData, analysisProfiles] = await Promise.all([
    getSenaiteClients(),
    getSampleTypes(),
    getAnalysisServices(),
    getSampleTemplatesPageData(),
    getAnalysisProfiles(),
  ])

  // SENAITE is the CRUD source of truth for clients (see Clients dashboard) —
  // read the dropdown straight from there instead of Django's own Client
  // model, whose senaite_uid only gets populated for clients created through
  // an older sync path. That mismatch silently hid any client created/edited
  // via the Clients page from this dropdown.
  const clientOptions = clients.map(c => ({ uid: c.uid, name: c.title, client_id: c.ClientID }))

  return (
    <NewSamplePage
      clients={clientOptions}
      sampleTypes={sampleTypes}
      analysisServices={analysisServices}
      sampleTemplates={templateData.sampleTemplates}
      sampleContainers={templateData.sampleContainers}
      analysisProfiles={analysisProfiles}
    />
  )
}

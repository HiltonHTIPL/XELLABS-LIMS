import { getAnalysesPageData } from '@/app/actions/analyses'
import { getAnalysisProfiles } from '@/app/actions/analysis-profiles'
import AnalysesTabsShell from './_components/AnalysesTabsShell'

export default async function AnalysesPage() {
  const [{ services, categories, departments, labContacts, methods, instruments }, profiles] = await Promise.all([
    getAnalysesPageData(),
    getAnalysisProfiles(),
  ])
  return (
    <AnalysesTabsShell
      initialServices={services}
      categories={categories}
      departments={departments}
      labContacts={labContacts}
      methods={methods}
      instruments={instruments}
      initialProfiles={profiles}
    />
  )
}

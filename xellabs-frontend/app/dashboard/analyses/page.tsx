import { getAnalysesPageData } from '@/app/actions/analyses'
import { getAnalysisProfiles } from '@/app/actions/analysis-profiles'
import { listOptions } from '@/app/lib/admin-crud'
import AnalysesTabsShell from './_components/AnalysesTabsShell'

export default async function AnalysesPage() {
  const [{ services, categories, departments, labContacts, methods, instruments, calculations }, profiles, sampleTypeOptions] = await Promise.all([
    getAnalysesPageData(),
    getAnalysisProfiles(),
    listOptions('SampleType'),
  ])
  return (
    <AnalysesTabsShell
      initialServices={services}
      categories={categories}
      departments={departments}
      labContacts={labContacts}
      methods={methods}
      instruments={instruments}
      calculations={calculations}
      initialProfiles={profiles}
      sampleTypeOptions={sampleTypeOptions}
    />
  )
}

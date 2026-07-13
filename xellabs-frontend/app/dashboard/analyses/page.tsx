import { getAnalysesPageData } from '@/app/actions/analyses'
import AnalysesShell from './_components/AnalysesShell'

export default async function AnalysesPage() {
  const { services, categories, departments, labContacts } = await getAnalysesPageData()
  return (
    <AnalysesShell
      initialServices={services}
      categories={categories}
      departments={departments}
      labContacts={labContacts}
    />
  )
}

import { listAnalysisCategories, listDepartmentOptions } from '@/app/actions/analysis-categories'
import AnalysisCategoriesShell from './_components/AnalysisCategoriesShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [rows, departments] = await Promise.all([listAnalysisCategories(), listDepartmentOptions()])
  return <AnalysisCategoriesShell rows={rows} departments={departments} />
}

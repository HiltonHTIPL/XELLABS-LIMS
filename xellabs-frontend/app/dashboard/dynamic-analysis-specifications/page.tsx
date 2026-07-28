import { getDynamicAnalysisSpecifications } from '@/app/actions/dynamic-analysis-specifications'
import DynamicAnalysisSpecificationsShell from './_components/DynamicAnalysisSpecificationsShell'

export default async function DynamicAnalysisSpecificationsPage() {
  const specs = await getDynamicAnalysisSpecifications()
  return <DynamicAnalysisSpecificationsShell initialSpecs={specs} />
}

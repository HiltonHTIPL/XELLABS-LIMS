import { getAnalysisRequests } from '@/app/actions/analysis-requests'
import { getLabSamples } from '@/app/actions/lab-samples'
import { getTests } from '@/app/actions/tests'
import ARShell from './_components/ARShell'

export default async function AnalysisRequestsPage() {
  const [ars, samples, tests] = await Promise.all([
    getAnalysisRequests(),
    getLabSamples(),
    getTests(),
  ])
  return <ARShell initialARs={ars} samples={samples} tests={tests} />
}

import { getAnalysisRequests } from '@/app/actions/analysis-requests'
import { getLabSamples } from '@/app/actions/lab-samples'
import { getAnalysisServices } from '@/app/actions/samples'
import ARShell from './_components/ARShell'

export default async function AnalysisRequestsPage() {
  const [ars, samples, services] = await Promise.all([
    getAnalysisRequests(),
    getLabSamples(),
    getAnalysisServices(),
  ])
  return <ARShell initialARs={ars} samples={samples} services={services} />
}

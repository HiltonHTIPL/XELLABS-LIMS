import { getLabSample } from '@/app/actions/lab-samples'
import { getAnalysisRequestsForSample } from '@/app/actions/analysis-requests'
import SampleOverviewDetail from './_components/SampleOverviewDetail'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sample = await getLabSample(Number(id))
  const analysisRequests = sample ? await getAnalysisRequestsForSample(sample.id) : []
  return (
    <SampleOverviewDetail
      sample={sample}
      id={id}
      analysisRequests={analysisRequests}
    />
  )
}

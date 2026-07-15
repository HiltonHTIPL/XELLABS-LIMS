import { getSamplePointsPageData } from '@/app/actions/sample-points'
import SamplePointsShell from './_components/SamplePointsShell'

export default async function SamplePointsPage() {
  const { samplePoints, sampleTypes } = await getSamplePointsPageData()
  return <SamplePointsShell initialSamplePoints={samplePoints} sampleTypes={sampleTypes} />
}

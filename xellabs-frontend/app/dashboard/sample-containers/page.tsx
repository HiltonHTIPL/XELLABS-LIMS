import { getSampleContainersPageData } from '@/app/actions/sample-containers'
import SampleContainersShell from './_components/SampleContainersShell'

export default async function SampleContainersPage() {
  const { sampleContainers, containerTypes, preservations } = await getSampleContainersPageData()
  return (
    <SampleContainersShell
      initialSampleContainers={sampleContainers}
      containerTypes={containerTypes}
      preservations={preservations}
    />
  )
}

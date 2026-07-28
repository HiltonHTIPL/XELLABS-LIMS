import { getSampleTypesPageData } from '@/app/actions/sample-types'
import SampleTypesShell from './_components/SampleTypesShell'

export default async function SampleTypesPage() {
  const { sampleTypes, sampleMatrices, containerTypes } = await getSampleTypesPageData()
  return (
    <SampleTypesShell
      initialSampleTypes={sampleTypes}
      sampleMatrices={sampleMatrices}
      containerTypes={containerTypes}
    />
  )
}

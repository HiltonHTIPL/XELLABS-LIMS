import { getSampleTypesList } from '@/app/actions/sample-types'
import SampleTypesShell from './_components/SampleTypesShell'

export default async function SampleTypesPage() {
  const sampleTypes = await getSampleTypesList()
  return <SampleTypesShell initialSampleTypes={sampleTypes} />
}

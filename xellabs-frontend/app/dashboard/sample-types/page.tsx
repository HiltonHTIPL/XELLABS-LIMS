import { getSampleTypesList } from '@/app/actions/sample-types'
import { getDjangoSampleTypes } from '@/app/actions/lab-samples'
import SampleTypesShell from './_components/SampleTypesShell'

export default async function SampleTypesPage() {
  const [sampleTypes, djangoTypes] = await Promise.all([
    getSampleTypesList(),
    getDjangoSampleTypes(),
  ])
  const retentionByName: Record<string, number> = {}
  for (const t of djangoTypes) {
    retentionByName[t.name] = t.retention_days ?? 14
  }
  return <SampleTypesShell initialSampleTypes={sampleTypes} retentionByName={retentionByName} />
}

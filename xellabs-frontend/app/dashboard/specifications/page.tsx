import { getSpecifications } from '@/app/actions/specifications'
import { getTests } from '@/app/actions/tests'
import { getDjangoSampleTypes } from '@/app/actions/lab-samples'
import SpecificationsShell from './_components/SpecificationsShell'

export default async function SpecificationsPage() {
  const [specifications, tests, sampleTypes] = await Promise.all([
    getSpecifications(),
    getTests(),
    getDjangoSampleTypes(),
  ])

  return (
    <SpecificationsShell
      initialSpecifications={specifications}
      tests={tests}
      sampleTypes={sampleTypes}
    />
  )
}

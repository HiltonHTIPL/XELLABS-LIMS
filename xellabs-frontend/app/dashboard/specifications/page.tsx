import { getAnalysisSpecifications } from '@/app/actions/specifications'
import { getTests } from '@/app/actions/tests'
import { getDjangoSampleTypes } from '@/app/actions/lab-samples'
import { getDynamicAnalysisSpecifications } from '@/app/actions/dynamic-analysis-specifications'
import SpecificationsShell from './_components/SpecificationsShell'

export default async function SpecificationsPage() {
  const [specifications, tests, sampleTypes, dynamicSpecs] = await Promise.all([
    getAnalysisSpecifications(),
    getTests(),
    getDjangoSampleTypes(),
    getDynamicAnalysisSpecifications(),
  ])

  return (
    <SpecificationsShell
      initialSpecifications={specifications}
      tests={tests}
      sampleTypes={sampleTypes}
      dynamicSpecs={dynamicSpecs}
    />
  )
}

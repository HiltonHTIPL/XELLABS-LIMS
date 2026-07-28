import { getAnalysisSpecifications } from '@/app/actions/specifications'
import { getAnalysisServices } from '@/app/actions/samples'
import { getDjangoSampleTypes } from '@/app/actions/lab-samples'
import { getDynamicAnalysisSpecifications } from '@/app/actions/dynamic-analysis-specifications'
import SpecificationsShell from './_components/SpecificationsShell'

export default async function SpecificationsPage() {
  const [specifications, services, sampleTypes, dynamicSpecs] = await Promise.all([
    getAnalysisSpecifications(),
    getAnalysisServices(),
    getDjangoSampleTypes(),
    getDynamicAnalysisSpecifications(),
  ])

  return (
    <SpecificationsShell
      initialSpecifications={specifications}
      services={services}
      sampleTypes={sampleTypes}
      dynamicSpecs={dynamicSpecs}
    />
  )
}

import { getAnalysisProfiles } from '@/app/actions/analysis-profiles'
import { getAnalysisServices } from '@/app/actions/samples'
import { listOptions } from '@/app/lib/admin-crud'
import AnalysisProfilesShell from './_components/AnalysisProfilesShell'

export default async function AnalysisProfilesPage() {
  const [profiles, analysisServices, sampleTypeOptions] = await Promise.all([
    getAnalysisProfiles(),
    getAnalysisServices(),
    listOptions('SampleType'),
  ])
  return (
    <AnalysisProfilesShell
      initialProfiles={profiles}
      analysisServices={analysisServices}
      sampleTypeOptions={sampleTypeOptions}
    />
  )
}

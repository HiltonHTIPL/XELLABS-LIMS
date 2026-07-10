import { getAnalysisProfiles } from '@/app/actions/analysis-profiles'
import { getAnalysisServices } from '@/app/actions/samples'
import AnalysisProfilesShell from './_components/AnalysisProfilesShell'

export default async function AnalysisProfilesPage() {
  const [profiles, analysisServices] = await Promise.all([
    getAnalysisProfiles(),
    getAnalysisServices(),
  ])
  return (
    <AnalysisProfilesShell
      initialProfiles={profiles}
      analysisServices={analysisServices}
    />
  )
}

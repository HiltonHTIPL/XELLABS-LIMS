import { getWorksheetAnalyses, getUnassignedAnalyses } from '@/app/actions/worksheets'
import WorksheetDetail from './_components/WorksheetDetail'

export default async function WorksheetDetailPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  const [analyses, unassigned] = await Promise.all([
    getWorksheetAnalyses(uid),
    getUnassignedAnalyses(),
  ])
  return <WorksheetDetail worksheetUid={uid} analyses={analyses} unassigned={unassigned} />
}

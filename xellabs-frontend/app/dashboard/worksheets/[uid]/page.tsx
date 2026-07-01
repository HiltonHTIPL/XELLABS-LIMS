import { getWorksheetAnalyses, getUnassignedAnalyses } from '@/app/actions/worksheets'
import WorksheetDetail from './_components/WorksheetDetail'

export default async function WorksheetDetailPage({ params }: { params: { uid: string } }) {
  const [analyses, unassigned] = await Promise.all([
    getWorksheetAnalyses(params.uid),
    getUnassignedAnalyses(),
  ])
  return <WorksheetDetail worksheetUid={params.uid} analyses={analyses} unassigned={unassigned} />
}

import { getWorksheets } from '@/app/actions/worksheets'
import WorksheetsShell from './_components/WorksheetsShell'

export default async function WorksheetsPage() {
  const worksheets = await getWorksheets()
  return <WorksheetsShell initialWorksheets={worksheets} />
}

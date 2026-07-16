import { getDjangoWorksheets } from '@/app/actions/django-worksheets'
import LabWorksheetsShell from './_components/LabWorksheetsShell'

export default async function WorksheetsPage() {
  const worksheets = await getDjangoWorksheets()
  return <LabWorksheetsShell initialWorksheets={worksheets} />
}

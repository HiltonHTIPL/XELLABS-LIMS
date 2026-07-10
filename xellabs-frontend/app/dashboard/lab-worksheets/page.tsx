import { getDjangoWorksheets } from '@/app/actions/django-worksheets'
import LabWorksheetsShell from './_components/LabWorksheetsShell'

export default async function LabWorksheetsPage() {
  const worksheets = await getDjangoWorksheets()
  return <LabWorksheetsShell initialWorksheets={worksheets} />
}

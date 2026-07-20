import {
  getSenaiteWorksheets, getWorksheetTemplateOptions, getWorksheetInstrumentOptions,
} from '@/app/actions/senaite-worksheets'
import WorksheetsShell from './_components/WorksheetsShell'

export const dynamic = 'force-dynamic'

export default async function WorksheetsPage() {
  const [worksheets, templates, instruments] = await Promise.all([
    getSenaiteWorksheets(),
    getWorksheetTemplateOptions(),
    getWorksheetInstrumentOptions(),
  ])
  return <WorksheetsShell initialWorksheets={worksheets} templates={templates} instruments={instruments} />
}

import {
  getSenaiteWorksheets, getWorksheetTemplateOptions, getWorksheetInstrumentOptions,
  getLabAnalysts,
} from '@/app/actions/senaite-worksheets'
import { getSession } from '@/app/lib/session'
import WorksheetsShell from './_components/WorksheetsShell'

export const dynamic = 'force-dynamic'

export default async function WorksheetsPage() {
  const [worksheets, templates, instruments, analysts, session] = await Promise.all([
    getSenaiteWorksheets(),
    getWorksheetTemplateOptions(),
    getWorksheetInstrumentOptions(),
    getLabAnalysts(),
    getSession(),
  ])
  return (
    <WorksheetsShell
      initialWorksheets={worksheets}
      templates={templates}
      instruments={instruments}
      analysts={analysts}
      currentUserId={session?.username ?? ''}
    />
  )
}

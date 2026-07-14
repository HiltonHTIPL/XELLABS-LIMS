import { getDjangoWorksheet, getAssignableUsers } from '@/app/actions/django-worksheets'
import { getAnalysisRequests } from '@/app/actions/analysis-requests'
import { getTests } from '@/app/actions/tests'
import { getInstrumentOptions } from '@/app/actions/instrument-maintenance'
import { getMethods } from '@/app/actions/methods'
import LabWorksheetDetail from './_components/LabWorksheetDetail'

export default async function LabWorksheetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [worksheet, ars, tests, users, instruments, methods] = await Promise.all([
    getDjangoWorksheet(Number(id)),
    getAnalysisRequests(),
    getTests(),
    getAssignableUsers(),
    getInstrumentOptions(),
    getMethods(),
  ])

  if (!worksheet) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>
        <p>Worksheet not found</p>
      </div>
    )
  }

  return <LabWorksheetDetail worksheet={worksheet} ars={ars} tests={tests} users={users} instruments={instruments} methods={methods} />
}

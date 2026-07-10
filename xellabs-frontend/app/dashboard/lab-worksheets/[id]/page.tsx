import { getDjangoWorksheet } from '@/app/actions/django-worksheets'
import { getAnalysisRequests } from '@/app/actions/analysis-requests'
import { getTests } from '@/app/actions/tests'
import LabWorksheetDetail from './_components/LabWorksheetDetail'

export default async function LabWorksheetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [worksheet, ars, tests] = await Promise.all([
    getDjangoWorksheet(Number(id)),
    getAnalysisRequests(),
    getTests(),
  ])

  if (!worksheet) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>
        <p>Worksheet not found</p>
      </div>
    )
  }

  return <LabWorksheetDetail worksheet={worksheet} ars={ars} tests={tests} />
}

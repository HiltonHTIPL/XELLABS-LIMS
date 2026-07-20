import {
  getSenaiteWorksheetDetailById, getUnassignedAnalyses,
  getWorksheetInstrumentOptions, getWorksheetMethodOptions,
  getReferenceSampleOptions, getLabAnalysts,
} from '@/app/actions/senaite-worksheets'
import WorksheetDetailShell from './_components/WorksheetDetailShell'

export const dynamic = 'force-dynamic'

export default async function WorksheetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const worksheet = await getSenaiteWorksheetDetailById(id)

  if (!worksheet) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>
        <p>Worksheet not found</p>
      </div>
    )
  }

  const [unassigned, instruments, methods, references, analysts] = await Promise.all([
    getUnassignedAnalyses(),
    getWorksheetInstrumentOptions(),
    getWorksheetMethodOptions(),
    getReferenceSampleOptions(),
    getLabAnalysts(),
  ])

  return (
    <WorksheetDetailShell
      worksheet={worksheet}
      unassigned={unassigned}
      instruments={instruments}
      methods={methods}
      references={references}
      analysts={analysts}
    />
  )
}

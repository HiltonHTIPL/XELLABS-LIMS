import { notFound, redirect } from 'next/navigation'
import {
  getSenaiteWorksheetDetailById, getUnassignedAnalyses, getWorksheetTemplateOptions,
  getServiceMethodMap,
} from '@/app/actions/senaite-worksheets'
import AddAnalysesShell from './_components/AddAnalysesShell'

export const dynamic = 'force-dynamic'

// SENAITE's dedicated `add_analyses` screen: pick unassigned routine analyses
// (or apply a template) to lay onto an open worksheet. Reached automatically
// for an empty worksheet from the list; a worksheet that isn't open has nothing
// to add, so bounce to its results grid instead.
export default async function AddAnalysesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [worksheet, unassigned, templates, serviceMethodMap] = await Promise.all([
    getSenaiteWorksheetDetailById(id),
    getUnassignedAnalyses(),
    getWorksheetTemplateOptions(),
    getServiceMethodMap(),
  ])
  if (!worksheet) notFound()
  if (worksheet.reviewState !== 'open') redirect(`/dashboard/worksheets/${id}`)
  return (
    <AddAnalysesShell
      worksheet={worksheet}
      unassigned={unassigned}
      templates={templates}
      serviceMethodMap={serviceMethodMap}
    />
  )
}

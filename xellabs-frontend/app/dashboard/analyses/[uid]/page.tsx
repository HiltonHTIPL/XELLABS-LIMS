import { notFound } from 'next/navigation'
import { getAnalysesPageData, getAnalysisAuditEvents } from '@/app/actions/analyses'
import { getAnalysisSpecifications } from '@/app/actions/specifications'
import AnalysisDetailShell from './_components/AnalysisDetailShell'

export const dynamic = 'force-dynamic'

export default async function AnalysisDetailPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  const { services, methods, instruments, calculations } = await getAnalysesPageData()
  const service = services.find(s => s.uid === uid)
  if (!service) notFound()

  const [specifications, auditEvents] = await Promise.all([
    getAnalysisSpecifications(),
    getAnalysisAuditEvents(service.Keyword),
  ])
  const specRows = specifications.flatMap(spec =>
    spec.rows
      .filter(r => r.senaite_service_uid === uid)
      .map(r => ({ specTitle: spec.title, isActive: spec.is_active, ...r })),
  )

  return (
    <AnalysisDetailShell
      service={service}
      methods={methods}
      instruments={instruments}
      calculations={calculations}
      specRows={specRows}
      auditEvents={auditEvents}
    />
  )
}

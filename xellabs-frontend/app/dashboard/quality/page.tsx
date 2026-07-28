import { getQCSamples, getQCWorksheets } from '@/app/actions/quality'
import { getAnalysisServices } from '@/app/actions/samples'
import QualityShell from './_components/QualityShell'

export default async function QualityPage() {
  const [qcSamples, services, worksheets] = await Promise.all([
    getQCSamples(),
    getAnalysisServices(),
    getQCWorksheets(),
  ])
  return <QualityShell initialQCSamples={qcSamples} services={services} worksheets={worksheets} />
}

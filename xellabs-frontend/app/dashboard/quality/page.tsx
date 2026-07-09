import { getQCSamples, getQCWorksheets } from '@/app/actions/quality'
import { getTests } from '@/app/actions/tests'
import QualityShell from './_components/QualityShell'

export default async function QualityPage() {
  const [qcSamples, tests, worksheets] = await Promise.all([
    getQCSamples(),
    getTests(),
    getQCWorksheets(),
  ])
  return <QualityShell initialQCSamples={qcSamples} tests={tests} worksheets={worksheets} />
}

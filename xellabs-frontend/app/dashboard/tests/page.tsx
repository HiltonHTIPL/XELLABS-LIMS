import { getTests } from '@/app/actions/tests'
import { getMethods } from '@/app/actions/methods'
import { fetchSenaiteAnalysisServices } from '@/app/lib/senaite'
import { serverToken } from '@/app/lib/senaite-auth'
import TestsShell from './_components/TestsShell'

export default async function TestsPage() {
  const [tests, methods, senaiteServices] = await Promise.all([
    getTests(),
    getMethods(),
    fetchSenaiteAnalysisServices(serverToken()),
  ])
  return <TestsShell initialTests={tests} methods={methods} senaiteServices={senaiteServices} />
}

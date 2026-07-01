import { getTests } from '@/app/actions/tests'
import { getMethods } from '@/app/actions/methods'
import TestsShell from './_components/TestsShell'

export default async function TestsPage() {
  const [tests, methods] = await Promise.all([getTests(), getMethods()])
  return <TestsShell initialTests={tests} methods={methods} />
}

import { listBatchLabels } from '@/app/actions/batch-labels'
import BatchLabelsShell from './_components/BatchLabelsShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const rows = await listBatchLabels()
  return <BatchLabelsShell rows={rows} />
}

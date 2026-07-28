import { getBatchesList, getBatchClientOptions } from '@/app/actions/batches'
import BatchesShell from './_components/BatchesShell'

export default async function BatchesPage() {
  const [batches, clientOptions] = await Promise.all([
    getBatchesList(),
    getBatchClientOptions(),
  ])
  return <BatchesShell initialBatches={batches} clientOptions={clientOptions} />
}

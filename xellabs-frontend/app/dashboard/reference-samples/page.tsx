import { listReferenceSamples, listSupplierOptions, listDefinitionOptions } from '@/app/actions/reference-samples'
import { listServiceOptions } from '@/app/actions/reference-definitions'
import ReferenceSamplesShell from './_components/ReferenceSamplesShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [rows, suppliers, definitions, services] = await Promise.all([
    listReferenceSamples(),
    listSupplierOptions(),
    listDefinitionOptions(),
    listServiceOptions(),
  ])
  return <ReferenceSamplesShell rows={rows} suppliers={suppliers} definitions={definitions} services={services} />
}

import { listReferenceDefinitions, listServiceOptions } from '@/app/actions/reference-definitions'
import ReferenceDefinitionsShell from './_components/ReferenceDefinitionsShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [rows, services] = await Promise.all([listReferenceDefinitions(), listServiceOptions()])
  return <ReferenceDefinitionsShell rows={rows} services={services} />
}

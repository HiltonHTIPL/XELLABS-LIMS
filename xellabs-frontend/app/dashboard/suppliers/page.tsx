import { listSuppliers } from '@/app/actions/suppliers'
import SuppliersShell from './_components/SuppliersShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const rows = await listSuppliers()
  return <SuppliersShell rows={rows} />
}

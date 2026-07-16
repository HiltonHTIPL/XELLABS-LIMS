import { listLabProducts } from '@/app/actions/lab-products'
import LabProductsShell from './_components/LabProductsShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const rows = await listLabProducts()
  return <LabProductsShell rows={rows} />
}

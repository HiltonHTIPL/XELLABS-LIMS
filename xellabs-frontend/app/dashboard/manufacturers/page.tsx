import { listManufacturers } from '@/app/actions/manufacturers'
import ManufacturersShell from './_components/ManufacturersShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const rows = await listManufacturers()
  return <ManufacturersShell rows={rows} />
}

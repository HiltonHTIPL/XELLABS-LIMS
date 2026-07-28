import { getInventoryDashboard } from '@/app/actions/inventory-dashboard'
import InventoryDashboardShell from './_components/InventoryDashboardShell'

export default async function InventoryDashboardPage() {
  const data = await getInventoryDashboard()
  return <InventoryDashboardShell data={data} />
}

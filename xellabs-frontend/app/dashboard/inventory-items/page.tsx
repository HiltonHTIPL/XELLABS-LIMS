import { getReagents, getStandards, getSolvents } from '@/app/actions/inventory'
import InventoryItemsShell from './_components/InventoryItemsShell'

export default async function InventoryItemsPage() {
  const [reagents, standards, solvents] = await Promise.all([
    getReagents(),
    getStandards(),
    getSolvents(),
  ])
  return <InventoryItemsShell initialReagents={reagents} initialStandards={standards} initialSolvents={solvents} />
}

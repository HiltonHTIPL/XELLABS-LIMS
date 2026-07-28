import {
  getLots, getTransactions, getExpiryAlerts,
  getReagents, getStandards, getSolvents, getContentTypeIds,
} from '@/app/actions/inventory'
import InventoryLotsShell from './_components/InventoryLotsShell'

export default async function InventoryLotsPage() {
  const [lots, transactions, alerts, reagents, standards, solvents, contentTypes] = await Promise.all([
    getLots(),
    getTransactions(),
    getExpiryAlerts(),
    getReagents(),
    getStandards(),
    getSolvents(),
    getContentTypeIds(),
  ])
  return (
    <InventoryLotsShell
      initialLots={lots}
      initialTransactions={transactions}
      initialAlerts={alerts}
      reagents={reagents}
      standards={standards}
      solvents={solvents}
      contentTypes={contentTypes}
    />
  )
}

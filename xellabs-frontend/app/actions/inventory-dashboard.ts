'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'
import {
  getReagents, getStandards, getSolvents, getLots, getTransactions, getContentTypeIds,
  type Lot, type InventoryTransaction, type InventoryFormState,
} from './inventory'

/**
 * Demo-ready inventory view model built on top of the existing inventory
 * endpoints. It surfaces what the Django models already store: current stock
 * per reagent/solvent/standard, lot-level detail with expiry, low-stock and
 * expiry indicators, and the consumption log from InventoryTransaction.
 */

export type ExpiryStatus = 'ok' | 'expiring' | 'expired' | 'none'

export type StockLot = {
  id: number
  lot_number: string
  quantity: number
  on_hand: number
  expiry_date: string | null
  expiry_status: ExpiryStatus
  storage_location: number | null
}

export type StockItem = {
  id: number
  name: string
  unit: string
  min_stock_level: number
  on_hand: number
  is_low: boolean
  lots: StockLot[]
  expiring_lots: number
  expired_lots: number
}

export type ConsumptionRow = {
  id: number
  lot_number: string
  item_name: string
  transaction_type: string
  quantity: string
  reference: string
  notes: string
  created_at: string
}

export type InventorySummary = { low_stock: number; expiring_soon: number; expired: number }

export type InventoryDashboardData = {
  reagents: StockItem[]
  standards: StockItem[]
  solvents: StockItem[]
  consumption: ConsumptionRow[]
  summary: InventorySummary
}

type MinItem = { id: number; name: string; unit: string; min_stock_level: string }

const DAY_MS = 86_400_000
const EXPIRING_WINDOW_DAYS = 30

function classifyExpiry(expiry: string | null): ExpiryStatus {
  if (!expiry) return 'none'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const exp = new Date(`${expiry}T00:00:00`)
  if (Number.isNaN(exp.getTime())) return 'none'
  const days = Math.floor((exp.getTime() - today.getTime()) / DAY_MS)
  if (days < 0) return 'expired'
  if (days <= EXPIRING_WINDOW_DAYS) return 'expiring'
  return 'ok'
}

// Signed movement, mirroring the backend low-stock endpoint: received adds,
// consumed/disposed subtract, adjustments are neutral. Lot.quantity is the
// received base (createLot writes no "in" transaction), so on-hand is that
// base plus net movements, meaning recording usage visibly reduces it.
function txnSign(type: string): number {
  if (type === 'in') return 1
  if (type === 'out' || type === 'dispose') return -1
  return 0
}

function buildStock(
  items: MinItem[],
  contentTypeId: number | undefined,
  lots: Lot[],
  txnByLot: Map<number, InventoryTransaction[]>,
): StockItem[] {
  return items.map((item) => {
    const itemLots = contentTypeId != null
      ? lots.filter((l) => l.content_type === contentTypeId && l.object_id === item.id)
      : []
    const stockLots: StockLot[] = itemLots.map((l) => {
      const base = Number(l.quantity) || 0
      const net = (txnByLot.get(l.id) ?? []).reduce(
        (sum, t) => sum + txnSign(t.transaction_type) * (Number(t.quantity) || 0), 0,
      )
      return {
        id: l.id,
        lot_number: l.lot_number,
        quantity: base,
        on_hand: base + net,
        expiry_date: l.expiry_date,
        expiry_status: classifyExpiry(l.expiry_date),
        storage_location: l.storage_location,
      }
    })
    const onHand = stockLots.reduce((sum, l) => sum + l.on_hand, 0)
    const min = Number(item.min_stock_level) || 0
    return {
      id: item.id,
      name: item.name,
      unit: item.unit,
      min_stock_level: min,
      on_hand: onHand,
      is_low: min > 0 && onHand < min,
      lots: stockLots,
      expiring_lots: stockLots.filter((l) => l.expiry_status === 'expiring').length,
      expired_lots: stockLots.filter((l) => l.expiry_status === 'expired').length,
    }
  })
}

export async function getInventoryDashboard(): Promise<InventoryDashboardData> {
  try {
    const [reagents, standards, solvents, lots, transactions, contentTypes] = await Promise.all([
      getReagents(), getStandards(), getSolvents(), getLots(), getTransactions(), getContentTypeIds(),
    ])

    const txnByLot = new Map<number, InventoryTransaction[]>()
    for (const t of transactions) {
      const arr = txnByLot.get(t.lot) ?? []
      arr.push(t)
      txnByLot.set(t.lot, arr)
    }

    const r = buildStock(reagents, contentTypes.reagents, lots, txnByLot)
    const s = buildStock(standards, contentTypes.standards, lots, txnByLot)
    const v = buildStock(solvents, contentTypes.solvents, lots, txnByLot)

    const lotNumberById = new Map(lots.map((l) => [l.id, l.lot_number]))
    const itemNameByLot = new Map<number, string>()
    for (const it of [...r, ...s, ...v]) for (const l of it.lots) itemNameByLot.set(l.id, it.name)

    const consumption: ConsumptionRow[] = transactions.slice(0, 50).map((t) => ({
      id: t.id,
      lot_number: lotNumberById.get(t.lot) ?? `#${t.lot}`,
      item_name: itemNameByLot.get(t.lot) ?? '',
      transaction_type: t.transaction_type,
      quantity: t.quantity,
      reference: t.reference,
      notes: t.notes,
      created_at: t.created_at,
    }))

    const allStock = [...r, ...s, ...v]
    const summary: InventorySummary = {
      low_stock: allStock.filter((i) => i.is_low).length,
      expiring_soon: allStock.reduce((n, i) => n + i.expiring_lots, 0),
      expired: allStock.reduce((n, i) => n + i.expired_lots, 0),
    }
    return { reagents: r, standards: s, solvents: v, consumption, summary }
  } catch {
    return {
      reagents: [], standards: [], solvents: [], consumption: [],
      summary: { low_stock: 0, expiring_soon: 0, expired: 0 },
    }
  }
}

/** Compact stock-health counts for the schedule page readiness strip. */
export async function getInventoryReadiness(): Promise<InventorySummary> {
  const data = await getInventoryDashboard()
  return data.summary
}

export async function recordConsumption(
  _state: InventoryFormState, formData: FormData,
): Promise<InventoryFormState> {
  const lot = formData.get('lot') as string
  const transaction_type = (formData.get('transaction_type') as string) || 'out'
  const quantity = formData.get('quantity') as string

  const errors: Record<string, string[]> = {}
  if (!lot) errors.lot = ['Lot is required']
  if (!quantity) errors.quantity = ['Quantity is required']
  if (Object.keys(errors).length) return { errors }

  const reference = (formData.get('reference') as string)?.trim() || ''
  const notes = (formData.get('notes') as string)?.trim() || ''

  try {
    const res = await djangoFetch('/api/inventory/transactions/', {
      method: 'POST',
      body: JSON.stringify({ lot: Number(lot), transaction_type, quantity, reference, notes }),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const msg = (data.detail as string) ?? (data.quantity as string[])?.[0] ?? 'Failed to record usage.'
      return { message: msg }
    }
    revalidatePath('/dashboard/inventory-dashboard')
    return { success: true, message: 'Usage recorded.' }
  } catch (e) {
    return { message: String(e) }
  }
}

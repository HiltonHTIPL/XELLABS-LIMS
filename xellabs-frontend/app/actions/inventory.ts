'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type InventoryItemBase = {
  id: number
  name: string
  cas_number: string
  manufacturer: string
  catalog_number: string
  unit: string
  min_stock_level: string
  is_active: boolean
  created_at: string
}

export type Reagent = InventoryItemBase & {
  grade: string
  concentration: string
  hazard_class: string
}

export type Standard = InventoryItemBase & {
  certified_value: string
  certified_uncertainty: string
  reference_material: string
}

export type Solvent = InventoryItemBase & {
  grade: string
  purity: string
  flash_point: string
}

export type InventoryItemKind = 'reagents' | 'standards' | 'solvents'

export type Lot = {
  id: number
  content_type: number
  object_id: number
  lot_number: string
  quantity: string
  expiry_date: string | null
  storage_location: number | null
  received_date: string
  certificate_of_analysis: string | null
  created_by: number
}

export type InventoryTransaction = {
  id: number
  lot: number
  transaction_type: 'in' | 'out' | 'adjust' | 'dispose'
  quantity: string
  reference: string
  notes: string
  created_by: number
  created_at: string
}

export type ExpiryAlert = {
  id: number
  lot: number
  alert_date: string
  is_acknowledged: boolean
  acknowledged_by: number | null
  created_at: string
}

export type LowStockRow = {
  item_type: string
  item_id: number
  name: string
  current_quantity: number
  min_stock_level: number
  unit: string
}

export type InventoryFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function unwrap<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : ((data as { results?: T[] })?.results ?? [])
}

const ITEM_ENDPOINT: Record<InventoryItemKind, string> = {
  reagents: '/api/inventory/reagents/',
  standards: '/api/inventory/standards/',
  solvents: '/api/inventory/solvents/',
}

/* ------------------------------------------------------------------ */
/* Reagents / Standards / Solvents — shared getters + CRUD              */
/* ------------------------------------------------------------------ */

export async function getInventoryItems<T = Reagent | Standard | Solvent>(kind: InventoryItemKind): Promise<T[]> {
  try {
    const res = await djangoFetch(`${ITEM_ENDPOINT[kind]}?ordering=name`)
    if (!res.ok) return []
    const data = await res.json()
    return unwrap<T>(data)
  } catch { return [] }
}

export async function getReagents(): Promise<Reagent[]> { return getInventoryItems<Reagent>('reagents') }
export async function getStandards(): Promise<Standard[]> { return getInventoryItems<Standard>('standards') }
export async function getSolvents(): Promise<Solvent[]> { return getInventoryItems<Solvent>('solvents') }

/** Shared field set common to all three item types. Kind-specific extra
 * fields (grade/concentration/hazard_class, certified_*, purity/flash_point)
 * are passed through as-is from the form. */
export async function createInventoryItem(
  kind: InventoryItemKind, _state: InventoryFormState, formData: FormData
): Promise<InventoryFormState> {
  const name = (formData.get('name') as string)?.trim()
  const errors: Record<string, string[]> = {}
  if (!name) errors.name = ['Name is required']
  if (Object.keys(errors).length) return { errors }

  const payload = formToItemPayload(formData)
  payload.name = name

  try {
    const res = await djangoFetch(ITEM_ENDPOINT[kind], { method: 'POST', body: JSON.stringify(payload) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { message: firstError(data) ?? 'Failed to create item.' }
    }
    revalidatePath('/dashboard/inventory-items')
    return { success: true, message: `"${name}" created.` }
  } catch (e) { return { message: String(e) } }
}

export async function updateInventoryItem(
  kind: InventoryItemKind, id: number, _state: InventoryFormState, formData: FormData
): Promise<InventoryFormState> {
  const name = (formData.get('name') as string)?.trim()
  const errors: Record<string, string[]> = {}
  if (!name) errors.name = ['Name is required']
  if (Object.keys(errors).length) return { errors }

  const payload = formToItemPayload(formData)
  payload.name = name

  try {
    const res = await djangoFetch(`${ITEM_ENDPOINT[kind]}${id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { message: firstError(data) ?? 'Failed to update item.' }
    }
    revalidatePath('/dashboard/inventory-items')
    return { success: true, message: `"${name}" updated.` }
  } catch (e) { return { message: String(e) } }
}

export async function toggleInventoryItemActive(
  kind: InventoryItemKind, id: number, is_active: boolean
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`${ITEM_ENDPOINT[kind]}${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    })
    revalidatePath('/dashboard/inventory-items')
    return { success: res.ok, message: res.ok ? (is_active ? 'Activated.' : 'Deactivated.') : 'Failed to update.' }
  } catch (e) { return { success: false, message: String(e) } }
}

export async function deleteInventoryItem(kind: InventoryItemKind, id: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`${ITEM_ENDPOINT[kind]}${id}/`, { method: 'DELETE' })
    revalidatePath('/dashboard/inventory-items')
    return { success: res.ok, message: res.ok ? 'Deleted.' : 'Failed to delete — it may be referenced by a lot.' }
  } catch (e) { return { success: false, message: String(e) } }
}

function formToItemPayload(formData: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const key of [
    'cas_number', 'manufacturer', 'catalog_number', 'unit',
    'grade', 'concentration', 'hazard_class',
    'certified_value', 'certified_uncertainty', 'reference_material',
    'purity', 'flash_point',
  ]) {
    const v = formData.get(key)
    if (v !== null) payload[key] = (v as string).trim()
  }
  const minStock = formData.get('min_stock_level')
  if (minStock !== null && minStock !== '') payload.min_stock_level = minStock
  return payload
}

function firstError(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const obj = data as Record<string, unknown>
  if (typeof obj.detail === 'string') return obj.detail
  for (const v of Object.values(obj)) {
    if (Array.isArray(v) && v.length) return String(v[0])
  }
  return undefined
}

/* ------------------------------------------------------------------ */
/* Lots                                                                 */
/* ------------------------------------------------------------------ */

export async function getLots(): Promise<Lot[]> {
  try {
    const res = await djangoFetch('/api/inventory/lots/?ordering=-received_date')
    if (!res.ok) return []
    const data = await res.json()
    return unwrap<Lot>(data)
  } catch { return [] }
}

export async function getLowStock(): Promise<LowStockRow[]> {
  try {
    const res = await djangoFetch('/api/inventory/lots/low-stock/')
    if (!res.ok) return []
    return await res.json()
  } catch { return [] }
}

export async function createLot(_state: InventoryFormState, formData: FormData): Promise<InventoryFormState> {
  const content_type = formData.get('content_type') as string
  const object_id = formData.get('object_id') as string
  const lot_number = (formData.get('lot_number') as string)?.trim()
  const quantity = formData.get('quantity') as string

  const errors: Record<string, string[]> = {}
  if (!content_type) errors.content_type = ['Item type is required']
  if (!object_id) errors.object_id = ['Item is required']
  if (!lot_number) errors.lot_number = ['Lot number is required']
  if (!quantity) errors.quantity = ['Quantity is required']
  if (Object.keys(errors).length) return { errors }

  const expiry_date = formData.get('expiry_date') as string
  const storage_location = formData.get('storage_location') as string

  try {
    const res = await djangoFetch('/api/inventory/lots/', {
      method: 'POST',
      body: JSON.stringify({
        content_type: Number(content_type),
        object_id: Number(object_id),
        lot_number,
        quantity,
        expiry_date: expiry_date || null,
        storage_location: storage_location ? Number(storage_location) : null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { message: firstError(data) ?? 'Failed to create lot.' }
    revalidatePath('/dashboard/inventory-lots')
    return { success: true, message: `Lot "${lot_number}" created.` }
  } catch (e) { return { message: String(e) } }
}

export async function updateLot(id: number, _state: InventoryFormState, formData: FormData): Promise<InventoryFormState> {
  const lot_number = (formData.get('lot_number') as string)?.trim()
  const quantity = formData.get('quantity') as string

  const errors: Record<string, string[]> = {}
  if (!lot_number) errors.lot_number = ['Lot number is required']
  if (!quantity) errors.quantity = ['Quantity is required']
  if (Object.keys(errors).length) return { errors }

  const expiry_date = formData.get('expiry_date') as string
  const storage_location = formData.get('storage_location') as string

  try {
    const res = await djangoFetch(`/api/inventory/lots/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({
        lot_number,
        quantity,
        expiry_date: expiry_date || null,
        storage_location: storage_location ? Number(storage_location) : null,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { message: firstError(data) ?? 'Failed to update lot.' }
    }
    revalidatePath('/dashboard/inventory-lots')
    return { success: true, message: `Lot "${lot_number}" updated.` }
  } catch (e) { return { message: String(e) } }
}

export async function deleteLot(id: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/inventory/lots/${id}/`, { method: 'DELETE' })
    revalidatePath('/dashboard/inventory-lots')
    return { success: res.ok, message: res.ok ? 'Lot deleted.' : 'Failed to delete lot.' }
  } catch (e) { return { success: false, message: String(e) } }
}

/* ------------------------------------------------------------------ */
/* Inventory Transactions — full CRUD (not auto-generated by any        */
/* signal/service — confirmed via repo-wide grep for                    */
/* "InventoryTransaction.objects.create", only found in tests.py)       */
/* ------------------------------------------------------------------ */

export async function getTransactions(lotId?: number): Promise<InventoryTransaction[]> {
  try {
    const qs = lotId ? `?lot=${lotId}&ordering=-created_at` : '?ordering=-created_at'
    const res = await djangoFetch(`/api/inventory/transactions/${qs}`)
    if (!res.ok) return []
    const data = await res.json()
    return unwrap<InventoryTransaction>(data)
  } catch { return [] }
}

export async function createTransaction(_state: InventoryFormState, formData: FormData): Promise<InventoryFormState> {
  const lot = formData.get('lot') as string
  const transaction_type = formData.get('transaction_type') as string
  const quantity = formData.get('quantity') as string

  const errors: Record<string, string[]> = {}
  if (!lot) errors.lot = ['Lot is required']
  if (!transaction_type) errors.transaction_type = ['Type is required']
  if (!quantity) errors.quantity = ['Quantity is required']
  if (Object.keys(errors).length) return { errors }

  const reference = (formData.get('reference') as string)?.trim() || ''
  const notes = (formData.get('notes') as string)?.trim() || ''

  try {
    const res = await djangoFetch('/api/inventory/transactions/', {
      method: 'POST',
      body: JSON.stringify({ lot: Number(lot), transaction_type, quantity, reference, notes }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { message: firstError(data) ?? 'Failed to record transaction.' }
    revalidatePath('/dashboard/inventory-lots')
    return { success: true, message: 'Transaction recorded.' }
  } catch (e) { return { message: String(e) } }
}

/* ------------------------------------------------------------------ */
/* Expiry Alerts — full CRUD available on the API (not auto-generated   */
/* by any signal/celery task — confirmed via repo-wide grep for         */
/* "ExpiryAlert.objects.create", only found in tests.py) plus a         */
/* dedicated acknowledge action.                                        */
/* ------------------------------------------------------------------ */

export async function getExpiryAlerts(): Promise<ExpiryAlert[]> {
  try {
    const res = await djangoFetch('/api/inventory/expiry-alerts/')
    if (!res.ok) return []
    const data = await res.json()
    return unwrap<ExpiryAlert>(data)
  } catch { return [] }
}

export async function getUpcomingExpiryAlerts(): Promise<ExpiryAlert[]> {
  try {
    const res = await djangoFetch('/api/inventory/expiry-alerts/upcoming/')
    if (!res.ok) return []
    const data = await res.json()
    return unwrap<ExpiryAlert>(data)
  } catch { return [] }
}

export async function createExpiryAlert(_state: InventoryFormState, formData: FormData): Promise<InventoryFormState> {
  const lot = formData.get('lot') as string
  const alert_date = formData.get('alert_date') as string

  const errors: Record<string, string[]> = {}
  if (!lot) errors.lot = ['Lot is required']
  if (!alert_date) errors.alert_date = ['Alert date is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch('/api/inventory/expiry-alerts/', {
      method: 'POST',
      body: JSON.stringify({ lot: Number(lot), alert_date }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { message: firstError(data) ?? 'Failed to create alert.' }
    revalidatePath('/dashboard/inventory-lots')
    return { success: true, message: 'Expiry alert created.' }
  } catch (e) { return { message: String(e) } }
}

export async function acknowledgeExpiryAlert(id: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/inventory/expiry-alerts/${id}/acknowledge/`, { method: 'POST' })
    revalidatePath('/dashboard/inventory-lots')
    return { success: res.ok, message: res.ok ? 'Alert acknowledged.' : 'Failed to acknowledge alert.' }
  } catch (e) { return { success: false, message: String(e) } }
}

/* ------------------------------------------------------------------ */
/* Content types — needed to resolve the Lot generic FK from the        */
/* frontend's item-kind picker to the numeric content_type id Django    */
/* expects.                                                              */
/* ------------------------------------------------------------------ */

export type ContentTypeMap = Partial<Record<InventoryItemKind, number>>

/**
 * There is no dedicated content-types list endpoint in this app, so the
 * numeric ContentType id for Reagent/Standard/Solvent (needed for the Lot
 * form's `content_type` field) is resolved from the DRF OPTIONS metadata
 * on `/api/inventory/lots/` — DRF's default SimpleMetadata includes a
 * `choices: [{value, display_name}]` list for the `content_type`
 * PrimaryKeyRelatedField automatically (no backend change needed).
 * `display_name` is Django's `ContentType.__str__()` — "<app label> | <model
 * verbose name>", e.g. "inventory | reagent" — so we match on the model
 * name at the end of that string.
 */
export async function getContentTypeIds(): Promise<ContentTypeMap> {
  const map: ContentTypeMap = {}
  try {
    const res = await djangoFetch('/api/inventory/lots/', { method: 'OPTIONS' })
    if (!res.ok) return map
    const data = await res.json()
    const choices = data?.actions?.POST?.content_type?.choices as
      { value: number; display_name: string }[] | undefined
    if (!choices) return map
    for (const c of choices) {
      const label = c.display_name.toLowerCase()
      if (label.endsWith('reagent')) map.reagents = c.value
      else if (label.endsWith('standard')) map.standards = c.value
      else if (label.endsWith('solvent')) map.solvents = c.value
    }
  } catch { /* ignore — form falls back to manual content_type entry */ }
  return map
}

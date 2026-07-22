'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type StorageLocation = {
  id: number
  name: string
  location_type: 'building' | 'room' | 'fridge' | 'freezer' | 'cabinet' | 'shelf' | 'box' | 'box_location'
  parent: number | null
  temperature: string
  notes: string
  senaite_uid: string
  rows: number | null
  columns: number | null
  slot_id: string
  label_code: string | null
  is_occupied: boolean
  assigned_sample_id: string
  description: string
  address: string
  phone: string
  email: string
  senaite_sync_error: string | null
  site_title?: string
  site_code?: string
  site_description?: string
  location_title?: string
  location_code?: string
  location_description?: string
  shelf_title?: string
  shelf_code?: string
  shelf_description?: string
  senaite_location_type?: string
}

export type StorageFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

// DRF returns {field: [messages]} for validation errors (e.g. the parent-type
// rule enforced in StorageLocationSerializer.validate()) — forward it as-is
// instead of only special-casing name/location_type, so a rejected
// combination like "Box requires a parent location" surfaces on the right
// field instead of a generic failure message.
function mapDjangoErrors(err: Record<string, unknown>): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {}
  for (const [key, val] of Object.entries(err)) {
    if (Array.isArray(val)) errors[key] = val.map(String)
    else if (typeof val === 'string') errors[key] = [val]
  }
  return Object.keys(errors).length ? errors : null
}

export async function getStorageLocations(): Promise<StorageLocation[]> {
  // The Storage Manager tree needs the FULL location set to build parent-child
  // relationships client-side — it is not a paginated list view. The API's
  // default PageNumberPagination (page_size=50) was silently truncating this
  // to page 1 once real usage pushed the count past 50 (a single 10x10 box
  // alone is 100 box_location rows), so any location past page 1 (e.g. a Box
  // sorted after its own room/shelf ancestors) would vanish from the tree
  // with no error — confirmed via a direct API call showing count=104,
  // results.length=50, and the box missing from that first page.
  try {
    const all: StorageLocation[] = []
    let page = 1
    while (true) {
      const res = await djangoFetch(`/api/inventory/storage-locations/?ordering=name&page=${page}`)
      if (!res.ok) break
      const data = await res.json()
      if (Array.isArray(data)) { all.push(...data); break } // unpaginated response shape
      all.push(...(data.results ?? []))
      if (!data.next) break
      page += 1
    }
    return all
  } catch { return [] }
}

export async function createStorageLocation(
  _state: StorageFormState,
  formData: FormData
): Promise<StorageFormState> {
  const name          = (formData.get('name') as string)?.trim()
  const location_type = (formData.get('location_type') as string)?.trim()
  const parent        = (formData.get('parent') as string)?.trim()
  const temperature   = (formData.get('temperature') as string)?.trim()
  const notes         = (formData.get('notes') as string)?.trim()
  const rows          = (formData.get('rows') as string)?.trim()
  const columns       = (formData.get('columns') as string)?.trim()
  const description   = (formData.get('description') as string)?.trim() ?? ''
  const address       = (formData.get('address') as string)?.trim() ?? ''
  const phone         = (formData.get('phone') as string)?.trim() ?? ''
  const email         = (formData.get('email') as string)?.trim() ?? ''

  const errors: Record<string, string[]> = {}
  if (!name)          errors.name          = ['Name is required']
  if (!location_type) errors.location_type = ['Type is required']
  if (location_type === 'box') {
    if (!rows || Number(rows) < 1)       errors.rows    = ['Rows required (min 1)']
    if (!columns || Number(columns) < 1) errors.columns = ['Columns required (min 1)']
  }
  if (Object.keys(errors).length) return { errors }

  const body: Record<string, unknown> = {
    name,
    location_type,
    temperature: temperature ?? '',
    notes: notes ?? '',
    description,
    address,
    phone,
    email,
  }
  if (parent) body.parent = Number(parent)
  if (location_type === 'box') {
    body.rows    = Number(rows)
    body.columns = Number(columns)
  }

  const res = await djangoFetch('/api/inventory/storage-locations/', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const errors = mapDjangoErrors(err)
    if (errors) return { errors }
    return { message: 'Failed to create storage location.' }
  }

  revalidatePath('/dashboard/storage')
  return { success: true, message: `"${name}" created.` }
}

export async function updateStorageLocation(
  id: number,
  _state: StorageFormState,
  formData: FormData
): Promise<StorageFormState> {
  const name          = (formData.get('name') as string)?.trim()
  const location_type = (formData.get('location_type') as string)?.trim()
  const parent        = (formData.get('parent') as string)?.trim()
  const temperature   = (formData.get('temperature') as string)?.trim()
  const notes         = (formData.get('notes') as string)?.trim()
  const description   = (formData.get('description') as string)?.trim() ?? ''
  const address       = (formData.get('address') as string)?.trim() ?? ''
  const phone         = (formData.get('phone') as string)?.trim() ?? ''
  const email         = (formData.get('email') as string)?.trim() ?? ''

  const errors: Record<string, string[]> = {}
  if (!name)          errors.name          = ['Name is required']
  if (!location_type) errors.location_type = ['Type is required']
  if (Object.keys(errors).length) return { errors }

  const body: Record<string, unknown> = {
    name,
    location_type,
    temperature: temperature ?? '',
    notes: notes ?? '',
    parent: parent ? Number(parent) : null,
    description,
    address,
    phone,
    email,
  }

  const res = await djangoFetch(`/api/inventory/storage-locations/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const errors = mapDjangoErrors(err)
    if (errors) return { errors }
    return { message: 'Failed to update storage location.' }
  }

  revalidatePath('/dashboard/storage')
  return { success: true, message: `"${name}" updated.` }
}

export async function deleteStorageLocation(id: number): Promise<{ success: boolean; message: string }> {
  const res = await djangoFetch(`/api/inventory/storage-locations/${id}/`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { success: false, message: err.error ?? 'Failed to delete. Location may have contents.' }
  }
  revalidatePath('/dashboard/storage')
  return { success: true, message: 'Location deleted.' }
}

export type CocSample = {
  sample_id: string
  senaite_ar_id?: string
  status: string
  status_display: string
  sample_type: string
  client: string
  barcode: string
  collection_date: string | null
  received_date: string | null
  expiry_date: string | null
  condition: string
  seal_condition: string
  priority: string
  storage_requirement: string
  sampling_deviation: string
  quantity_received: string
  quantity_unit: string
  hold_for_qa: boolean
  received_by: string
  receipt_notes: string
  collector: string
  client_order_number: string
  composite: boolean
  container_type: string
  preservation: string
  sample_point: string
  batch_id: string
  batch_sub_group: string
}

export type CocEvent = {
  id: number | string
  timestamp: string
  user: string
  event_type: 'sample_registered' | 'sample_received' | 'status_change' | 'update' | 'stored' | 'released'
    | 'result_submitted' | 'result_verified' | 'result_rejected' | 'ar_completed'
    // Rows sourced from the lims.ChainOfCustody ledger (inventory/views.py's
    // `custody_${action}` prefix) — `disposed` is the only action written in
    // production today; the union stays open-ended (`custody_${string}`) so
    // any other ACTION value the model already defines (transferred/stored/
    // retrieved/analysed/collected) renders too if it's ever written.
    | `custody_${string}`
  label: string
  details: Record<string, unknown>
}

export type ChainOfCustodyResult = {
  sample_id: string
  sample: CocSample | null
  current_location: {
    slot_id: string
    slot_name: string
    storage_path: string
    temperature: string
    capacity: { total: number; occupied: number; free: number } | null
  } | null
  history: CocEvent[]
}

export async function lookupChainOfCustody(sampleId: string): Promise<{ success: boolean; data?: ChainOfCustodyResult; message?: string }> {
  try {
    const res = await djangoFetch(
      `/api/inventory/storage-locations/chain-of-custody/?sample_id=${encodeURIComponent(sampleId)}`
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { success: false, message: err.error ?? 'Lookup failed.' }
    }
    const data = await res.json()
    return { success: true, data }
  } catch {
    return { success: false, message: 'Network error.' }
  }
}

export async function regenerateBoxSlots(
  boxId: number
): Promise<{ success: boolean; message: string }> {
  const res = await djangoFetch(`/api/inventory/storage-locations/${boxId}/regenerate-slots/`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { success: false, message: err.error ?? 'Failed to regenerate slots.' }
  }
  const data = await res.json()
  revalidatePath('/dashboard/storage')
  return { success: true, message: data.created > 0 ? `Created ${data.created} missing slot(s).` : 'All slots already exist.' }
}

export async function releaseSampleFromSlot(
  slotId: number
): Promise<{ success: boolean; message: string }> {
  const res = await djangoFetch(`/api/inventory/storage-locations/${slotId}/unassign/`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { success: false, message: err.error ?? 'Failed to release slot.' }
  }
  revalidatePath('/dashboard/storage')
  revalidatePath('/dashboard/samples-overview')
  revalidatePath('/dashboard/samples-overview')
  return { success: true, message: 'Slot released.' }
}

export async function assignSampleToSlot(
  slotId: number,
  sampleId: string
): Promise<{ success: boolean; message: string }> {
  const res = await djangoFetch(`/api/inventory/storage-locations/${slotId}/assign/`, {
    method: 'POST',
    body: JSON.stringify({ sample_id: sampleId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { success: false, message: err.error ?? 'Failed to assign sample.' }
  }
  revalidatePath('/dashboard/storage')
  revalidatePath('/dashboard/chain-of-custody')
  revalidatePath('/dashboard/samples-overview')
  revalidatePath('/dashboard/samples-overview')
  return { success: true, message: `Sample ${sampleId} assigned to slot.` }
}

export type ResolvedLabel = {
  id: number
  label_code: string
  location_type: string
  path: string[]
  is_occupied?: boolean
  capacity?: { total: number; free: number }
  next_free_slot?: { id: number; slot_id: string; label_code: string }
  error?: string
}

export async function resolveStorageLabel(
  code: string
): Promise<{ success: boolean; message?: string; data?: ResolvedLabel }> {
  try {
    const res = await djangoFetch(
      `/api/inventory/storage-locations/resolve-label/?code=${encodeURIComponent(code.trim())}`
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { success: false, message: data.error ?? 'Location not found.' }
    return { success: true, data }
  } catch { return { success: false, message: 'Network error.' } }
}

export async function searchStorageBoxes(query: string): Promise<StorageLocation[]> {
  try {
    const res = await djangoFetch(
      `/api/inventory/storage-locations/?location_type=box&search=${encodeURIComponent(query.trim())}`
    )
    if (!res.ok) return []
    const data = await res.json()
    const list: StorageLocation[] = Array.isArray(data) ? data : (data.results ?? [])
    return list.slice(0, 20)
  } catch { return [] }
}

export async function assignSampleByLabel(
  labelCode: string,
  sampleId: string
): Promise<{ success: boolean; message: string; slot?: StorageLocation }> {
  try {
    const res = await djangoFetch('/api/inventory/storage-locations/assign-by-label/', {
      method: 'POST',
      body: JSON.stringify({ label_code: labelCode.trim(), sample_id: sampleId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { success: false, message: data.error ?? 'Failed to assign sample.' }
    revalidatePath('/dashboard/storage')
    revalidatePath('/dashboard/chain-of-custody')
    revalidatePath('/dashboard/samples-overview')
    revalidatePath('/dashboard/samples-overview')
    return { success: true, message: `Sample ${sampleId} stored in slot ${data.slot_id}.`, slot: data }
  } catch { return { success: false, message: 'Network error.' } }
}

export async function retryStorageSync(id: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/inventory/storage-locations/${id}/retry-sync/`, { method: 'POST' })
    if (!res.ok) return { success: false, message: 'Sync retry failed.' }
    return { success: true, message: 'Sync retried successfully.' }
  } catch { return { success: false, message: 'Network error.' } }
}

'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type StorageLocation = {
  id: number
  name: string
  location_type: 'room' | 'fridge' | 'freezer' | 'cabinet' | 'shelf' | 'box' | 'box_location'
  parent: number | null
  temperature: string
  notes: string
  senaite_uid: string
  rows: number | null
  columns: number | null
  slot_id: string
  is_occupied: boolean
  assigned_sample_id: string
  description: string
  address: string
  site_title: string
  site_code: string
  site_description: string
  location_title: string
  location_code: string
  location_description: string
  senaite_location_type: string
  shelf_title: string
  shelf_code: string
  shelf_description: string
}

export type StorageFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function getStorageLocations(): Promise<StorageLocation[]> {
  try {
    const res = await djangoFetch('/api/inventory/storage-locations/?ordering=name')
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : (data.results ?? [])
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
  const description          = (formData.get('description') as string)?.trim() ?? ''
  const address              = (formData.get('address') as string)?.trim() ?? ''
  const site_title           = (formData.get('site_title') as string)?.trim() ?? ''
  const site_code            = (formData.get('site_code') as string)?.trim() ?? ''
  const site_description     = (formData.get('site_description') as string)?.trim() ?? ''
  const location_title       = (formData.get('location_title') as string)?.trim() ?? ''
  const location_code        = (formData.get('location_code') as string)?.trim() ?? ''
  const location_description = (formData.get('location_description') as string)?.trim() ?? ''
  const senaite_location_type = (formData.get('senaite_location_type') as string)?.trim() ?? ''
  const shelf_title          = (formData.get('shelf_title') as string)?.trim() ?? ''
  const shelf_code           = (formData.get('shelf_code') as string)?.trim() ?? ''
  const shelf_description    = (formData.get('shelf_description') as string)?.trim() ?? ''

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
  }
  if (parent) body.parent = Number(parent)
  if (location_type === 'box') {
    body.rows    = Number(rows)
    body.columns = Number(columns)
  }
  body.description           = description
  body.address               = address
  body.site_title            = site_title
  body.site_code             = site_code
  body.site_description      = site_description
  body.location_title        = location_title
  body.location_code         = location_code
  body.location_description  = location_description
  body.senaite_location_type = senaite_location_type
  body.shelf_title           = shelf_title
  body.shelf_code            = shelf_code
  body.shelf_description     = shelf_description

  const res = await djangoFetch('/api/inventory/storage-locations/', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    if (err.name)          return { errors: { name: [err.name] } }
    if (err.location_type) return { errors: { location_type: [err.location_type] } }
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
  const description          = (formData.get('description') as string)?.trim() ?? ''
  const address              = (formData.get('address') as string)?.trim() ?? ''
  const site_title           = (formData.get('site_title') as string)?.trim() ?? ''
  const site_code            = (formData.get('site_code') as string)?.trim() ?? ''
  const site_description     = (formData.get('site_description') as string)?.trim() ?? ''
  const location_title       = (formData.get('location_title') as string)?.trim() ?? ''
  const location_code        = (formData.get('location_code') as string)?.trim() ?? ''
  const location_description = (formData.get('location_description') as string)?.trim() ?? ''
  const senaite_location_type = (formData.get('senaite_location_type') as string)?.trim() ?? ''
  const shelf_title          = (formData.get('shelf_title') as string)?.trim() ?? ''
  const shelf_code           = (formData.get('shelf_code') as string)?.trim() ?? ''
  const shelf_description    = (formData.get('shelf_description') as string)?.trim() ?? ''

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
    site_title,
    site_code,
    site_description,
    location_title,
    location_code,
    location_description,
    senaite_location_type,
    shelf_title,
    shelf_code,
    shelf_description,
  }

  const res = await djangoFetch(`/api/inventory/storage-locations/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    if (err.name)          return { errors: { name: [err.name] } }
    if (err.location_type) return { errors: { location_type: [err.location_type] } }
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
}

export type CocEvent = {
  id: number
  timestamp: string
  user: string
  event_type: 'sample_registered' | 'sample_received' | 'status_change' | 'update' | 'stored' | 'released'
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
  return { success: true, message: `Sample ${sampleId} assigned to slot.` }
}

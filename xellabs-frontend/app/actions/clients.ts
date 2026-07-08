'use server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/lib/session'
import { djangoFetch } from '@/app/lib/django'
import { fetchSenaiteClients } from '@/app/lib/senaite'

export type SenaiteAddress = {
  address: string
  city: string
  state: string
  zip: string
  country: string
}

export type DjangoClient = {
  id: number
  name: string
  client_id: string
  tenant_detail?: { id: number; name: string; slug: string; schema_name: string; logo?: string | null } | null
  logo_url?: string | null
  email: string
  phone: string
  fax: string
  mobile: string
  contact_person: string
  salutation: string
  contact_first_name: string
  contact_last_name: string
  contact_email: string
  contact_phone: string
  contact_job_title: string
  contact_department: string
  address: string
  physical_address: SenaiteAddress | Record<string, never>
  postal_address: SenaiteAddress | Record<string, never>
  billing_address: SenaiteAddress | Record<string, never>
  tax_number: string
  account_number: string
  bank_name: string
  bank_branch: string
  swift_code: string
  iban: string
  nib: string
  bulk_discount: string
  member_discount: string
  remarks: string
  senaite_uid: string
  tenant: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ClientFormState = {
  success?: boolean
  message?: string
  errors?: {
    name?: string[]
    client_id?: string[]
    email?: string[]
    phone?: string[]
    [key: string]: string[] | undefined
  }
}

function addr(formData: FormData, prefix: string): SenaiteAddress {
  return {
    address: (formData.get(`${prefix}_street`) as string)?.trim() ?? '',
    city:    (formData.get(`${prefix}_city`)   as string)?.trim() ?? '',
    state:   (formData.get(`${prefix}_state`)  as string)?.trim() ?? '',
    zip:     (formData.get(`${prefix}_zip`)    as string)?.trim() ?? '',
    country: (formData.get(`${prefix}_country`) as string)?.trim() ?? '',
  }
}

export async function resetClientPassword(
  clientId: number,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/clients/${clientId}/reset-password/`, {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = (data as { new_password?: string[]; detail?: string }).new_password?.[0]
        ?? (data as { detail?: string }).detail
        ?? `Error ${res.status}`
      return { success: false, message: msg }
    }
    return { success: true, message: (data as { detail?: string }).detail ?? 'Password updated.' }
  } catch {
    return { success: false, message: 'Could not reach the server.' }
  }
}

export async function checkClientIdAvailable(clientId: string, excludeId?: number): Promise<boolean> {
  const trimmed = clientId.trim().toUpperCase()
  if (!trimmed) return true
  try {
    const res = await djangoFetch(`/api/clients/?search=${encodeURIComponent(trimmed)}`)
    if (!res.ok) return true // fail open — the real uniqueness check still runs server-side on submit
    const data = await res.json()
    const list: DjangoClient[] = data.results ?? data
    return !list.some(c => c.client_id?.toUpperCase() === trimmed && c.id !== excludeId)
  } catch {
    return true
  }
}

export async function getClient(id: number): Promise<DjangoClient | null> {
  try {
    const res = await djangoFetch(`/api/clients/${id}/`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function getClients(): Promise<DjangoClient[]> {
  try {
    const res = await djangoFetch('/api/clients/')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data
  } catch {
    return []
  }
}

export async function toggleClientActive(
  id: number,
  is_active: boolean
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/clients/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    })
    if (!res.ok) return { success: false, message: `Server error ${res.status}` }
    revalidatePath('/dashboard/clients')
    return { success: true, message: is_active ? 'Client activated.' : 'Client deactivated.' }
  } catch {
    return { success: false, message: 'Could not reach the server.' }
  }
}

export type SyncResult = {
  success: boolean
  message: string
  created: number
  updated: number
  total: number
}

export async function syncClientsFromSenaite(): Promise<SyncResult> {
  const session = await getSession()
  if (!session) return { success: false, message: 'Not authenticated. Please sign in again.', created: 0, updated: 0, total: 0 }

  // 1. Fetch all Django clients to build uid→id map (uses djangoFetch — tenant-aware)
  const existingRes = await djangoFetch('/api/clients/?page_size=1000').catch(() => null)
  const existingData = existingRes?.ok ? await existingRes.json() : { results: [] }
  const existingList: DjangoClient[] = existingData.results ?? existingData
  const byUid = new Map<string, number>()
  for (const c of existingList) {
    if (c.senaite_uid) byUid.set(c.senaite_uid, c.id)
  }

  // 2. Fetch all clients from SENAITE (raw fetch — not a Django endpoint)
  const SENAITE_USER = process.env.SENAITE_ADMIN_USER ?? 'admin'
  const SENAITE_PASS = process.env.SENAITE_ADMIN_PASS ?? 'admin'
  const senaiteToken = session.senaiteToken ?? Buffer.from(`${SENAITE_USER}:${SENAITE_PASS}`).toString('base64')
  const senaiteClients = await fetchSenaiteClients(senaiteToken)
  if (senaiteClients.length === 0) {
    return { success: false, message: 'No clients found in XelLabs. Verify XelLabs is running and you are logged in as a XelLabs user.', created: 0, updated: 0, total: 0 }
  }

  let created = 0
  let updated = 0
  let failed = 0

  // 3. Upsert each SENAITE client into Django
  for (const sc of senaiteClients) {
    const payload = {
      name:             sc.title,
      client_id:        sc.ClientID || sc.id,
      email:            sc.EmailAddress || '',
      phone:            sc.Phone || '',
      fax:              sc.Fax || '',
      tax_number:       sc.TaxNumber || '',
      bank_name:        sc.BankName || '',
      bank_branch:      sc.BankBranch || '',
      physical_address: sc.PhysicalAddress ?? {},
      postal_address:   sc.PostalAddress ?? {},
      billing_address:  sc.BillingAddress ?? {},
      is_active:        sc.review_state !== 'inactive',
      senaite_uid:      sc.uid,
    }

    const existingId = byUid.get(sc.uid)
    try {
      const res = existingId
        ? await djangoFetch(`/api/clients/${existingId}/`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await djangoFetch('/api/clients/', { method: 'POST', body: JSON.stringify({ ...payload, is_active: true }) })

      if (!res.ok) {
        failed++
      } else if (existingId) {
        updated++
      } else {
        created++
      }
    } catch {
      failed++
    }
  }

  revalidatePath('/dashboard/clients')
  return {
    success: failed === 0,
    message: failed === 0
      ? `Sync complete — ${created} created, ${updated} updated.`
      : `Sync finished with errors — ${created} created, ${updated} updated, ${failed} failed. Check server logs.`,
    created,
    updated,
    total: senaiteClients.length,
  }
}

export async function updateClient(
  id: number,
  _state: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const g = (key: string) => (formData.get(key) as string)?.trim() ?? ''

  const name      = g('name')
  const client_id = g('client_id')

  const errors: ClientFormState['errors'] = {}
  if (!name)      errors.name      = ['Client name is required']
  if (!client_id) errors.client_id = ['Client ID is required']
  if (Object.keys(errors).length > 0) return { errors }

  const payload = {
    name, client_id,
    email: g('email'), phone: g('phone'), fax: g('fax'), mobile: g('mobile'),
    contact_person: g('contact_person'), salutation: g('salutation'),
    contact_first_name: g('contact_first_name'), contact_last_name: g('contact_last_name'),
    contact_email: g('contact_email'), contact_phone: g('contact_phone'),
    contact_job_title: g('contact_job_title'), contact_department: g('contact_department'),
    physical_address: addr(formData, 'physical'),
    postal_address:   addr(formData, 'postal'),
    billing_address:  addr(formData, 'billing'),
    tax_number: g('tax_number'), account_number: g('account_number'),
    bank_name: g('bank_name'), bank_branch: g('bank_branch'),
    swift_code: g('swift_code'), iban: g('iban'), nib: g('nib'),
    bulk_discount: g('bulk_discount') || '0', member_discount: g('member_discount') || '0',
    remarks: g('remarks'),
  }

  try {
    const res = await djangoFetch(`/api/clients/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      let msg = `Error ${res.status}`
      try {
        const err = await res.json()
        const parts = Object.values(err as Record<string, unknown>).flat() as string[]
        if (parts.length) msg = parts.join(' ')
      } catch { /* non-JSON body */ }
      return { message: msg }
    }
    revalidatePath('/dashboard/clients')
    return { success: true, message: `Client "${name}" updated successfully.` }
  } catch {
    return { message: 'Could not reach the server. Please try again.' }
  }
}

export async function createClient(
  _state: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const g = (key: string) => (formData.get(key) as string)?.trim() ?? ''

  const name      = g('name')
  const client_id = g('client_id')

  const errors: ClientFormState['errors'] = {}
  if (!name)      errors.name      = ['Client name is required']
  if (!client_id) errors.client_id = ['Client ID is required']
  if (Object.keys(errors).length > 0) return { errors }

  const payload = {
    name, client_id,
    email:  g('email'), phone: g('phone'), fax: g('fax'), mobile: g('mobile'),
    contact_person: g('contact_person'), salutation: g('salutation'),
    contact_first_name: g('contact_first_name'), contact_last_name: g('contact_last_name'),
    contact_email: g('contact_email'), contact_phone: g('contact_phone'),
    contact_job_title: g('contact_job_title'), contact_department: g('contact_department'),
    physical_address: addr(formData, 'physical'),
    postal_address:   addr(formData, 'postal'),
    billing_address:  addr(formData, 'billing'),
    tax_number: g('tax_number'), account_number: g('account_number'),
    bank_name: g('bank_name'), bank_branch: g('bank_branch'),
    swift_code: g('swift_code'), iban: g('iban'), nib: g('nib'),
    bulk_discount: g('bulk_discount') || '0', member_discount: g('member_discount') || '0',
    remarks: g('remarks'),
  }

  try {
    const res = await djangoFetch('/api/clients/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      let msg = `Error ${res.status}`
      try {
        const err = await res.json()
        const parts = Object.values(err as Record<string, unknown>).flat() as string[]
        if (parts.length) msg = parts.join(' ')
      } catch { /* non-JSON body — keep generic message */ }
      return { message: msg }
    }

    revalidatePath('/dashboard/clients')
    return {
      success: true,
      message: `Client "${name}" created successfully.`,
    }
  } catch {
    return { message: 'Could not reach the server. Please try again.' }
  }
}

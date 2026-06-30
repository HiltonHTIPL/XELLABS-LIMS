'use server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/lib/session'
import { fetchSenaiteClients } from '@/app/lib/senaite'

const DJANGO_API = process.env.DJANGO_API_URL ?? 'http://django:8001'

export type SenaiteAddress = {
  address: string
  city: string
  state: string
  zip: string
  country: string
}

export type DjangoClient = {
  id: number
  // Core identifiers
  name: string
  client_id: string
  // Organisation contact
  email: string
  phone: string
  fax: string
  mobile: string
  // Primary contact person
  contact_person: string
  salutation: string
  contact_first_name: string
  contact_last_name: string
  contact_email: string
  contact_phone: string
  contact_job_title: string
  contact_department: string
  // Addresses
  address: string
  physical_address: SenaiteAddress | Record<string, never>
  postal_address: SenaiteAddress | Record<string, never>
  billing_address: SenaiteAddress | Record<string, never>
  // Financial
  tax_number: string
  account_number: string
  bank_name: string
  bank_branch: string
  swift_code: string
  iban: string
  nib: string
  bulk_discount: string
  member_discount: string
  // Notes & sync
  remarks: string
  senaite_uid: string
  // Meta
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

function authHeader(token: string) {
  return { Authorization: `Token ${token}`, 'Content-Type': 'application/json' }
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

export async function getClient(id: number): Promise<DjangoClient | null> {
  const session = await getSession()
  if (!session?.djangoToken) return null
  try {
    const res = await fetch(`${DJANGO_API}/api/clients/${id}/`, {
      headers: authHeader(session.djangoToken),
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function getClients(): Promise<DjangoClient[]> {
  const session = await getSession()
  if (!session?.djangoToken) return []
  try {
    const res = await fetch(`${DJANGO_API}/api/clients/`, {
      headers: authHeader(session.djangoToken),
      cache: 'no-store',
    })
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
  const session = await getSession()
  if (!session?.djangoToken) return { success: false, message: 'Not authenticated.' }
  try {
    const res = await fetch(`${DJANGO_API}/api/clients/${id}/`, {
      method: 'PATCH',
      headers: authHeader(session.djangoToken),
      body: JSON.stringify({ is_active }),
      cache: 'no-store',
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
  if (!session?.djangoToken) return { success: false, message: 'Not authenticated.', created: 0, updated: 0, total: 0 }
  if (!session.senaiteToken) return { success: false, message: 'No SENAITE session. Please log in again.', created: 0, updated: 0, total: 0 }

  // 1. Fetch all clients currently in Django to build a uid→id map
  const existingRes = await fetch(`${DJANGO_API}/api/clients/?page_size=1000`, {
    headers: authHeader(session.djangoToken),
    cache: 'no-store',
  }).catch(() => null)
  const existingData = existingRes?.ok ? await existingRes.json() : { results: [] }
  const existingList: DjangoClient[] = existingData.results ?? existingData
  const byUid = new Map<string, number>()
  for (const c of existingList) {
    if (c.senaite_uid) byUid.set(c.senaite_uid, c.id)
  }

  // 2. Fetch all clients from SENAITE
  const senaiteClients = await fetchSenaiteClients(session.senaiteToken)
  if (senaiteClients.length === 0) {
    return { success: false, message: 'No clients found in SENAITE. Verify SENAITE is running and you are logged in as a SENAITE user.', created: 0, updated: 0, total: 0 }
  }

  let created = 0
  let updated = 0

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
    if (existingId) {
      // PATCH — update existing
      await fetch(`${DJANGO_API}/api/clients/${existingId}/`, {
        method: 'PATCH',
        headers: authHeader(session.djangoToken),
        body: JSON.stringify(payload),
        cache: 'no-store',
      }).catch(() => null)
      updated++
    } else {
      // POST — create new
      await fetch(`${DJANGO_API}/api/clients/`, {
        method: 'POST',
        headers: authHeader(session.djangoToken),
        body: JSON.stringify({ ...payload, is_active: true }),
        cache: 'no-store',
      }).catch(() => null)
      created++
    }
  }

  revalidatePath('/dashboard/clients')
  return {
    success: true,
    message: `Sync complete — ${created} created, ${updated} updated.`,
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
  const session = await getSession()
  if (!session?.djangoToken) return { message: 'Not authenticated. Please sign in again.' }

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
    const res = await fetch(`${DJANGO_API}/api/clients/${id}/`, {
      method: 'PATCH',
      headers: authHeader(session.djangoToken),
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = Object.values(err).flat().join(' ') || `Error ${res.status}`
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
  const session = await getSession()
  if (!session?.djangoToken) return { message: 'Not authenticated. Please sign in again.' }

  const g = (key: string) => (formData.get(key) as string)?.trim() ?? ''

  const name      = g('name')
  const client_id = g('client_id')

  const errors: ClientFormState['errors'] = {}
  if (!name)      errors.name      = ['Client name is required']
  if (!client_id) errors.client_id = ['Client ID is required']
  if (Object.keys(errors).length > 0) return { errors }

  const payload = {
    // Core
    name,
    client_id,
    // Organisation contact
    email:  g('email'),
    phone:  g('phone'),
    fax:    g('fax'),
    mobile: g('mobile'),
    // Primary contact person
    contact_person:    g('contact_person'),
    salutation:        g('salutation'),
    contact_first_name: g('contact_first_name'),
    contact_last_name:  g('contact_last_name'),
    contact_email:      g('contact_email'),
    contact_phone:      g('contact_phone'),
    contact_job_title:  g('contact_job_title'),
    contact_department: g('contact_department'),
    // Addresses
    physical_address: addr(formData, 'physical'),
    postal_address:   addr(formData, 'postal'),
    billing_address:  addr(formData, 'billing'),
    // Financial
    tax_number:      g('tax_number'),
    account_number:  g('account_number'),
    bank_name:       g('bank_name'),
    bank_branch:     g('bank_branch'),
    swift_code:      g('swift_code'),
    iban:            g('iban'),
    nib:             g('nib'),
    bulk_discount:   g('bulk_discount')   || '0',
    member_discount: g('member_discount') || '0',
    // Notes
    remarks: g('remarks'),
  }

  try {
    const res = await fetch(`${DJANGO_API}/api/clients/`, {
      method: 'POST',
      headers: authHeader(session.djangoToken),
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = Object.values(err).flat().join(' ') || `Error ${res.status}`
      return { message: msg }
    }

    revalidatePath('/dashboard/clients')
    return { success: true, message: `Client "${name}" created successfully.` }
  } catch {
    return { message: 'Could not reach the server. Please try again.' }
  }
}

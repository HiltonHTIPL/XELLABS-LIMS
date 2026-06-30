'use server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/lib/session'

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

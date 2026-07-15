'use server'
import { revalidatePath } from 'next/cache'
import { serverToken } from '@/app/lib/senaite-auth'
import {
  fetchSenaiteClientsFull, fetchSenaiteClientByUid,
  createSenaiteClientObj, updateSenaiteClientObj, setSenaiteClientActive,
  type SenaiteClientFull, type SenaiteClientPayload, type SenaiteContactPayload,
} from '@/app/lib/senaite'

export type ClientFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function getSenaiteClients(): Promise<SenaiteClientFull[]> {
  return fetchSenaiteClientsFull(serverToken())
}

export async function getSenaiteClient(uid: string): Promise<SenaiteClientFull | null> {
  return fetchSenaiteClientByUid(serverToken(), uid)
}

// SENAITE does NOT enforce ClientID uniqueness itself (confirmed: creating a
// second Client with an already-used ClientID succeeds silently) — this app
// owns that constraint. Checked both live in the UI (on blur / before Next)
// and again here on submit as the authoritative guard.
export async function checkClientIdAvailable(clientId: string, excludeUid?: string): Promise<boolean | null> {
  const trimmed = clientId.trim().toUpperCase()
  if (!trimmed) return true
  try {
    const clients = await fetchSenaiteClientsFull(serverToken())
    return !clients.some(c => c.ClientID?.toUpperCase() === trimmed && c.uid !== excludeUid)
  } catch {
    return null // network/API error — UI should treat as "couldn't verify", not fail-open
  }
}

function addr(fd: FormData, prefix: string) {
  const g = (k: string) => (fd.get(`${prefix}_${k}`) as string)?.trim() ?? ''
  return { address: g('street'), city: g('city'), state: g('state'), zip: g('zip'), country: g('country') }
}

function buildPayloads(fd: FormData): { client: SenaiteClientPayload; contact: SenaiteContactPayload } {
  const g = (k: string) => (fd.get(k) as string)?.trim() ?? ''
  const client: SenaiteClientPayload = {
    title:                 g('name'),
    ClientID:              g('client_id'),
    EmailAddress:          g('email'),
    Phone:                 g('phone'),
    Fax:                   g('fax'),
    TaxNumber:             g('tax_number'),
    AccountName:           g('account_name'),
    AccountNumber:         g('account_number'),
    AccountType:           g('account_type'),
    BankName:              g('bank_name'),
    BankBranch:            g('bank_branch'),
    CCEmails:              g('cc_emails'),
    BulkDiscount:          fd.get('bulk_discount') === 'on' || fd.get('bulk_discount') === 'true',
    MemberDiscountApplies: fd.get('member_discount') === 'on' || fd.get('member_discount') === 'true',
    DecimalMark:           g('decimal_mark') || '.',
    description:           g('description'),
    PhysicalAddress:       addr(fd, 'physical'),
    PostalAddress:         addr(fd, 'postal'),
    BillingAddress:        addr(fd, 'billing'),
  }
  const contact: SenaiteContactPayload = {
    Salutation:    g('salutation'),
    Firstname:     g('contact_first_name'),
    Surname:       g('contact_last_name'),
    EmailAddress:  g('contact_email'),
    BusinessPhone: g('contact_phone'),
    MobilePhone:   g('contact_mobile'),
    BusinessFax:   g('contact_fax'),
    JobTitle:      g('contact_job_title'),
    Department:    g('contact_department'),
  }
  return { client, contact }
}

async function validate(fd: FormData, excludeUid?: string): Promise<Record<string, string[]>> {
  const errors: Record<string, string[]> = {}
  if (!(fd.get('name') as string)?.trim()) errors.name = ['Client name is required']
  const clientId = (fd.get('client_id') as string)?.trim()
  if (!clientId) {
    errors.client_id = ['Client ID is required']
  } else {
    const available = await checkClientIdAvailable(clientId, excludeUid)
    if (available === false) errors.client_id = ['This Client ID is already in use — choose a different one.']
  }
  return errors
}

export async function createSenaiteClient(_state: ClientFormState, fd: FormData): Promise<ClientFormState> {
  const errors = await validate(fd)
  if (Object.keys(errors).length) return { errors }
  const { client, contact } = buildPayloads(fd)
  const res = await createSenaiteClientObj(serverToken(), client, contact)
  if (!res.success) return { message: res.error ?? 'Failed to create client.' }
  revalidatePath('/dashboard/clients')
  return { success: true, message: `Client "${client.title}" created.` }
}

export async function updateSenaiteClient(
  uid: string, clientPath: string, existingContactUid: string | null,
  _state: ClientFormState, fd: FormData,
): Promise<ClientFormState> {
  const errors = await validate(fd, uid)
  if (Object.keys(errors).length) return { errors }
  const { client, contact } = buildPayloads(fd)
  const res = await updateSenaiteClientObj(serverToken(), uid, clientPath, client, contact, existingContactUid)
  if (!res.success) return { message: res.error ?? 'Failed to update client.' }
  revalidatePath('/dashboard/clients')
  revalidatePath(`/dashboard/clients/${uid}`)
  return { success: true, message: `Client "${client.title}" updated.` }
}

export async function toggleSenaiteClientActive(
  uid: string, active: boolean,
): Promise<{ success: boolean; message: string }> {
  const res = await setSenaiteClientActive(serverToken(), uid, active)
  if (!res.success) return { success: false, message: res.error ?? 'Failed to update status.' }
  revalidatePath('/dashboard/clients')
  revalidatePath(`/dashboard/clients/${uid}`)
  return { success: true, message: active ? 'Client activated.' : 'Client deactivated.' }
}

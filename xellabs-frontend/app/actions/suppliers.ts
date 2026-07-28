'use server'
import { createEntity, updateEntity, str, type EntityConfig } from '@/app/lib/admin-crud'
import { serverToken } from '@/app/lib/senaite-auth'
import { fetchSetupList, fetchRestapiOverlay, type SetupRecord } from '@/app/lib/senaite-setup'
import type { AdminFormState } from '@/app/dashboard/_components/AdminRefShell'

// SENAITE Supplier — a Dexterity type at setup/suppliers (senaite/core/content/
// supplier.py + organization.py). Suppliers are the containers for Reference
// Samples (QC materials). Read via v1, write via plone.restapi (the shared
// read-v1 / write-restapi split — §16d). Verified live: DX Supplier writes
// cleanly through restapi (unlike AT Client, its address subfields don't trip
// the inline_field_validator crash), so no custom Zope view is needed here.
//
// Confirmed live (2026-07-20): v1's list serialization returns a real value for
// title/description/website/remarks/nib/iban/swift_code/lab_account_number
// (Supplier's own added fields) but OMITS every field inherited from the
// Organization base — email, phone, tax_number, fax, account_type,
// account_name, account_number, bank_name, bank_branch, address — even though
// they persist correctly via restapi PATCH (confirmed by reading them back via
// restapi's own per-object GET). Same read/write split as SampleType's
// retention_period (§16b) — the OVERLAY_FIELDS list below is overlaid from a
// per-object restapi GET, exactly like fetchRestapiSampleTypeExtras().
// Adapter Pattern: all of this stays isolated in this file / senaite-setup.ts,
// never leaks into SuppliersShell.tsx.
const OVERLAY_FIELDS = [
  'email', 'phone', 'tax_number', 'fax',
  'account_type', 'account_name', 'account_number', 'bank_name', 'bank_branch',
  'address',
]

const CFG: EntityConfig = {
  portalType: 'Supplier',
  parentSubPath: 'setup/suppliers',
  revalidate: '/dashboard/suppliers',
  singular: 'Supplier',
  buildBody: (fd) => {
    const title = str(fd, 'title')
    const errors: Record<string, string[]> = {}
    if (!title) errors.title = ['Name is required']

    // Address is a single AddressField holding physical/postal/billing
    // records together (senaite/core/schema/addressfield.py) — sub-field
    // names are `address`/`city`/`subdivision1`(state)/`subdivision2`
    // (district)/`zip`/`country`, confirmed live, NOT the Client-style
    // Country/State/District key names. Only send address types that have
    // at least one non-empty sub-field, so an untouched block doesn't
    // overwrite an existing address with blanks.
    const addressType = (prefix: string, type: string) => {
      const rec = {
        type,
        address: str(fd, `${prefix}_address`),
        city: str(fd, `${prefix}_city`),
        subdivision1: str(fd, `${prefix}_state`),
        subdivision2: str(fd, `${prefix}_district`),
        zip: str(fd, `${prefix}_zip`),
        country: str(fd, `${prefix}_country`),
      }
      const hasValue = Object.entries(rec).some(([k, v]) => k !== 'type' && v)
      return hasValue ? rec : null
    }
    const address = [
      addressType('physical', 'physical'),
      addressType('postal', 'postal'),
      addressType('billing', 'billing'),
    ].filter((r): r is NonNullable<typeof r> => r !== null)

    // description MUST be a string, never omitted (restapi applies a None
    // default that fails validation on DX types that declare the field — §16d).
    // NOTE: Supplier.description is confirmed a dead write in this SENAITE
    // build — PATCH/create both return success but the value never persists
    // (verified live 2026-07-20; restapi GET always reads back None/"").
    // Hardcoded to "" here purely to satisfy that create-time requirement —
    // there is intentionally no UI field for it since it can't hold a value;
    // Remarks (a genuinely working field) covers free-text notes instead.
    //
    // email uses zope.schema.Email, which validates FORMAT even though the
    // field itself is optional — sending "" fails with "not a valid email"
    // (confirmed live), so it must be omitted entirely when blank, not sent
    // as an empty string like the plain TextLine fields below.
    return {
      body: {
        title,
        description: '',
        ...(str(fd, 'email') ? { email: str(fd, 'email') } : {}),
        phone: str(fd, 'phone'),
        website: str(fd, 'website'),
        tax_number: str(fd, 'tax_number'),
        fax: str(fd, 'fax'),
        account_type: str(fd, 'account_type'),
        account_name: str(fd, 'account_name'),
        account_number: str(fd, 'account_number'),
        bank_name: str(fd, 'bank_name'),
        bank_branch: str(fd, 'bank_branch'),
        nib: str(fd, 'nib'),
        iban: str(fd, 'iban'),
        swift_code: str(fd, 'swift_code'),
        lab_account_number: str(fd, 'lab_account_number'),
        remarks: str(fd, 'remarks'),
        ...(address.length ? { address } : {}),
      },
      errors,
    }
  },
}

export type SupplierRow = {
  uid: string; path: string; title: string
  email: string; phone: string; website: string; description: string
  tax_number: string; fax: string
  account_type: string; account_name: string; account_number: string
  bank_name: string; bank_branch: string
  nib: string; iban: string; swift_code: string
  lab_account_number: string; remarks: string
  physical_address: string; physical_city: string; physical_state: string; physical_district: string; physical_zip: string; physical_country: string
  postal_address: string; postal_city: string; postal_state: string; postal_district: string; postal_zip: string; postal_country: string
  billing_address: string; billing_city: string; billing_state: string; billing_district: string; billing_zip: string; billing_country: string
}

function addressField(address: unknown, type: string, key: string): string {
  const rec = (Array.isArray(address) ? address : []).find(
    (a): a is Record<string, unknown> => typeof a === 'object' && a !== null && (a as Record<string, unknown>).type === type,
  )
  return rec ? String(rec[key] ?? '') : ''
}

function mapSupplierRow(d: SetupRecord): SupplierRow {
  return {
    uid: d.uid as string,
    path: (d.path as string) ?? '',
    title: d.title as string,
    email: (d.email as string) ?? '',
    phone: (d.phone as string) ?? '',
    website: (d.website as string) ?? '',
    description: (d.description as string) ?? '',
    tax_number: (d.tax_number as string) ?? '',
    fax: (d.fax as string) ?? '',
    account_type: (d.account_type as string) ?? '',
    account_name: (d.account_name as string) ?? '',
    account_number: (d.account_number as string) ?? '',
    bank_name: (d.bank_name as string) ?? '',
    bank_branch: (d.bank_branch as string) ?? '',
    nib: (d.nib as string) ?? '',
    iban: (d.iban as string) ?? '',
    swift_code: (d.swift_code as string) ?? '',
    lab_account_number: (d.lab_account_number as string) ?? '',
    remarks: (d.remarks as string) ?? '',
    physical_address: addressField(d.address, 'physical', 'address'),
    physical_city: addressField(d.address, 'physical', 'city'),
    physical_state: addressField(d.address, 'physical', 'subdivision1'),
    physical_district: addressField(d.address, 'physical', 'subdivision2'),
    physical_zip: addressField(d.address, 'physical', 'zip'),
    physical_country: addressField(d.address, 'physical', 'country'),
    postal_address: addressField(d.address, 'postal', 'address'),
    postal_city: addressField(d.address, 'postal', 'city'),
    postal_state: addressField(d.address, 'postal', 'subdivision1'),
    postal_district: addressField(d.address, 'postal', 'subdivision2'),
    postal_zip: addressField(d.address, 'postal', 'zip'),
    postal_country: addressField(d.address, 'postal', 'country'),
    billing_address: addressField(d.address, 'billing', 'address'),
    billing_city: addressField(d.address, 'billing', 'city'),
    billing_state: addressField(d.address, 'billing', 'subdivision1'),
    billing_district: addressField(d.address, 'billing', 'subdivision2'),
    billing_zip: addressField(d.address, 'billing', 'zip'),
    billing_country: addressField(d.address, 'billing', 'country'),
  }
}

export async function listSuppliers(): Promise<SupplierRow[]> {
  const token = serverToken()
  const items = await fetchSetupList(token, 'Supplier')
  const overlays = await Promise.all(items.map(d => fetchRestapiOverlay(token, (d.url as string) ?? '', OVERLAY_FIELDS)))
  return items.map((d, i) => mapSupplierRow({ ...d, ...overlays[i] }))
}
export async function createSupplier(_p: AdminFormState, fd: FormData) { return createEntity(CFG, fd) }
export async function updateSupplier(_uid: string, _p: AdminFormState, fd: FormData) { return updateEntity(CFG, fd) }

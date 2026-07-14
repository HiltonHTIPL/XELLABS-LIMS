const SENAITE_URL = process.env.SENAITE_URL ?? 'http://senaite:8080/senaite'
// Plone/SENAITE site root path — used for legacy create API parent_path.
// When SENAITE_URL has no path (e.g. http://172.21.0.1:8096), pathname is '/'
// which produces '//batches' — incorrect. Always use '/senaite' as the site root.
const SENAITE_SITE_PATH = (() => {
  try {
    const p = new URL(SENAITE_URL).pathname.replace(/\/$/, '')
    return p || '/senaite'
  } catch { return '/senaite' }
})()

export type SenaiteUser = {
  userid: string
  fullname: string
  email: string
  roles: string[]
}

export type SenaiteAddress = {
  address: string
  city: string
  state: string
  zip: string
  country: string
}

export type SenaiteClient = {
  uid: string
  id: string
  title: string
  ClientID: string
  EmailAddress: string
  Phone: string
  Fax?: string
  TaxNumber?: string
  BankName?: string
  BankBranch?: string
  PhysicalAddress?: SenaiteAddress | null
  PostalAddress?: SenaiteAddress | null
  BillingAddress?: SenaiteAddress | null
  review_state?: string
  url: string
  path?: string
}

/** Authenticate against SENAITE using Basic Auth (JWT plugin not required) */
export async function senaiteLogin(username: string, password: string): Promise<{ token: string; user: SenaiteUser } | null> {
  try {
    const basicToken = Buffer.from(`${username}:${password}`).toString('base64')
    const res = await fetch(`${SENAITE_URL}/@users/${encodeURIComponent(username)}`, {
      headers: {
        Authorization: `Basic ${basicToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    // Store Basic Auth token (base64 credentials) as the "senaite token"
    return {
      token: basicToken,
      user: {
        userid: data.id ?? username,
        fullname: data.fullname ?? username,
        email: data.email ?? '',
        roles: data.roles ?? [],
      },
    }
  } catch {
    return null
  }
}

/** Map SENAITE roles to our internal role string */
export function mapSenaiteRole(roles: string[]): string {
  if (roles.includes('Manager') || roles.includes('Site Administrator')) return 'admin'
  if (roles.includes('LabManager')) return 'lab_manager'
  if (roles.includes('Reviewer') || roles.includes('Verifier')) return 'reviewer'
  if (roles.includes('Analyst')) return 'analyst'
  if (roles.includes('Client')) return 'client'
  return 'analyst'
}

/** Fetch all clients from SENAITE using senaite.jsonapi (v1) */
export async function fetchSenaiteClients(token: string): Promise<SenaiteClient[]> {
  const headers = { Authorization: `Basic ${token}`, Accept: 'application/json' }

  // Try senaite.jsonapi endpoint first (more reliable in SENAITE v2.x)
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/client?complete=true&limit=1000`, {
      headers,
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      const mapAddr = (a: unknown): SenaiteAddress | null => {
        if (!a || typeof a !== 'object') return null
        const o = a as Record<string, unknown>
        return { address: (o.address as string) ?? '', city: (o.city as string) ?? '', state: (o.state as string) ?? '', zip: (o.zip as string) ?? '', country: (o.country as string) ?? '' }
      }
      const items: SenaiteClient[] = (data.items ?? []).map((c: Record<string, unknown>) => ({
        uid:             (c.uid as string) ?? '',
        id:              (c.id as string) ?? '',
        title:           (c.title as string) ?? '',
        ClientID:        (c.ClientID as string) ?? '',
        EmailAddress:    (c.EmailAddress as string) ?? '',
        Phone:           (c.Phone as string) ?? '',
        Fax:             (c.Fax as string) ?? '',
        TaxNumber:       (c.TaxNumber as string) ?? '',
        BankName:        (c.BankName as string) ?? '',
        BankBranch:      (c.BankBranch as string) ?? '',
        PhysicalAddress: mapAddr(c.PhysicalAddress),
        PostalAddress:   mapAddr(c.PostalAddress),
        BillingAddress:  mapAddr(c.BillingAddress),
        review_state:    (c.review_state as string) ?? 'active',
        url:             (c.url as string) ?? '',
        path:            (c.path as string) ?? '',
      }))
      if (items.length > 0) return items
    }
  } catch {
    // fall through to Plone REST API
  }

  // Fallback: Plone REST API
  try {
    const res = await fetch(`${SENAITE_URL}/clients?fullobjects=true`, {
      headers: { ...headers, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []).map((c: Record<string, unknown>) => ({
      uid:          (c.UID as string) ?? (c.uid as string) ?? '',
      id:           (c.id as string) ?? '',
      title:        (c.title as string) ?? '',
      ClientID:     (c.ClientID as string) ?? '',
      EmailAddress: (c.EmailAddress as string) ?? '',
      Phone:        (c.Phone as string) ?? '',
      url:          (c['@id'] as string) ?? '',
    }))
  } catch {
    return []
  }
}

// ─── SENAITE-owned Clients (full CRUD, no Django) ─────────────────────────────
// The Clients feature is sourced entirely from SENAITE. A client's primary
// contact person is a separate SENAITE `Contact` object living under the client
// folder — we treat the first Contact as the primary one.

export type SenaiteContact = {
  uid: string
  path: string
  Salutation: string
  Firstname: string
  Surname: string
  EmailAddress: string
  BusinessPhone: string
  MobilePhone: string
  Fax: string
  JobTitle: string
  Department: string
}

export type SenaiteClientFull = {
  uid: string
  id: string
  path: string
  title: string
  ClientID: string
  EmailAddress: string
  Phone: string
  Fax: string
  TaxNumber: string
  AccountName: string
  AccountNumber: string
  AccountType: string
  BankName: string
  BankBranch: string
  CCEmails: string
  BulkDiscount: boolean
  MemberDiscountApplies: boolean
  DecimalMark: string
  description: string
  PhysicalAddress: SenaiteAddress | null
  PostalAddress: SenaiteAddress | null
  BillingAddress: SenaiteAddress | null
  review_state: string
  contact: SenaiteContact | null
}

const CLIENTS_PATH = `${SENAITE_SITE_PATH}/clients`

function mapAddress(a: unknown): SenaiteAddress | null {
  if (!a || typeof a !== 'object') return null
  const o = a as Record<string, unknown>
  return {
    address: (o.address as string) ?? '',
    city:    (o.city as string) ?? '',
    state:   (o.state as string) ?? '',
    zip:     (o.zip as string) ?? '',
    country: (o.country as string) ?? '',
  }
}

function mapClient(c: Record<string, unknown>): SenaiteClientFull {
  return {
    uid:                  (c.uid as string) ?? '',
    id:                   (c.id as string) ?? '',
    path:                 (c.path as string) ?? '',
    title:                (c.title as string) ?? (c.Name as string) ?? '',
    ClientID:             (c.ClientID as string) ?? '',
    EmailAddress:         (c.EmailAddress as string) ?? '',
    Phone:                (c.Phone as string) ?? '',
    Fax:                  (c.Fax as string) ?? '',
    TaxNumber:            (c.TaxNumber as string) ?? '',
    AccountName:          (c.AccountName as string) ?? '',
    AccountNumber:        (c.AccountNumber as string) ?? '',
    AccountType:          (c.AccountType as string) ?? '',
    BankName:             (c.BankName as string) ?? '',
    BankBranch:           (c.BankBranch as string) ?? '',
    CCEmails:             (c.CCEmails as string) ?? '',
    BulkDiscount:         Boolean(c.BulkDiscount),
    MemberDiscountApplies: Boolean(c.MemberDiscountApplies),
    DecimalMark:          (c.DecimalMark as string) ?? '.',
    description:          (c.description as string) ?? '',
    PhysicalAddress:      mapAddress(c.PhysicalAddress),
    PostalAddress:        mapAddress(c.PostalAddress),
    BillingAddress:       mapAddress(c.BillingAddress),
    review_state:         (c.review_state as string) ?? 'active',
    contact:              null,
  }
}

function mapContact(c: Record<string, unknown>): SenaiteContact {
  return {
    uid:           (c.uid as string) ?? '',
    path:          (c.path as string) ?? '',
    Salutation:    (c.Salutation as string) ?? '',
    Firstname:     (c.Firstname as string) ?? '',
    Surname:       (c.Surname as string) ?? '',
    EmailAddress:  (c.EmailAddress as string) ?? '',
    BusinessPhone: (c.BusinessPhone as string) ?? '',
    MobilePhone:   (c.MobilePhone as string) ?? '',
    Fax:           (c.BusinessFax as string) ?? (c.Fax as string) ?? '',
    JobTitle:      (c.JobTitle as string) ?? '',
    Department:    (c.Department as string) ?? '',
  }
}

/** List all active clients with their primary contact merged in (one bulk Contact fetch). */
export async function fetchSenaiteClientsFull(token: string): Promise<SenaiteClientFull[]> {
  const headers = { Authorization: `Basic ${token}`, Accept: 'application/json' }
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Client?complete=true&limit=1000&review_state=active`, {
      headers, cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    const clients: SenaiteClientFull[] = (data.items ?? []).map(mapClient)
    if (clients.length === 0) return []

    // One bulk Contact fetch, grouped by parent client path.
    const cRes = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Contact?complete=true&limit=2000`, {
      headers, cache: 'no-store',
    })
    if (cRes.ok) {
      const cData = await cRes.json()
      const byParent = new Map<string, SenaiteContact>()
      for (const raw of (cData.items ?? []) as Record<string, unknown>[]) {
        const parent = (raw.parent_path as string) ?? ''
        if (parent && !byParent.has(parent)) byParent.set(parent, mapContact(raw))
      }
      for (const cl of clients) cl.contact = byParent.get(cl.path) ?? null
    }
    return clients
  } catch { return [] }
}

/** Fetch a single client by UID, with its primary contact. */
export async function fetchSenaiteClientByUid(token: string, uid: string): Promise<SenaiteClientFull | null> {
  const headers = { Authorization: `Basic ${token}`, Accept: 'application/json' }
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Client?UID=${encodeURIComponent(uid)}&complete=true`, {
      headers, cache: 'no-store',
    })
    if (!res.ok) return null
    const item = ((await res.json()).items ?? [])[0]
    if (!item) return null
    const client = mapClient(item)
    const cRes = await fetch(
      `${SENAITE_URL}/@@API/senaite/v1/Contact?complete=true&limit=100&path=${encodeURIComponent(client.path)}`,
      { headers, cache: 'no-store' },
    )
    if (cRes.ok) {
      const first = ((await cRes.json()).items ?? [])[0]
      if (first) client.contact = mapContact(first as Record<string, unknown>)
    }
    return client
  } catch { return null }
}

export type SenaiteClientPayload = {
  title: string
  ClientID: string
  EmailAddress: string
  Phone: string
  Fax: string
  TaxNumber: string
  AccountName: string
  AccountNumber: string
  AccountType: string
  BankName: string
  BankBranch: string
  CCEmails: string
  BulkDiscount: boolean
  MemberDiscountApplies: boolean
  DecimalMark: string
  description: string
  PhysicalAddress: SenaiteAddress
  PostalAddress: SenaiteAddress
  BillingAddress: SenaiteAddress
}

export type SenaiteContactPayload = {
  Salutation: string
  Firstname: string
  Surname: string
  EmailAddress: string
  BusinessPhone: string
  MobilePhone: string
  BusinessFax: string
  JobTitle: string
  Department: string
}

function hasContactData(p: SenaiteContactPayload): boolean {
  return Boolean(p.Firstname || p.Surname || p.EmailAddress || p.BusinessPhone || p.MobilePhone || p.JobTitle || p.Department)
}

/** Create a Client (+ its primary Contact) in SENAITE. Returns the new client UID. */
export async function createSenaiteClientObj(
  token: string, client: SenaiteClientPayload, contact: SenaiteContactPayload,
): Promise<{ success: boolean; uid?: string; error?: string }> {
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({ portal_type: 'Client', parent_path: CLIENTS_PATH, ...client }),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    const item = ((data.items as Record<string, unknown>[]) ?? [])[0]
    const uid = (item?.uid as string) ?? ''
    const path = (item?.path as string) ?? ''
    if (!uid || !path) return { success: false, error: 'No client returned from the lab system.' }
    if (hasContactData(contact)) await createSenaiteContactObj(token, path, contact)
    return { success: true, uid }
  } catch (e) { return { success: false, error: String(e) } }
}

/** Update an existing Client, and upsert its primary Contact. */
export async function updateSenaiteClientObj(
  token: string, uid: string, clientPath: string,
  client: SenaiteClientPayload, contact: SenaiteContactPayload, existingContactUid: string | null,
): Promise<{ success: boolean; error?: string }> {
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update/${uid}`, {
      method: 'POST', headers, cache: 'no-store', body: JSON.stringify(client),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    if (hasContactData(contact)) {
      if (existingContactUid) await updateSenaiteContactObj(token, existingContactUid, contact)
      else await createSenaiteContactObj(token, clientPath, contact)
    }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function createSenaiteContactObj(
  token: string, clientPath: string, contact: SenaiteContactPayload,
): Promise<{ success: boolean; error?: string }> {
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({ portal_type: 'Contact', parent_path: clientPath, ...contact }),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function updateSenaiteContactObj(
  token: string, uid: string, contact: SenaiteContactPayload,
): Promise<{ success: boolean; error?: string }> {
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update/${uid}`, {
      method: 'POST', headers, cache: 'no-store', body: JSON.stringify(contact),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

/** Activate or deactivate a client via the SENAITE workflow. */
export async function setSenaiteClientActive(
  token: string, uid: string, active: boolean,
): Promise<{ success: boolean; error?: string }> {
  const headers = { Authorization: `Basic ${token}`, Accept: 'application/json' }
  const transition = active ? 'activate' : 'deactivate'
  try {
    // The workflow route can return a non-200 while still committing the
    // transition, so we verify the resulting review_state rather than trust the status.
    await fetch(`${SENAITE_URL}/@@API/senaite/v1/${transition}/${uid}`, { method: 'POST', headers, cache: 'no-store' })
    const check = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Client?UID=${encodeURIComponent(uid)}`, { headers, cache: 'no-store' })
    const item = ((await check.json()).items ?? [])[0]
    const state = (item?.review_state as string) ?? ''
    const ok = active ? state === 'active' : state === 'inactive'
    return ok ? { success: true } : { success: false, error: `Client is still '${state}'.` }
  } catch (e) { return { success: false, error: String(e) } }
}

// ─── Sample Types ────────────────────────────────────────────────────────────

// Fixed sticker template codes — same list rendered by SENAITE's own
// "Admitted sticker templates" datagrid widget (confirmed against the live
// edit form: senaite/setup/sampletypes/<id>/edit). Not user-editable master
// data, so hardcoded here rather than round-tripped from a vocabulary.
export const STICKER_TEMPLATES: { value: string; label: string }[] = [
  { value: 'Code_128_1x48mm.pt', label: 'Code 128 1x48mm' },
  { value: 'Code_128_1x72mm.pt', label: 'Code 128 1x72mm' },
  { value: 'Code_39_1x54mm.pt', label: 'Code 39 1x54mm' },
  { value: 'Code_39_1x72mm.pt', label: 'Code 39 1x72mm' },
  { value: 'Code_39_2ix1i.pt', label: 'Code 39 2ix1i' },
  { value: 'Code_39_40x20mm.pt', label: 'Code 39 40x20mm' },
  { value: 'Code_93_2x38mm.pt', label: 'Code 93 2x38mm' },
  { value: 'DIN_Address_40x85mm.pt', label: 'DIN Address 40x85mm' },
  { value: 'QR_1x14mmx39mm.pt', label: 'QR 1x14mmx39mm' },
]

export type RetentionPeriod = { days: number; hours: number; minutes: number }
export type AdmittedStickerTemplates = { admitted: string[]; smallDefault: string; largeDefault: string }

export type SenaiteSampleType = {
  uid: string
  id: string
  url: string
  title: string
  description: string
  Prefix: string
  MinimumVolume: string
  RetentionPeriod: RetentionPeriod
  Hazardous: boolean
  SampleMatrixUid: string
  SampleMatrixTitle: string
  ContainerTypeUid: string
  ContainerTypeTitle: string
  AdmittedStickerTemplates: AdmittedStickerTemplates
}

// retention_period comes back as a {days,hours,minutes} dict from the legacy
// @@API/senaite/v1 read path, but as total seconds (a plain number) from
// plone.restapi — accept both since we read via v1 and patch via restapi.
function parseRetentionPeriod(raw: unknown): RetentionPeriod {
  if (typeof raw === 'number') {
    const totalMinutes = Math.floor(raw / 60)
    return { days: Math.floor(totalMinutes / 1440), hours: Math.floor((totalMinutes % 1440) / 60), minutes: totalMinutes % 60 }
  }
  const o = (raw as Record<string, unknown>) ?? {}
  return {
    days: Number(o.days) || 0,
    hours: Number(o.hours) || 0,
    minutes: Number(o.minutes) || 0,
  }
}

function retentionPeriodToSeconds(r: RetentionPeriod): number {
  return r.days * 86400 + r.hours * 3600 + r.minutes * 60
}

function parseRef(raw: unknown): { uid: string; title: string } {
  if (!raw || typeof raw !== 'object') return { uid: '', title: '' }
  const o = raw as Record<string, unknown>
  return { uid: (o.uid as string) ?? '', title: (o.title as string) ?? '' }
}

// admitted_sticker_templates is a DataGrid field — SENAITE stores it as a
// list containing exactly one row: {admitted: [...], small_default, large_default}.
function parseStickerTemplates(raw: unknown): AdmittedStickerTemplates {
  const rows = (raw as Record<string, unknown>[]) ?? []
  const row = rows[0] ?? {}
  return {
    admitted: (row.admitted as string[]) ?? [],
    smallDefault: (row.small_default as string) ?? '',
    largeDefault: (row.large_default as string) ?? '',
  }
}

function mapSenaiteSampleType(t: Record<string, unknown>): SenaiteSampleType {
  const matrix = parseRef(t.sample_matrix)
  const container = parseRef(t.container_type)
  return {
    uid:           (t.uid as string) ?? '',
    id:            (t.id as string) ?? '',
    url:           (t.url as string) ?? '',
    title:         (t.title as string) ?? '',
    description:   (t.description as string) ?? '',
    Prefix:        (t.Prefix as string) ?? (t.prefix as string) ?? '',
    MinimumVolume: (t.MinimumVolume as string) ?? (t.min_volume as string) ?? '',
    RetentionPeriod: parseRetentionPeriod(t.RetentionPeriod ?? t.retention_period),
    Hazardous: Boolean(t.Hazardous ?? t.hazardous ?? false),
    SampleMatrixUid: matrix.uid,
    SampleMatrixTitle: matrix.title,
    ContainerTypeUid: container.uid,
    ContainerTypeTitle: container.title,
    AdmittedStickerTemplates: parseStickerTemplates(t.AdmittedStickerTemplates ?? t.admitted_sticker_templates),
  }
}

// retention_period and admitted_sticker_templates are never populated by the
// legacy @@API/senaite/v1 read path (confirmed: reads back null even when the
// field genuinely has a value) — only plone.restapi's own per-object GET
// serializes them correctly, so fetch that too and let it win.
async function fetchRestapiSampleTypeExtras(
  token: string, url: string
): Promise<{ RetentionPeriod: RetentionPeriod; AdmittedStickerTemplates: AdmittedStickerTemplates } | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { headers: { Authorization: `Basic ${token}`, Accept: 'application/json' }, cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return {
      RetentionPeriod: parseRetentionPeriod(data.retention_period),
      AdmittedStickerTemplates: parseStickerTemplates(data.admitted_sticker_templates),
    }
  } catch { return null }
}

export async function fetchSenaiteSampleTypes(token: string): Promise<SenaiteSampleType[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/SampleType?complete=true&limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    const sampleTypes: SenaiteSampleType[] = (data.items ?? []).map(mapSenaiteSampleType)
    const extras = await Promise.all(sampleTypes.map(st => fetchRestapiSampleTypeExtras(token, st.url)))
    return sampleTypes.map((st, i) => extras[i] ? { ...st, ...extras[i] } : st)
  } catch { return [] }
}

// SampleMatrix and ContainerType are simple reference lists (used by the
// sample_matrix / container_type dropdowns) — same shape/fetch pattern as
// fetchSenaiteDepartments below, just a different portal_type.
export type SenaiteRefOption = { uid: string; title: string }

async function fetchSenaiteRefList(token: string, portalType: string): Promise<SenaiteRefOption[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/${portalType}?limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []).map((d: Record<string, unknown>) => ({
      uid: (d.uid as string) ?? '',
      title: (d.title as string) ?? '',
    })).filter((d: SenaiteRefOption) => d.uid && d.title)
  } catch { return [] }
}

export const fetchSenaiteSampleMatrices = (token: string) => fetchSenaiteRefList(token, 'SampleMatrix')
export const fetchSenaiteContainerTypes = (token: string) => fetchSenaiteRefList(token, 'ContainerType')

// Full Container Type record (uid/title/description) for the standalone admin
// list page — fetchSenaiteRefList only returns uid/title, which is enough for
// dropdown options but not enough to show a description column.
export type SenaiteContainerType = { uid: string; title: string; description: string }

export async function fetchSenaiteContainerTypesFull(token: string): Promise<SenaiteContainerType[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/ContainerType?limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return ((data.items ?? []) as Record<string, unknown>[]).map(d => ({
      uid: (d.uid as string) ?? '',
      title: (d.title as string) ?? '',
      description: (d.description as string) ?? '',
    })).filter(d => d.uid && d.title)
  } catch { return [] }
}
// The v1 API's portal_type is "SamplePreservation", not "Preservation" — the
// latter 404s ("Not Found"), confirmed by direct probing.
export const fetchSenaitePreservations = (token: string) => fetchSenaiteRefList(token, 'SamplePreservation')
export const fetchSenaiteSampleContainers = (token: string) => fetchSenaiteRefList(token, 'SampleContainer')
export const fetchSenaiteSamplePoints = (token: string) => fetchSenaiteRefList(token, 'SamplePoint')

export async function createSenaiteContainerType(
  token: string,
  payload: { title: string; description?: string }
): Promise<{ success: boolean; option?: SenaiteRefOption; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        portal_type: 'ContainerType',
        parent_path: `${SENAITE_SITE_PATH}/setup/containertypes`,
        title: payload.title,
        ...(payload.description ? { description: payload.description } : {}),
      }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    const items = (data.items as Record<string, unknown>[]) ?? []
    if (!items.length) return { success: false, error: 'No container type returned from the lab system.' }
    return { success: true, option: { uid: (items[0].uid as string) ?? '', title: (items[0].title as string) ?? payload.title } }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function updateSenaiteContainerType(
  token: string,
  uid: string,
  payload: { title: string; description?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify([{ uid, title: payload.title, description: payload.description ?? '' }]),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

// Confirmed live at /senaite/setup/{samplecontainers,samplepreservations,samplepoints}
// with portal_type ids SampleContainer / SamplePreservation / SamplePoint.
async function createSenaiteSetupRef(
  token: string,
  portalType: string,
  parentPath: string,
  payload: { title: string; description?: string },
  notFoundLabel: string,
): Promise<{ success: boolean; option?: SenaiteRefOption; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        portal_type: portalType,
        parent_path: parentPath,
        title: payload.title,
        ...(payload.description ? { description: payload.description } : {}),
        // SampleContainer.pre_preserved is required with a cross-field rule
        // ("pre-preserved containers must have a preservation selected") —
        // confirmed live: a quick-create with just title/description fails
        // with "pre_preserved: required field" unless explicitly set. A bare
        // inline-created container isn't pre-preserved by default; anyone
        // needing that flag can set it later via SENAITE's own container edit.
        ...(portalType === 'SampleContainer' ? { pre_preserved: false } : {}),
      }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    const items = (data.items as Record<string, unknown>[]) ?? []
    if (!items.length) return { success: false, error: `No ${notFoundLabel} returned from the lab system.` }
    return { success: true, option: { uid: (items[0].uid as string) ?? '', title: (items[0].title as string) ?? payload.title } }
  } catch (e) { return { success: false, error: String(e) } }
}

export const createSenaiteSampleContainer = (token: string, payload: { title: string; description?: string }) =>
  createSenaiteSetupRef(token, 'SampleContainer', `${SENAITE_SITE_PATH}/setup/samplecontainers`, payload, 'sample container')

export const createSenaiteSamplePreservation = (token: string, payload: { title: string; description?: string }) =>
  createSenaiteSetupRef(token, 'SamplePreservation', `${SENAITE_SITE_PATH}/setup/samplepreservations`, payload, 'preservation')

// ─── Sample Containers — full CRUD (standalone admin page) ───────────────────
// Beyond title/description (the only fields createSenaiteSampleContainer above
// exercises for the inline-create widget), a SampleContainer also carries
// capacity, container_type/preservation references, pre_preserved and
// security_seal_intact. These field shapes were not previously exercised live
// — capacity is sent under both casings the same defensive way MinimumVolume
// is (see updateSenaiteSampleType), and container_type/preservation are sent
// as {uid: ...} objects, mirroring the confirmed Dexterity reference shape
// used for SampleType.sample_matrix/container_type.
export type SampleContainerPayload = {
  title: string
  description?: string
  capacity?: string
  containerTypeUid?: string
  preservationUid?: string
  prePreserved: boolean
  securitySealIntact: boolean
}

export type SenaiteSampleContainer = {
  uid: string
  title: string
  description: string
  capacity: string
  containerTypeUid: string
  containerTypeTitle: string
  preservationUid: string
  preservationTitle: string
  prePreserved: boolean
  securitySealIntact: boolean
}

function sampleContainerApiBody(payload: SampleContainerPayload): Record<string, unknown> {
  return {
    title: payload.title,
    description: payload.description ?? '',
    Capacity: payload.capacity || '0 ml',
    capacity: payload.capacity || '0 ml',
    pre_preserved: payload.prePreserved,
    security_seal_intact: payload.securitySealIntact,
    ...(payload.containerTypeUid ? { container_type: { uid: payload.containerTypeUid } } : {}),
    ...(payload.preservationUid ? { preservation: { uid: payload.preservationUid } } : {}),
  }
}

function mapSenaiteSampleContainer(d: Record<string, unknown>): SenaiteSampleContainer {
  const containerType = parseRef(d.container_type)
  const preservation = parseRef(d.preservation)
  return {
    uid: (d.uid as string) ?? '',
    title: (d.title as string) ?? '',
    description: (d.description as string) ?? '',
    capacity: (d.Capacity as string) ?? (d.capacity as string) ?? '',
    containerTypeUid: containerType.uid,
    containerTypeTitle: containerType.title,
    preservationUid: preservation.uid,
    preservationTitle: preservation.title,
    prePreserved: Boolean(d.pre_preserved ?? false),
    securitySealIntact: Boolean(d.security_seal_intact ?? false),
  }
}

export async function fetchSenaiteSampleContainersFull(token: string): Promise<SenaiteSampleContainer[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/SampleContainer?limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return ((data.items ?? []) as Record<string, unknown>[]).map(mapSenaiteSampleContainer).filter(d => d.uid && d.title)
  } catch { return [] }
}

export async function createSenaiteSampleContainerFull(
  token: string,
  payload: SampleContainerPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        portal_type: 'SampleContainer',
        parent_path: `${SENAITE_SITE_PATH}/setup/samplecontainers`,
        ...sampleContainerApiBody(payload),
      }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function updateSenaiteSampleContainer(
  token: string,
  uid: string,
  payload: SampleContainerPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify([{ uid, ...sampleContainerApiBody(payload) }]),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

export const createSenaiteSamplePoint = (token: string, payload: { title: string; description?: string }) =>
  createSenaiteSetupRef(token, 'SamplePoint', `${SENAITE_SITE_PATH}/setup/samplepoints`, payload, 'sample point')

export async function createSenaiteSampleMatrix(
  token: string,
  payload: { title: string; description?: string }
): Promise<{ success: boolean; option?: SenaiteRefOption; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        portal_type: 'SampleMatrix',
        parent_path: `${SENAITE_SITE_PATH}/setup/samplematrices`,
        title: payload.title,
        ...(payload.description ? { description: payload.description } : {}),
      }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    const items = (data.items as Record<string, unknown>[]) ?? []
    if (!items.length) return { success: false, error: 'No sample matrix returned from the lab system.' }
    return { success: true, option: { uid: (items[0].uid as string) ?? '', title: (items[0].title as string) ?? payload.title } }
  } catch (e) { return { success: false, error: String(e) } }
}

// SampleTemplate — a real SENAITE Dexterity content type (portal_type
// "SampleTemplate", not the deprecated Archetypes "ARTemplate") living at
// /senaite/setup/sampletemplates. Confirmed live via @types/SampleTemplate:
//   title, description, samplepoint (uid array), sampletype (uid array),
//   composite (bool), sampling_required (bool), auto_partition (bool),
//   partitions: [{part_id, container: [uid], preservation: [uid], sampletype: [uid]}],
//   services: [{uid, hidden, part_id}]
// Like SampleType.admitted_sticker_templates, `partitions`/`services` are
// List(value_type=DataGridRow(...)) fields with no restapi deserializer —
// fixed the same way via a custom Zope adapter (see CLAUDE.md 16b/16c).
// v1 API list works for cheap bulk listing (SETUP_CATALOG is indexed there)
// but plone.restapi's own folder listing returns 0 items for this setup
// content (same broken-catalog-search issue as SampleType) — so listing
// uses v1, and all create/update/read-of-partitions-and-services uses
// plone.restapi directly against the object's own URL.
export type SampleTemplatePartition = {
  partId: string
  containerUid: string
  preservationUid: string
  sampleTypeUid: string
}

export type SampleTemplateService = {
  uid: string
  hidden: boolean
  partId: string
}

export type SenaiteSampleTemplate = {
  uid: string
  url: string
  title: string
  description: string
  samplePointUid: string
  sampleTypeUid: string
  composite: boolean
  samplingRequired: boolean
  autoPartition: boolean
  partitions: SampleTemplatePartition[]
  services: SampleTemplateService[]
}

export type SampleTemplatePayload = {
  title: string
  description?: string
  samplePointUid?: string
  sampleTypeUid?: string
  composite?: boolean
  samplingRequired?: boolean
  autoPartition?: boolean
  partitions: SampleTemplatePartition[]
  services: SampleTemplateService[]
}

// Full SampleTemplate body — safe to send in a single POST or PATCH.
// Originally this required a two-step create-then-PATCH split because
// partitions/services failed with "Wrong contained type" on the create POST.
// Root cause (confirmed live 2026-07-14): the custom Zope adapter for
// partitions/services (SampleTemplateDataGridFieldDeserializer, registered on
// the bare `List` class) was shadowing plone.restapi's own more-specific
// CollectionFieldDeserializer for every OTHER List-typed field on
// SampleTemplate too — including `sampletype`/`samplepoint` — because it
// subclassed the wrong base (DefaultFieldDeserializer instead of
// CollectionFieldDeserializer). Fixed at the SENAITE adapter level
// (senaite-rebrand/sampletemplate_datagrid_deserializer.py) — the adapter now
// subclasses CollectionFieldDeserializer, so it only special-cases
// partitions/services and correctly falls through to plone.restapi's real
// per-item deserialization for every other field. Verified: title,
// sampletype, partitions, and services now all persist correctly together in
// a single create POST. See CLAUDE.md §16b/16c.
function sampleTemplateRestBody(payload: SampleTemplatePayload): Record<string, unknown> {
  return {
    title: payload.title,
    description: payload.description ?? '',
    samplepoint: payload.samplePointUid ? [payload.samplePointUid] : [],
    sampletype: payload.sampleTypeUid ? [payload.sampleTypeUid] : [],
    composite: payload.composite ?? false,
    sampling_required: payload.samplingRequired ?? false,
    auto_partition: payload.autoPartition ?? false,
    partitions: payload.partitions.map(p => ({
      part_id: p.partId || 'part-1',
      container: p.containerUid ? [p.containerUid] : [],
      preservation: p.preservationUid ? [p.preservationUid] : [],
      sampletype: p.sampleTypeUid ? [p.sampleTypeUid] : [],
    })),
    services: payload.services.map(s => ({ uid: s.uid, hidden: s.hidden, part_id: s.partId })),
  }
}

function first(value: unknown): string {
  if (Array.isArray(value)) return (value[0] as string) ?? ''
  return (value as string) ?? ''
}

function mapSenaiteSampleTemplate(t: Record<string, unknown>): SenaiteSampleTemplate {
  const partitions = ((t.partitions as Record<string, unknown>[]) ?? []).map(p => ({
    partId: (p.part_id as string) ?? '',
    containerUid: first(p.container),
    preservationUid: first(p.preservation),
    sampleTypeUid: first(p.sampletype),
  }))
  const services = ((t.services as Record<string, unknown>[]) ?? []).map(s => ({
    uid: (s.uid as string) ?? '',
    hidden: Boolean(s.hidden),
    partId: (s.part_id as string) ?? '',
  }))
  return {
    uid: (t.UID as string) ?? (t.uid as string) ?? '',
    url: (t.url as string) ?? (t['@id'] as string) ?? '',
    title: (t.title as string) ?? '',
    description: (t.description as string) ?? '',
    samplePointUid: first(t.samplepoint),
    sampleTypeUid: first(t.sampletype),
    composite: Boolean(t.composite),
    samplingRequired: Boolean(t.sampling_required),
    autoPartition: Boolean(t.auto_partition),
    partitions,
    services,
  }
}

export async function fetchSenaiteSampleTemplates(token: string): Promise<SenaiteSampleTemplate[]> {
  try {
    // v1 list gives us the url/uid cheaply (SETUP_CATALOG-indexed); plone.restapi's
    // folder listing returns 0 items here, same broken-catalog-search issue as
    // SampleType, so we can't use it for bulk listing.
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/SampleTemplate?limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    const stubs = (data.items ?? []) as Record<string, unknown>[]
    // v1's own item shape lacks partitions/services (both come back null there),
    // so fetch full detail per-object via restapi, same pattern as sample types.
    const details = await Promise.all(stubs.map(async (stub) => {
      const url = stub.url as string
      const detailRes = await fetch(url, {
        headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      }).catch(() => null)
      if (!detailRes || !detailRes.ok) return mapSenaiteSampleTemplate(stub)
      const detail = await detailRes.json().catch(() => stub)
      return mapSenaiteSampleTemplate(detail)
    }))
    return details
  } catch { return [] }
}

export async function createSenaiteSampleTemplate(
  token: string,
  payload: SampleTemplatePayload
): Promise<{ success: boolean; sampleTemplate?: SenaiteSampleTemplate; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/setup/sampletemplates`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json',
      },
      body: JSON.stringify({ '@type': 'SampleTemplate', ...sampleTemplateRestBody(payload) }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    return { success: true, sampleTemplate: mapSenaiteSampleTemplate(data) }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function updateSenaiteSampleTemplate(
  token: string,
  url: string,
  payload: SampleTemplatePayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json',
      },
      body: JSON.stringify(sampleTemplateRestBody(payload)),
      cache: 'no-store',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function deleteSenaiteSampleTemplate(token: string, url: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

export type SampleTypePayload = {
  title: string
  Prefix: string
  MinimumVolume?: string
  description?: string
  retentionPeriod?: RetentionPeriod
  hazardous?: boolean
  sampleMatrixUid?: string
  containerTypeUid?: string
  stickerTemplates?: AdmittedStickerTemplates
}

function sampleTypeApiBody(payload: SampleTypePayload): Record<string, unknown> {
  return {
    title: payload.title,
    Prefix: payload.Prefix,
    // Sent under both casings — mapSenaiteSampleType's read side already falls
    // back MinimumVolume -> min_volume, confirming SENAITE's real field name
    // is inconsistent/uncertain here; sending both avoids a silent write-miss.
    MinimumVolume: payload.MinimumVolume || '1 ml',
    min_volume: payload.MinimumVolume || '1 ml',
    description: payload.description ?? '',
    hazardous: payload.hazardous ?? false,
    // Dexterity reference fields require the {uid: ...} shape, not a bare
    // string — confirmed by the same probing noted in createSenaiteAnalysisCategory.
    ...(payload.sampleMatrixUid ? { sample_matrix: { uid: payload.sampleMatrixUid } } : {}),
    ...(payload.containerTypeUid ? { container_type: { uid: payload.containerTypeUid } } : {}),
    // retention_period and admitted_sticker_templates are deliberately NOT sent
    // here — the legacy @@API/senaite/v1 create/update endpoints silently drop
    // both (no adapter for DurationField/DataGridField on this path). They're
    // patched separately via plone.restapi in patchSampleTypeExtras() below,
    // which does have a working deserializer (retention_period natively, and
    // admitted_sticker_templates via our custom adapter).
  }
}

// Patches retention_period + admitted_sticker_templates via plone.restapi —
// the only API path that persists retention_period at all (see
// sampleTypeApiBody above). These used to be sent in ONE bundled PATCH; if
// either field failed validation, the WHOLE request 400'd and neither field
// saved — confirmed live: retention_period alone always succeeds, but
// admitted_sticker_templates (a DataGridField) is rejected by plone.restapi's
// deserializer with "Object is of wrong type" for ANY non-empty row content,
// regardless of payload shape tried (only a bare empty list is accepted) —
// this looks like a genuine plone.restapi/DataGridField incompatibility in
// this SENAITE version, not a fixable payload-formatting mistake. Splitting
// into two independent calls so retention_period reliably saves even though
// sticker templates structurally cannot be set through this API.
async function patchSampleTypeExtras(
  token: string, url: string, payload: SampleTypePayload
): Promise<{ success: boolean; error?: string }> {
  if (!url) return { success: false, error: 'Could not resolve sample type URL for retention/sticker update' }
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }

  try {
    const retentionRes = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        retention_period: retentionPeriodToSeconds(payload.retentionPeriod ?? { days: 0, hours: 0, minutes: 0 }),
      }),
    })
    if (!retentionRes.ok) {
      return { success: false, error: `Retention period update failed (HTTP ${retentionRes.status})` }
    }

    const wantsStickers = (payload.stickerTemplates?.admitted?.length ?? 0) > 0
      || payload.stickerTemplates?.smallDefault
      || payload.stickerTemplates?.largeDefault
    if (!wantsStickers) return { success: true }

    const stickerRes = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        admitted_sticker_templates: [{
          admitted: payload.stickerTemplates?.admitted ?? [],
          small_default: payload.stickerTemplates?.smallDefault || null,
          large_default: payload.stickerTemplates?.largeDefault || null,
        }],
      }),
    })
    if (!stickerRes.ok) {
      return {
        success: false,
        error: 'Sticker templates could not be saved via the API — set them directly in SENAITE\'s Sample Types page (retention period was saved).',
      }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: `Retention/sticker update failed: ${String(e)}` }
  }
}

export async function createSenaiteSampleType(
  token: string,
  payload: SampleTypePayload
): Promise<{ success: boolean; sampleType?: SenaiteSampleType; error?: string; warning?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        portal_type: 'SampleType',
        parent_path: `${SENAITE_SITE_PATH}/setup/sampletypes`,
        ...sampleTypeApiBody(payload),
      }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    // SENAITE's JSON API returns HTTP 200 even on failure (e.g. bad credentials,
    // permission denied) — the real outcome is the body's own `success` flag.
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    const items = (data.items as Record<string, unknown>[]) ?? []
    if (!items.length) return { success: false, error: 'No sample type returned from SENAITE' }
    const created = items[0]
    const extras = await patchSampleTypeExtras(token, (created.url as string) ?? '', payload)
    return {
      success: true,
      warning: extras.success ? undefined : extras.error,
      sampleType: {
        ...mapSenaiteSampleType(created),
        RetentionPeriod: payload.retentionPeriod ?? { days: 0, hours: 0, minutes: 0 },
        AdmittedStickerTemplates: payload.stickerTemplates ?? { admitted: [], smallDefault: '', largeDefault: '' },
      },
    }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function updateSenaiteSampleType(
  token: string,
  uid: string,
  payload: SampleTypePayload
): Promise<{ success: boolean; error?: string; warning?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify([{ uid, ...sampleTypeApiBody(payload) }]),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    // Update path only has the UID, not the object's URL — look it up so we
    // can patch retention_period/admitted_sticker_templates via restapi
    // (same limitation as create, see sampleTypeApiBody).
    const lookup = await fetch(`${SENAITE_URL}/@@API/senaite/v1/SampleType?UID=${encodeURIComponent(uid)}&complete=true`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    const lookupData = await lookup.json().catch(() => ({})) as Record<string, unknown>
    const url = ((lookupData.items as Record<string, unknown>[]) ?? [])[0]?.url as string | undefined
    const extras = await patchSampleTypeExtras(token, url ?? '', payload)
    return { success: true, warning: extras.success ? undefined : extras.error }
  } catch (e) { return { success: false, error: String(e) } }
}

// ─── Instruments & Storage Locations (read-only master data lists) ────────────

export type SenaiteInstrument = {
  uid: string
  id: string
  title: string
  InstrumentType: string
  Manufacturer: string
  Supplier: string
  Model: string
  SerialNo: string
  AssetNumber: string
  Location: string
  review_state: string
}

// Reference-data lookup maps (InstrumentType/Manufacturer/Supplier) change rarely —
// cache them briefly in-process so every Instrument List page load doesn't re-fetch
// all three full catalogs on top of the instrument list itself.
const TITLE_MAP_TTL_MS = 5 * 60 * 1000
const titleMapCache = new Map<string, { expires: number; map: Record<string, string> }>()

async function fetchSenaiteTitleMap(token: string, portalType: string): Promise<Record<string, string>> {
  const cached = titleMapCache.get(portalType)
  if (cached && cached.expires > Date.now()) return cached.map
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/${portalType}?complete=true&limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return cached?.map ?? {}
    const data = await res.json()
    const map: Record<string, string> = {}
    for (const item of data.items ?? []) {
      if (item.uid) map[item.uid] = item.title ?? ''
    }
    titleMapCache.set(portalType, { expires: Date.now() + TITLE_MAP_TTL_MS, map })
    return map
  } catch { return cached?.map ?? {} }
}

export async function fetchSenaiteInstruments(token: string): Promise<SenaiteInstrument[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Instrument?complete=true&limit=1000&review_state=active`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    const items = (data.items ?? []) as Record<string, unknown>[]

    // InstrumentType/Manufacturer/Supplier/Location come back as {uid, url, api_url} refs, not titles.
    const [typeMap, manufacturerMap, supplierMap, locationMap] = await Promise.all([
      fetchSenaiteTitleMap(token, 'InstrumentType'),
      fetchSenaiteTitleMap(token, 'Manufacturer'),
      fetchSenaiteTitleMap(token, 'Supplier'),
      fetchSenaiteTitleMap(token, 'StorageLocation'),
    ])

    const refTitle = (ref: unknown, map: Record<string, string>) => {
      const uid = (ref as { uid?: string } | null)?.uid
      return uid ? (map[uid] ?? '') : ''
    }

    return items.map(t => ({
      uid:            (t.uid as string) ?? '',
      id:             (t.id as string) ?? '',
      title:          (t.title as string) ?? '',
      InstrumentType: refTitle(t.InstrumentType, typeMap),
      Manufacturer:   refTitle(t.Manufacturer, manufacturerMap),
      Supplier:       refTitle(t.Supplier, supplierMap),
      Model:          (t.Model as string) ?? '',
      SerialNo:       (t.SerialNo as string) ?? '',
      AssetNumber:    (t.AssetNumber as string) ?? '',
      Location:       refTitle(t.Location, locationMap),
      review_state:   (t.review_state as string) ?? '',
    }))
  } catch { return [] }
}

export type SenaiteStorageLocation = {
  uid: string
  id: string
  title: string
  description: string
  review_state: string
}

export async function fetchSenaiteStorageLocations(token: string): Promise<SenaiteStorageLocation[]> {
  try {
    // No `complete=true` here: title/description/review_state/id/uid are all standard
    // catalog brain metadata, so this stays a cheap catalog query instead of resolving
    // (waking up) all objects, which is what was hanging this page. Single request,
    // limit=1000 — SENAITE's jsonapi ignores an unsupported `page` param and just
    // re-returns page 1, so looping on `page` silently duplicated results instead
    // of paging forward; keep this as one bounded request.
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/StorageLocation?limit=1000&review_state=active`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []).map((t: Record<string, unknown>) => ({
      uid:          (t.uid as string) ?? '',
      id:           (t.id as string) ?? '',
      title:        (t.title as string) ?? '',
      description:  (t.description as string) ?? '',
      review_state: (t.review_state as string) ?? '',
    }))
  } catch { return [] }
}

// ─── Analysis Services ────────────────────────────────────────────────────────

export type SenaiteAnalysisService = {
  uid: string
  id: string
  title: string
  Keyword: string
  Category: string
  Price: string
  Unit: string
}

export async function fetchSenaiteAnalysisServices(token: string): Promise<SenaiteAnalysisService[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/AnalysisService?complete=true&limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    const all = (data.items ?? []).map((s: Record<string, unknown>) => ({
      uid:      (s.uid as string) ?? '',
      id:       (s.id as string) ?? '',
      title:    (s.title as string) ?? '',
      Keyword:  (s.Keyword as string) ?? '',
      Category: typeof s.Category === 'object' && s.Category !== null ? ((s.Category as Record<string, unknown>).title as string) ?? '' : (s.Category as string) ?? '',
      Price:    (s.Price as string) ?? '',
      Unit:     (s.Unit as string) ?? '',
    }))
    // SENAITE's headless create API for this content type intermittently produces
    // untitled orphan objects, and its delete endpoint doesn't reliably remove them
    // either — so filter blanks and dedupe by title here rather than depending on a
    // clean SENAITE dataset. Keeps the first (oldest) UID per title.
    const seen = new Set<string>()
    const cleaned: typeof all = []
    for (const svc of all) {
      const key = svc.title.trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      cleaned.push(svc)
    }
    return cleaned
  } catch { return [] }
}

// ─── Departments & Analysis Categories ───────────────────────────────────────

export type SenaiteDepartment = {
  uid: string
  title: string
}

export async function fetchSenaiteDepartments(token: string): Promise<SenaiteDepartment[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Department?limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []).map((d: Record<string, unknown>) => ({
      uid:   (d.uid as string) ?? '',
      title: (d.title as string) ?? '',
    })).filter((d: SenaiteDepartment) => d.uid && d.title)
  } catch { return [] }
}

export type SenaiteLabContact = {
  uid: string
  title: string
}

export async function fetchSenaiteLabContacts(token: string): Promise<SenaiteLabContact[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/LabContact?complete=true&limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []).map((c: Record<string, unknown>) => ({
      uid:   (c.uid as string) ?? '',
      title: (c.title as string) ?? (c.getFullname as string) ?? '',
    })).filter((c: SenaiteLabContact) => c.uid && c.title)
  } catch { return [] }
}

/**
 * Create a LabContact — the minimal set (Firstname/Surname) is all this build
 * requires (confirmed by direct API probing, 2026-07-13). Needed as the
 * `manager` reference before a Department can be created (see below).
 */
export async function createSenaiteLabContact(
  token: string,
  payload: { firstName: string; lastName: string }
): Promise<{ success: boolean; uid?: string; title?: string; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        portal_type: 'LabContact',
        parent_path: `${SENAITE_SITE_PATH}/bika_setup/bika_labcontacts`,
        Firstname: payload.firstName,
        Surname: payload.lastName,
      }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    const items = (data.items as Record<string, unknown>[]) ?? []
    if (!items.length) return { success: false, error: 'No contact returned from the lab system.' }
    return { success: true, uid: (items[0].uid as string) ?? '', title: (items[0].title as string) ?? '' }
  } catch (e) { return { success: false, error: String(e) } }
}

/**
 * Create a Department. Confirmed by direct API probing (2026-07-13):
 * `department_id` (plain string) and `manager` are both required at creation
 * time; `manager` must be a reference object `{"uid": "..."}` — a bare UID
 * string is rejected with `{"manager": ""}`, same pattern as
 * AnalysisCategory.department below.
 */
export async function createSenaiteDepartment(
  token: string,
  payload: { title: string; departmentId: string; managerUid: string }
): Promise<{ success: boolean; uid?: string; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        portal_type: 'Department',
        parent_path: `${SENAITE_SITE_PATH}/setup/departments`,
        title: payload.title,
        department_id: payload.departmentId,
        manager: { uid: payload.managerUid },
      }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    const items = (data.items as Record<string, unknown>[]) ?? []
    if (!items.length) return { success: false, error: 'No department returned from the lab system.' }
    return { success: true, uid: (items[0].uid as string) ?? '' }
  } catch (e) { return { success: false, error: String(e) } }
}

export type SenaiteAnalysisCategory = {
  uid: string
  id: string
  title: string
}

export async function fetchSenaiteAnalysisCategories(token: string): Promise<SenaiteAnalysisCategory[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/AnalysisCategory?limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []).map((c: Record<string, unknown>) => ({
      uid:   (c.uid as string) ?? '',
      id:    (c.id as string) ?? '',
      title: (c.title as string) ?? '',
    })).filter((c: SenaiteAnalysisCategory) => c.uid && c.title)
  } catch { return [] }
}

export async function createSenaiteAnalysisCategory(
  token: string,
  payload: { title: string; departmentUid: string }
): Promise<{ success: boolean; uid?: string; error?: string }> {
  try {
    // `department` is a required Dexterity reference field and must be passed as
    // an object `{uid: ...}` — a bare UID string or a list is rejected (confirmed
    // by direct API probing on this 2.6.0 build).
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        portal_type: 'AnalysisCategory',
        parent_path: `${SENAITE_SITE_PATH}/setup/analysiscategories`,
        title: payload.title,
        department: { uid: payload.departmentUid },
      }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    const items = (data.items as Record<string, unknown>[]) ?? []
    if (!items.length) return { success: false, error: (data.message as string) ?? 'No category returned from the lab system.' }
    return { success: true, uid: (items[0].uid as string) ?? '' }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function createSenaiteAnalysisService(
  token: string,
  payload: { title: string; Keyword: string; CategoryUid: string; Unit?: string; Price?: string }
): Promise<{ success: boolean; service?: SenaiteAnalysisService; error?: string }> {
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }
  try {
    // AnalysisService is a legacy Archetypes content type on this 2.6.0 build: the
    // jsonapi create endpoint creates the object WITH all fields correctly set, but
    // then errors while rendering the response ("'NoneType' object has no attribute
    // 'form'") and returns success:false — confirmed by direct probing. So the
    // response body cannot be trusted; verify by re-fetching the service by title.
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        portal_type: 'AnalysisService',
        parent_path: `${SENAITE_SITE_PATH}/bika_setup/bika_analysisservices`,
        title: payload.title,
        Keyword: payload.Keyword,
        Category: payload.CategoryUid,
        ...(payload.Unit ? { Unit: payload.Unit } : {}),
        ...(payload.Price ? { Price: payload.Price } : {}),
      }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    const items = (data.items as Record<string, unknown>[]) ?? []
    if (items.length > 0) {
      const s = items[0]
      return {
        success: true,
        service: {
          uid: (s.uid as string) ?? '', id: (s.id as string) ?? '', title: (s.title as string) ?? '',
          Keyword: (s.Keyword as string) ?? '', Category: '', Price: (s.Price as string) ?? '', Unit: (s.Unit as string) ?? '',
        },
      }
    }

    // Bogus-error path: verify whether the service actually got created.
    const verify = await fetch(`${SENAITE_URL}/@@API/senaite/v1/AnalysisService?complete=true&limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (verify.ok) {
      const vData = await verify.json().catch(() => ({})) as Record<string, unknown>
      const vItems = (vData.items as Record<string, unknown>[]) ?? []
      const match = vItems.find(s =>
        ((s.title as string) ?? '').trim().toLowerCase() === payload.title.trim().toLowerCase() &&
        (s.Keyword as string) === payload.Keyword
      )
      if (match) {
        return {
          success: true,
          service: {
            uid: (match.uid as string) ?? '', id: (match.id as string) ?? '', title: (match.title as string) ?? '',
            Keyword: (match.Keyword as string) ?? '', Category: '', Price: (match.Price as string) ?? '', Unit: (match.Unit as string) ?? '',
          },
        }
      }
    }
    return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
  } catch (e) { return { success: false, error: String(e) } }
}

// ─── Samples (AnalysisRequests) ───────────────────────────────────────────────

export type SenaiteSample = {
  uid: string
  id: string
  title: string
  ClientTitle: string
  ClientID: string
  ClientUID: string
  SampleTypeTitle: string
  SampleTypeUID: string
  DateReceived: string | null
  DateSampled: string | null
  DateDue: string | null
  review_state: string
  Priority: string
  ClientSampleID: string
  BatchUID: string
  Analyses: { uid: string; title: string; Keyword: string; review_state: string }[]
  url: string
}

function mapSample(s: Record<string, unknown>): SenaiteSample {
  const client = (s.Client as Record<string, unknown>) ?? {}
  const sampleType = (s.SampleType as Record<string, unknown>) ?? {}
  const batch = (s.Batch as Record<string, unknown>) ?? {}
  return {
    uid:             (s.uid as string) ?? '',
    id:              (s.id as string) ?? '',
    title:           (s.title as string) ?? '',
    ClientTitle:     (client.title as string) ?? (s.ClientTitle as string) ?? '',
    ClientID:        (client.ClientID as string) ?? (s.ClientID as string) ?? '',
    ClientUID:       (client.uid as string) ?? '',
    SampleTypeTitle: (sampleType.title as string) ?? (s.SampleTypeTitle as string) ?? '',
    SampleTypeUID:   (sampleType.uid as string) ?? '',
    DateReceived:    (s.DateReceived as string) ?? null,
    DateSampled:     (s.DateSampled as string) ?? null,
    DateDue:         (s.DateDue as string) ?? null,
    review_state:    (s.review_state as string) ?? '',
    Priority:        (s.Priority as string) ?? '3',
    ClientSampleID:  (s.ClientSampleID as string) ?? '',
    BatchUID:        (batch.uid as string) ?? '',
    Analyses:        Array.isArray(s.Analyses)
      ? (s.Analyses as Record<string, unknown>[]).map(a => ({
          uid:          (a.uid as string) ?? '',
          title:        (a.title as string) ?? '',
          Keyword:      (a.Keyword as string) ?? '',
          review_state: (a.review_state as string) ?? '',
        }))
      : [],
    url: (s.url as string) ?? '',
  }
}

export async function fetchSenaiteSamples(token: string, params: Record<string, string> = {}): Promise<SenaiteSample[]> {
  const qs = new URLSearchParams({ complete: 'true', limit: '100', ...params }).toString()
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/AnalysisRequest?${qs}`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []).map(mapSample)
  } catch { return [] }
}

export async function fetchSenaiteSample(token: string, uid: string): Promise<SenaiteSample | null> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/AnalysisRequest/${uid}?complete=true`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    const items = data.items ?? []
    return items.length > 0 ? mapSample(items[0]) : null
  } catch { return null }
}

export async function createSenaiteSample(
  token: string,
  payload: {
    Client: string        // client UID — used to look up parent_path
    Contact?: string      // contact UID (optional)
    SampleType: string    // sample type UID
    DateSampled: string   // ISO date string
    Analyses?: string[]   // analysis service UIDs
    Priority?: string     // "1"-"5"
    ClientSampleID?: string
    Batch?: string         // Batch UID — groups this sample under a Batch (optional)
  }
): Promise<{ success: boolean; sample?: SenaiteSample; error?: string }> {
  const headers = {
    Authorization: `Basic ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  try {
    // Step 1: resolve the client's path (SENAITE needs parent_path, not Client UID)
    const clientRes = await fetch(`${SENAITE_URL}/@@API/senaite/v1/client?UID=${encodeURIComponent(payload.Client)}&complete=true`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!clientRes.ok) return { success: false, error: `Client not found in SENAITE (${clientRes.status})` }
    const clientData = await clientRes.json().catch(() => ({})) as Record<string, unknown>
    const clientItems = (clientData.items as Record<string, unknown>[]) ?? []
    const clientPath = (clientItems[0]?.path as string) ?? ''
    if (!clientPath) return { success: false, error: 'Could not determine client path in SENAITE' }

    // Step 2: create the AnalysisRequest under the client
    const body: Record<string, unknown> = {
      portal_type: 'AnalysisRequest',
      parent_path: clientPath,
      SampleType: payload.SampleType,
      DateSampled: payload.DateSampled,
      Priority: payload.Priority ?? '3',
    }
    if (payload.Analyses?.length)    body.Analyses       = payload.Analyses
    if (payload.ClientSampleID)      body.ClientSampleID = payload.ClientSampleID
    if (payload.Contact)             body.Contact        = payload.Contact
    if (payload.Batch)               body.Batch          = payload.Batch

    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    // SENAITE's JSON API returns HTTP 200 even on failure (e.g. bad credentials,
    // permission denied) — the real outcome is the body's own `success` flag.
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    const items = (data.items as Record<string, unknown>[]) ?? []
    if (items.length === 0) {
      return { success: false, error: (data.message as string) ?? 'No sample returned from SENAITE' }
    }
    return { success: true, sample: mapSample(items[0]) }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/** Push field updates to an existing SENAITE sample (AnalysisRequest) via v1/update.
 *
 * Two confirmed quirks of this 2.6.0 build (2026-07-10, by direct probing):
 * - the body must be a single OBJECT `{uid, ...fields}` — a list `[{...}]` fails
 *   with "'list' object has no attribute 'update'";
 * - the update is APPLIED even when the response says success:false (e.g.
 *   `{"Contact": "Contact is required"}`) — so verify by re-fetching the field
 *   instead of trusting the response body. */
export async function updateSenaiteSample(
  token: string,
  uid: string,
  fields: { DateSampled?: string; SampleType?: string; ClientSampleID?: string }
): Promise<{ success: boolean; error?: string }> {
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ uid, ...fields }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (res.ok && data.success !== false) return { success: true }

    // Bogus-error path: check whether the update actually landed.
    const verify = await fetch(`${SENAITE_URL}/@@API/senaite/v1/AnalysisRequest/${uid}?complete=true`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (verify.ok) {
      const vData = await verify.json().catch(() => ({})) as Record<string, unknown>
      const item = ((vData.items as Record<string, unknown>[]) ?? [])[0]
      if (item) {
        const applied = Object.entries(fields).every(([k, v]) => {
          const got = item[k]
          if (k === 'SampleType') return (got as { uid?: string } | null)?.uid === v
          if (k === 'DateSampled') return typeof got === 'string' && typeof v === 'string' && got.slice(0, 10) === v.slice(0, 10)
          return got === v
        })
        if (applied) return { success: true }
      }
    }
    return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
  } catch (e) { return { success: false, error: String(e) } }
}

// This SENAITE 2.6 instance has no `/workflow_action` REST route (senaite.jsonapi only
// registers create/update/delete — confirmed by reading its routes/content.py). Calling
// that URL always returns HTTP 200 with an error message embedded in the JSON body, which
// looks like success to a caller that only checks res.ok. The real way to trigger a
// workflow transition is the classic Zope/Plone `content_status_modify` view on the
// object's own path, POSTed as a form field (not JSON). Since that view renders an HTML
// page rather than returning a structured result, success is confirmed by re-fetching the
// object and checking its review_state actually changed.
async function _resolvePath(token: string, resource: string, uid: string): Promise<string | null> {
  const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/${resource}/${uid}?complete=true`, {
    headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = await res.json().catch(() => ({})) as Record<string, unknown>
  const items = (data.items as Record<string, unknown>[]) ?? []
  return (items[0]?.path as string) ?? null
}

async function _contentStatusModify(
  token: string,
  path: string,
  workflowAction: string
): Promise<boolean> {
  const res = await fetch(`${SENAITE_URL}${path}/content_status_modify`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ workflow_action: workflowAction }).toString(),
    cache: 'no-store',
  })
  return res.ok
}

export async function senaiteWorkflowAction(
  token: string,
  uid: string,
  action: 'receive' | 'verify' | 'publish' | 'retract' | 'cancel'
): Promise<{ success: boolean; error?: string }> {
  try {
    const before = await fetch(`${SENAITE_URL}/@@API/senaite/v1/AnalysisRequest/${uid}?complete=true`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    const beforeData = await before.json().catch(() => ({})) as Record<string, unknown>
    const beforeItems = (beforeData.items as Record<string, unknown>[]) ?? []
    const path = beforeItems[0]?.path as string | undefined
    const stateBefore = beforeItems[0]?.review_state as string | undefined
    if (!path) return { success: false, error: 'Sample not found in SENAITE.' }

    const ok = await _contentStatusModify(token, path, action)
    if (!ok) return { success: false, error: 'Failed to trigger workflow transition.' }

    const after = await fetch(`${SENAITE_URL}/@@API/senaite/v1/AnalysisRequest/${uid}?complete=true`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    const afterData = await after.json().catch(() => ({})) as Record<string, unknown>
    const afterItems = (afterData.items as Record<string, unknown>[]) ?? []
    const stateAfter = afterItems[0]?.review_state as string | undefined

    if (stateAfter && stateAfter !== stateBefore) return { success: true }

    // State didn't change — determine a helpful reason
    const currentState = stateAfter ?? stateBefore
    const alreadyDoneStates: Record<string, string> = {
      sample_received: 'This sample has already been received.',
      verified:        'This sample has already been verified.',
      published:       'This sample has already been published.',
      cancelled:       'This sample has already been cancelled.',
      rejected:        'This sample has already been rejected.',
    }
    const alreadyMsg = currentState ? alreadyDoneStates[currentState] : undefined
    return {
      success: false,
      error: alreadyMsg ?? `Action not allowed in the current state ("${currentState}"). A different user may need to perform this step.`,
    }
  } catch (e) { return { success: false, error: String(e) } }
}


export function mapSenaiteState(review_state: string): string {
  const MAP: Record<string, string> = {
    registered:      'Registered',
    sample_due:      'Sample Due',
    sample_received: 'Received',
    to_be_verified:  'To Be Verified',
    verified:        'Verified',
    published:       'Published',
    invalid:         'Invalid',
    cancelled:       'Cancelled',
    rejected:        'Rejected',
  }
  return MAP[review_state] ?? review_state
}

export function mapSenaitePriority(priority: string): string {
  const MAP: Record<string, string> = {
    '1': 'Critical', '2': 'High', '3': 'Normal', '4': 'Low', '5': 'Routine',
  }
  return MAP[priority] ?? 'Normal'
}

/** Create a client in SENAITE */
export async function createSenaiteClient(
  token: string,
  data: { title: string; ClientID: string; EmailAddress?: string; Phone?: string }
): Promise<{ success: boolean; client?: SenaiteClient; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/clients`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ '@type': 'Client', ...data }),
      cache: 'no-store',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { success: false, error: (err as Record<string, string>).message ?? `HTTP ${res.status}` }
    }
    const client = await res.json()
    return {
      success: true,
      client: {
        uid: client.uid,
        id: client.id,
        title: client.title,
        ClientID: client.ClientID ?? '',
        EmailAddress: client.EmailAddress ?? '',
        Phone: client.Phone ?? '',
        url: client['@id'],
      },
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ─── Worksheets ───────────────────────────────────────────────────────────────

export type SenaiteWorksheet = {
  uid: string
  id: string
  title: string
  Analyst: string
  AnalystTitle: string
  review_state: string
  created: string
  analyses_count: number
}

export type SenaiteAnalysis = {
  uid: string
  id: string
  title: string
  Keyword: string
  Result: string | null
  Unit: string
  review_state: string
  SampleID: string
  ClientTitle: string
  CategoryTitle: string
  WorksheetUID: string | null
}

export async function fetchSenaiteWorksheets(token: string): Promise<SenaiteWorksheet[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Worksheet?complete=true&limit=100`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []).map((w: Record<string, unknown>) => {
      const analyst = (w.Analyst as Record<string, unknown>) ?? {}
      return {
        uid:            (w.uid as string) ?? '',
        id:             (w.id as string) ?? '',
        title:          (w.title as string) ?? '',
        Analyst:        (analyst.uid as string) ?? (w.Analyst as string) ?? '',
        AnalystTitle:   (analyst.fullname as string) ?? (w.AnalystTitle as string) ?? '',
        review_state:   (w.review_state as string) ?? '',
        created:        (w.created as string) ?? '',
        analyses_count: Array.isArray(w.Analyses) ? (w.Analyses as unknown[]).length : 0,
      }
    })
  } catch { return [] }
}

export async function createSenaiteWorksheet(
  token: string,
  analysisUids: string[] = [],
): Promise<{ success: boolean; uid?: string; id?: string; error?: string }> {
  try {
    // The Plone REST API (/worksheets, @type: Worksheet) 500s when serializing the
    // response for this content type ("No converter for making <Analysis> JSON
    // compatible") — a plone.restapi limitation with SENAITE's custom Analysis
    // reference fields, confirmed by direct testing. senaite.jsonapi's v1 create
    // endpoint (used everywhere else in this file) works correctly for Worksheet.
    // Analyses is required by SENAITE at creation time (returns 400 without it).
    // After creation, assignAnalysesToWorksheet is called separately to ensure the
    // getWorksheetUID catalog index is updated so fetchWorksheetAnalyses can find them.
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        portal_type: 'Worksheet',
        parent_path: `${SENAITE_SITE_PATH}/worksheets`,
        Analyses: analysisUids.map(uid => ({ uid })),
      }),
      cache: 'no-store',
    })
    const rawText = await res.text()
    let data: Record<string, unknown> = {}
    try { data = JSON.parse(rawText) } catch { /* non-JSON */ }

    if (!res.ok || data.success === false) {
      const msg = (data.message as string) ?? (data.error as string) ?? rawText ?? `HTTP ${res.status}`
      return { success: false, error: msg }
    }
    const items = (data.items as Record<string, unknown>[]) ?? []
    if (items.length === 0) {
      return { success: false, error: (data.message as string) ?? rawText ?? 'No worksheet returned from SENAITE.' }
    }
    const uid = (items[0].uid as string) ?? (items[0].UID as string) ?? ''
    const id  = (items[0].id  as string) ?? ''
    return { success: true, uid, id }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function fetchUnassignedAnalyses(token: string): Promise<SenaiteAnalysis[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Analysis?review_state=unassigned&complete=true&limit=200`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []).map((a: Record<string, unknown>) => mapAnalysis(a))
  } catch { return [] }
}

export async function fetchWorksheetAnalyses(token: string, worksheetUid: string): Promise<SenaiteAnalysis[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Analysis?getWorksheetUID=${worksheetUid}&complete=true&limit=200`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []).map((a: Record<string, unknown>) => mapAnalysis(a))
  } catch { return [] }
}

function mapAnalysis(a: Record<string, unknown>): SenaiteAnalysis {
  const sample = (a.SampleID ?? a.RequestID ?? '') as string
  const ws = a.Worksheet as Record<string, unknown> | null
  return {
    uid:           (a.uid as string) ?? '',
    id:            (a.id as string) ?? '',
    title:         (a.title as string) ?? '',
    Keyword:       (a.Keyword as string) ?? '',
    Result:        a.Result !== undefined && a.Result !== null ? String(a.Result) : null,
    Unit:          (a.Unit as string) ?? '',
    review_state:  (a.review_state as string) ?? '',
    SampleID:      sample,
    ClientTitle:   (a.ClientTitle as string) ?? '',
    CategoryTitle: (a.CategoryTitle as string) ?? (a.Category as string) ?? '',
    WorksheetUID:  ws ? (ws.uid as string) ?? null : null,
  }
}

export async function assignAnalysesToWorksheet(
  token: string,
  worksheetUid: string,
  analysisUids: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify([{ uid: worksheetUid, Analyses: analysisUids.map(uid => ({ uid })) }]),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function submitAnalysisResult(
  token: string,
  analysisUid: string,
  result: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Pre-existing bug found while building Batch results entry: the bulk
    // /update endpoint with a LIST body `[{uid, Result}]` always fails with
    // "'list' object has no attribute 'update'" (confirmed via direct
    // testing) — never actually set a Result, ever. The `/update/<uid>` form
    // (uid in the URL, plain object body) is the one proven working pattern
    // already used everywhere else in this file (Client, Batch, etc).
    const updateRes = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update/${analysisUid}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ Result: result }),
      cache: 'no-store',
    })
    const updateData = await updateRes.json().catch(() => ({})) as Record<string, unknown>
    if (!updateRes.ok || updateData.success === false) {
      return { success: false, error: (updateData.message as string) ?? `Update failed: HTTP ${updateRes.status}` }
    }

    // See senaiteWorkflowAction for why content_status_modify is used instead of
    // the nonexistent `/workflow_action` REST route.
    const path = await _resolvePath(token, 'Analysis', analysisUid)
    if (!path) return { success: false, error: 'Analysis not found in SENAITE after update.' }

    // content_status_modify is a classic Zope form view — it redirects (which
    // fetch follows to a 200 by default) whether the transition actually fired
    // or was silently rejected (e.g. the parent Sample hasn't been received
    // yet, so 'submit' isn't a legal transition), so `res.ok` alone is not
    // proof of success. Confirmed by direct testing: Result saved correctly,
    // content_status_modify returned ok, yet review_state never left
    // "registered" for an unreceived sample's analysis. Verify the state
    // actually changed, same guard senaiteWorkflowAction already uses for ARs.
    const ok = await _contentStatusModify(token, path, 'submit')
    if (!ok) return { success: false, error: 'Failed to submit result for verification.' }

    const afterRes = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Analysis/${analysisUid}?complete=true`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    const afterData = await afterRes.json().catch(() => ({})) as Record<string, unknown>
    const afterItems = (afterData.items as Record<string, unknown>[]) ?? []
    const stateAfter = afterItems[0]?.review_state as string | undefined
    if (stateAfter !== 'to_be_verified' && stateAfter !== 'verified') {
      return {
        success: false,
        error: stateAfter === 'registered' || stateAfter === 'unassigned'
          ? 'Result saved, but this sample must be Received before its result can be submitted for verification.'
          : `Result saved, but submit was rejected (analysis is in "${stateAfter}" state).`,
      }
    }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

export type SenaiteAnalysisFull = {
  uid: string
  title: string
  Keyword: string
  Result: string
  Unit: string
  review_state: string
  sampleId: string
}

/**
 * Fetch every Analysis in SENAITE, unfiltered. `sample_uid` (and every other
 * search param tried against this endpoint) is silently ignored rather than
 * actually filtering — confirmed via direct testing with a nonsense UID that
 * still returned real results — so there is no reliable server-side way to
 * fetch only the analyses for a given sample/batch. Callers must filter
 * client-side against the uids they already trust (e.g. a SenaiteSample's own
 * `Analyses[].uid` list, which comes from the object itself, not a search).
 */
export async function fetchAllAnalyses(token: string): Promise<SenaiteAnalysisFull[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Analysis?complete=true&limit=5000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []).map((a: Record<string, unknown>) => ({
      uid:          (a.uid as string) ?? '',
      title:        (a.title as string) ?? '',
      Keyword:      (a.Keyword as string) ?? (a.getKeyword as string) ?? '',
      Result:       (a.Result as string) ?? '',
      Unit:         (a.Unit as string) ?? '',
      review_state: (a.review_state as string) ?? '',
      sampleId:     (a.getRequestID as string) ?? '',
    }))
  } catch { return [] }
}

// ─── Batches ──────────────────────────────────────────────────────────────────

export type SenaiteBatch = {
  uid: string
  id: string
  title: string
  ClientUID: string
  ClientTitle: string
  ClientID: string
  ClientBatchID: string
  Remarks: string
  description: string
  BatchLabels: string[]
  BatchDate: string
  review_state: string
  created: string
  getProgress: number
}

// SENAITE's Batch.Remarks (and this shape appears on other content types too)
// is NOT a plain string at runtime — it's a list of structured comment objects
// ({content, user_id, user_name, id, created}, content itself being HTML),
// confirmed live via a direct API call. Rendering it directly as a React
// child (as `as string` type-cast code here previously did) throws React
// error #31 ("Objects are not valid as a React child") the moment any batch
// actually has a remark — silent for every batch with Remarks: None, so this
// went unnoticed until B-009 (the first one with a real comment) crashed.
function extractRemarksText(raw: unknown): string {
  if (!raw) return ''
  if (typeof raw === 'string') return raw
  const entries = Array.isArray(raw) ? raw : [raw]
  return entries
    .map(e => (e && typeof e === 'object' && 'content' in e) ? String((e as { content: unknown }).content) : '')
    .filter(Boolean)
    .join(' ')
    .replace(/<[^>]+>/g, '')
    .trim()
}

export async function fetchSenaiteBatches(token: string): Promise<SenaiteBatch[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/batch?complete=true&limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []).map((b: Record<string, unknown>) => {
      const client = (b.Client as Record<string, unknown>) ?? {}
      return {
        uid:           (b.uid as string) ?? '',
        id:            (b.id as string) ?? '',
        title:         (b.title as string) ?? '',
        ClientUID:     (client.uid as string) ?? '',
        ClientTitle:   (b.getClientTitle as string) ?? '',
        ClientID:      (b.getClientID as string) ?? '',
        ClientBatchID: (b.ClientBatchID as string) ?? (b.getClientBatchID as string) ?? '',
        Remarks:       extractRemarksText(b.Remarks),
        description:   (b.description as string) ?? '',
        BatchLabels:   Array.isArray(b.BatchLabels) ? (b.BatchLabels as string[]) : [],
        BatchDate:     (b.BatchDate as string) ?? '',
        review_state:  (b.review_state as string) ?? '',
        created:       (b.created as string) ?? '',
        getProgress:   Number(b.getProgress ?? 0),
      }
    })
  } catch { return [] }
}

export async function createSenaiteBatch(
  token: string,
  data: {
    title: string; ClientUID?: string; ClientBatchID?: string; Remarks?: string
    description?: string; BatchDate?: string; BatchLabels?: string[]
  }
): Promise<{ success: boolean; batch?: SenaiteBatch; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        portal_type: 'Batch',
        parent_path: `${SENAITE_SITE_PATH}/batches`,
        title: data.title,
        ...(data.ClientUID ? { Client: data.ClientUID } : {}),
        ...(data.ClientBatchID ? { ClientBatchID: data.ClientBatchID } : {}),
        ...(data.Remarks ? { Remarks: data.Remarks } : {}),
        ...(data.description ? { description: data.description } : {}),
        ...(data.BatchDate ? { BatchDate: data.BatchDate } : {}),
        ...(data.BatchLabels?.length ? { BatchLabels: data.BatchLabels } : {}),
      }),
      cache: 'no-store',
    })
    const rawText = await res.text()
    let responseData: Record<string, unknown> = {}
    try { responseData = JSON.parse(rawText) } catch { /* non-JSON */ }

    if (!res.ok || responseData.success === false) {
      return { success: false, error: (responseData.message as string) ?? rawText ?? `HTTP ${res.status}` }
    }
    const items = (responseData.items as Record<string, unknown>[]) ?? []
    if (!items.length) return { success: false, error: 'No batch returned from SENAITE.' }
    const b = items[0]
    const client = (b.Client as Record<string, unknown>) ?? {}
    return {
      success: true,
      batch: {
        uid: (b.uid as string) ?? '',
        id: (b.id as string) ?? '',
        title: (b.title as string) ?? '',
        ClientUID: (client.uid as string) ?? '',
        ClientTitle: (b.getClientTitle as string) ?? '',
        ClientID: (b.getClientID as string) ?? '',
        ClientBatchID: (b.ClientBatchID as string) ?? '',
        Remarks: extractRemarksText(b.Remarks),
        description: (b.description as string) ?? '',
        BatchLabels: Array.isArray(b.BatchLabels) ? (b.BatchLabels as string[]) : [],
        BatchDate: (b.BatchDate as string) ?? '',
        review_state: (b.review_state as string) ?? 'open',
        created: (b.created as string) ?? '',
        getProgress: 0,
      },
    }
  } catch (e) { return { success: false, error: String(e) } }
}

/** Close, reopen, or cancel a Batch (confirmed via direct testing: 'close' and
 * 'cancel' are both valid from the open state; 'open' is the reopen transition
 * once closed — not 'reinstate'/'reopen' as might be assumed). */
export async function setSenaiteBatchState(
  token: string,
  uid: string,
  transition: 'close' | 'open' | 'cancel'
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update/${uid}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ transition }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

export const SENAITE_URL = process.env.SENAITE_URL ?? 'http://senaite:8080/senaite'
// Plone/SENAITE site root path — used for legacy create API parent_path.
// When SENAITE_URL has no path (e.g. http://172.21.0.1:8096), pathname is '/'
// which produces '//batches' — incorrect. Always use '/senaite' as the site root.
export const SENAITE_SITE_PATH = (() => {
  try {
    const p = new URL(SENAITE_URL).pathname.replace(/\/$/, '')
    return p || '/senaite'
  } catch { return '/senaite' }
})()
// Protocol+host only, no site path — object `path` values returned by SENAITE
// (e.g. "/senaite/clients/client-8") already include the site path, so custom
// Zope browser views invoked on an object/folder's own path must be built as
// `${SENAITE_ORIGIN}${path}/@@view-name`, never `${SENAITE_URL}${path}/...`
// (that doubles the site path segment and 404s).
export const SENAITE_ORIGIN = (() => {
  try { return new URL(SENAITE_URL).origin } catch { return SENAITE_URL.replace(/\/senaite\/?$/, '') }
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

// NOTE: deliberately NOT SENAITE_SITE_PATH (which always falls back to
// '/senaite' when SENAITE_URL has no path — correct for the legacy v1
// parent_path mechanism, but not here). This is a DIRECT url fetch() to a
// browser view, a different resolution mechanism than parent_path, and it
// must reflect SENAITE_URL's actual path segment with no fallback: when a
// VHM-proxied SENAITE_URL has no path (e.g. http://172.21.0.1:8096, site
// mounted at the origin root), a hardcoded '/senaite' prefix breaks Zope's
// VHM traversal and 404s ("Resource not found: <origin>/senaite") on the
// SECOND+ request sharing that fetch() keep-alive connection pool with the
// prefix-less v1/restapi list calls above — reproduced reliably by replaying
// the real GET Client / GET Contact / POST create-client-safe sequence.
// Confirmed live 2026-07-17: local dev's SENAITE_URL DOES carry a path
// (.../senaite), so dropping it unconditionally 404s there instead ("POST
// /clients/@@create-client-safe" with no site segment at all). Compute the
// prefix from SENAITE_URL's own raw pathname so both cases resolve
// correctly: empty for a root-mounted proxy, '/senaite' for local dev.
const SENAITE_RAW_PATH = (() => {
  try { return new URL(SENAITE_URL).pathname.replace(/\/$/, '') } catch { return '/senaite' }
})()
const CLIENTS_PATH = `${SENAITE_RAW_PATH}/clients`

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

/**
 * Lean client list for dropdowns (e.g. New Sample) — only uid/title/ClientID,
 * active clients only, and a single server-side-filtered call. Deliberately
 * NOT `fetchSenaiteClientsFull`: that one also bulk-fetches every Contact
 * (complete=true&limit=2000) to support the Clients admin page's contact
 * column, which a dropdown never renders.
 */
export async function fetchSenaiteClientsForDropdown(
  token: string,
): Promise<{ uid: string; title: string; ClientID: string }[]> {
  const headers = { Authorization: `Basic ${token}`, Accept: 'application/json' }
  try {
    const res = await fetch(
      `${SENAITE_URL}/@@API/senaite/v1/Client?review_state=active&complete=true&limit=1000`,
      { headers, cache: 'no-store' },
    )
    if (!res.ok) return []
    const data = await res.json()
    return ((data.items ?? []) as Record<string, unknown>[]).map(c => ({
      uid: (c.uid as string) ?? '',
      title: (c.title as string) ?? '',
      ClientID: (c.ClientID as string) ?? '',
    }))
  } catch { return [] }
}

/** List all active clients with their primary contact merged in (one bulk Contact fetch). */
export async function fetchSenaiteClientsFull(token: string): Promise<SenaiteClientFull[]> {
  const headers = { Authorization: `Basic ${token}`, Accept: 'application/json' }
  try {
    // Client and Contact are independent SENAITE queries (Contact isn't
    // filtered by the resolved client list — it fetches everything and gets
    // grouped by parent_path below) — fire both concurrently instead of
    // sequentially. Each `complete=true` call measured ~1-1.5s standalone;
    // this halves the wall-clock cost of every page that calls getClients().
    const [res, cRes] = await Promise.all([
      // Fetch BOTH active and inactive clients — the Clients page computes the
      // Active/Inactive stat cards and status filter client-side, so filtering
      // to review_state=active here would hide deactivated clients entirely
      // (Inactive count stuck at 0, "Inactive" filter empty, a just-deactivated
      // client vanishing instead of moving to Inactive).
      fetch(`${SENAITE_URL}/@@API/senaite/v1/Client?complete=true&limit=1000`, { headers, cache: 'no-store' }),
      // One bulk Contact fetch, grouped by parent client path below.
      fetch(`${SENAITE_URL}/@@API/senaite/v1/Contact?complete=true&limit=2000`, { headers, cache: 'no-store' }),
    ])
    if (!res.ok) return []
    const data = await res.json()
    const clients: SenaiteClientFull[] = (data.items ?? []).map(mapClient)
    if (clients.length === 0) return []

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

/** Create a Client (+ its primary Contact) in SENAITE. Returns the new client
 * UID/path (and the contact's UID, if one was created) — the caller needs
 * these to keep saving into the SAME record on subsequent tab-by-tab saves
 * instead of creating a duplicate client each time.
 *
 * Uses the custom `@@create-client-safe` Zope view (see
 * senaite-rebrand/client_address_views.py), NOT the legacy
 * `@@API/senaite/v1/create` endpoint — that endpoint (and plone.restapi's own
 * PATCH) both call `obj.validate(data=True)`, which crashes with
 * "'NoneType' object has no attribute 'get'" the moment Country/State/
 * District on any Address block is non-blank (a SENAITE core bug: the
 * validator needs a real Zope REQUEST that neither REST path ever supplies).
 * The custom view sets fields via mutators instead, bypassing validate()
 * entirely — confirmed fixed by direct testing against a live instance. */
export async function createSenaiteClientObj(
  token: string, client: SenaiteClientPayload, contact: SenaiteContactPayload,
): Promise<{ success: boolean; uid?: string; path?: string; contactUid?: string; error?: string }> {
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }
  try {
    const res = await fetch(`${SENAITE_ORIGIN}${CLIENTS_PATH}/@@create-client-safe`, {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({ ...client }),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) return { success: false, error: (data.error as string) ?? `HTTP ${res.status}` }
    const uid = (data.uid as string) ?? ''
    const path = (data.path as string) ?? ''
    if (!uid || !path) return { success: false, error: 'No client returned from the lab system.' }
    let contactUid: string | undefined
    if (hasContactData(contact)) {
      const contactRes = await createSenaiteContactObj(token, path, contact)
      contactUid = contactRes.uid
    }
    return { success: true, uid, path, contactUid }
  } catch (e) { return { success: false, error: String(e) } }
}

/** Update an existing Client, and upsert its primary Contact. See
 * createSenaiteClientObj's docstring — uses `@@update-client-safe`, not the
 * legacy/restapi update paths, for the same Address-validator crash reason. */
export async function updateSenaiteClientObj(
  token: string, uid: string, clientPath: string,
  client: SenaiteClientPayload, contact: SenaiteContactPayload, existingContactUid: string | null,
): Promise<{ success: boolean; contactUid?: string; error?: string }> {
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }
  // clientPath comes back from SENAITE prefixed with whatever site path
  // Zope's own internal config thinks it has — which may or may not match
  // SENAITE_URL's actual externally-reachable path (see the CLIENTS_PATH
  // note above for why that distinction matters). Re-derive the path
  // relative to our own SENAITE_RAW_PATH instead of guessing whether to
  // strip a hardcoded prefix: take clientPath's "/clients/..." suffix
  // (stripping whatever internal prefix it came with) and re-prepend the
  // prefix this app actually needs — correct whether that's '/senaite'
  // (local dev) or '' (a root-mounted VHM proxy).
  const clientsSuffixIdx = clientPath.indexOf('/clients/')
  const clientPathSuffix = clientsSuffixIdx >= 0 ? clientPath.slice(clientsSuffixIdx) : clientPath
  const rootRelativeClientPath = `${SENAITE_RAW_PATH}${clientPathSuffix}`
  try {
    const res = await fetch(`${SENAITE_ORIGIN}${rootRelativeClientPath}/@@update-client-safe`, {
      method: 'POST', headers, cache: 'no-store', body: JSON.stringify(client),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) return { success: false, error: (data.error as string) ?? `HTTP ${res.status}` }
    let contactUid = existingContactUid ?? undefined
    if (hasContactData(contact)) {
      if (existingContactUid) await updateSenaiteContactObj(token, existingContactUid, contact)
      else contactUid = (await createSenaiteContactObj(token, clientPath, contact)).uid
    }
    return { success: true, contactUid }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function createSenaiteContactObj(
  token: string, clientPath: string, contact: SenaiteContactPayload,
): Promise<{ success: boolean; uid?: string; error?: string }> {
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({ portal_type: 'Contact', parent_path: clientPath, ...contact }),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    const item = ((data.items as Record<string, unknown>[]) ?? [])[0]
    return { success: true, uid: (item?.uid as string) ?? undefined }
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

/** Activate or deactivate a client via the SENAITE workflow.
 *
 * This SENAITE 2.6 build has NO jsonapi workflow route (senaite.jsonapi only
 * registers create/update/delete) — a POST to `.../v1/deactivate/<uid>` returns
 * 200 with an error embedded in the body and does NOT actually transition.
 * The real mechanism is the classic Zope `content_status_modify` view POSTed
 * as a form field on the object's own path (same approach as
 * senaiteWorkflowAction); success is confirmed by re-reading review_state. */
export async function setSenaiteClientActive(
  token: string, uid: string, active: boolean,
): Promise<{ success: boolean; error?: string }> {
  const headers = { Authorization: `Basic ${token}`, Accept: 'application/json' }
  const workflowAction = active ? 'activate' : 'deactivate'
  try {
    const path = await _resolvePath(token, 'Client', uid)
    if (!path) return { success: false, error: 'Client not found in the lab system.' }

    const ok = await _contentStatusModify(token, path, workflowAction)
    if (!ok) return { success: false, error: 'Failed to trigger the status change.' }

    const check = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Client?UID=${encodeURIComponent(uid)}`, { headers, cache: 'no-store' })
    const item = ((await check.json()).items ?? [])[0]
    const state = (item?.review_state as string) ?? ''
    const good = active ? state === 'active' : state === 'inactive'
    return good ? { success: true } : { success: false, error: `Status is still '${state}'.` }
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

/**
 * Lean sample-type list for dropdowns (e.g. New Sample) — uid/title only, no
 * `complete=true` (title/uid are standard catalog metadata) and no per-item
 * restapi extras call. `fetchSenaiteSampleTypes` below does both of those for
 * every item (needed by the SampleTypes admin page, which renders
 * retention_period/admitted_sticker_templates/etc.) — a dropdown that only
 * renders uid+title doesn't need any of that.
 */
export async function fetchSenaiteSampleTypesForDropdown(
  token: string,
): Promise<{ uid: string; title: string }[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/SampleType?limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return ((data.items ?? []) as Record<string, unknown>[]).map(t => ({
      uid: (t.uid as string) ?? '',
      title: (t.title as string) ?? '',
    }))
  } catch { return [] }
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
export type SenaiteRefOption = { uid: string; title: string; description?: string; review_state?: string; url?: string }

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
      description: (d.description as string) ?? '',
      review_state: (d.review_state as string) ?? 'active',
      url: (d.url as string) ?? '',
    })).filter((d: SenaiteRefOption) => d.uid && d.title)
  } catch { return [] }
}

export const fetchSenaiteSampleMatrices = (token: string) => fetchSenaiteRefList(token, 'SampleMatrix')
export const fetchSenaiteContainerTypes = (token: string) => fetchSenaiteRefList(token, 'ContainerType')
export const fetchSenaiteMethods = (token: string) => fetchSenaiteRefList(token, 'Method')

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
export const fetchSenaiteSamplingDeviations = (token: string) => fetchSenaiteRefList(token, 'SamplingDeviation')

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
      // v1/update rejects a list-wrapped body ("'list' object has no
      // attribute 'update'") — must be a single bare object, confirmed live
      // 2026-07-20 (same bug independently found/fixed in updateSenaiteSampleType).
      body: JSON.stringify({ uid, title: payload.title, description: payload.description ?? '' }),
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
    const created = items[0]
    return {
      success: true,
      option: {
        uid: (created.uid as string) ?? '',
        title: (created.title as string) ?? payload.title,
        description: (created.description as string) ?? payload.description ?? '',
        review_state: (created.review_state as string) ?? 'active',
        url: (created.url as string) ?? '',
      },
    }
  } catch (e) { return { success: false, error: String(e) } }
}

// Update counterpart to createSenaiteSetupRef — same simple setup-reference
// content types (title + optional description). Uses /update/<uid> with a
// plain object body, NOT the bulk /update endpoint with a list body — the
// latter 400s with "'list' object has no attribute 'update'" (same bug
// documented for Batch/Result updates elsewhere in this codebase; confirmed
// live that /update/<uid> + a single object is the shape that actually works).
async function updateSenaiteSetupRef(
  token: string,
  uid: string,
  payload: { title: string; description?: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update/${uid}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ title: payload.title, description: payload.description ?? '' }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

// Generic activate/deactivate for any simple setup-reference content type.
// The legacy v1 activate/deactivate-by-uid shortcut (used for Clients) 500s
// for these setup-folder content types ("API has no member named
// 'None_items'", confirmed live) — plone.restapi's own @workflow endpoint on
// the object's URL works correctly for the same transition, so this uses that
// instead, with the same verify-by-refetch discipline as setSenaiteClientActive.
async function setSenaiteSetupRefActive(
  token: string, url: string, active: boolean,
): Promise<{ success: boolean; error?: string }> {
  if (!url) return { success: false, error: 'Could not resolve this item\'s URL.' }
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }
  const transition = active ? 'activate' : 'deactivate'
  try {
    await fetch(`${url}/@workflow/${transition}`, { method: 'POST', headers, body: JSON.stringify({}), cache: 'no-store' })
    const check = await fetch(url, { headers, cache: 'no-store' })
    const state = ((await check.json()).review_state as string) ?? ''
    const ok = active ? state === 'active' : state === 'inactive'
    return ok ? { success: true } : { success: false, error: `Still '${state}'.` }
  } catch (e) { return { success: false, error: String(e) } }
}

export const createSenaiteSampleContainer = (token: string, payload: { title: string; description?: string }) =>
  createSenaiteSetupRef(token, 'SampleContainer', `${SENAITE_SITE_PATH}/setup/samplecontainers`, payload, 'sample container')

export const createSenaiteSamplePreservation = (token: string, payload: { title: string; description?: string }) =>
  createSenaiteSetupRef(token, 'SamplePreservation', `${SENAITE_SITE_PATH}/setup/samplepreservations`, payload, 'preservation')

// Only Preservations and Sampling Deviations are consumed via ReferenceListShell
// (name+description only) — Sample Points and Sample Containers each have their
// own richer bespoke admin page instead (Sample Point's own full-CRUD functions
// are further below), so no update/toggle wrapper is added for those here.
export const updateSenaiteSamplePreservation = (token: string, uid: string, payload: { title: string; description?: string }) =>
  updateSenaiteSetupRef(token, uid, payload)
export const updateSenaiteSamplingDeviation = (token: string, uid: string, payload: { title: string; description?: string }) =>
  updateSenaiteSetupRef(token, uid, payload)

export const setSenaiteSamplePreservationActive = (token: string, url: string, active: boolean) =>
  setSenaiteSetupRefActive(token, url, active)
export const setSenaiteSamplePointActive = (token: string, url: string, active: boolean) =>
  setSenaiteSetupRefActive(token, url, active)
export const setSenaiteSamplingDeviationActive = (token: string, url: string, active: boolean) =>
  setSenaiteSetupRefActive(token, url, active)

// ─── Sample Containers — full CRUD (standalone admin page) ───────────────────
// Confirmed via SENAITE's actual source (senaite/core/content/samplecontainer.py)
// that SampleContainer is a modern Dexterity content type with capacity (plain
// schema.TextLine — writes fine via legacy v1) and containertype/preservation
// (both UIDReferenceField — note the schema field is "containertype", ONE
// word, no underscore; the previous "container_type" never matched anything).
// pre_preserved carries a schema-level @invariant: if true, `preservation`
// MUST already resolve to a real reference or SENAITE rejects the whole write
// with "Pre-preserved containers must have a preservation selected" — since
// UIDReferenceField writes aren't reliable via the legacy v1 API (same class
// of gap as SamplePoint.sample_types/SampleType.container_type), pre_preserved/
// security_seal_intact/containertype/preservation are all PATCHed together in
// one plone.restapi call so the invariant sees a complete, valid final state.
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
  url: string
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

function sampleContainerScalarBody(payload: SampleContainerPayload): Record<string, unknown> {
  return {
    title: payload.title,
    description: payload.description ?? '',
    capacity: payload.capacity || '0 ml',
  }
}

function mapSenaiteSampleContainer(d: Record<string, unknown>): SenaiteSampleContainer {
  const containerType = parseRef(d.containertype)
  const preservation = parseRef(d.preservation)
  return {
    uid: (d.uid as string) ?? '',
    url: (d.url as string) ?? '',
    title: (d.title as string) ?? '',
    description: (d.description as string) ?? '',
    capacity: (d.capacity as string) ?? '',
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
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/SampleContainer?complete=true&limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return ((data.items ?? []) as Record<string, unknown>[]).map(mapSenaiteSampleContainer).filter(d => d.uid && d.title)
  } catch { return [] }
}

async function patchSampleContainerExtras(
  token: string, url: string, payload: SampleContainerPayload,
): Promise<{ success: boolean; error?: string }> {
  if (!url) return { success: false, error: 'Could not resolve sample container URL for extended fields' }
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }
  try {
    // plone.restapi's UIDReferenceField write shape is the bare UID string —
    // confirmed live: {uid: ...} (the shape used elsewhere for legacy v1 AT
    // reference fields) 400s with "Object is of wrong type" here.
    const body: Record<string, unknown> = {
      pre_preserved: payload.prePreserved,
      security_seal_intact: payload.securitySealIntact,
      containertype: payload.containerTypeUid || null,
      preservation: payload.preservationUid || null,
    }
    const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function createSenaiteSampleContainerFull(
  token: string,
  payload: SampleContainerPayload
): Promise<{ success: boolean; error?: string; warning?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        portal_type: 'SampleContainer',
        parent_path: `${SENAITE_SITE_PATH}/setup/samplecontainers`,
        ...sampleContainerScalarBody(payload),
        // pre_preserved has no schema default and is required — omitting it
        // 400s the create outright ("pre_preserved: required field"), and
        // sending the real desired value here (before `preservation` exists
        // on the brand-new object) trips the schema's own invariant instead
        // ("Pre-preserved containers must have a preservation selected").
        // Always create as false; patchSampleContainerExtras() sets the real
        // value together with preservation/containertype in one PATCH right
        // after, so the invariant only ever sees a complete, valid state.
        pre_preserved: false,
      }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    const items = (data.items as Record<string, unknown>[]) ?? []
    if (!items.length) return { success: false, error: 'No sample container returned from the lab system.' }
    const url = (items[0].url as string) ?? ''
    const extras = await patchSampleContainerExtras(token, url, payload)
    if (!extras.success) {
      return { success: true, warning: `Sample container created, but pre-preserved/container type/preservation could not be saved: ${extras.error}` }
    }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function updateSenaiteSampleContainer(
  token: string,
  uid: string,
  url: string,
  payload: SampleContainerPayload
): Promise<{ success: boolean; error?: string; warning?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update/${uid}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(sampleContainerScalarBody(payload)),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    const extras = await patchSampleContainerExtras(token, url, payload)
    if (!extras.success) {
      return { success: true, warning: `Sample container updated, but pre-preserved/container type/preservation could not be saved: ${extras.error}` }
    }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

export const createSenaiteSamplingDeviation = (token: string, payload: { title: string; description?: string }) =>
  createSenaiteSetupRef(token, 'SamplingDeviation', `${SENAITE_SITE_PATH}/setup/samplingdeviations`, payload, 'sampling deviation')

// ─── Sample Points — full CRUD (standalone admin page) ───────────────────────
// SamplePoint is a Dexterity content type (senaite/core/content/samplepoint.py),
// not the older Archetypes style — title/description/elevation are plain
// schema.TextLine/Text fields the legacy v1 API writes fine directly, but
// sampling_frequency (a DurationField, same mechanic as SampleType's
// RetentionPeriod — reused below), location (a GPSCoordinatesField, confirmed
// live via v1 GET to read back as a plain {latitude, longitude} dict),
// sample_types (a multi-valued UIDReferenceField) and attachment_file (a
// NamedBlobFile) are custom schema types the legacy API can't reliably write —
// same class of gap as SampleType's RetentionPeriod/AdmittedStickerTemplates,
// so they're PATCHed separately via plone.restapi on the object's own URL.
export type SamplePointAttachment = { data: string; filename: string; contentType: string }

export type SamplePointPayload = {
  title: string
  description?: string
  elevation?: string
  latitude?: string
  longitude?: string
  samplingFrequency?: RetentionPeriod
  sampleTypeUids?: string[]
  composite?: boolean
}

export type SenaiteSamplePoint = {
  uid: string
  title: string
  description: string
  url: string
  reviewState: string
  elevation: string
  latitude: string
  longitude: string
  samplingFrequency: RetentionPeriod
  sampleTypeUids: string[]
  composite: boolean
  attachmentFilename: string
}

function samplePointScalarBody(payload: SamplePointPayload): Record<string, unknown> {
  return {
    title: payload.title,
    description: payload.description ?? '',
    elevation: payload.elevation ?? '',
  }
}

// UIDReferenceField comes back as a list of {uid, ...} refs (or plain uid
// strings, defensively handled the same way) — mirrors parseRef's approach.
function parseUidRefList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(r => (typeof r === 'string' ? r : (r as Record<string, unknown> | null)?.uid as string | undefined))
    .filter((uid): uid is string => Boolean(uid))
}

function mapSenaiteSamplePoint(d: Record<string, unknown>): SenaiteSamplePoint {
  const location = (d.location as Record<string, unknown>) ?? {}
  const attachment = d.attachment_file as Record<string, unknown> | null
  return {
    uid: (d.uid as string) ?? '',
    title: (d.title as string) ?? '',
    description: (d.description as string) ?? '',
    url: (d.url as string) ?? '',
    reviewState: (d.review_state as string) ?? 'active',
    elevation: (d.elevation as string) ?? '',
    latitude: (location.latitude as string) ?? '',
    longitude: (location.longitude as string) ?? '',
    samplingFrequency: parseRetentionPeriod(d.sampling_frequency),
    sampleTypeUids: parseUidRefList(d.sample_types),
    composite: Boolean(d.composite ?? false),
    attachmentFilename: (attachment?.filename as string) ?? '',
  }
}

// sampling_frequency/sample_types never serialize via the legacy v1 list read
// for this content type — confirmed live, always None even on a record where
// SENAITE's own native UI correctly shows real values (e.g. "14 days"/"Hilton")
// — same class of gap already documented for SampleType's retention_period/
// admitted_sticker_templates. location/elevation/composite/description DO
// come through the v1 list fine, so only these two need the per-object
// restapi overlay, mirroring fetchRestapiSampleTypeExtras()'s established pattern.
async function fetchRestapiSamplePointExtras(
  token: string, url: string,
): Promise<{ samplingFrequency: RetentionPeriod; sampleTypeUids: string[] } | null> {
  if (!url) return null
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      samplingFrequency: parseRetentionPeriod(data.sampling_frequency),
      sampleTypeUids: parseUidRefList(data.sample_types),
    }
  } catch { return null }
}

export async function fetchSenaiteSamplePointsFull(token: string): Promise<SenaiteSamplePoint[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/SamplePoint?complete=true&limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    const base = ((data.items ?? []) as Record<string, unknown>[]).map(mapSenaiteSamplePoint).filter(d => d.uid && d.title)
    return await Promise.all(base.map(async sp => {
      const extras = await fetchRestapiSamplePointExtras(token, sp.url)
      return extras ? { ...sp, samplingFrequency: extras.samplingFrequency, sampleTypeUids: extras.sampleTypeUids } : sp
    }))
  } catch { return [] }
}

async function patchSamplePointExtras(
  token: string, url: string, payload: SamplePointPayload, attachment?: SamplePointAttachment,
): Promise<{ success: boolean; error?: string }> {
  if (!url) return { success: false, error: 'Could not resolve sample point URL for extended fields' }
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }
  try {
    const body: Record<string, unknown> = {
      location: { latitude: payload.latitude ?? '', longitude: payload.longitude ?? '' },
      sampling_frequency: retentionPeriodToSeconds(payload.samplingFrequency ?? { days: 0, hours: 0, minutes: 0 }),
      composite: payload.composite ?? false,
      sample_types: payload.sampleTypeUids ?? [],
    }
    if (attachment) {
      body.attachment_file = {
        data: attachment.data, encoding: 'base64', filename: attachment.filename, 'content-type': attachment.contentType,
      }
    }
    const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function createSenaiteSamplePointFull(
  token: string, payload: SamplePointPayload, attachment?: SamplePointAttachment,
): Promise<{ success: boolean; option?: SenaiteRefOption; error?: string; warning?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        portal_type: 'SamplePoint',
        parent_path: `${SENAITE_SITE_PATH}/setup/samplepoints`,
        ...samplePointScalarBody(payload),
      }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    const items = (data.items as Record<string, unknown>[]) ?? []
    if (!items.length) return { success: false, error: 'No sample point returned from the lab system.' }
    const created = items[0]
    const url = (created.url as string) ?? ''
    const option: SenaiteRefOption = {
      uid: (created.uid as string) ?? '',
      title: (created.title as string) ?? payload.title,
      description: (created.description as string) ?? payload.description ?? '',
      review_state: (created.review_state as string) ?? 'active',
      url,
    }
    const extras = await patchSamplePointExtras(token, url, payload, attachment)
    if (!extras.success) {
      return { success: true, option, warning: `Sample point created, but extended fields could not be saved: ${extras.error}` }
    }
    return { success: true, option }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function updateSenaiteSamplePointFull(
  token: string, uid: string, url: string, payload: SamplePointPayload, attachment?: SamplePointAttachment,
): Promise<{ success: boolean; error?: string; warning?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update/${uid}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(samplePointScalarBody(payload)),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    const extras = await patchSamplePointExtras(token, url, payload, attachment)
    if (!extras.success) {
      return { success: true, warning: `Sample point updated, but extended fields could not be saved: ${extras.error}` }
    }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

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

// SampleTemplate write body, split in two because the two write paths behave
// differently for partitions/services (both DataGridFields):
//  - PATCH to an existing template: traversal context IS already an
//    ISampleTemplate, so SampleTemplateDataGridFieldDeserializer (registered
//    for (List, ISampleTemplate, IBrowserRequest)) fires correctly and the
//    full body (scalars + partitions/services) can go in one request.
//  - POST to create a new template: traversal context is the `sampletemplates`
//    *folder*, not yet an ISampleTemplate — the adapter never fires, SENAITE's
//    default (broken, for this field type) deserializer handles
//    partitions/services instead and rejects them with "Wrong contained type"
//    (confirmed live on a real deploy, 2026-07-15). So create must go
//    scalars-only first, then PATCH partitions/services onto the now-existing
//    object — same two-step shape already used for SampleType's own
//    DataGridField extras, see patchSampleTypeExtras() above.
function sampleTemplateScalarBody(payload: SampleTemplatePayload): Record<string, unknown> {
  return {
    title: payload.title,
    description: payload.description ?? '',
    samplepoint: payload.samplePointUid ? [payload.samplePointUid] : [],
    sampletype: payload.sampleTypeUid ? [payload.sampleTypeUid] : [],
    composite: payload.composite ?? false,
    sampling_required: payload.samplingRequired ?? false,
    auto_partition: payload.autoPartition ?? false,
  }
}

function sampleTemplateGridBody(payload: SampleTemplatePayload): Record<string, unknown> {
  return {
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
  // Same class of bug fixed in fetchSenaiteCalculations: SENAITE can
  // serialize an empty reference/records field as `{}` instead of `[]`,
  // which crashes a bare `?? []`.map() (only null/undefined is replaced).
  const partitions = asArray(t.partitions).map(p => ({
    partId: (p.part_id as string) ?? '',
    containerUid: first(p.container),
    preservationUid: first(p.preservation),
    sampleTypeUid: first(p.sampletype),
  }))
  const services = asArray(t.services).map(s => ({
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
): Promise<{ success: boolean; sampleTemplate?: SenaiteSampleTemplate; error?: string; warning?: string }> {
  const headers = {
    Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json',
  }
  try {
    // Scalars only — see sampleTemplateScalarBody's comment for why partitions/
    // services can't go in this same request.
    const res = await fetch(`${SENAITE_URL}/setup/sampletemplates`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ '@type': 'SampleTemplate', ...sampleTemplateScalarBody(payload) }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    const created = mapSenaiteSampleTemplate(data)

    let warning: string | undefined
    const hasGrids = payload.partitions.length > 0 || payload.services.length > 0
    if (hasGrids) {
      if (!created.url) {
        warning = 'Template created, but its URL could not be resolved to save partitions/services.'
      } else {
        const gridRes = await fetch(created.url, {
          method: 'PATCH', headers, body: JSON.stringify(sampleTemplateGridBody(payload)), cache: 'no-store',
        })
        if (!gridRes.ok) {
          const gridData = await gridRes.json().catch(() => ({})) as Record<string, unknown>
          warning = (gridData.message as string) ?? `Partitions/services could not be saved (HTTP ${gridRes.status})`
        }
      }
    }

    return {
      success: true,
      warning,
      sampleTemplate: { ...created, partitions: warning ? created.partitions : payload.partitions, services: warning ? created.services : payload.services },
    }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function updateSenaiteSampleTemplate(
  token: string,
  url: string,
  payload: SampleTemplatePayload
): Promise<{ success: boolean; error?: string }> {
  const headers = {
    Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json',
  }
  try {
    // Split the same way createSenaiteSampleTemplate does: a combined PATCH of
    // scalars (samplepoint/sampletype) + grid fields (partitions/services) in
    // one request trips 'Wrong contained type' ValidationError on samplepoint/
    // sampletype on a real deploy (2026-07-16) — despite the object already
    // being an ISampleTemplate, SENAITE's per-field deserializers don't compose
    // cleanly in a single PATCH body here. Two sequential PATCHes avoid it.
    const scalarRes = await fetch(url, {
      method: 'PATCH', headers, body: JSON.stringify(sampleTemplateScalarBody(payload)), cache: 'no-store',
    })
    if (!scalarRes.ok) {
      const data = await scalarRes.json().catch(() => ({})) as Record<string, unknown>
      return { success: false, error: (data.message as string) ?? `HTTP ${scalarRes.status}` }
    }

    const gridRes = await fetch(url, {
      method: 'PATCH', headers, body: JSON.stringify(sampleTemplateGridBody(payload)), cache: 'no-store',
    })
    if (!gridRes.ok) {
      const data = await gridRes.json().catch(() => ({})) as Record<string, unknown>
      return { success: false, error: (data.message as string) ?? `HTTP ${gridRes.status}` }
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
// the only API path that persists either field at all (see sampleTypeApiBody
// above). Split into two independent calls (rather than one bundled PATCH) so
// a validation failure on one field doesn't 400 the whole request and block
// the other from saving. Both fields persist correctly via this path — the
// custom sampletype_stickers_deserializer.py adapter (see CLAUDE.md §16b)
// handles admitted_sticker_templates, including multi-item rows.
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
      body: JSON.stringify({ uid, ...sampleTypeApiBody(payload) }),
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

export async function fetchSenaiteTitleMap(token: string, portalType: string): Promise<Record<string, string>> {
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
    // No review_state filter: the Instrument List shows a status column + Active
    // stat card and must include inactive instruments too, or the count/status
    // are meaningless (same class of bug as the Clients list).
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Instrument?complete=true&limit=1000`, {
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

// Instrument create/update/detail-read — MUST go through the legacy v1 API,
// never plone.restapi. Confirmed live: any restapi call that returns a full
// Instrument object (GET, or the response body of a create/PATCH) 500s with
// "No converter for making <InstrumentType ...> JSON compatible" — restapi
// cannot serialize this type's reference fields at all. A restapi CREATE
// attempt actually rolled back (the object was never persisted), unlike
// AnalysisRequest where a v1/update "failure" can still have applied — so
// this is a stricter, cleaner case than AR's: v1 create/update on Instrument
// is fully reliable, verified by re-fetching via the v1 singular endpoint
// (`v1/instrument/<uid>`), which returns every field (InstrumentType,
// Manufacturer, Supplier, Model, SerialNo) as plain JSON-safe {uid,url,api_url}
// refs — completely unlike restapi's crash on the same reference fields.
export async function createSenaiteInstrument(
  token: string,
  fields: { title: string; InstrumentType: string; Manufacturer: string; Supplier: string; Model?: string; SerialNo?: string; Methods?: string[] },
): Promise<{ success: boolean; uid?: string; error?: string }> {
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        portal_type: 'Instrument',
        parent_path: `${SENAITE_SITE_PATH}/bika_setup/bika_instruments`,
        ...fields,
      }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    const item = ((data.items as Record<string, unknown>[]) ?? [])[0]
    return { success: true, uid: item?.uid as string | undefined }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function updateSenaiteInstrument(
  token: string,
  uid: string,
  fields: { title?: string; InstrumentType?: string; Manufacturer?: string; Supplier?: string; Model?: string; SerialNo?: string; Methods?: string[] },
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
    return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
  } catch (e) { return { success: false, error: String(e) } }
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
    // No review_state filter: the Storage List shows a status column + Active
    // stat card, so inactive locations must load too (same class of bug as the
    // Clients list). Still no `complete=true` — keep it a cheap catalog query.
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/StorageLocation?limit=1000`, {
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

// Reference-field subfields come back from the v1 API as {uid, url, api_url}
// when set, or {} when empty — never a bare string. Same shape for single
// refs (Category/Department/Method/Instrument/Calculation) and, as an array
// of these objects, for multi-refs (Methods/Instruments).
function refUid(v: unknown): string {
  return (v && typeof v === 'object' && 'uid' in (v as object)) ? ((v as Record<string, unknown>).uid as string) ?? '' : ''
}
function refTitle(v: unknown): string {
  if (Array.isArray(v)) return ''
  return (v && typeof v === 'object' && 'title' in (v as object)) ? ((v as Record<string, unknown>).title as string) ?? '' : (typeof v === 'string' ? v : '')
}
function refUidList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(refUid).filter(Boolean) : []
}

export type SenaiteUncertaintyRow = { intercept_min: string; intercept_max: string; errorvalue: string }
export type SenaiteInterimFieldRow = {
  keyword: string; title: string; value: string; choices: string; result_type: string
  allow_empty: boolean; unit: string; report: boolean; hidden: boolean; wide: boolean
}
export type SenaiteConditionRow = {
  title: string; description: string; type: string; value: string; choices: string; required: boolean
}

export type SenaiteAnalysisService = {
  uid: string
  id: string
  title: string
  description: string
  Keyword: string
  Category: string
  CategoryUid: string
  Price: string
  Unit: string
  // Description tab
  ShortTitle: string
  SortKey: string
  CommercialID: string
  ProtocolID: string
  ScientificName: string
  // Analysis tab
  Accredited: boolean
  PointOfCapture: string
  DepartmentUid: string
  BulkPrice: string
  VAT: string
  // Limits tab
  LowerDetectionLimit: string
  LowerLimitOfQuantification: string
  UpperLimitOfQuantification: string
  UpperDetectionLimit: string
  DetectionLimitSelector: boolean
  AllowManualDetectionLimit: boolean
  // Method tab
  MethodUids: string[]
  DefaultMethodUid: string
  InstrumentUids: string[]
  DefaultInstrumentUid: string
  CalculationUid: string
  // Uncertainties tab
  Uncertainties: SenaiteUncertaintyRow[]
  PrecisionFromUncertainty: boolean
  AllowManualUncertainty: boolean
  // Result options tab
  ResultType: string
  DefaultResult: string
  InterimFields: SenaiteInterimFieldRow[]
  Precision: string
  ExponentialFormatPrecision: string
  AttachmentRequired: boolean
  MaxTimeAllowedDays: string
  MaxTimeAllowedHours: string
  MaxTimeAllowedMinutes: string
  MaxHoldingTimeDays: string
  MaxHoldingTimeHours: string
  MaxHoldingTimeMinutes: string
  DuplicateVariation: string
  Hidden: boolean
  SelfVerification: string
  NumberOfRequiredVerifications: string
  // Advanced tab
  Conditions: SenaiteConditionRow[]
  review_state: string
}

function timePart(v: Record<string, unknown> | undefined, key: string): string {
  return v ? String(v[key] ?? '') : ''
}

function mapSenaiteAnalysisService(s: Record<string, unknown>): SenaiteAnalysisService {
  const maxTime = s.MaxTimeAllowed as Record<string, unknown> | undefined
  const maxHolding = s.MaxHoldingTime as Record<string, unknown> | undefined
  return {
    uid: (s.uid as string) ?? '',
    id: (s.id as string) ?? '',
    title: (s.title as string) ?? '',
    description: (s.description as string) ?? '',
    Keyword: (s.Keyword as string) ?? '',
    Category: refTitle(s.Category),
    CategoryUid: refUid(s.Category),
    Price: (s.Price as string) ?? '',
    Unit: (s.Unit as string) ?? '',
    ShortTitle: (s.ShortTitle as string) ?? '',
    SortKey: (s.SortKey as string) ?? '',
    CommercialID: (s.CommercialID as string) ?? '',
    ProtocolID: (s.ProtocolID as string) ?? '',
    ScientificName: (s.ScientificName as string) ?? '',
    Accredited: Boolean(s.Accredited),
    PointOfCapture: (s.PointOfCapture as string) ?? 'lab',
    DepartmentUid: refUid(s.Department),
    BulkPrice: (s.BulkPrice as string) ?? '',
    VAT: (s.VAT as string) ?? '',
    LowerDetectionLimit: (s.LowerDetectionLimit as string) ?? '',
    LowerLimitOfQuantification: (s.LowerLimitOfQuantification as string) ?? '',
    UpperLimitOfQuantification: (s.UpperLimitOfQuantification as string) ?? '',
    UpperDetectionLimit: (s.UpperDetectionLimit as string) ?? '',
    DetectionLimitSelector: Boolean(s.DetectionLimitSelector),
    AllowManualDetectionLimit: Boolean(s.AllowManualDetectionLimit),
    MethodUids: refUidList(s.Methods),
    DefaultMethodUid: refUid(s.Method),
    InstrumentUids: refUidList(s.Instruments),
    DefaultInstrumentUid: refUid(s.Instrument),
    CalculationUid: refUid(s.Calculation),
    Uncertainties: ((s.Uncertainties as Record<string, unknown>[]) ?? []).map(r => ({
      intercept_min: String(r.intercept_min ?? ''), intercept_max: String(r.intercept_max ?? ''), errorvalue: String(r.errorvalue ?? ''),
    })),
    PrecisionFromUncertainty: Boolean(s.PrecisionFromUncertainty),
    AllowManualUncertainty: Boolean(s.AllowManualUncertainty),
    ResultType: (s.ResultType as string) ?? 'numeric',
    DefaultResult: (s.DefaultResult as string) ?? '',
    InterimFields: ((s.InterimFields as Record<string, unknown>[]) ?? []).map(r => ({
      keyword: String(r.keyword ?? ''), title: String(r.title ?? ''), value: String(r.value ?? ''), choices: String(r.choices ?? ''),
      result_type: String(r.result_type ?? 'string'), allow_empty: Boolean(r.allow_empty), unit: String(r.unit ?? ''),
      report: Boolean(r.report), hidden: Boolean(r.hidden), wide: Boolean(r.wide),
    })),
    Precision: (s.Precision as string) ?? '',
    ExponentialFormatPrecision: (s.ExponentialFormatPrecision as string) ?? '',
    AttachmentRequired: Boolean(s.AttachmentRequired),
    MaxTimeAllowedDays: timePart(maxTime, 'days'),
    MaxTimeAllowedHours: timePart(maxTime, 'hours'),
    MaxTimeAllowedMinutes: timePart(maxTime, 'minutes'),
    MaxHoldingTimeDays: timePart(maxHolding, 'days'),
    MaxHoldingTimeHours: timePart(maxHolding, 'hours'),
    MaxHoldingTimeMinutes: timePart(maxHolding, 'minutes'),
    DuplicateVariation: (s.DuplicateVariation as string) ?? '',
    Hidden: Boolean(s.Hidden),
    SelfVerification: (s.SelfVerification as string) ?? '0',
    NumberOfRequiredVerifications: (s.NumberOfRequiredVerifications as string) ?? '1',
    Conditions: ((s.Conditions as Record<string, unknown>[]) ?? []).map(r => ({
      title: String(r.title ?? ''), description: String(r.description ?? ''), type: String(r.type ?? 'text'),
      value: String(r.value ?? ''), choices: String(r.choices ?? ''), required: Boolean(r.required),
    })),
    review_state: (s.review_state as string) ?? 'active',
  }
}

/**
 * Lean analysis-service list for dropdowns (e.g. New Sample) — uid/title only,
 * no `complete=true` (both are standard catalog metadata; the full
 * `fetchSenaiteAnalysisServices` below needs complete=true for price/category/
 * unit/etc. rendered on the Analyses admin page).
 */
export async function fetchSenaiteAnalysisServicesForDropdown(
  token: string,
): Promise<{ uid: string; title: string }[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/AnalysisService?limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    const seen = new Set<string>()
    const cleaned: { uid: string; title: string }[] = []
    for (const s of (data.items ?? []) as Record<string, unknown>[]) {
      const title = ((s.title as string) ?? '').trim()
      const key = title.toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      cleaned.push({ uid: (s.uid as string) ?? '', title })
    }
    return cleaned
  } catch { return [] }
}

export async function fetchSenaiteAnalysisServices(token: string): Promise<SenaiteAnalysisService[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/AnalysisService?complete=true&limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    const all = (data.items ?? []).map((s: Record<string, unknown>) => mapSenaiteAnalysisService(s))
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

// Full payload shape for the 7-tab Add/Edit Analysis Service form. Optional
// throughout — callers send only what a given tab's fields actually collected.
export type AnalysisServicePayload = {
  title: string
  description?: string
  Keyword: string
  CategoryUid: string
  Unit?: string
  Price?: string
  ShortTitle?: string
  SortKey?: string
  CommercialID?: string
  ProtocolID?: string
  ScientificName?: string
  Accredited?: boolean
  PointOfCapture?: string
  DepartmentUid?: string
  BulkPrice?: string
  VAT?: string
  LowerDetectionLimit?: string
  LowerLimitOfQuantification?: string
  UpperLimitOfQuantification?: string
  UpperDetectionLimit?: string
  DetectionLimitSelector?: boolean
  AllowManualDetectionLimit?: boolean
  MethodUids?: string[]
  DefaultMethodUid?: string
  InstrumentUids?: string[]
  DefaultInstrumentUid?: string
  CalculationUid?: string
  Uncertainties?: SenaiteUncertaintyRow[]
  PrecisionFromUncertainty?: boolean
  AllowManualUncertainty?: boolean
  ResultType?: string
  DefaultResult?: string
  InterimFields?: SenaiteInterimFieldRow[]
  Precision?: string
  ExponentialFormatPrecision?: string
  AttachmentRequired?: boolean
  MaxTimeAllowedDays?: string
  MaxTimeAllowedHours?: string
  MaxTimeAllowedMinutes?: string
  MaxHoldingTimeDays?: string
  MaxHoldingTimeHours?: string
  MaxHoldingTimeMinutes?: string
  DuplicateVariation?: string
  Hidden?: boolean
  SelfVerification?: string
  NumberOfRequiredVerifications?: string
  Conditions?: SenaiteConditionRow[]
}

function analysisServiceBody(payload: AnalysisServicePayload): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: payload.title,
    description: payload.description ?? '',
    Keyword: payload.Keyword,
    Category: payload.CategoryUid,
    Unit: payload.Unit ?? '',
    Price: payload.Price ?? '0.00',
    ShortTitle: payload.ShortTitle ?? '',
    SortKey: payload.SortKey ?? '',
    CommercialID: payload.CommercialID ?? '',
    ProtocolID: payload.ProtocolID ?? '',
    ScientificName: payload.ScientificName ?? '',
    Accredited: payload.Accredited ?? false,
    PointOfCapture: payload.PointOfCapture ?? 'lab',
    BulkPrice: payload.BulkPrice ?? '0.00',
    VAT: payload.VAT ?? '',
    // Unlike every other blank-optional field on this type (which merely
    // trips the already-handled bogus "'NoneType' object has no attribute
    // 'form'" response-rendering error while the object is still created
    // fine underneath — see createSenaiteAnalysisService's verify-by-refetch
    // fallback), LowerLimitOfQuantification/UpperLimitOfQuantification
    // genuinely BLOCK creation when sent as `''`: SENAITE rejects them with
    // "Value u'' is not floatable" and the object never gets created at all.
    // Confirmed live by isolating each blank-float field one at a time.
    // Always send a numeric default, matching the Price/BulkPrice pattern.
    LowerDetectionLimit: payload.LowerDetectionLimit ?? '',
    LowerLimitOfQuantification: payload.LowerLimitOfQuantification || '0.00',
    UpperLimitOfQuantification: payload.UpperLimitOfQuantification || '0.00',
    UpperDetectionLimit: payload.UpperDetectionLimit ?? '',
    DetectionLimitSelector: payload.DetectionLimitSelector ?? false,
    AllowManualDetectionLimit: payload.AllowManualDetectionLimit ?? false,
    Methods: payload.MethodUids ?? [],
    Instruments: payload.InstrumentUids ?? [],
    Uncertainties: payload.Uncertainties ?? [],
    PrecisionFromUncertainty: payload.PrecisionFromUncertainty ?? false,
    AllowManualUncertainty: payload.AllowManualUncertainty ?? false,
    ResultType: payload.ResultType ?? 'numeric',
    DefaultResult: payload.DefaultResult ?? '',
    InterimFields: payload.InterimFields ?? [],
    Precision: payload.Precision ?? '',
    ExponentialFormatPrecision: payload.ExponentialFormatPrecision ?? '',
    AttachmentRequired: payload.AttachmentRequired ?? false,
    // SENAITE parses each of these three parts as a float when computing due
    // dates at AnalysisRequest-creation time — an empty string (rather than
    // "0") crashes that calculation with "could not convert string to float"
    // for every sample that includes this analysis, confirmed live. Always
    // send a numeric default, never a blank string, for all three subfields.
    MaxTimeAllowed: {
      days: payload.MaxTimeAllowedDays || '0', hours: payload.MaxTimeAllowedHours || '0', minutes: payload.MaxTimeAllowedMinutes || '0',
    },
    MaxHoldingTime: {
      days: payload.MaxHoldingTimeDays || '0', hours: payload.MaxHoldingTimeHours || '0', minutes: payload.MaxHoldingTimeMinutes || '0',
    },
    DuplicateVariation: payload.DuplicateVariation ?? '',
    Hidden: payload.Hidden ?? false,
    SelfVerification: payload.SelfVerification ?? '0',
    NumberOfRequiredVerifications: payload.NumberOfRequiredVerifications ?? '1',
    Conditions: payload.Conditions ?? [],
  }
  if (payload.DepartmentUid) body.Department = payload.DepartmentUid
  if (payload.DefaultMethodUid) body.Method = payload.DefaultMethodUid
  if (payload.DefaultInstrumentUid) body.Instrument = payload.DefaultInstrumentUid
  if (payload.CalculationUid) body.Calculation = payload.CalculationUid
  return body
}

export async function createSenaiteAnalysisService(
  token: string,
  payload: AnalysisServicePayload
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
        ...analysisServiceBody(payload),
      }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    const items = (data.items as Record<string, unknown>[]) ?? []
    if (items.length > 0) {
      return { success: true, service: mapSenaiteAnalysisService(items[0]) }
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
      if (match) return { success: true, service: mapSenaiteAnalysisService(match) }
    }
    return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function updateSenaiteAnalysisService(
  token: string,
  uid: string,
  payload: AnalysisServicePayload
): Promise<{ success: boolean; service?: SenaiteAnalysisService; error?: string }> {
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }
  try {
    // Same bogus-error-on-success behavior as create (confirmed live) — the
    // update call itself is not trustworthy, so always verify by re-fetching
    // the object afterward rather than trusting res.ok/data.success.
    await fetch(`${SENAITE_URL}/@@API/senaite/v1/update/${uid}`, {
      method: 'POST', headers, body: JSON.stringify(analysisServiceBody(payload)), cache: 'no-store',
    })
    const check = await fetch(`${SENAITE_URL}/@@API/senaite/v1/AnalysisService?UID=${encodeURIComponent(uid)}&complete=true`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' }, cache: 'no-store',
    })
    const item = ((await check.json().catch(() => ({}))).items ?? [])[0]
    if (!item) return { success: false, error: 'Could not verify the update.' }
    const updated = mapSenaiteAnalysisService(item)
    const ok = updated.title === payload.title && updated.Keyword === payload.Keyword
    return ok ? { success: true, service: updated } : { success: false, error: 'Update did not persist as expected.' }
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
  // Display-only context for the Audit Trail drawer's per-event detail (e.g.
  // "storage location for Stored, condition for Received") — SENAITE's own
  // @history entries carry no such detail themselves, only the AR's current
  // snapshot does, so these are attached to whichever history entry they're
  // relevant for as a best-effort "what it looked like as of now" annotation,
  // not a true historical value at that point in time.
  StorageLocationTitle: string
  SampleConditionTitle: string
  EnvironmentalConditionsTitle: string
}

function mapSample(s: Record<string, unknown>): SenaiteSample {
  const client = (s.Client as Record<string, unknown>) ?? {}
  const sampleType = (s.SampleType as Record<string, unknown>) ?? {}
  const batch = (s.Batch as Record<string, unknown>) ?? {}
  const storageLocation = (s.StorageLocation as Record<string, unknown>) ?? {}
  const sampleCondition = (s.SampleCondition as Record<string, unknown>) ?? {}
  const environmentalConditions = (s.EnvironmentalConditions as Record<string, unknown>) ?? {}
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
    StorageLocationTitle: (s.getStorageLocationTitle as string) || (storageLocation.title as string) || '',
    SampleConditionTitle: (sampleCondition.title as string) || '',
    EnvironmentalConditionsTitle: (environmentalConditions.title as string) || '',
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
    if (items.length === 0) return null
    const sample = mapSample(items[0])
    // The AR's own `Analyses` array is a list of bare reference objects
    // ({url, uid, api_url} only) even with `?complete=true` on the AR itself —
    // confirmed live: title/Keyword/review_state are never present there,
    // regardless of the AR's own resolution. Only the singular
    // `@@API/senaite/v1/Analysis/<uid>?complete=true` endpoint actually
    // resolves those fields, so the Sample Detail page (the one place these
    // per-analysis fields are rendered) needs one follow-up fetch per
    // analysis. Cheap here — a handful of analyses per sample, one sample at
    // a time — unlike the list endpoint (fetchSenaiteSamples), which is left
    // reading the bare refs since nothing there renders per-analysis detail.
    if (sample.Analyses.length > 0) {
      const resolved = await Promise.all(sample.Analyses.map(async a => {
        try {
          const r = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Analysis/${a.uid}?complete=true`, {
            headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
            cache: 'no-store',
          })
          if (!r.ok) return a
          const full = ((await r.json()).items ?? [])[0] as Record<string, unknown> | undefined
          if (!full) return a
          return {
            uid: a.uid,
            title: (full.title as string) ?? a.title,
            Keyword: (full.Keyword as string) ?? a.Keyword,
            review_state: (full.review_state as string) ?? a.review_state,
          }
        } catch { return a }
      }))
      sample.Analyses = resolved
    }
    return sample
  } catch { return null }
}

/** Finds an existing Contact by full-name match under the given client path,
 * or creates one. Mirrors the same resolve-or-create pattern already used
 * server-side in core/senaite_service.py's _ensure_client_contact — this
 * flow talks to SENAITE directly from the Next.js server action instead, so
 * it needs its own copy of the same logic. Filters client-side rather than
 * trusting a server-side query filter, per this build's confirmed unreliable
 * list-filter params (see other _find_by_title-style lookups in this repo). */
export async function resolveOrCreateContactUid(token: string, clientPath: string, fullName: string): Promise<string | null> {
  const name = fullName.trim()
  if (!name) return null
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Contact?complete=true&limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      const items = (data.items as Record<string, unknown>[]) ?? []
      const needle = name.toLowerCase()
      const match = items.find(it =>
        it.parent_path === clientPath && (String(it.title ?? '').toLowerCase() === needle)
      )
      if (match?.uid) return match.uid as string
    }
  } catch { /* fall through to create */ }

  const [firstName, ...rest] = name.split(/\s+/)
  const surname = rest.join(' ') || firstName
  try {
    const createRes = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        portal_type: 'Contact',
        parent_path: clientPath,
        Firstname: firstName,
        Surname: surname,
      }),
      cache: 'no-store',
    })
    const data = await createRes.json().catch(() => ({})) as Record<string, unknown>
    if (!createRes.ok || data.success === false) return null
    const items = (data.items as Record<string, unknown>[]) ?? []
    return (items[0]?.uid as string) ?? null
  } catch { return null }
}

export async function createSenaiteSample(
  token: string,
  payload: {
    Client: string        // client UID — used to look up parent_path
    ContactName?: string  // free-text contact name — resolved/created against SENAITE Contact
    CCContactNames?: string // comma-separated free-text names — resolved/created the same way
    CCEmails?: string      // comma-separated emails
    SampleType: string    // sample type UID
    DateSampled: string   // ISO date string
    Analyses?: string[]   // analysis service UIDs
    Priority?: string     // "1"-"5"
    ClientSampleID?: string
    Batch?: string         // Batch UID — groups this sample under a Batch (optional)
    Composite?: boolean
    InternalUse?: boolean
    ClientOrderNumber?: string
    ClientReference?: string
    Remarks?: string
    Preservation?: string       // SamplePreservation UID (resolved by caller)
    SamplePoint?: string        // SamplePoint UID (resolved by caller)
    SamplingDeviation?: string  // SamplingDeviation UID (resolved by caller)
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

    const contactUid = payload.ContactName ? await resolveOrCreateContactUid(token, clientPath, payload.ContactName) : null
    const ccContactUids = payload.CCContactNames
      ? (await Promise.all(
          payload.CCContactNames.split(',').map(n => resolveOrCreateContactUid(token, clientPath, n))
        )).filter((uid): uid is string => Boolean(uid))
      : []

    // Step 2: create the AnalysisRequest under the client — kept to ONLY the
    // fields confirmed (2026-07-20, live probing + a real end-to-end test) to
    // actually persist via v1/create: SampleType, DateSampled, Priority,
    // Analyses. Every other field below returns success:true from `create`
    // but is silently dropped server-side — same class of bug documented in
    // CLAUDE.md §16b-16d for other content types. They must go through a
    // SEPARATE v1/update call after the AR exists (verified reliable for AR
    // fields, unlike restapi which crashes on this object's own serializer).
    const body: Record<string, unknown> = {
      portal_type: 'AnalysisRequest',
      parent_path: clientPath,
      SampleType: payload.SampleType,
      DateSampled: payload.DateSampled,
      Priority: payload.Priority ?? '3',
    }
    if (payload.Analyses?.length) body.Analyses = payload.Analyses

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
    const created = items[0]
    const uid = created.uid as string

    // Step 3: push every other field via v1/update — same endpoint already
    // confirmed reliable for AR reference/text fields via updateSenaiteSample.
    const extras: Record<string, unknown> = {
      // Always sent (not gated on truthiness) — these are real toggles the
      // user can flip back to false, and SENAITE needs the explicit false
      // to actually clear a previously-true value.
      Composite: payload.Composite ?? false,
      InternalUse: payload.InternalUse ?? false,
    }
    if (payload.ClientSampleID)    extras.ClientSampleID    = payload.ClientSampleID
    if (contactUid)                extras.Contact           = contactUid
    if (ccContactUids.length)      extras.CCContact         = ccContactUids
    if (payload.CCEmails)          extras.CCEmails          = payload.CCEmails
    if (payload.Batch)             extras.Batch             = payload.Batch
    if (payload.ClientOrderNumber) extras.ClientOrderNumber = payload.ClientOrderNumber
    if (payload.ClientReference)   extras.ClientReference   = payload.ClientReference
    if (payload.Remarks)           extras.Remarks           = payload.Remarks
    if (payload.Preservation)      extras.Preservation      = payload.Preservation
    if (payload.SamplePoint)       extras.SamplePoint       = payload.SamplePoint
    if (payload.SamplingDeviation) extras.SamplingDeviation = payload.SamplingDeviation

    let finalItem = created
    try {
      const updateRes = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ uid, ...extras }),
        cache: 'no-store',
      })
      await updateRes.json().catch(() => ({}))
      // v1/update's response body is not trustworthy (see updateSenaiteSample's
      // docstring — success:false can still mean the update landed) — always
      // re-fetch the AR itself to return accurate data to the caller instead
      // of trusting either response.
      const verifyRes = await fetch(`${SENAITE_URL}/@@API/senaite/v1/AnalysisRequest/${uid}?complete=true`, {
        headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      })
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json().catch(() => ({})) as Record<string, unknown>
        const verifyItems = (verifyData.items as Record<string, unknown>[]) ?? []
        if (verifyItems[0]) finalItem = verifyItems[0]
      }
    } catch {
      // The AR itself was already created successfully — a failure pushing
      // the extra fields must not fail the whole sample registration.
    }

    return { success: true, sample: mapSample(finalItem) }
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
/** Resolves a Client's SENAITE folder path from its SENAITE UID — needed to
 * scope Contact lookups/creates (see resolveOrCreateContactUid) when editing
 * an existing sample, mirroring the same lookup createSenaiteSample() does
 * internally at creation time. */
export async function resolveSenaiteClientPathByUid(token: string, clientUid: string): Promise<string | null> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/client?UID=${encodeURIComponent(clientUid)}&complete=true`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    const items = (data.items as Record<string, unknown>[]) ?? []
    return (items[0]?.path as string) ?? null
  } catch { return null }
}

export async function updateSenaiteSample(
  token: string,
  uid: string,
  fields: {
    DateSampled?: string; SampleType?: string; ClientSampleID?: string; Batch?: string
    Priority?: string; Composite?: boolean; InternalUse?: boolean
    ClientOrderNumber?: string; ClientReference?: string; Remarks?: string
    Preservation?: string; SamplePoint?: string; SamplingDeviation?: string
    Contact?: string; CCContact?: string[]; CCEmails?: string
  }
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
          if (k === 'SampleType' || k === 'Batch' || k === 'Preservation' || k === 'SamplePoint' || k === 'SamplingDeviation' || k === 'Contact') {
            return (got as { uid?: string } | null)?.uid === v
          }
          if (k === 'CCContact') {
            const gotUids = ((got as { uid?: string }[] | null) ?? []).map(c => c.uid)
            return Array.isArray(v) && v.every(u => gotUids.includes(u))
          }
          if (k === 'DateSampled') return typeof got === 'string' && typeof v === 'string' && got.slice(0, 10) === v.slice(0, 10)
          return got === v
        })
        if (applied) return { success: true }
      }
    }
    return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
  } catch (e) { return { success: false, error: String(e) } }
}

/** Best-effort push of the full analyses list to an existing SENAITE AR — a
 * plain field-set via v1/update, same mechanism createSenaiteSample() uses to
 * set Analyses at creation time. SENAITE's own add/remove analyses workflow
 * actions are more robust for this, but aren't exposed on this build's REST
 * surface (see CLAUDE.md §16f) — this is the same best-effort path already
 * relied on elsewhere in this file. Caller is responsible for only invoking
 * this while the sample is still in a state where analyses are editable. */
export async function updateSenaiteSampleAnalyses(
  token: string, uid: string, analysisUids: string[],
): Promise<{ success: boolean; error?: string }> {
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ uid, Analyses: analysisUids }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (res.ok && data.success !== false) return { success: true }
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
      // v1/update rejects a list-wrapped body — must be a single bare object
      // (same bug independently found/fixed in updateSenaiteSampleType/updateSenaiteContainerType).
      body: JSON.stringify({ uid: worksheetUid, Analyses: analysisUids.map(uid => ({ uid })) }),
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
    //
    // Found while building Quality Result Import (2026-07-17): that same
    // /update/<uid> call 400s with "Calculation Interim Fields is required"
    // for ANY Analysis whose Service has an Interim Fields template
    // configured — even with no Calculation formula attached (confirmed
    // live: SOIL_PH has a non-null InterimFields entry and always 400s on a
    // bare {Result} body; PH Test has InterimFields: null and never did).
    // This silently broke every Result submission for such analyses,
    // including through the existing Batches UI, not just the new importer.
    // Fix: fetch the analysis's current InterimFields and pass it back
    // unchanged (default null to []) — satisfies the validator without
    // altering any real interim sub-result data.
    const beforeRes = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Analysis/${analysisUid}?complete=true`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    const beforeData = await beforeRes.json().catch(() => ({})) as Record<string, unknown>
    const interimFields = (beforeData.items as Record<string, unknown>[] | undefined)?.[0]?.InterimFields ?? []

    const updateRes = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update/${analysisUid}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ Result: result, InterimFields: interimFields }),
      cache: 'no-store',
    })
    const updateData = await updateRes.json().catch(() => ({})) as Record<string, unknown>
    if (!updateRes.ok || updateData.success === false) {
      // Confirmed live (2026-07-22): for an Analysis whose Service/Analysis
      // has any blank detection-limit field, this endpoint returns HTTP 200
      // with `success:false, message:"Value '' is not floatable"` — the same
      // to_float('') crash as the submit-transition render bug above, this
      // time surfacing while the endpoint recomputes a formatted-result
      // summary for its own JSON response, AFTER the Result field has
      // already been written. `updateData.success===false` is therefore not
      // trustworthy either; verify by re-fetching the Result value itself
      // before treating this as a real failure.
      const verifyRes = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Analysis/${analysisUid}?complete=true`, {
        headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      })
      const verifyData = await verifyRes.json().catch(() => ({})) as Record<string, unknown>
      const savedResult = (verifyData.items as Record<string, unknown>[] | undefined)?.[0]?.Result
      if (String(savedResult ?? '') !== String(result)) {
        return { success: false, error: (updateData.message as string) ?? `Update failed: HTTP ${updateRes.status}` }
      }
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
    //
    // The inverse is also true, confirmed live (2026-07-22): `res.ok` can be
    // FALSE (500) even though the transition itself genuinely committed —
    // the 500 comes from the classic-UI redirect target's own page render
    // (the Analysis's base_view), which crashes with `APIError: Value '' is
    // not floatable` whenever its Analysis Service has a blank
    // LowerLimitOfQuantification/UpperLimitOfQuantification (getLowerLimitOfQuantification
    // calls to_float('') while rendering the result-entry widget) — unrelated
    // to whether the workflow transition succeeded. So a non-ok response here
    // must NOT short-circuit; only the re-fetched review_state below is
    // trustworthy proof either way.
    await _contentStatusModify(token, path, 'submit')

    // The catalog-brain metadata `review_state` reads from can lag the
    // just-committed ZODB transaction by up to a second or two (confirmed
    // live 2026-07-22: a re-check moments later, e.g. the next CSV import's
    // own preview pass, correctly saw "to_be_verified" for an analysis this
    // same check had just reported as still "assigned"). A single immediate
    // re-fetch isn't reliable proof of failure — poll briefly before giving up.
    let stateAfter: string | undefined
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1000))
      const afterRes = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Analysis/${analysisUid}?complete=true`, {
        headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      })
      const afterData = await afterRes.json().catch(() => ({})) as Record<string, unknown>
      const afterItems = (afterData.items as Record<string, unknown>[]) ?? []
      stateAfter = afterItems[0]?.review_state as string | undefined
      if (stateAfter === 'to_be_verified' || stateAfter === 'verified') break
    }
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
  // Added for the Results admin page (app/actions/results.ts) — kept on the
  // shared type rather than a parallel fetch so every caller reads from the
  // one already-proven `v1/Analysis?complete=true` call (DRY).
  submittedBy: string
  verifiedBy: string
  resultCaptureDate: string | null
  resultsRangeMin: number | null
  resultsRangeMax: number | null
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
    return (data.items ?? []).map((a: Record<string, unknown>) => {
      // ResultsRange (bika.lims.content.abstractroutineanalysis.getResultsRange)
      // is a {min, max, warn_min, warn_max} dict per-Analysis, or null/empty
      // when no Specification applies — never an AR-level join, confirmed by
      // reading the SENAITE source directly (not guessed).
      const range = (a.ResultsRange && typeof a.ResultsRange === 'object') ? a.ResultsRange as Record<string, unknown> : null
      const toNum = (v: unknown): number | null => {
        if (v === null || v === undefined || v === '') return null
        const n = Number(v)
        return Number.isFinite(n) ? n : null
      }
      const verificators = Array.isArray(a.getVerificators) ? (a.getVerificators as unknown[]) : []
      return {
        uid:          (a.uid as string) ?? '',
        title:        (a.title as string) ?? '',
        Keyword:      (a.Keyword as string) ?? (a.getKeyword as string) ?? '',
        Result:       (a.Result as string) ?? '',
        Unit:         (a.Unit as string) ?? (a.getUnit as string) ?? '',
        review_state: (a.review_state as string) ?? '',
        sampleId:     (a.getRequestID as string) ?? '',
        submittedBy:  (a.getSubmittedBy as string) ?? '',
        verifiedBy:   (a.getLastVerificator as string) ?? (verificators[verificators.length - 1] as string) ?? '',
        resultCaptureDate: (a.getResultCaptureDate as string) ?? (a.ResultCaptureDate as string) ?? null,
        resultsRangeMin: toNum(range?.min),
        resultsRangeMax: toNum(range?.max),
      }
    })
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

// ─── Calculations ────────────────────────────────────────────────────────────
//
// SENAITE's Calculation.Formula field has a registered validator
// ("formulavalidator") that reads request.form["InterimFields"] — raw classic
// Zope form-POST data — to decide whether a bracketed [keyword] in the formula
// is a valid interim variable. plone.restapi's JSON body never populates
// request.form, so every REST path (legacy v1 create, restapi POST/PATCH, any
// field ordering) rejects any formula referencing an interim keyword —
// confirmed via direct testing against a live instance. Two custom Zope views
// (senaite-rebrand/calculation_views.py, baked into the SENAITE image) call
// bika.lims.api.create()/edit() instead, which set AT fields via their
// mutators and never invoke that validator — Calculation.setFormula() is
// already safe to call directly, it just extracts real service keywords for
// DependentServices and silently ignores anything else (interim keywords
// included). List/read still goes through the normal v1 API.

// Full real subfield set, confirmed from SENAITE's own field class
// (bika/lims/browser/fields/interimfieldsfield.py InterimFieldsField) — not
// the trimmed 4-field version this shipped with first, which the user caught
// missing choices/control type/allow empty/unit/report/apply-wide.
export type SenaiteInterimControlType =
  '' | 'string' | 'datetime' | 'select' | 'multiselect' | 'multiselect_duplicates' | 'multichoice' | 'multivalue'

export type SenaiteCalculationInterimField = {
  keyword: string
  title: string
  value: string
  choices: string
  resultType: SenaiteInterimControlType
  allowEmpty: boolean
  unit: string
  report: boolean
  hidden: boolean
  wide: boolean
}

export type SenaiteCalculationDependentService = {
  uid: string
  title: string
  keyword: string
}

export type SenaiteCalculationPythonImport = {
  module: string
  function: string
}

export type SenaiteCalculationTestParameter = {
  keyword: string
  value: string
}

export type SenaiteCalculation = {
  uid: string
  id: string
  title: string
  description: string
  formula: string
  interimFields: SenaiteCalculationInterimField[]
  dependentServiceUids: string[]
  pythonImports: SenaiteCalculationPythonImport[]
  testParameters: SenaiteCalculationTestParameter[]
  testResult: string
  isActive: boolean
}

function mapInterimField(f: Record<string, unknown>): SenaiteCalculationInterimField {
  return {
    keyword: (f.keyword as string) ?? '',
    title: (f.title as string) ?? '',
    value: (f.value as string) ?? '',
    choices: (f.choices as string) ?? '',
    resultType: ((f.result_type as string) ?? '') as SenaiteInterimControlType,
    allowEmpty: Boolean(f.allow_empty),
    unit: (f.unit as string) ?? '',
    report: Boolean(f.report),
    hidden: Boolean(f.hidden),
    wide: Boolean(f.wide),
  }
}

// SENAITE's v1 API serializes an empty reference/records field as `{}` (an
// object), not `[]`, when it has zero items — `?? []` only replaces
// null/undefined, so `(c.Field ?? []).map(...)` threw on every calculation
// with no dependent services, which the outer try/catch silently swallowed
// as "no calculations at all". Confirmed via runtime logs, not guessed —
// `TypeError: (a.DependentServices ?? []).map is not a function`.
function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value : []
}

export async function fetchSenaiteCalculations(token: string): Promise<SenaiteCalculation[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Calculation?complete=true&limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    const all: SenaiteCalculation[] = asArray(data.items).map((c: Record<string, unknown>) => ({
      uid: (c.uid as string) ?? '',
      id: (c.id as string) ?? '',
      title: (c.title as string) ?? '',
      description: (c.description as string) ?? '',
      formula: (c.Formula as string) ?? '',
      interimFields: asArray(c.InterimFields).map(mapInterimField),
      dependentServiceUids: asArray(c.DependentServices)
        .map(d => (d.uid as string) ?? '').filter(Boolean),
      pythonImports: asArray(c.PythonImports).map(p => ({
        module: (p.module as string) ?? '', function: (p.function as string) ?? '',
      })),
      testParameters: asArray(c.TestParameters).map(p => ({
        keyword: (p.keyword as string) ?? '', value: String(p.value ?? ''),
      })),
      testResult: (c.TestResult as string) ?? '',
      isActive: c.review_state === 'active',
    }))
    // Same unreliable-headless-create caveat as AnalysisService — a failed
    // create call can still leave an untitled orphan behind. Filter blanks.
    return all.filter(c => c.uid && c.title)
  } catch (e) {
    // Next.js throws a special internal error (digest === 'DYNAMIC_SERVER_USAGE')
    // during its own static-render trial pass for routes using a no-store
    // fetch — that must propagate to Next's own handler, not be swallowed
    // here as if it were a real network failure.
    if ((e as { digest?: string })?.digest?.startsWith('DYNAMIC_SERVER_USAGE')) throw e
    return []
  }
}

export type CalculationPayload = {
  title: string
  description?: string
  formula: string
  interimFields: SenaiteCalculationInterimField[]
  pythonImports?: SenaiteCalculationPythonImport[]
}

function calculationFromViewResponse(d: Record<string, unknown>): SenaiteCalculation {
  return {
    uid: (d.uid as string) ?? '',
    id: (d.id as string) ?? '',
    title: (d.title as string) ?? '',
    description: (d.description as string) ?? '',
    formula: (d.formula as string) ?? '',
    interimFields: asArray(d.interim_fields).map(mapInterimField),
    dependentServiceUids: asArray(d.dependent_services)
      .map(s => (s.uid as string) ?? '').filter(Boolean),
    pythonImports: asArray(d.python_imports).map(p => ({
      module: (p.module as string) ?? '', function: (p.function as string) ?? '',
    })),
    testParameters: asArray(d.test_parameters).map(p => ({
      keyword: (p.keyword as string) ?? '', value: String(p.value ?? ''),
    })),
    testResult: (d.test_result as string) ?? '',
    isActive: Boolean(d.is_active),
  }
}

// Wire format for AT's InterimFields RecordsField uses SENAITE's own
// snake_case subfield names (result_type, allow_empty) — not the camelCase
// TS property names.
function interimFieldToWire(f: SenaiteCalculationInterimField): Record<string, unknown> {
  return {
    keyword: f.keyword, title: f.title, value: f.value, choices: f.choices,
    result_type: f.resultType, allow_empty: f.allowEmpty, unit: f.unit,
    report: f.report, hidden: f.hidden, wide: f.wide,
  }
}

export async function createSenaiteCalculation(
  token: string, payload: CalculationPayload
): Promise<{ success: boolean; calculation?: SenaiteCalculation; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/bika_setup/bika_calculations/@@create-calculation`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: payload.title,
        description: payload.description ?? '',
        formula: payload.formula,
        interim_fields: payload.interimFields.map(interimFieldToWire),
        ...(payload.pythonImports ? { python_imports: payload.pythonImports } : {}),
      }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || !data.success) return { success: false, error: (data.error as string) ?? `HTTP ${res.status}` }
    return { success: true, calculation: calculationFromViewResponse(data) }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function updateSenaiteCalculation(
  token: string, uid: string, payload: Partial<CalculationPayload>
): Promise<{ success: boolean; calculation?: SenaiteCalculation; error?: string }> {
  try {
    const path = await _resolvePath(token, 'Calculation', uid)
    if (!path) return { success: false, error: 'Calculation not found in the lab system.' }

    const body: Record<string, unknown> = {}
    if (payload.title !== undefined) body.title = payload.title
    if (payload.description !== undefined) body.description = payload.description
    if (payload.formula !== undefined) body.formula = payload.formula
    if (payload.interimFields !== undefined) body.interim_fields = payload.interimFields.map(interimFieldToWire)
    if (payload.pythonImports !== undefined) body.python_imports = payload.pythonImports

    const res = await fetch(`${SENAITE_URL}${path}/@@update-calculation`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || !data.success) return { success: false, error: (data.error as string) ?? `HTTP ${res.status}` }
    return { success: true, calculation: calculationFromViewResponse(data) }
  } catch (e) { return { success: false, error: String(e) } }
}

/** Run the formula against test values (mirrors SENAITE's own "Test
 * Parameters" / "Test Result" panel). SENAITE normally computes this via an
 * objectmodified event subscriber that never fires for our direct API calls,
 * so the custom @@test-calculation view replicates it explicitly. */
export async function runSenaiteCalculationTest(
  token: string, uid: string, testParameters: SenaiteCalculationTestParameter[]
): Promise<{ success: boolean; calculation?: SenaiteCalculation; error?: string }> {
  try {
    const path = await _resolvePath(token, 'Calculation', uid)
    if (!path) return { success: false, error: 'Calculation not found in the lab system.' }

    const res = await fetch(`${SENAITE_URL}${path}/@@test-calculation`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ test_parameters: testParameters }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || !data.success) return { success: false, error: (data.error as string) ?? `HTTP ${res.status}` }
    return { success: true, calculation: calculationFromViewResponse(data) }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function setSenaiteCalculationActive(
  token: string, uid: string, active: boolean,
): Promise<{ success: boolean; error?: string }> {
  const headers = { Authorization: `Basic ${token}`, Accept: 'application/json' }
  const workflowAction = active ? 'activate' : 'deactivate'
  try {
    const path = await _resolvePath(token, 'Calculation', uid)
    if (!path) return { success: false, error: 'Calculation not found in the lab system.' }

    const ok = await _contentStatusModify(token, path, workflowAction)
    if (!ok) return { success: false, error: 'Failed to trigger the status change.' }

    const check = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Calculation?UID=${encodeURIComponent(uid)}`, { headers, cache: 'no-store' })
    const item = ((await check.json()).items ?? [])[0]
    const state = (item?.review_state as string) ?? ''
    const good = active ? state === 'active' : state === 'inactive'
    return good ? { success: true } : { success: false, error: `Status is still '${state}'.` }
  } catch (e) { return { success: false, error: String(e) } }
}

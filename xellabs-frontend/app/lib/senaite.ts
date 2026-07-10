const SENAITE_URL = process.env.SENAITE_URL ?? 'http://senaite:8080/senaite'

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

// ─── Sample Types ────────────────────────────────────────────────────────────

export type SenaiteSampleType = {
  uid: string
  id: string
  title: string
  Prefix: string
  MinimumVolume: string
  RetentionPeriod: Record<string, unknown>
}

export async function fetchSenaiteSampleTypes(token: string): Promise<SenaiteSampleType[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/SampleType?complete=true&limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []).map((t: Record<string, unknown>) => ({
      uid:           (t.uid as string) ?? '',
      id:            (t.id as string) ?? '',
      title:         (t.title as string) ?? '',
      Prefix:        (t.Prefix as string) ?? (t.prefix as string) ?? '',
      MinimumVolume: (t.MinimumVolume as string) ?? (t.min_volume as string) ?? '',
      RetentionPeriod: (t.RetentionPeriod as Record<string, unknown>) ?? (t.retention_period as Record<string, unknown>) ?? {},
    }))
  } catch { return [] }
}

export async function createSenaiteSampleType(
  token: string,
  payload: { title: string; Prefix: string; MinimumVolume?: string }
): Promise<{ success: boolean; sampleType?: SenaiteSampleType; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        portal_type: 'SampleType',
        parent_path: '/senaite/setup/sampletypes',
        title: payload.title,
        Prefix: payload.Prefix,
        min_volume: payload.MinimumVolume || '1 ml',
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
    const t = items[0]
    return {
      success: true,
      sampleType: {
        uid: (t.uid as string) ?? '',
        id: (t.id as string) ?? '',
        title: (t.title as string) ?? '',
        Prefix: (t.prefix as string) ?? (t.Prefix as string) ?? '',
        MinimumVolume: (t.min_volume as string) ?? (t.MinimumVolume as string) ?? '',
        RetentionPeriod: (t.retention_period as Record<string, unknown>) ?? {},
      },
    }
  } catch (e) { return { success: false, error: String(e) } }
}

export async function updateSenaiteSampleType(
  token: string,
  uid: string,
  payload: { title?: string; Prefix?: string; MinimumVolume?: string; min_volume?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify([{ uid, ...payload }]),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    return { success: true }
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
  review_state: string
}

async function fetchSenaiteTitleMap(token: string, portalType: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/${portalType}?complete=true&limit=1000`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return {}
    const data = await res.json()
    const map: Record<string, string> = {}
    for (const item of data.items ?? []) {
      if (item.uid) map[item.uid] = item.title ?? ''
    }
    return map
  } catch { return {} }
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

    // InstrumentType/Manufacturer/Supplier come back as {uid, url, api_url} refs, not titles.
    const [typeMap, manufacturerMap, supplierMap] = await Promise.all([
      fetchSenaiteTitleMap(token, 'InstrumentType'),
      fetchSenaiteTitleMap(token, 'Manufacturer'),
      fetchSenaiteTitleMap(token, 'Supplier'),
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
        parent_path: '/senaite/setup/analysiscategories',
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
        parent_path: '/senaite/bika_setup/bika_analysisservices',
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
  Analyses: { uid: string; title: string; Keyword: string; review_state: string }[]
  url: string
}

function mapSample(s: Record<string, unknown>): SenaiteSample {
  const client = (s.Client as Record<string, unknown>) ?? {}
  const sampleType = (s.SampleType as Record<string, unknown>) ?? {}
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
        parent_path: `${new URL(SENAITE_URL).pathname}/worksheets`,
        Analyses: analysisUids.map(uid => ({ uid })),
      }),
      cache: 'no-store',
    })
    const rawText = await res.text()
    console.log('[createSenaiteWorksheet] status:', res.status, 'body:', rawText)
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
    const updateRes = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify([{ uid: analysisUid, Result: result }]),
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

    const ok = await _contentStatusModify(token, path, 'submit')
    if (!ok) return { success: false, error: 'Failed to submit result for verification.' }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

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
      Prefix:        (t.Prefix as string) ?? '',
      MinimumVolume: (t.MinimumVolume as string) ?? '',
      RetentionPeriod: (t.RetentionPeriod as Record<string, unknown>) ?? {},
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
    return (data.items ?? []).map((s: Record<string, unknown>) => ({
      uid:      (s.uid as string) ?? '',
      id:       (s.id as string) ?? '',
      title:    (s.title as string) ?? '',
      Keyword:  (s.Keyword as string) ?? '',
      Category: typeof s.Category === 'object' && s.Category !== null ? ((s.Category as Record<string, unknown>).title as string) ?? '' : (s.Category as string) ?? '',
      Price:    (s.Price as string) ?? '',
      Unit:     (s.Unit as string) ?? '',
    }))
  } catch { return [] }
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
    Client: string        // client UID
    Contact?: string      // contact UID (optional)
    SampleType: string    // sample type UID
    DateSampled: string   // ISO date string
    Analyses?: string[]   // analysis service UIDs
    Priority?: string     // "1"-"5"
    ClientSampleID?: string
  }
): Promise<{ success: boolean; sample?: SenaiteSample; error?: string }> {
  try {
    // SENAITE jsonapi v1 create endpoint
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/create`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify([{
        obj_type: 'AnalysisRequest',
        ...payload,
        Priority: payload.Priority ?? '3',
      }]),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) {
      return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    }
    const items = (data.items as Record<string, unknown>[]) ?? []
    if (items.length === 0) return { success: false, error: 'No sample returned from SENAITE' }
    return { success: true, sample: mapSample(items[0]) }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function senaiteWorkflowAction(
  token: string,
  uid: string,
  action: 'receive' | 'verify' | 'publish' | 'retract' | 'cancel'
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/AnalysisRequest/${uid}/workflow_action`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ action }),
      cache: 'no-store',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>
      return { success: false, error: (err.message as string) ?? `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
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

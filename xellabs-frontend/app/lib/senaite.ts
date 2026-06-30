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

const SENAITE_URL = process.env.SENAITE_URL ?? 'http://senaite:8080/senaite'

export type SenaiteUser = {
  userid: string
  fullname: string
  email: string
  roles: string[]
}

export type SenaiteLoginResult = {
  token: string
  user: SenaiteUser
}

export async function senaiteLogin(
  username: string,
  password: string
): Promise<SenaiteLoginResult | null> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ __ac_name: username, __ac_password: password }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.authenticated) return null
    return {
      token: data.token ?? '',
      user: {
        userid: data.userid ?? username,
        fullname: data.fullname ?? username,
        email: data.email ?? '',
        roles: data.roles ?? [],
      },
    }
  } catch {
    return null
  }
}

export function mapSenaiteRole(roles: string[]): string {
  if (roles.includes('LabManager')) return 'lab_manager'
  if (roles.includes('Analyst')) return 'analyst'
  if (roles.includes('Verifier')) return 'reviewer'
  if (roles.includes('Client')) return 'client'
  if (roles.includes('Manager') || roles.includes('Site Administrator')) return 'admin'
  return 'analyst'
}

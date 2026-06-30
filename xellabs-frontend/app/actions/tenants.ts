'use server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/lib/session'

const DJANGO_API = process.env.DJANGO_API_URL ?? 'http://django:8001'

export type TenantDomain = { id: number; domain: string; is_primary: boolean }

export type TenantDetail = {
  id: number
  name: string
  slug: string
  schema_name: string
  email: string
  phone: string
  address: string
  logo: string | null
  is_active: boolean
  created_at: string
  domains: TenantDomain[]
}

export type TenantUser = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  role: string
  is_active: boolean
  date_joined: string
}

async function token(): Promise<string | null> {
  const session = await getSession()
  return session?.djangoToken || null
}

function authHeader(t: string) {
  return { Authorization: `Token ${t}`, 'Content-Type': 'application/json' }
}

export async function getTenant(tenantId: number): Promise<TenantDetail | null> {
  const t = await token()
  if (!t) return null
  try {
    const res = await fetch(`${DJANGO_API}/api/tenants/${tenantId}/`, {
      headers: authHeader(t),
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function getTenantUsers(tenantId: number): Promise<TenantUser[]> {
  const t = await token()
  if (!t) return []
  try {
    const res = await fetch(`${DJANGO_API}/api/tenants/${tenantId}/users/`, {
      headers: authHeader(t),
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data
  } catch {
    return []
  }
}

export async function uploadTenantLogo(
  tenantId: number,
  formData: FormData
): Promise<{ logo: string | null; error?: string }> {
  const t = await token()
  if (!t) return { logo: null, error: 'Not authenticated' }
  try {
    const res = await fetch(`${DJANGO_API}/api/tenants/${tenantId}/logo/`, {
      method: 'POST',
      headers: { Authorization: `Token ${t}` },   // no Content-Type — let fetch set multipart boundary
      body: formData,
      cache: 'no-store',
    })
    if (!res.ok) return { logo: null, error: `Upload failed (${res.status})` }
    const data = await res.json()
    revalidatePath('/dashboard/clients')
    return { logo: data.logo }
  } catch {
    return { logo: null, error: 'Could not reach server' }
  }
}

export async function removeTenantLogo(tenantId: number): Promise<void> {
  const t = await token()
  if (!t) return
  try {
    await fetch(`${DJANGO_API}/api/tenants/${tenantId}/logo/`, {
      method: 'DELETE',
      headers: authHeader(t),
      cache: 'no-store',
    })
    revalidatePath('/dashboard/clients')
  } catch { /* ignore */ }
}

'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

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

export async function getTenant(tenantId: number): Promise<TenantDetail | null> {
  try {
    const res = await djangoFetch(`/api/tenants/${tenantId}/`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function getTenantUsers(tenantId: number): Promise<TenantUser[]> {
  try {
    const res = await djangoFetch(`/api/tenants/${tenantId}/users/`)
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
  try {
    const res = await djangoFetch(`/api/tenants/${tenantId}/logo/`, {
      method: 'POST',
      body: formData,
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
  try {
    await djangoFetch(`/api/tenants/${tenantId}/logo/`, { method: 'DELETE' })
    revalidatePath('/dashboard/clients')
  } catch { /* ignore */ }
}

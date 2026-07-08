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

export type TenantFormState = {
  success?: boolean
  message?: string
  admin_username?: string
  admin_password?: string
  errors?: Record<string, string[] | undefined>
}

export async function getTenants(): Promise<TenantDetail[]> {
  try {
    const res = await djangoFetch('/api/tenant-management/?page_size=500')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data
  } catch {
    return []
  }
}

export async function createTenant(
  _state: TenantFormState,
  formData: FormData
): Promise<TenantFormState> {
  const g = (key: string) => (formData.get(key) as string)?.trim() ?? ''
  const name = g('name')
  const slug = g('slug').toLowerCase()

  const errors: TenantFormState['errors'] = {}
  if (!name) errors.name = ['Organisation name is required']
  if (!slug) errors.slug = ['Slug is required']
  else if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) errors.slug = ['Use lowercase letters, numbers and hyphens only']
  if (Object.keys(errors).length > 0) return { errors }

  try {
    const res = await djangoFetch('/api/tenant-management/', {
      method: 'POST',
      body: JSON.stringify({
        name, slug,
        email: g('email'), phone: g('phone'), address: g('address'),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const parts = Object.values(data as Record<string, unknown>).flat() as string[]
      return { message: parts.length ? parts.join(' ') : `Error ${res.status}` }
    }
    revalidatePath('/dashboard/tenant-management')
    return {
      success: true,
      message: `Organisation "${name}" created successfully.`,
      admin_username: (data as { admin_username?: string }).admin_username ?? '',
      admin_password: (data as { admin_password?: string }).admin_password ?? '',
    }
  } catch {
    return { message: 'Could not reach the server. Please try again.' }
  }
}

export async function toggleTenantActive(
  tenantId: number,
  is_active: boolean
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/tenant-management/${tenantId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    })
    if (!res.ok) return { success: false, message: `Server error ${res.status}` }
    revalidatePath('/dashboard/tenant-management')
    return { success: true, message: is_active ? 'Organisation activated.' : 'Organisation deactivated.' }
  } catch {
    return { success: false, message: 'Could not reach the server.' }
  }
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
    revalidatePath('/dashboard/tenant-management')
    return { logo: data.logo }
  } catch {
    return { logo: null, error: 'Could not reach server' }
  }
}

export async function removeTenantLogo(tenantId: number): Promise<void> {
  try {
    await djangoFetch(`/api/tenants/${tenantId}/logo/`, { method: 'DELETE' })
    revalidatePath('/dashboard/tenant-management')
  } catch { /* ignore */ }
}

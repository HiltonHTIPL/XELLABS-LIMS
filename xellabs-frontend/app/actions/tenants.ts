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

export async function getTenants(): Promise<TenantDetail[]> {
  try {
    const res = await djangoFetch('/api/tenants/')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export type TenantFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function updateTenant(tenantId: number, _state: TenantFormState, formData: FormData): Promise<TenantFormState> {
  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()
  const address = (formData.get('address') as string)?.trim()
  const is_active = formData.get('is_active') === 'true'

  const errors: Record<string, string[]> = {}
  if (!name) errors.name = ['Name is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch(`/api/tenants/${tenantId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ name, email: email || '', phone: phone || '', address: address || '', is_active }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        message: (data as Record<string, string[]>).name?.[0] ?? (data as { detail?: string }).detail ?? 'Failed to update tenant.',
        errors: data as Record<string, string[]>,
      }
    }
    revalidatePath('/dashboard/tenants')
    return { success: true, message: `Tenant "${name}" updated.` }
  } catch (e) { return { message: String(e) } }
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
    revalidatePath('/dashboard/tenants')
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

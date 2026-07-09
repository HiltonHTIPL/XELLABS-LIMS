'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'
import type { StaffRole } from '@/app/lib/roles'

export type StaffUser = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  role: StaffRole
  is_active: boolean
  date_joined: string
}

export type StaffUserFormState = {
  success?: boolean
  message?: string
  login_username?: string
  login_password?: string
  errors?: Record<string, string[]>
}

export async function getStaffUsers(): Promise<StaffUser[]> {
  try {
    const res = await djangoFetch('/api/users/?page_size=200')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data
  } catch {
    return []
  }
}

export async function createStaffUser(
  _state: StaffUserFormState,
  formData: FormData
): Promise<StaffUserFormState> {
  const g = (key: string) => (formData.get(key) as string)?.trim() ?? ''

  const username = g('username')
  const role     = g('role')

  const errors: Record<string, string[]> = {}
  if (!username) errors.username = ['Username is required']
  if (!role)     errors.role     = ['Role is required']
  if (Object.keys(errors).length) return { errors }

  const payload = {
    username,
    role,
    email: g('email'),
    first_name: g('first_name'),
    last_name: g('last_name'),
  }

  try {
    const res = await djangoFetch('/api/users/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      if (err.username) return { errors: { username: err.username } }
      if (err.role)     return { errors: { role: err.role } }
      return { message: err.detail ?? 'Failed to create user.' }
    }
    const created = await res.json()
    revalidatePath('/dashboard/admin')
    return {
      success: true,
      message: `User "${username}" created successfully.`,
      login_username: created.username,
      login_password: created.login_password ?? '',
    }
  } catch {
    return { message: 'Could not reach the server. Please try again.' }
  }
}

export async function updateStaffUser(
  id: number,
  _state: StaffUserFormState,
  formData: FormData
): Promise<StaffUserFormState> {
  const g = (key: string) => (formData.get(key) as string)?.trim() ?? ''

  const role = g('role')
  const errors: Record<string, string[]> = {}
  if (!role) errors.role = ['Role is required']
  if (Object.keys(errors).length) return { errors }

  const payload = {
    role,
    email: g('email'),
    first_name: g('first_name'),
    last_name: g('last_name'),
  }

  try {
    const res = await djangoFetch(`/api/users/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      if (err.role) return { errors: { role: err.role } }
      return { message: err.detail ?? 'Failed to update user.' }
    }
    revalidatePath('/dashboard/admin')
    return { success: true, message: 'User updated successfully.' }
  } catch {
    return { message: 'Could not reach the server. Please try again.' }
  }
}

export async function toggleStaffUserActive(
  id: number,
  is_active: boolean
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/users/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    })
    if (!res.ok) return { success: false, message: `Server error ${res.status}` }
    revalidatePath('/dashboard/admin')
    return { success: true, message: is_active ? 'User activated.' : 'User deactivated.' }
  } catch {
    return { success: false, message: 'Could not reach the server.' }
  }
}

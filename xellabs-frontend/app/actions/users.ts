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
  senaite_roles: string[]
}

export type StaffUserFormState = {
  success?: boolean
  message?: string
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
  // Not trimmed — a password legitimately may start/end with a space.
  const raw = (key: string) => (formData.get(key) as string) ?? ''

  const username = g('username')
  const password = raw('password')
  const confirmPassword = raw('confirm_password')

  const errors: Record<string, string[]> = {}
  if (!username) errors.username = ['Username is required']
  if (!password) errors.password = ['Password is required']
  if (password && password !== confirmPassword) errors.confirm_password = ['Passwords do not match']
  if (Object.keys(errors).length) return { errors }

  const payload = {
    username,
    password,
    confirm_password: confirmPassword,
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
      if (err.password) return { errors: { password: err.password } }
      if (err.confirm_password) return { errors: { confirm_password: err.confirm_password } }
      return { message: err.detail ?? 'Failed to create user.' }
    }
    revalidatePath('/dashboard/admin/users')
    return { success: true, message: `User "${username}" created successfully.` }
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
    revalidatePath('/dashboard/admin/users')
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
    revalidatePath('/dashboard/admin/users')
    return { success: true, message: is_active ? 'User activated.' : 'User deactivated.' }
  } catch {
    return { success: false, message: 'Could not reach the server.' }
  }
}

export async function toggleSenaiteRole(
  id: number,
  role: string,
  enabled: boolean
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await djangoFetch(`/api/users/${id}/senaite-roles/`, {
      method: 'POST',
      body: JSON.stringify({ role, enabled }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { success: false, message: err.detail ?? `Server error ${res.status}` }
    }
    revalidatePath('/dashboard/admin/users')
    return { success: true }
  } catch {
    return { success: false, message: 'Could not reach the server.' }
  }
}

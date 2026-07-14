'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type SenaiteGroup = {
  id: string
  title: string
  roles: string[]
  member_count: number
}

export async function getSenaiteGroups(): Promise<SenaiteGroup[]> {
  try {
    const res = await djangoFetch('/api/senaite-groups/')
    if (!res.ok) return []
    return await res.json()
  } catch { return [] }
}

export async function createSenaiteGroup(
  id: string,
  title: string
): Promise<{ success: boolean; message: string }> {
  const groupId = id.trim()
  if (!groupId) return { success: false, message: 'Group ID is required.' }
  try {
    const res = await djangoFetch('/api/senaite-groups/', {
      method: 'POST',
      body: JSON.stringify({ id: groupId, title: title.trim() || groupId }),
    })
    const data = await res.json().catch(() => ({}))
    revalidatePath('/dashboard/admin/users')
    return {
      success: res.ok,
      message: res.ok ? `Group "${groupId}" created.` : ((data as { detail?: string; id?: string[] }).detail ?? (data as { id?: string[] }).id?.[0] ?? 'Failed to create group.'),
    }
  } catch (e) { return { success: false, message: String(e) } }
}

export async function deleteSenaiteGroup(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/senaite-groups/${encodeURIComponent(id)}/`, { method: 'DELETE' })
    revalidatePath('/dashboard/admin/users')
    return { success: res.ok, message: res.ok ? 'Group removed.' : 'Failed to remove group.' }
  } catch (e) { return { success: false, message: String(e) } }
}

export async function toggleSenaiteGroupRole(
  id: string,
  role: string,
  enabled: boolean
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await djangoFetch(`/api/senaite-groups/${encodeURIComponent(id)}/role/`, {
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

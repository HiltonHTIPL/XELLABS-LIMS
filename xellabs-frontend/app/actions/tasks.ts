'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type WorkflowTask = {
  id: number
  title: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'done' | 'cancelled'
  due_date: string | null
}

export async function getOpenTasks(): Promise<WorkflowTask[]> {
  try {
    const res = await djangoFetch('/api/compliance/workflow/tasks/?status=open')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

/* ------------------------------------------------------------------------ */
/* Full Task Management                                                     */
/* ------------------------------------------------------------------------ */

export type Task = {
  id: number
  title: string
  description: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'done' | 'cancelled'
  due_date: string | null
  content_type: number | null
  object_id: number | null
  created_by: number
  created_at: string
  updated_at: string
}

export type TaskAssignment = {
  id: number
  task: number
  assigned_to: number
  assigned_by: number
  assigned_at: string
}

export type TaskFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function getTasks(): Promise<Task[]> {
  try {
    const res = await djangoFetch('/api/compliance/workflow/tasks/?page_size=200&ordering=-created_at')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export async function getTaskAssignments(): Promise<TaskAssignment[]> {
  try {
    const res = await djangoFetch('/api/compliance/workflow/task-assignments/?page_size=500')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export async function createTask(_state: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const priority = (formData.get('priority') as string)?.trim() || 'normal'
  const due_date = (formData.get('due_date') as string)?.trim()
  const assigned_to = (formData.get('assigned_to') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!title) errors.title = ['Title is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch('/api/compliance/workflow/tasks/', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: description || '',
        priority,
        status: 'open',
        due_date: due_date ? new Date(due_date).toISOString() : null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const d = data as Record<string, string[]> & { detail?: string }
      return { message: d.title?.[0] ?? d.detail ?? 'Failed to create task.' }
    }
    const created = data as Task

    if (assigned_to) {
      await djangoFetch(`/api/compliance/workflow/tasks/${created.id}/assign/`, {
        method: 'POST',
        body: JSON.stringify({ assigned_to: Number(assigned_to) }),
      })
    }

    revalidatePath('/dashboard/tasks')
    return { success: true, message: `Task "${title}" created.` }
  } catch (e) { return { message: String(e) } }
}

export async function updateTask(id: number, _state: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const priority = (formData.get('priority') as string)?.trim() || 'normal'
  const due_date = (formData.get('due_date') as string)?.trim()
  const assigned_to = (formData.get('assigned_to') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!title) errors.title = ['Title is required']
  if (Object.keys(errors).length) return { errors }

  try {
    const res = await djangoFetch(`/api/compliance/workflow/tasks/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({
        title,
        description: description || '',
        priority,
        due_date: due_date ? new Date(due_date).toISOString() : null,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { detail?: string }
      return { message: data.detail ?? 'Failed to update task.' }
    }

    if (assigned_to) {
      await djangoFetch(`/api/compliance/workflow/tasks/${id}/assign/`, {
        method: 'POST',
        body: JSON.stringify({ assigned_to: Number(assigned_to) }),
      })
    }

    revalidatePath('/dashboard/tasks')
    return { success: true, message: `Task "${title}" updated.` }
  } catch (e) { return { message: String(e) } }
}

export async function updateTaskStatus(id: number, status: Task['status']): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/compliance/workflow/tasks/${id}/update_status/`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    })
    revalidatePath('/dashboard/tasks')
    return { success: res.ok, message: res.ok ? 'Task status updated.' : 'Failed to update status.' }
  } catch (e) { return { success: false, message: String(e) } }
}

export async function deleteTask(id: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/compliance/workflow/tasks/${id}/`, { method: 'DELETE' })
    revalidatePath('/dashboard/tasks')
    return { success: res.ok, message: res.ok ? 'Task deleted.' : 'Failed to delete task.' }
  } catch (e) { return { success: false, message: String(e) } }
}

export async function assignTask(taskId: number, userId: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/compliance/workflow/tasks/${taskId}/assign/`, {
      method: 'POST',
      body: JSON.stringify({ assigned_to: userId }),
    })
    revalidatePath('/dashboard/tasks')
    return { success: res.ok, message: res.ok ? 'User assigned.' : 'Failed to assign user.' }
  } catch (e) { return { success: false, message: String(e) } }
}

export async function unassignTask(assignmentId: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/compliance/workflow/task-assignments/${assignmentId}/`, { method: 'DELETE' })
    revalidatePath('/dashboard/tasks')
    return { success: res.ok, message: res.ok ? 'User unassigned.' : 'Failed to unassign user.' }
  } catch (e) { return { success: false, message: String(e) } }
}

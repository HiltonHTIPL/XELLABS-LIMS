'use server'
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

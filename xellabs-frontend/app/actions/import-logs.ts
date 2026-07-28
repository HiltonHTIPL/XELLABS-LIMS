'use server'

import { djangoFetch } from '@/app/lib/django'
import { getSession } from '@/app/lib/session'

export type ImportBatchPayload = {
  entity_name: string
  filename: string
  total_rows: number
  created_count: number
  skipped_count: number
  failed_count: number
  row_errors?: any
}

export async function logImportBatch(payload: ImportBatchPayload) {
  const session = await getSession()
  if (!session) {
    return { success: false, message: 'Unauthorized' }
  }

  try {
    const res = await djangoFetch('/api/compliance/audit/import-logs/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('Failed to log import batch:', err)
      return { success: false, message: 'Failed to log import batch' }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error logging import batch:', error)
    return { success: false, message }
  }
}

export type ImportLogRecord = {
  id: number
  entity_name: string
  filename: string
  total_rows: number
  created_count: number
  skipped_count: number
  failed_count: number
  row_errors?: unknown
  user?: string | null
  timestamp: string
}

// Server-side history fetch. ImportButton is a client component and must NOT
// import the server-only django.ts directly, so it goes through this action.
export async function getImportHistory(entityName: string): Promise<ImportLogRecord[]> {
  const session = await getSession()
  if (!session) return []
  try {
    const res = await djangoFetch(`/api/compliance/audit/import-logs/?entity_name=${encodeURIComponent(entityName)}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? data ?? []) as ImportLogRecord[]
  } catch (error) {
    console.error('Error fetching import history:', error)
    return []
  }
}

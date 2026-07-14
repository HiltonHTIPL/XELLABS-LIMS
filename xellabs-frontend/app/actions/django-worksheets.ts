'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type Worksheet = {
  id: number
  ws_id: string
  status: 'open' | 'in_progress' | 'to_be_verified' | 'verified' | 'rejected'
  created_at: string
  updated_at: string
  analyst: number | null
  analyst_name?: string
  instrument: number | null
  instrument_name?: string
  method: number | null
  method_name?: string
}

export type WorksheetAssignment = {
  id: number
  worksheet: number
  analysis_request: number
  test: number
  status: string
  created_at: string
  instrument: number | null
  instrument_name?: string
  method: number | null
  method_name?: string
}

export type EnrichedAssignment = WorksheetAssignment & {
  ar_id: string
  sample_id: string
  test_name: string
  test_code: string
  result_id: number | null
  result_value: string
  result_status: string
  result_submitted_at: string | null
  result_verified_at: string | null
}

export type EnrichedWorksheet = Worksheet & {
  assignment_count: number
  completed_count: number
  assignments: EnrichedAssignment[]
}

type StaffUser = { id: number; username: string; first_name: string; last_name: string }

async function fetchAllPages<T>(path: string): Promise<T[]> {
  const out: T[] = []
  let url: string | null = path
  let pages = 0
  while (url && pages < 50) {
    const res = await djangoFetch(url.startsWith('/') ? url : url.replace(/^https?:\/\/[^/]+/, ''))
    if (!res.ok) break
    const data = await res.json().catch(() => null) as { results?: T[]; next?: string | null } | T[] | null
    if (!data) break
    if (Array.isArray(data)) { out.push(...data); break }
    out.push(...(data.results ?? []))
    url = data.next ?? null
    pages += 1
  }
  return out
}

export async function getDjangoWorksheets(): Promise<EnrichedWorksheet[]> {
  try {
    const [worksheets, assignments, ars, samples, tests, results, users] = await Promise.all([
      fetchAllPages<Worksheet>('/api/lims/worksheets/?page_size=500&ordering=-created_at'),
      fetchAllPages<WorksheetAssignment>('/api/lims/worksheet-assignments/?page_size=500'),
      fetchAllPages<{ id: number; ar_id: string; sample: number }>('/api/lims/analysis-requests/?page_size=500'),
      fetchAllPages<{ id: number; sample_id: string }>('/api/lims/samples/?page_size=500'),
      fetchAllPages<{ id: number; name: string; code: string }>('/api/lims/tests/?page_size=500'),
      fetchAllPages<{ id: number; worksheet_assignment: number; value: string; status: string; submitted_at: string | null; verified_at: string | null }>('/api/lims/results/?page_size=500'),
      fetchAllPages<StaffUser>('/api/users/?page_size=500'),
    ])

    const assignmentMap = new Map(assignments.map(a => [a.id, a]))
    const arMap = new Map(ars.map(a => [a.id, a]))
    const sampleMap = new Map(samples.map(s => [s.id, s]))
    const testMap = new Map(tests.map(t => [t.id, t]))
    const resultMap = new Map(results.map(r => [r.worksheet_assignment, r]))
    const userMap = new Map(users.map(u => [u.id, u]))

    function userName(id: number | null): string {
      if (!id) return ''
      const u = userMap.get(id)
      if (!u) return ''
      const full = `${u.first_name} ${u.last_name}`.trim()
      return full || u.username
    }

    return worksheets.map(ws => {
      const wsAssignments = [...assignmentMap.values()].filter(a => a.worksheet === ws.id)
      const enriched = wsAssignments.map(a => {
        const ar = arMap.get(a.analysis_request)
        const sample = ar ? sampleMap.get(ar.sample) : undefined
        const test = testMap.get(a.test)
        const result = resultMap.get(a.id)
        return {
          ...a,
          ar_id: ar?.ar_id ?? '',
          sample_id: sample?.sample_id ?? '',
          test_name: test?.name ?? '',
          test_code: test?.code ?? '',
          result_id: result?.id ?? null,
          result_value: result?.value ?? '',
          result_status: result?.status ?? 'pending',
          result_submitted_at: result?.submitted_at ?? null,
          result_verified_at: result?.verified_at ?? null,
        }
      })

      return {
        ...ws,
        analyst_name: userName(ws.analyst),
        assignment_count: enriched.length,
        completed_count: enriched.filter(a => a.result_status === 'verified').length,
        assignments: enriched,
      }
    })
  } catch {
    return []
  }
}

export async function getDjangoWorksheet(id: number): Promise<EnrichedWorksheet | null> {
  try {
    const worksheets = await getDjangoWorksheets()
    return worksheets.find(w => w.id === id) ?? null
  } catch {
    return null
  }
}

export async function createDjangoWorksheet(): Promise<{ success: boolean; worksheet_id?: number; message: string }> {
  try {
    const res = await djangoFetch('/api/lims/worksheets/', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, message: (data as Record<string, unknown>).detail as string ?? 'Failed to create worksheet' }
    }
    const data = await res.json() as { id: number }
    revalidatePath('/dashboard/worksheets')
    return { success: true, worksheet_id: data.id, message: 'Worksheet created.' }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

export async function assignToWorksheet(worksheetId: number, analysisRequestId: number, testId: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch('/api/lims/worksheet-assignments/', {
      method: 'POST',
      body: JSON.stringify({
        worksheet: worksheetId,
        analysis_request: analysisRequestId,
        test: testId,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, message: (data as Record<string, unknown>).detail as string ?? 'Failed to assign' }
    }
    // Result is a required OneToOne on WorksheetAssignment and is never auto-created
    // by the backend — create the pending row now so result entry has something to PATCH/submit.
    const assignment = await res.json() as { id: number }
    const resultRes = await djangoFetch('/api/lims/results/', {
      method: 'POST',
      body: JSON.stringify({ worksheet_assignment: assignment.id, value: '', status: 'pending' }),
    })
    if (!resultRes.ok) {
      const data = await resultRes.json().catch(() => ({}))
      return { success: false, message: (data as Record<string, unknown>).detail as string ?? 'Assigned, but failed to create result row' }
    }
    revalidatePath(`/dashboard/worksheets/${worksheetId}`)
    return { success: true, message: 'Assignment added.' }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

export async function getAssignableUsers(): Promise<{ id: number; name: string }[]> {
  const users = await fetchAllPages<StaffUser>('/api/users/?page_size=500')
  return users.map(u => ({
    id: u.id,
    name: `${u.first_name} ${u.last_name}`.trim() || u.username,
  }))
}

export async function assignWorksheetAnalyst(worksheetId: number, userId: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/lims/worksheets/${worksheetId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ analyst: userId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, message: (data as Record<string, unknown>).detail as string ?? 'Failed to assign analyst' }
    }
    revalidatePath('/dashboard/worksheets')
    revalidatePath(`/dashboard/worksheets/${worksheetId}`)
    return { success: true, message: 'Worksheet assigned.' }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

export async function assignWorksheetInstrument(worksheetId: number, instrumentId: number | null): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/lims/worksheets/${worksheetId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ instrument: instrumentId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, message: (data as Record<string, unknown>).detail as string ?? 'Failed to set instrument' }
    }
    revalidatePath('/dashboard/worksheets')
    revalidatePath(`/dashboard/worksheets/${worksheetId}`)
    return { success: true, message: 'Instrument updated.' }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

export async function assignWorksheetMethod(worksheetId: number, methodId: number | null): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/lims/worksheets/${worksheetId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ method: methodId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, message: (data as Record<string, unknown>).detail as string ?? 'Failed to set method' }
    }
    revalidatePath('/dashboard/worksheets')
    revalidatePath(`/dashboard/worksheets/${worksheetId}`)
    return { success: true, message: 'Method updated.' }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

export async function submitResultValue(resultId: number, value: string): Promise<{ success: boolean; message: string }> {
  try {
    // submit_result() (lims/services.py) requires Result.value to already be
    // set before the transition — PATCH the value first, then trigger submit.
    const patchRes = await djangoFetch(`/api/lims/results/${resultId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    })
    if (!patchRes.ok) {
      const data = await patchRes.json().catch(() => ({}))
      return { success: false, message: (data as Record<string, unknown>).detail as string ?? 'Failed to save value' }
    }
    const res = await djangoFetch(`/api/lims/results/${resultId}/submit/`, { method: 'POST', body: JSON.stringify({}) })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, message: (data as Record<string, unknown>).detail as string ?? 'Failed to submit' }
    }
    revalidatePath('/dashboard/worksheets')
    return { success: true, message: 'Result submitted.' }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

export async function verifyResult(resultId: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/lims/results/${resultId}/verify/`, { method: 'POST', body: JSON.stringify({}) })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, message: (data as Record<string, unknown>).detail as string ?? 'Failed to verify' }
    }
    revalidatePath('/dashboard/worksheets')
    return { success: true, message: 'Result verified.' }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

export async function submitWorksheetForReview(worksheetId: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/lims/worksheets/${worksheetId}/submit_for_review/`, { method: 'POST', body: JSON.stringify({}) })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, message: (data as Record<string, unknown>).detail as string ?? 'Failed to submit' }
    }
    revalidatePath('/dashboard/worksheets')
    return { success: true, message: 'Worksheet submitted for review.' }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

export async function verifyWorksheet(worksheetId: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/lims/worksheets/${worksheetId}/verify/`, { method: 'POST', body: JSON.stringify({}) })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { success: false, message: (data as Record<string, unknown>).detail as string ?? 'Failed to verify' }
    }
    revalidatePath('/dashboard/worksheets')
    return { success: true, message: 'Worksheet verified.' }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

export async function rejectWorksheet(worksheetId: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await djangoFetch(`/api/lims/worksheets/${worksheetId}/reject/`, { method: 'POST', body: JSON.stringify({}) })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) {
      return { success: false, message: (data.detail as string) ?? 'Failed to reject' }
    }
    revalidatePath('/dashboard/worksheets')
    const newWs = data.new_worksheet as { ws_id?: string } | null
    const message = newWs?.ws_id
      ? `Worksheet rejected. Unfinished analyses carried forward to ${newWs.ws_id}.`
      : 'Worksheet rejected.'
    return { success: true, message }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

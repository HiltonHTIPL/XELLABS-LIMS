'use server'
import { djangoFetch } from '@/app/lib/django'

/**
 * Test schedule for upcoming and ongoing analyses.
 *
 * Assembled entirely from existing LIMS endpoints by joining on the client,
 * mirroring the enrichment pattern in django-worksheets.ts. One row per
 * AnalysisRequest (the schedulable unit): its target due date, sample, tests,
 * priority, status, and the worksheet/analyst it has been assigned to (if any).
 * No dedicated backend endpoint is added.
 */

export type ScheduleRow = {
  ar_pk: number
  ar_id: string
  sample_id: string
  sample_type: string
  client: string
  status: string
  priority: string
  due_date: string | null
  test_names: string[]
  analyst: string
  worksheet_id: string
  worksheet_status: string
}

type ARRaw = {
  id: number; ar_id: string; sample: number; tests: number[]
  status: string; priority: string; due_date: string | null
}
type SampleRaw = { id: number; sample_id: string; sample_type_name: string; client_name: string }
type TestRaw = { id: number; name: string }
type AssignmentRaw = { id: number; worksheet: number; analysis_request: number; test: number }
type WorksheetRaw = { id: number; ws_id: string; status: string; analyst: number | null }
type UserRaw = { id: number; username: string; first_name: string; last_name: string }

async function fetchAll<T>(path: string): Promise<T[]> {
  const out: T[] = []
  let url: string | null = path
  let pages = 0
  while (url && pages < 50) {
    const res = await djangoFetch(url.startsWith('/') ? url : url.replace(/^https?:\/\/[^/]+/, ''))
    if (!res.ok) break
    const data = (await res.json().catch(() => null)) as { results?: T[]; next?: string | null } | T[] | null
    if (!data) break
    if (Array.isArray(data)) { out.push(...data); break }
    out.push(...(data.results ?? []))
    url = data.next ?? null
    pages += 1
  }
  return out
}

export async function getTestSchedule(): Promise<ScheduleRow[]> {
  try {
    const [ars, samples, tests, assignments, worksheets, users] = await Promise.all([
      fetchAll<ARRaw>('/api/lims/analysis-requests/?page_size=500&ordering=due_date'),
      fetchAll<SampleRaw>('/api/lims/samples/?page_size=500'),
      fetchAll<TestRaw>('/api/lims/tests/?page_size=500'),
      fetchAll<AssignmentRaw>('/api/lims/worksheet-assignments/?page_size=500'),
      fetchAll<WorksheetRaw>('/api/lims/worksheets/?page_size=500'),
      fetchAll<UserRaw>('/api/users/?page_size=500'),
    ])

    const sampleMap = new Map(samples.map((s) => [s.id, s]))
    const testMap = new Map(tests.map((t) => [t.id, t.name]))
    const wsMap = new Map(worksheets.map((w) => [w.id, w]))
    const userMap = new Map(users.map((u) => [u.id, u]))

    const assignmentByAR = new Map<number, AssignmentRaw>()
    for (const a of assignments) {
      if (!assignmentByAR.has(a.analysis_request)) assignmentByAR.set(a.analysis_request, a)
    }

    const userName = (id: number | null): string => {
      if (!id) return ''
      const u = userMap.get(id)
      if (!u) return ''
      return `${u.first_name} ${u.last_name}`.trim() || u.username
    }

    return ars.map((ar) => {
      const sample = sampleMap.get(ar.sample)
      const assignment = assignmentByAR.get(ar.id)
      const ws = assignment ? wsMap.get(assignment.worksheet) : undefined
      return {
        ar_pk: ar.id,
        ar_id: ar.ar_id,
        sample_id: sample?.sample_id ?? '',
        sample_type: sample?.sample_type_name ?? '',
        client: sample?.client_name ?? '',
        status: ar.status,
        priority: ar.priority,
        due_date: ar.due_date,
        test_names: (ar.tests ?? []).map((id) => testMap.get(id) ?? '').filter(Boolean),
        analyst: ws ? userName(ws.analyst) : '',
        worksheet_id: ws?.ws_id ?? '',
        worksheet_status: ws?.status ?? '',
      }
    })
  } catch {
    return []
  }
}

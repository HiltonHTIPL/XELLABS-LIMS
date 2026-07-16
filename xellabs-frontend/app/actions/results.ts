'use server'
import { djangoFetch } from '@/app/lib/django'

/**
 * Cross-sample Result search/view.
 *
 * Backed by the real Django endpoint used by the `lims` app for the
 * `Result` model — /api/lims/results/ (lims/views.py ResultViewSet,
 * registered in lims/urls.py as `router.register("results", ResultViewSet)`).
 *
 * NOTE: today's Worksheet UI (app/dashboard/worksheets) does NOT use this
 * Django endpoint — it edits results directly against SENAITE
 * (app/lib/senaite.ts submitAnalysisResult / app/actions/worksheets.ts
 * submitResult). The Django `Result` model/endpoint exists independently
 * for the Django-native lims workflow (WorksheetAssignment -> Result).
 * This page is a read-only search view over that Django Result data.
 *
 * Result model fields (lims/models.py, confirmed from source):
 *   id, worksheet_assignment (OneToOne -> WorksheetAssignment), value,
 *   unit, status ('pending'|'submitted'|'verified'|'rejected'),
 *   is_out_of_range, submitted_by (User FK), verified_by (User FK),
 *   submitted_at, verified_at, remarks, is_locked
 *
 * ResultViewSet.filterset_fields = ["status", "is_out_of_range", "worksheet_assignment"]
 * — there is no native search/date-range filter on this endpoint, and the
 * serializer is `fields = "__all__"` with no nested detail (FKs are plain
 * IDs). To support search-by-sample/test and to display human-readable
 * names, this action cross-references WorksheetAssignment, Test,
 * AnalysisRequest, Sample, Worksheet, and User lookups (all real Django
 * endpoints/filters already used elsewhere in this app) and does the
 * search/date filtering itself after joining.
 */

export type ResultStatus = 'pending' | 'submitted' | 'verified' | 'rejected'

export type Result = {
  id: number
  worksheet_assignment: number
  value: string
  unit: string
  status: ResultStatus
  is_out_of_range: boolean
  submitted_by: number | null
  verified_by: number | null
  submitted_at: string | null
  verified_at: string | null
  remarks: string
  is_locked: boolean
}

export type EnrichedResult = Result & {
  test_name: string
  sample_id: string
  sample_barcode: string
  ar_id: string
  ws_id: string
  worksheet_id: number | null
  submitted_by_name: string
  verified_by_name: string
}

export type ResultFilters = {
  search?: string
  status?: ResultStatus | ''
  is_out_of_range?: '' | 'true' | 'false'
  date_from?: string
  date_to?: string
}

type WorksheetAssignment = { id: number; worksheet: number; analysis_request: number; senaite_service_name: string }
type AnalysisRequest = { id: number; ar_id: string; sample: number }
type Sample = { id: number; sample_id: string; barcode: string }
type Worksheet = { id: number; ws_id: string }
type StaffUser = { id: number; username: string; first_name: string; last_name: string }

/** Follows DRF pagination `next` links so lookup tables are complete, not just page 1. */
async function fetchAllPages<T>(path: string, maxPages = 50): Promise<T[]> {
  const out: T[] = []
  let url: string | null = path
  let pages = 0
  while (url && pages < maxPages) {
    const res: Response = await djangoFetch(url.startsWith('/') ? url : url.replace(/^https?:\/\/[^/]+/, ''))
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

export async function getResults(filters: ResultFilters = {}): Promise<EnrichedResult[]> {
  try {
    const params = new URLSearchParams({ page_size: '500' })
    if (filters.status) params.set('status', filters.status)
    if (filters.is_out_of_range) params.set('is_out_of_range', filters.is_out_of_range)

    const [results, assignments, ars, samples, worksheets, users] = await Promise.all([
      fetchAllPages<Result>(`/api/lims/results/?${params.toString()}`),
      fetchAllPages<WorksheetAssignment>('/api/lims/worksheet-assignments/?page_size=500'),
      fetchAllPages<AnalysisRequest>('/api/lims/analysis-requests/?page_size=500'),
      fetchAllPages<Sample>('/api/lims/samples/?page_size=500'),
      fetchAllPages<Worksheet>('/api/lims/worksheets/?page_size=500'),
      fetchAllPages<StaffUser>('/api/users/?page_size=500'),
    ])

    const assignmentMap = new Map(assignments.map(a => [a.id, a]))
    const arMap = new Map(ars.map(a => [a.id, a]))
    const sampleMap = new Map(samples.map(s => [s.id, s]))
    const worksheetMap = new Map(worksheets.map(w => [w.id, w]))
    const userMap = new Map(users.map(u => [u.id, u]))

    function userName(id: number | null): string {
      if (!id) return ''
      const u = userMap.get(id)
      if (!u) return ''
      const full = `${u.first_name} ${u.last_name}`.trim()
      return full || u.username
    }

    let enriched: EnrichedResult[] = results.map(r => {
      const assignment = assignmentMap.get(r.worksheet_assignment)
      const ar = assignment ? arMap.get(assignment.analysis_request) : undefined
      const sample = ar ? sampleMap.get(ar.sample) : undefined
      const worksheet = assignment ? worksheetMap.get(assignment.worksheet) : undefined
      return {
        ...r,
        test_name: assignment?.senaite_service_name ?? '',
        sample_id: sample?.sample_id ?? '',
        sample_barcode: sample?.barcode ?? '',
        ar_id: ar?.ar_id ?? '',
        ws_id: worksheet?.ws_id ?? '',
        worksheet_id: worksheet?.id ?? null,
        submitted_by_name: userName(r.submitted_by),
        verified_by_name: userName(r.verified_by),
      }
    })

    if (filters.search) {
      const q = filters.search.trim().toLowerCase()
      if (q) {
        enriched = enriched.filter(r =>
          r.sample_id.toLowerCase().includes(q) ||
          r.sample_barcode.toLowerCase().includes(q) ||
          r.ar_id.toLowerCase().includes(q) ||
          r.ws_id.toLowerCase().includes(q) ||
          r.test_name.toLowerCase().includes(q)
        )
      }
    }

    if (filters.date_from) {
      const from = new Date(filters.date_from).getTime()
      enriched = enriched.filter(r => r.submitted_at && new Date(r.submitted_at).getTime() >= from)
    }
    if (filters.date_to) {
      const to = new Date(filters.date_to).getTime() + 24 * 60 * 60 * 1000 - 1
      enriched = enriched.filter(r => r.submitted_at && new Date(r.submitted_at).getTime() <= to)
    }

    return enriched
  } catch {
    return []
  }
}

// SENAITE-native Worksheet adapter (Phase 1: create / apply-template / info /
// list / workflow transitions). All SENAITE quirks stay isolated here
// (Adapter Pattern), same discipline as senaite.ts / senaite-setup.ts.
//
// The running SENAITE 2.6.0 Worksheet is Archetypes and can't be created via
// generic REST (its `Analyses` field is required, blocking the empty create the
// native flow performs). These calls therefore go through the custom Zope views
// baked into the SENAITE image (senaite-rebrand/worksheet_views.py):
//   POST <site>/worksheets/@@create-worksheet        {analyst?, instrument?, template?}
//   POST <object>/@@apply-worksheet-template          {template}
//   GET  <object>/@@worksheet-info
// Workflow transitions use plone.restapi's @workflow endpoint (works on AT
// content — confirmed). Reads/listing use the v1 jsonapi catalog.
import { SENAITE_URL, SENAITE_ORIGIN, SENAITE_SITE_PATH, fetchSenaiteTitleMap } from './senaite'

const authHeaders = (token: string) => ({
  Authorization: `Basic ${token}`,
  Accept: 'application/json',
})

export type WorksheetAnalysisInfo = {
  uid: string
  id: string
  title: string
  keyword: string
  portalType: string
  reviewState: string
  result: string
  sampleId: string
  sampleUid: string
}

export type WorksheetSlot = {
  position: number
  type: string          // a=Analysis, b=Blank, c=Control, d=Duplicate
  analysisUid: string
  analysis: WorksheetAnalysisInfo | null
}

export type WorksheetInfo = {
  uid: string
  id: string
  path: string
  analyst: string
  instrumentUid: string
  instrumentTitle: string
  methodUid: string
  methodTitle: string
  remarks: string
  templateUid: string
  templateTitle: string
  reviewState: string
  numRegularAnalyses: number
  numQcAnalyses: number
  slots: WorksheetSlot[]
  created: string
}

export type WorksheetListItem = {
  uid: string
  id: string
  path: string
  analyst: string
  reviewState: string
  created: string
  instrumentTitle: string
  templateTitle: string
  numAnalyses: number
}

type RawView = Record<string, unknown>

function mapAnalysis(a: RawView | null): WorksheetAnalysisInfo | null {
  if (!a) return null
  return {
    uid: (a.uid as string) ?? '',
    id: (a.id as string) ?? '',
    title: (a.title as string) ?? '',
    keyword: (a.keyword as string) ?? '',
    portalType: (a.portal_type as string) ?? '',
    reviewState: (a.review_state as string) ?? '',
    result: a.result == null ? '' : String(a.result),
    sampleId: (a.sample_id as string) ?? '',
    sampleUid: (a.sample_uid as string) ?? '',
  }
}

function mapInfo(d: RawView): WorksheetInfo {
  const slots = Array.isArray(d.layout) ? (d.layout as RawView[]) : []
  return {
    uid: (d.uid as string) ?? '',
    id: (d.id as string) ?? '',
    path: (d.url as string) ?? '',
    analyst: (d.analyst as string) ?? '',
    instrumentUid: (d.instrument_uid as string) ?? '',
    instrumentTitle: (d.instrument_title as string) ?? '',
    methodUid: (d.method_uid as string) ?? '',
    methodTitle: (d.method_title as string) ?? '',
    remarks: (d.remarks as string) ?? '',
    templateUid: (d.template_uid as string) ?? '',
    templateTitle: (d.template_title as string) ?? '',
    reviewState: (d.review_state as string) ?? '',
    numRegularAnalyses: Number(d.num_regular_analyses) || 0,
    numQcAnalyses: Number(d.num_qc_analyses) || 0,
    created: (d.created as string) ?? '',
    slots: slots.map(s => ({
      position: Number(s.position) || 0,
      type: (s.type as string) ?? 'a',
      analysisUid: (s.analysis_uid as string) ?? '',
      analysis: mapAnalysis(s.analysis as RawView | null),
    })),
  }
}

export type WorksheetWriteResult = { success: boolean; info?: WorksheetInfo; error?: string }

async function postView(token: string, url: string, body: unknown): Promise<WorksheetWriteResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      cache: 'no-store',
    })
    const text = await res.text()
    let data: RawView = {}
    try { data = JSON.parse(text) } catch { /* non-JSON */ }
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.error as string) ?? `HTTP ${res.status}` }
    }
    return { success: true, info: mapInfo(data) }
  } catch (e) { return { success: false, error: String(e) } }
}

// Create a worksheet (optionally applying a Worksheet Template that auto-fills
// routine + QC + duplicate slots). analyst/instrument/template are all optional.
export async function createSenaiteWorksheet(
  token: string,
  opts: { analyst?: string; instrument?: string; template?: string } = {},
): Promise<WorksheetWriteResult> {
  const body: RawView = {}
  if (opts.analyst) body.analyst = opts.analyst
  if (opts.instrument) body.instrument = opts.instrument
  if (opts.template) body.template = opts.template
  return postView(token, `${SENAITE_ORIGIN}${SENAITE_SITE_PATH}/worksheets/@@create-worksheet`, body)
}

// Apply a template to an existing worksheet (path = object physical path,
// e.g. /senaite/worksheets/WS-001).
export async function applyTemplateToWorksheet(
  token: string,
  path: string,
  template: string,
): Promise<WorksheetWriteResult> {
  return postView(token, `${SENAITE_ORIGIN}${path}/@@apply-worksheet-template`, { template })
}

export async function fetchWorksheetInfo(token: string, path: string): Promise<WorksheetInfo | null> {
  try {
    const res = await fetch(`${SENAITE_ORIGIN}${path}/@@worksheet-info`, {
      headers: authHeaders(token),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as RawView
    if (data.success === false) return null
    return mapInfo(data)
  } catch { return null }
}

export async function listSenaiteWorksheets(token: string): Promise<WorksheetListItem[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Worksheet?complete=true&limit=200`, {
      headers: authHeaders(token),
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    const items = Array.isArray(data.items) ? (data.items as RawView[]) : []
    // The v1 API's Instrument reference only ever comes back as {uid, url,
    // api_url} — never a resolved title (confirmed live: SENAITE never
    // populates it), same class of bug as fetchSenaiteInstruments' own
    // InstrumentType/Manufacturer/Supplier/Location refs. Resolve via a title
    // map instead of trusting `.title` on the reference object.
    const instrumentTitles = await fetchSenaiteTitleMap(token, 'Instrument')
    return items.map(w => {
      const analyst = (w.Analyst as RawView) ?? {}
      const instrument = (w.Instrument as RawView) ?? {}
      const instrumentUid = (instrument.uid as string) ?? ''
      return {
        uid: (w.uid as string) ?? '',
        id: (w.id as string) ?? '',
        path: (w.path as string) ?? '',
        analyst: (analyst.fullname as string) ?? (w.getAnalyst as string) ?? (w.Analyst as string) ?? '',
        reviewState: (w.review_state as string) ?? '',
        created: (w.created as string) ?? '',
        instrumentTitle: instrumentUid ? (instrumentTitles[instrumentUid] ?? '') : '',
        templateTitle: (w.getWorksheetTemplateTitle as string) ?? '',
        numAnalyses: Array.isArray(w.Analyses) ? (w.Analyses as unknown[]).length : 0,
      }
    })
  } catch { return [] }
}

// ── Manual worksheet building (add/remove analyses, QC, reassign) ───────────
export async function addWorksheetAnalyses(token: string, path: string, analysisUids: string[]): Promise<WorksheetWriteResult> {
  return postView(token, `${SENAITE_ORIGIN}${path}/@@add-worksheet-analyses`, { analyses: analysisUids })
}

export async function removeWorksheetAnalyses(token: string, path: string, analysisUids: string[]): Promise<WorksheetWriteResult> {
  return postView(token, `${SENAITE_ORIGIN}${path}/@@remove-worksheet-analyses`, { analyses: analysisUids })
}

export async function addWorksheetDuplicate(token: string, path: string, srcSlot: number): Promise<WorksheetWriteResult> {
  return postView(token, `${SENAITE_ORIGIN}${path}/@@add-worksheet-duplicate`, { src_slot: srcSlot })
}

export async function addWorksheetReference(token: string, path: string, referenceUid: string, serviceUids: string[]): Promise<WorksheetWriteResult> {
  return postView(token, `${SENAITE_ORIGIN}${path}/@@add-worksheet-reference`, { reference: referenceUid, services: serviceUids })
}

export async function updateWorksheet(
  token: string,
  path: string,
  fields: { analyst?: string; instrument?: string; method?: string; remarks?: string },
): Promise<WorksheetWriteResult> {
  return postView(token, `${SENAITE_ORIGIN}${path}/@@update-worksheet`, fields)
}

// Unassigned routine analyses available to add to a worksheet (from received
// samples whose analyses aren't on any worksheet yet).
export type UnassignedAnalysis = {
  uid: string
  title: string
  keyword: string
  sampleId: string
  clientTitle: string
  categoryTitle: string
}

export async function fetchUnassignedAnalyses(token: string): Promise<UnassignedAnalysis[]> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/Analysis?review_state=unassigned&complete=true&limit=500`, {
      headers: authHeaders(token),
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    const items = Array.isArray(data.items) ? (data.items as RawView[]) : []
    return items.map(a => ({
      uid: (a.uid as string) ?? '',
      title: (a.title as string) ?? '',
      keyword: (a.getKeyword as string) ?? '',
      sampleId: (a.getRequestID as string) ?? (a.getRequestUID as string) ?? '',
      clientTitle: (a.getClientTitle as string) ?? '',
      categoryTitle: (a.getCategoryTitle as string) ?? '',
    })).filter(a => a.uid)
  } catch { return [] }
}

// Lab members eligible to be a worksheet analyst (Plone member id + fullname),
// from the custom @@lab-analysts view (SENAITE's own get_users_by_roles).
export type LabAnalyst = { id: string; fullname: string }

export async function fetchLabAnalysts(token: string): Promise<LabAnalyst[]> {
  try {
    const res = await fetch(`${SENAITE_ORIGIN}${SENAITE_SITE_PATH}/worksheets/@@lab-analysts`, {
      headers: authHeaders(token),
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = (await res.json()) as RawView
    const items = Array.isArray(data.analysts) ? (data.analysts as RawView[]) : []
    return items
      .map(a => ({ id: (a.id as string) ?? '', fullname: (a.fullname as string) ?? '' }))
      .filter(a => a.id)
  } catch { return [] }
}

// ── Result entry (Phase 3) ─────────────────────────────────────────────────
// Setting a result and submitting/verifying an analysis both work over the
// v1 jsonapi `update` endpoint (confirmed live: update {uid, Result} then
// update {uid, transition:"submit"} moves an analysis assigned -> to_be_verified
// with the result stored). No custom view needed.
async function jsonapiUpdate(token: string, body: RawView): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/update`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => ({}))) as RawView
    // jsonapi returns success:false with a message on guard/validation failure;
    // on success it omits `success` but returns the updated `items`.
    if (data.success === false) return { success: false, error: (data.message as string) ?? 'Update failed.' }
    if (!res.ok) return { success: false, error: (data.message as string) ?? `HTTP ${res.status}` }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

// Set a result on an analysis (does not submit it).
export async function setAnalysisResult(token: string, analysisUid: string, result: string) {
  return jsonapiUpdate(token, { uid: analysisUid, Result: result })
}

// Fire an analysis-level workflow transition (submit / verify / retract).
export async function transitionAnalysis(token: string, analysisUid: string, transition: string) {
  return jsonapiUpdate(token, { uid: analysisUid, transition })
}

// Set a result then submit the analysis in one call (the common grid action).
export async function submitAnalysisResult(token: string, analysisUid: string, result: string) {
  const set = await setAnalysisResult(token, analysisUid, result)
  if (!set.success) return set
  return transitionAnalysis(token, analysisUid, 'submit')
}

// Fire a worksheet workflow transition (submit / verify / reject / retract /
// rollback_to_open) via plone.restapi's @workflow endpoint.
export async function transitionSenaiteWorksheet(
  token: string,
  path: string,
  transition: string,
): Promise<{ success: boolean; reviewState?: string; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_ORIGIN}${path}/@workflow/${transition}`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => ({}))) as RawView
    if (!res.ok) {
      // restapi nests the reason under `error.message`. The common case is a
      // guard block: the transition isn't available in the current state (e.g.
      // Submit before every analysis has a submitted result).
      const nested = (data.error as RawView | undefined)?.message as string | undefined
      const raw = nested ?? (data.message as string) ?? `HTTP ${res.status}`
      const guardBlocked = /no workflow provides|not available|guard/i.test(raw)
      // Different unmet precondition per transition — the worksheet-level guard
      // for 'verify' only opens once every individual analysis row has ALREADY
      // been verified one-by-one (it's a rollup, not the actual verify action);
      // 'submit' is the one that actually depends on unsubmitted results.
      const friendly = guardBlocked
        ? transition === 'verify'
          ? "This worksheet can't be verified yet — verify every analysis row individually first (or you may be the same user who submitted a result, which self-verification disallows)."
          : `This worksheet can't be ${transition}ed yet — every analysis must have a submitted result first.`
        : raw
      return { success: false, error: friendly }
    }
    return { success: true, reviewState: (data.review_state as string) ?? '' }
  } catch (e) { return { success: false, error: String(e) } }
}

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

export type WorksheetInterimField = {
  keyword: string
  title: string
  value: string
  unit: string
}

export type WorksheetAnalysisInfo = {
  uid: string
  id: string
  path: string
  title: string
  keyword: string
  portalType: string
  reviewState: string
  result: string
  sampleId: string
  sampleUid: string
  // Only non-empty when this analysis's Service has a Calculation configured
  // with Interim Fields (e.g. Soil Calcium and Magnesium: CA/MG) — most
  // analyses have none. See calculateAnalysisResult() below.
  interimFields: WorksheetInterimField[]
  calculationUid: string
  // Grading flags — only meaningful once a result exists (all false/blank
  // before then). outOfRange comes from SENAITE's real is_out_of_range(),
  // working uniformly for both a routine Analysis (graded against
  // ResultsRange, pushed from our Django Specification) and a QC
  // ReferenceAnalysis (graded against its ReferenceSample's own
  // ReferenceResults). The four *Lod/*Uoq flags come from the Analysis
  // Service's own configured detection/quantification limits.
  outOfRange: boolean
  belowLod: boolean
  aboveUdl: boolean
  belowLoq: boolean
  aboveUoq: boolean
  // manage_results detail columns (from the @@worksheet-info view)
  dl: string
  uncertainty: string
  specification: string
  retested: boolean
  methodTitle: string
  methodUid: string
  instrumentTitle: string
  instrumentUid: string
  attachmentsCount: number
  captured: string
  dueDate: string
  remarks: string
  // Rich slot-header context (routine rows use the sample fields; QC rows use
  // referenceTitle/supplierTitle; a duplicate row carries dupSourceUid, which
  // the shell maps to the source slot's position).
  clientTitle: string
  sampleType: string
  samplePoint: string
  dateReceived: string
  referenceTitle: string
  supplierTitle: string
  dupSourceUid: string
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
  // Raw SENAITE member id of the assigned analyst (e.g. "Hilton_analyst").
  // The shell resolves this to a full name via the lab-analysts list (SoC:
  // lib returns the stored value, presentation layer maps it to a label); the
  // "Mine" filter and Reassign both key off this id, not the display name.
  analystId: string
  reviewState: string
  created: string
  instrumentTitle: string
  templateTitle: string
  numAnalyses: number
  // SENAITE worksheet-list catalog columns (worksheets.pt) — progress bar +
  // the three separate counts SENAITE shows instead of one total.
  progress: number
  numRegularSamples: number
  numQcAnalyses: number
  numRegularAnalyses: number
}

type RawView = Record<string, unknown>

// SENAITE ResultsRange dict → "min – max" display string (SoC: presentation
// lives here, the view emits the raw dict). Empty when no spec is configured.
function formatRange(rr: unknown): string {
  if (!rr || typeof rr !== 'object') return ''
  const r = rr as RawView
  const min = r.min == null ? '' : String(r.min)
  const max = r.max == null ? '' : String(r.max)
  if (min && max) return `${min} – ${max}`
  return min || max || ''
}

function mapAnalysis(a: RawView | null): WorksheetAnalysisInfo | null {
  if (!a) return null
  const interimFields = Array.isArray(a.interim_fields) ? (a.interim_fields as RawView[]) : []
  return {
    uid: (a.uid as string) ?? '',
    id: (a.id as string) ?? '',
    path: (a.path as string) ?? '',
    title: (a.title as string) ?? '',
    keyword: (a.keyword as string) ?? '',
    portalType: (a.portal_type as string) ?? '',
    reviewState: (a.review_state as string) ?? '',
    result: a.result == null ? '' : String(a.result),
    sampleId: (a.sample_id as string) ?? '',
    sampleUid: (a.sample_uid as string) ?? '',
    interimFields: interimFields.map(f => ({
      keyword: (f.keyword as string) ?? '',
      title: (f.title as string) ?? '',
      value: f.value == null ? '' : String(f.value),
      unit: (f.unit as string) ?? '',
    })),
    calculationUid: (a.calculation_uid as string) ?? '',
    outOfRange: Boolean(a.out_of_range),
    belowLod: Boolean(a.below_lod),
    aboveUdl: Boolean(a.above_udl),
    belowLoq: Boolean(a.below_loq),
    aboveUoq: Boolean(a.above_uoq),
    dl: (a.detection_limit_operand as string) ?? '',
    uncertainty: a.uncertainty == null ? '' : String(a.uncertainty),
    specification: formatRange(a.results_range),
    retested: Boolean(a.retested),
    methodTitle: (a.method_title as string) ?? '',
    methodUid: (a.method_uid as string) ?? '',
    instrumentTitle: (a.instrument_title as string) ?? '',
    instrumentUid: (a.instrument_uid as string) ?? '',
    attachmentsCount: Number(a.attachments_count) || 0,
    captured: (a.result_captured as string) ?? '',
    dueDate: (a.due_date as string) ?? '',
    remarks: (a.remarks as string) ?? '',
    clientTitle: (a.client_title as string) ?? '',
    sampleType: (a.sample_type as string) ?? '',
    samplePoint: (a.sample_point as string) ?? '',
    dateReceived: (a.date_received as string) ?? '',
    referenceTitle: (a.reference_title as string) ?? '',
    supplierTitle: (a.supplier_title as string) ?? '',
    dupSourceUid: (a.dup_source_uid as string) ?? '',
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
      const instrument = (w.Instrument as RawView) ?? {}
      const instrumentUid = (instrument.uid as string) ?? ''
      // Analyst comes back as a plain member-id string on this endpoint
      // (confirmed live: both `getAnalyst` and `Analyst` are e.g.
      // "Hilton_analyst", never a resolved-fullname reference object).
      const analystId = (w.getAnalyst as string) ?? (typeof w.Analyst === 'string' ? (w.Analyst as string) : '') ?? ''
      const numRegularAnalyses = Number(w.getNumberOfRegularAnalyses) || 0
      const numQcAnalyses = Number(w.getNumberOfQCAnalyses) || 0
      return {
        uid: (w.uid as string) ?? '',
        id: (w.id as string) ?? '',
        path: (w.path as string) ?? '',
        analystId,
        reviewState: (w.review_state as string) ?? '',
        created: (w.created as string) ?? '',
        instrumentTitle: instrumentUid ? (instrumentTitles[instrumentUid] ?? '') : '',
        templateTitle: (w.getWorksheetTemplateTitle as string) ?? '',
        numAnalyses: numRegularAnalyses + numQcAnalyses,
        progress: Number(w.getProgressPercentage) || 0,
        numRegularSamples: Number(w.getNumberOfRegularSamples) || 0,
        numQcAnalyses,
        numRegularAnalyses,
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

// Delete an (empty) worksheet. SENAITE's `remove` workflow transition can't be
// driven over REST — restapi @workflow/remove 404s (it deletes then fails to
// serialize the gone object) and jsonapi update rejects it ("Analyses is
// required"). plone.restapi's plain DELETE on the object works cleanly and is
// equivalent for the empty-worksheet case (the only case we expose Remove for).
export async function deleteSenaiteWorksheet(token: string, path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_ORIGIN}${path}`, {
      method: 'DELETE',
      headers: authHeaders(token),
      cache: 'no-store',
    })
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` }
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

// Unassigned routine analyses available to add to a worksheet (from received
// samples whose analyses aren't on any worksheet yet).
export type UnassignedAnalysis = {
  uid: string
  title: string
  keyword: string
  serviceUid: string
  sampleId: string
  clientTitle: string
  clientOrderNumber: string
  categoryTitle: string
  // SENAITE priority 1..5 (1=Highest … 3=Medium default … 5=Lowest), taken from
  // the parent sample and surfaced on the add-analyses screen as an icon/label.
  priority: number
  dateReceived: string
  dueDate: string
}

// SENAITE ANALYSIS priority vocabulary (bika.lims): value → label.
export const PRIORITY_LABEL: Record<number, string> = {
  1: 'Highest', 2: 'High', 3: 'Medium', 4: 'Low', 5: 'Lowest',
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
    // Analysis Category comes back only as a {uid} reference (getCategoryTitle
    // is always null on this endpoint — confirmed live), so resolve titles via
    // a uid→title map, same pattern as the Instrument title map above.
    const categoryTitles = await fetchSenaiteTitleMap(token, 'AnalysisCategory')
    return items.map(a => {
      const category = (a.Category as RawView) ?? {}
      const categoryUid = (category.uid as string) ?? ''
      // Priority lives in the leading segment of the sort key (e.g. "3.<ts>…").
      const priority = Number((a.getPrioritySortkey as string ?? '').split('.')[0]) || 3
      return {
        uid: (a.uid as string) ?? '',
        title: (a.title as string) ?? '',
        keyword: (a.getKeyword as string) ?? '',
        serviceUid: (a.getServiceUID as string) ?? '',
        sampleId: (a.getRequestID as string) ?? (a.getRequestUID as string) ?? '',
        clientTitle: (a.getClientTitle as string) ?? '',
        clientOrderNumber: (a.getClientOrderNumber as string) ?? '',
        categoryTitle: categoryUid ? (categoryTitles[categoryUid] ?? '') : '',
        priority,
        dateReceived: (a.getDateReceived as string) ?? '',
        dueDate: (a.getDueDate as string) ?? '',
      }
    }).filter(a => a.uid)
  } catch { return [] }
}

// serviceUid → method uids the service supports (its Methods + default Method).
// Powers the add-analyses "Filter by template method" tab: an analysis matches
// the template's restrict_to_method when its own service carries that method.
// SENAITE returns an empty reference field as {} (not []), so normalize via a
// tolerant ref extractor rather than a bare cast.
function refUids(v: unknown): string[] {
  if (!v) return []
  const arr = Array.isArray(v) ? v : [v]
  return arr
    .map(x => (x && typeof x === 'object' ? ((x as RawView).uid as string) : typeof x === 'string' ? x : ''))
    .filter(Boolean)
}

export async function fetchServiceMethodMap(token: string): Promise<Record<string, string[]>> {
  try {
    const res = await fetch(`${SENAITE_URL}/@@API/senaite/v1/AnalysisService?complete=true&limit=500`, {
      headers: authHeaders(token),
      cache: 'no-store',
    })
    if (!res.ok) return {}
    const data = await res.json()
    const items = Array.isArray(data.items) ? (data.items as RawView[]) : []
    const map: Record<string, string[]> = {}
    for (const s of items) {
      const uid = (s.uid as string) ?? ''
      if (!uid) continue
      map[uid] = Array.from(new Set([...refUids(s.Methods), ...refUids(s.Method)]))
    }
    return map
  } catch { return {} }
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

// Invoke SENAITE's own Analysis.calculateResult() engine over REST via the
// @@calculate-analysis-result custom view (senaite-rebrand/analysis_calculate_view.py).
// A flat jsonapi {Result} write never triggers this — in SENAITE's own widget
// it only fires on a JS-driven interim-cell-change event, which our REST
// calls have no equivalent of. This view is that equivalent: it writes the
// submitted interim values onto the Analysis's own InterimFields, then calls
// the real calculateResult(override=True) so the formula (e.g. [CA]+[MG])
// computes the Result exactly as SENAITE's own engine would.
export async function calculateAnalysisResult(
  token: string,
  analysisPath: string,
  interimValues: { keyword: string; value: string }[],
): Promise<{ success: boolean; result?: string; error?: string }> {
  try {
    const res = await fetch(`${SENAITE_ORIGIN}${analysisPath}/@@calculate-analysis-result`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ interim_fields: interimValues }),
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => ({}))) as RawView
    if (!res.ok || data.success === false) {
      return { success: false, error: (data.error as string) ?? `HTTP ${res.status}` }
    }
    return { success: true, result: (data.result as string) ?? '' }
  } catch (e) { return { success: false, error: String(e) } }
}

// Combined action for a Calculation-backed analysis row: compute the Result
// from the entered interim values via SENAITE's real engine, then submit —
// the interim-field equivalent of submitAnalysisResult() above.
export async function submitAnalysisInterimResult(
  token: string,
  analysisPath: string,
  analysisUid: string,
  interimValues: { keyword: string; value: string }[],
) {
  const calc = await calculateAnalysisResult(token, analysisPath, interimValues)
  if (!calc.success) return calc
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
      // "Invalid transition 'verify'. Valid transitions are: reject retract"
      // is SENAITE's literal wording when the worksheet-level Verify cascades
      // into one underlying Analysis that can't be verified right now — by
      // far the most common cause is the self-verification guard (the same
      // user who submitted the result can't also verify it). Confirmed live:
      // this exact message appears with no "guard"/"not available" substring,
      // so the original regex missed it and let the raw Zope object repr
      // ("<Analysis at SOILMIN>") leak straight to the user.
      const guardBlocked = /no workflow provides|not available|guard|invalid transition/i.test(raw)
      // Different unmet precondition per transition — the worksheet-level guard
      // for 'verify' only opens once every individual analysis row has ALREADY
      // been verified one-by-one (it's a rollup, not the actual verify action);
      // 'submit' is the one that actually depends on unsubmitted results.
      const friendly = guardBlocked
        ? transition === 'verify'
          ? "This worksheet can't be verified yet — at least one analysis row can't be verified right now. The most common reason is self-verification: the same user who submitted a result can't also verify it, so someone else needs to verify that row (or every row must be verified individually first)."
          : `This worksheet can't be ${transition}ed yet — every analysis must have a submitted result first.`
        : raw
      return { success: false, error: friendly }
    }
    return { success: true, reviewState: (data.review_state as string) ?? '' }
  } catch (e) { return { success: false, error: String(e) } }
}

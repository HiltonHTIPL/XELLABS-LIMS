'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'
import {
  createSenaiteSample, updateSenaiteSample, updateSenaiteSampleAnalyses, senaiteWorkflowAction,
  resolveOrCreateContactUid, resolveSenaiteClientPathByUid,
} from '@/app/lib/senaite'
import { getSession } from '@/app/lib/session'

const SENAITE_USER = process.env.SENAITE_ADMIN_USER
const SENAITE_PASS = process.env.SENAITE_ADMIN_PASS

if (!SENAITE_USER || !SENAITE_PASS) {
  throw new Error('SENAITE_ADMIN_USER and SENAITE_ADMIN_PASS env vars are required')
}

function serverToken(): string {
  return Buffer.from(`${SENAITE_USER}:${SENAITE_PASS}`).toString('base64')
}

async function senaiteToken(): Promise<string> {
  const session = await getSession()
  return session?.senaiteToken ?? serverToken()
}

export type DjangoSampleType = {
  id: number
  name: string
  prefix: string
  retention_days?: number
  senaite_uid?: string
  is_active?: boolean
}

export async function getDjangoSampleTypes(): Promise<DjangoSampleType[]> {
  try {
    const res = await djangoFetch('/api/lims/sample-types/?ordering=name')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export type LabSample = {
  id: number
  sample_id: string
  client: number | null
  client_name: string
  client_senaite_uid: string
  sample_type: number | null
  sample_type_name: string
  description: string
  collection_date: string | null
  received_date: string | null
  expiry_date: string | null
  status: string
  condition: string
  priority: string
  hold_for_qa: boolean
  storage_location: string
  preferred_storage_location: string
  preferred_storage_label_code: string
  barcode: string
  is_locked: boolean
  received_by_name: string
  created_at: string
  senaite_uid?: string
  senaite_ar_id?: string
  // Extended intake fields
  contact_name: string
  cc_contact: string
  cc_emails: string
  batch_id: string
  batch_sub_group: string
  container_type: string
  preservation: string
  analysis_specification: string
  sample_point: string
  environmental_conditions: string
  composite: boolean
  internal_use: boolean
  client_order_number: string
  client_reference: string
  client_sample_id: string
  attachment?: string | null
  attachment_url?: string | null
  senaite_sync_status?: string
  senaite_sync_error?: string
  sampling_deviation?: string
}

export type NewSamplePayload = {
  client: number
  sample_type: number
  priority: string
  condition: string
  collection_date?: string
  expiry_date?: string
  description?: string
  preferred_storage_location?: string
  preferred_storage_label_code?: string
  contact_name?: string
  cc_contact?: string
  cc_emails?: string
  batch_id?: string
  batch_sub_group?: string
  container_type?: string
  preservation?: string
  analysis_specification?: string
  sampling_deviation?: string
  sample_point?: string
  environmental_conditions?: string
  composite?: boolean
  internal_use?: boolean
  client_order_number?: string
  client_reference?: string
  client_sample_id?: string
  client_senaite_uid?: string
  sample_type_senaite_uid?: string
  batch_senaite_uid?: string
  // SENAITE UIDs for reference fields whose UI value is a title/name, not a
  // UID — resolved client-side (NewSampleShell already holds the live lists
  // these titles came from) since the SENAITE-facing lookup happens in
  // createSenaiteSample(), not here.
  preservation_senaite_uid?: string
  sample_point_senaite_uid?: string
  sampling_deviation_senaite_uid?: string
}

function senaitePriority(priority: string): string {
  if (priority === 'high') return '2'
  if (priority === 'low') return '4'
  return '3'
}

export type SelectedAnalysis = { uid: string; name: string }

export async function createSampleWithAnalyses(
  payload: NewSamplePayload,
  analyses: SelectedAnalysis[],
): Promise<{ success: boolean; message: string; sample_id?: string; id?: number }> {
  const testSenaiteUids = analyses.map(a => a.uid).filter(Boolean)
  try {
    // ── SENAITE is the source of truth for samples ────────────────────────────
    // Step 1: create the sample in SENAITE FIRST. If SENAITE rejects it (or the
    // client/sample type isn't linked to the lab system), registration fails —
    // no orphan Django-only samples are ever created.
    if (!payload.client_senaite_uid) {
      return { success: false, message: 'This client is not linked to the lab system yet — open the Clients page and sync it first.' }
    }
    if (!payload.sample_type_senaite_uid) {
      return { success: false, message: 'This sample type is not linked to the lab system yet — re-open this page to trigger a sample type sync, or recreate it under Sample Types.' }
    }

    const token = await senaiteToken()
    const senaiteResult = await createSenaiteSample(token, {
      Client: payload.client_senaite_uid,
      SampleType: payload.sample_type_senaite_uid,
      DateSampled: payload.collection_date ?? new Date().toISOString(),
      ...(testSenaiteUids.length > 0 ? { Analyses: testSenaiteUids } : {}),
      Priority: senaitePriority(payload.priority),
      ...(payload.client_sample_id ? { ClientSampleID: payload.client_sample_id } : {}),
      ...(payload.batch_senaite_uid ? { Batch: payload.batch_senaite_uid } : {}),
      Composite: payload.composite ?? false,
      InternalUse: payload.internal_use ?? false,
      ...(payload.contact_name ? { ContactName: payload.contact_name } : {}),
      ...(payload.cc_contact ? { CCContactNames: payload.cc_contact } : {}),
      ...(payload.cc_emails ? { CCEmails: payload.cc_emails } : {}),
      ...(payload.client_order_number ? { ClientOrderNumber: payload.client_order_number } : {}),
      ...(payload.client_reference ? { ClientReference: payload.client_reference } : {}),
      ...(payload.description ? { Remarks: payload.description } : {}),
      ...(payload.preservation_senaite_uid ? { Preservation: payload.preservation_senaite_uid } : {}),
      ...(payload.sample_point_senaite_uid ? { SamplePoint: payload.sample_point_senaite_uid } : {}),
      ...(payload.sampling_deviation_senaite_uid ? { SamplingDeviation: payload.sampling_deviation_senaite_uid } : {}),
    })
    if (!senaiteResult.success || !senaiteResult.sample) {
      return { success: false, message: `The lab system rejected the sample: ${senaiteResult.error ?? 'unknown error'}` }
    }

    // Step 2: create the Django mirror row (receipt workflow, chain of custody,
    // audit trail, storage and dashboards all hang off this) — already linked to
    // the SENAITE record via senaite_uid at insert time.
    const sampleRes = await djangoFetch('/api/lims/samples/', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        client_senaite_uid: undefined,
        sample_type_senaite_uid: undefined,
        batch_senaite_uid: undefined,
        status: 'registered',
        is_active: true,
        senaite_uid: senaiteResult.sample.uid,
        senaite_ar_id: senaiteResult.sample.id,
      }),
    })
    const sampleData = await sampleRes.json().catch(() => ({})) as Record<string, unknown>
    if (!sampleRes.ok) {
      const msg = (sampleData.client as string[])?.[0]
        ?? (sampleData.sample_type as string[])?.[0]
        ?? (sampleData.detail as string)
        ?? 'Failed to create sample.'
      // The sample exists in the source of truth but the mirror failed — tell the
      // user exactly what happened; the periodic pull-sync will not invent the
      // mirror row, so this needs surfacing, not swallowing.
      console.error('[MIRROR_CREATE_FAILED]', { senaite_id: senaiteResult.sample.id, error: msg })
      return { success: false, message: `Sample ${senaiteResult.sample.id} was created in the lab system, but the local mirror failed: ${msg}` }
    }
    const sampleId = sampleData.id as number
    const sampleDisplayId = sampleData.sample_id as string

    // XelLabs' own sample_id is only generated by Django in step 2 above (see
    // lims/services.py generate_sample_id), i.e. AFTER the SENAITE sample already
    // exists — so it can't be included in the initial createSenaiteSample() call.
    // Backfill it into ClientSampleID now so the two IDs are visually
    // cross-referenceable directly in SENAITE's own sample list, unless the user
    // already provided their own external reference for that field. Best-effort:
    // a failure here must not fail sample registration, which already succeeded.
    if (!payload.client_sample_id) {
      const linkResult = await updateSenaiteSample(token, senaiteResult.sample.uid, { ClientSampleID: sampleDisplayId })
      if (!linkResult.success) {
        console.error('[CLIENT_SAMPLE_ID_LINK_FAILED]', { senaite_uid: senaiteResult.sample.uid, sample_id: sampleDisplayId, error: linkResult.error })
      }
    }

    // Step 3: Django analysis-request record if tests selected
    if (analyses.length > 0) {
      const arRes = await djangoFetch('/api/lims/analysis-requests/', {
        method: 'POST',
        body: JSON.stringify({
          sample: sampleId,
          analyses: analyses.map(a => ({ senaite_service_uid: a.uid, senaite_service_name: a.name })),
          status: 'pending',
          priority: payload.priority === 'high' ? 'high' : payload.priority === 'low' ? 'low' : 'normal',
        }),
      })
      if (!arRes.ok) {
        const arError = await arRes.json().catch(() => ({})) as Record<string, unknown>
        const arMsg = (arError.detail as string) ?? 'Failed to create analysis request.'
        return { success: false, message: `Sample ${sampleDisplayId} created, but analysis request failed: ${arMsg}` }
      }
    }

    revalidatePath('/dashboard/samples-overview')
    revalidatePath('/dashboard/analysis-requests')
    return { success: true, message: `Sample ${sampleDisplayId} logged successfully.`, sample_id: sampleDisplayId, id: sampleId }
  } catch (e) {
    console.error('[SAMPLE_CREATE_ERROR]', e)
    return { success: false, message: 'An unexpected error occurred. Please try again.' }
  }
}

/** Edits an existing sample end-to-end — the update-mode counterpart to
 * createSampleWithAnalyses(). Pushes the editable AR fields to SENAITE
 * (source of truth), optionally replaces the analyses list there too, then
 * PATCHes the Django mirror row and its linked AnalysisRequest. Individual
 * sub-steps report warnings rather than failing the whole save, matching
 * this project's documented SENAITE update quirks (CLAUDE.md §16f) — a
 * partial failure here still leaves the sample in a usable, re-editable
 * state instead of erroring out with nothing saved. */
export async function updateSampleWithAnalyses(
  sampleId: number,
  currentSenaiteUid: string,
  currentArId: number | null,
  payload: NewSamplePayload,
  analyses: SelectedAnalysis[],
  canEditAnalyses: boolean,
): Promise<{ success: boolean; message: string }> {
  try {
    const token = await senaiteToken()
    const warnings: string[] = []

    // Step 1: resolve Contact/CC Contact names to SENAITE uids (needs the
    // client's folder path, same as createSenaiteSample's own internal step).
    let contactUid: string | null = null
    let ccContactUids: string[] = []
    if (payload.client_senaite_uid && (payload.contact_name || payload.cc_contact)) {
      const clientPath = await resolveSenaiteClientPathByUid(token, payload.client_senaite_uid)
      if (clientPath) {
        if (payload.contact_name) contactUid = await resolveOrCreateContactUid(token, clientPath, payload.contact_name)
        if (payload.cc_contact) {
          ccContactUids = (await Promise.all(
            payload.cc_contact.split(',').map(n => resolveOrCreateContactUid(token, clientPath, n.trim()))
          )).filter((u): u is string => Boolean(u))
        }
      }
    }

    // Step 2: push editable AR-level fields to SENAITE.
    const senaitePush = await updateSenaiteSample(token, currentSenaiteUid, {
      ...(payload.collection_date ? { DateSampled: payload.collection_date } : {}),
      Priority: senaitePriority(payload.priority),
      ...(payload.client_sample_id ? { ClientSampleID: payload.client_sample_id } : {}),
      ...(payload.batch_senaite_uid ? { Batch: payload.batch_senaite_uid } : {}),
      Composite: payload.composite ?? false,
      InternalUse: payload.internal_use ?? false,
      ...(contactUid ? { Contact: contactUid } : {}),
      ...(ccContactUids.length ? { CCContact: ccContactUids } : {}),
      ...(payload.cc_emails ? { CCEmails: payload.cc_emails } : {}),
      ...(payload.client_order_number ? { ClientOrderNumber: payload.client_order_number } : {}),
      ...(payload.client_reference ? { ClientReference: payload.client_reference } : {}),
      ...(payload.description ? { Remarks: payload.description } : {}),
      ...(payload.preservation_senaite_uid ? { Preservation: payload.preservation_senaite_uid } : {}),
      ...(payload.sample_point_senaite_uid ? { SamplePoint: payload.sample_point_senaite_uid } : {}),
      ...(payload.sampling_deviation_senaite_uid ? { SamplingDeviation: payload.sampling_deviation_senaite_uid } : {}),
    })
    if (!senaitePush.success) warnings.push(`Some fields could not be saved to the lab system: ${senaitePush.error}`)

    // Step 3: analyses — only attempted while the sample is still editable
    // (mirrors the Django AnalysisRequest serializer's own guard below, kept
    // in sync here so the UI doesn't promise an edit the backend will reject).
    if (canEditAnalyses) {
      const testUids = analyses.map(a => a.uid).filter(Boolean)
      const arSenaitePush = await updateSenaiteSampleAnalyses(token, currentSenaiteUid, testUids)
      if (!arSenaitePush.success) warnings.push(`Analyses could not be updated in the lab system: ${arSenaitePush.error}`)
    }

    // Step 4: PATCH the Django mirror row.
    const patch: Record<string, unknown> = {
      priority: payload.priority, condition: payload.condition,
      collection_date: payload.collection_date, description: payload.description ?? '',
      preferred_storage_location: payload.preferred_storage_location ?? '',
      preferred_storage_label_code: payload.preferred_storage_label_code ?? '',
      contact_name: payload.contact_name ?? '', cc_contact: payload.cc_contact ?? '',
      cc_emails: payload.cc_emails ?? '', batch_id: payload.batch_id ?? '',
      batch_sub_group: payload.batch_sub_group ?? '', container_type: payload.container_type ?? '',
      preservation: payload.preservation ?? '', analysis_specification: payload.analysis_specification ?? '',
      sampling_deviation: payload.sampling_deviation ?? 'none', sample_point: payload.sample_point ?? '',
      environmental_conditions: payload.environmental_conditions ?? '',
      composite: payload.composite ?? false, internal_use: payload.internal_use ?? false,
      client_order_number: payload.client_order_number ?? '', client_reference: payload.client_reference ?? '',
      client_sample_id: payload.client_sample_id ?? '',
    }
    const sampleRes = await djangoFetch(`/api/lims/samples/${sampleId}/`, { method: 'PATCH', body: JSON.stringify(patch) })
    if (!sampleRes.ok) {
      const d = await sampleRes.json().catch(() => ({})) as Record<string, unknown>
      return { success: false, message: (d.detail as string) ?? 'Failed to update the sample record.' }
    }

    // Step 5: sync the Django AnalysisRequest's analyses list — its own
    // serializer independently guards against editing analyses once the
    // sample is no longer 'registered' (lims/serializers.py), so this is safe
    // to attempt unconditionally; a rejection there is surfaced, not swallowed.
    if (currentArId) {
      const arRes = await djangoFetch(`/api/lims/analysis-requests/${currentArId}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          analyses: analyses.map(a => ({ senaite_service_uid: a.uid, senaite_service_name: a.name })),
          priority: payload.priority === 'high' ? 'high' : payload.priority === 'low' ? 'low' : 'normal',
        }),
      })
      if (!arRes.ok) {
        const arData = await arRes.json().catch(() => ({})) as Record<string, unknown>
        const arMsg = (arData.detail as string) ?? (Array.isArray(arData) ? String(arData[0]) : undefined) ?? 'Analysis request could not be updated.'
        warnings.push(arMsg)
      }
    } else if (analyses.length > 0) {
      const arRes = await djangoFetch('/api/lims/analysis-requests/', {
        method: 'POST',
        body: JSON.stringify({
          sample: sampleId,
          analyses: analyses.map(a => ({ senaite_service_uid: a.uid, senaite_service_name: a.name })),
          status: 'pending',
          priority: payload.priority === 'high' ? 'high' : payload.priority === 'low' ? 'low' : 'normal',
        }),
      })
      if (!arRes.ok) warnings.push('Failed to create an analysis request for the newly added analyses.')
    }

    revalidatePath('/dashboard/samples-overview')
    revalidatePath(`/dashboard/samples-overview/${sampleId}`)
    revalidatePath('/dashboard/analysis-requests')
    return {
      success: true,
      message: warnings.length ? `Sample updated with warnings: ${warnings.join(' | ')}` : 'Sample updated successfully.',
    }
  } catch (e) {
    console.error('[SAMPLE_UPDATE_ERROR]', e)
    return { success: false, message: 'An unexpected error occurred while saving changes.' }
  }
}

export type SampleStats = {
  logged: number
  received: number
  in_process: number
  to_be_verified: number
  on_hold_for_qa: number
  completed: number
  overdue: number
}

export async function getSampleStats(): Promise<SampleStats> {
  try {
    const res = await djangoFetch('/api/lims/samples/stats/')
    if (!res.ok) return { logged: 0, received: 0, in_process: 0, to_be_verified: 0, on_hold_for_qa: 0, completed: 0, overdue: 0 }
    return await res.json()
  } catch { return { logged: 0, received: 0, in_process: 0, to_be_verified: 0, on_hold_for_qa: 0, completed: 0, overdue: 0 } }
}

export type LabSampleFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
  /** Numeric DB id of the created/updated sample — used for follow-up attachment upload */
  id?: number
}

export type TatTrendPoint = { week_start: string; avg_tat_days: number | null; sample_count: number }

export async function getTatTrend(): Promise<TatTrendPoint[]> {
  try {
    const res = await djangoFetch('/api/lims/samples/tat_trend/')
    if (!res.ok) return []
    return await res.json()
  } catch { return [] }
}

export async function getLabSamples(): Promise<LabSample[]> {
  try {
    // DRF paginates at PAGE_SIZE=50 — page through every page so the list
    // matches the true total (e.g. the "Logged" stat card), not just page 1.
    const all: LabSample[] = []
    let url: string | null = '/api/lims/samples/?ordering=-created_at'
    while (url) {
      const res = await djangoFetch(url)
      if (!res.ok) break
      const data = await res.json()
      all.push(...(data.results ?? []))
      const next: string | null = data.next ?? null
      url = next ? next.replace(/^https?:\/\/[^/]+/, '') : null
    }
    return all
  } catch { return [] }
}

/**
 * Recent-samples-only variant for the New Sample page's duplicate-warning
 * check (findLikelyDuplicate in NewSampleShell.tsx only looks within a
 * 24-hour window) — the full getLabSamples() above pages through the ENTIRE
 * samples table ever logged, which only gets slower as the lab accumulates
 * history. A single bounded page (most-recent-first) is enough: any real
 * duplicate within the last 24h will be in the newest samples, not buried
 * deep in history.
 */
export async function getRecentLabSamplesForDuplicateCheck(): Promise<LabSample[]> {
  try {
    const res = await djangoFetch('/api/lims/samples/?ordering=-created_at&page_size=200')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? []
  } catch { return [] }
}

export async function createLabSample(_state: LabSampleFormState, formData: FormData): Promise<LabSampleFormState> {
  const sample_id        = (formData.get('sample_id') as string)?.trim()
  const client           = (formData.get('client') as string)?.trim()
  const sample_type      = (formData.get('sample_type') as string)?.trim()
  const description      = (formData.get('description') as string)?.trim()
  const collection_date  = (formData.get('collection_date') as string)?.trim()
  const received_date    = (formData.get('received_date') as string)?.trim()
  const expiry_date      = (formData.get('expiry_date') as string)?.trim()
  const status           = (formData.get('status') as string)?.trim() || 'registered'
  const storage_location = (formData.get('storage_location') as string)?.trim()
  const barcode          = (formData.get('barcode') as string)?.trim()

  const errors: Record<string, string[]> = {}
  if (!client)      errors.client      = ['Client is required']
  if (!sample_type) errors.sample_type = ['Sample type is required']
  if (collection_date && new Date(collection_date) > new Date()) {
    errors.collection_date = ['Sample date cannot be in the future.']
  }
  if (Object.keys(errors).length) return { errors }

  const body: Record<string, unknown> = {
    status,
    is_active: true,
    ...(sample_id        ? { sample_id }                         : {}),
    ...(client           ? { client: Number(client) }            : {}),
    ...(sample_type      ? { sample_type: Number(sample_type) }  : {}),
    ...(description      ? { description }                       : {}),
    ...(collection_date  ? { collection_date }                   : {}),
    ...(received_date    ? { received_date }                     : {}),
    ...(expiry_date      ? { expiry_date }                       : {}),
    ...(storage_location ? { storage_location }                  : {}),
    ...(barcode          ? { barcode }                           : {}),
  }

  try {
    // ── SENAITE first (source of truth) ───────────────────────────────────────
    // The modal only carries Django ids, so resolve the linked lab-system UIDs.
    const [clientRes, typeRes] = await Promise.all([
      djangoFetch(`/api/clients/${client}/`),
      djangoFetch(`/api/lims/sample-types/${sample_type}/`),
    ])
    const clientData = clientRes.ok ? await clientRes.json() as { senaite_uid?: string } : {}
    const typeData = typeRes.ok ? await typeRes.json() as { senaite_uid?: string } : {}
    if (!clientData.senaite_uid) {
      return { errors: { client: ['This client is not linked to the lab system yet — open the Clients page and sync it first.'] } }
    }
    if (!typeData.senaite_uid) {
      return { errors: { sample_type: ['This sample type is not linked to the lab system yet — open Sample Types to sync it first.'] } }
    }

    const token = await senaiteToken()
    const senaiteResult = await createSenaiteSample(token, {
      Client: clientData.senaite_uid,
      SampleType: typeData.senaite_uid,
      DateSampled: collection_date || new Date().toISOString(),
      ...(sample_id ? { ClientSampleID: sample_id } : {}),
    })
    if (!senaiteResult.success || !senaiteResult.sample) {
      return { message: `The lab system rejected the sample: ${senaiteResult.error ?? 'unknown error'}` }
    }

    const res = await djangoFetch('/api/lims/samples/', {
      method: 'POST',
      body: JSON.stringify({
        ...body,
        senaite_uid: senaiteResult.sample.uid,
        senaite_ar_id: senaiteResult.sample.id,
      }),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) {
      console.error('[MIRROR_CREATE_FAILED]', { senaite_id: senaiteResult.sample.id, error: data })
      return { message: `Sample ${senaiteResult.sample.id} was created in the lab system, but the local mirror failed: ${(data.sample_id as string[])?.[0] ?? (data.client as string[])?.[0] ?? (data.detail as string) ?? 'unknown error'}` }
    }
    revalidatePath('/dashboard/samples-overview')
    return { success: true, message: `Sample ${data.sample_id} registered successfully.`, id: data.id as number }
  } catch (e) { return { message: String(e) } }
}

export async function getLabSample(id: number): Promise<LabSample | null> {
  try {
    const res = await djangoFetch(`/api/lims/samples/${id}/`)
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

export type ReceiptFormState = {
  success?: boolean
  message?: string
}

export async function receiveLabSample(id: number, data: {
  condition: string
  seal_condition: string
  seal_number: string
  quantity_received: string
  quantity_unit: string
  sampling_deviation: string
  storage_requirement: string
  priority: string
  hold_for_qa: boolean
  collector: string
  location: string
  notes: string
}): Promise<ReceiptFormState> {
  try {
    const body: Record<string, unknown> = {
      condition:           data.condition,
      seal_condition:      data.seal_condition,
      seal_number:         data.seal_number,
      quantity_unit:       data.quantity_unit,
      sampling_deviation:  data.sampling_deviation,
      storage_requirement: data.storage_requirement,
      priority:            data.priority,
      hold_for_qa:         data.hold_for_qa,
      collector:           data.collector,
      location:            data.location,
      notes:               data.notes,
      ...(data.quantity_received ? { quantity_received: parseFloat(data.quantity_received) } : {}),
    }
    const res = await djangoFetch(`/api/lims/samples/${id}/receive/`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const resData = await res.json().catch(() => ({})) as { detail?: string; sample_id?: string; senaite_uid?: string }
    if (!res.ok) {
      return { message: resData.detail ?? 'Failed to receive sample.' }
    }

    // If this sample has a SENAITE mirror (created at registration time), transition
    // it to "received" now — the exact physical-receipt moment — so its analyses
    // move from "sample_due" into "unassigned" and become visible to Worksheets.
    if (resData.senaite_uid) {
      try {
        const token = await senaiteToken()
        await senaiteWorkflowAction(token, resData.senaite_uid, 'receive')
      } catch { /* non-fatal — Django receipt already succeeded */ }
    }

    revalidatePath('/dashboard/samples-overview')
    revalidatePath('/dashboard/sample-receipts')
    return { success: true, message: `Sample ${resData.sample_id ?? ''} marked as received.` }
  } catch (e) { return { message: String(e) } }
}

export async function uploadSampleAttachment(sampleId: string, formData: FormData): Promise<{ ok: boolean; attachment_url?: string }> {
  try {
    const res = await djangoFetch(`/api/lims/samples/${sampleId}/upload-attachment/`, {
      method: 'PATCH',
      body: formData,
    })
    if (!res.ok) return { ok: false }
    const data = await res.json().catch(() => ({})) as { attachment_url?: string }
    revalidatePath('/dashboard/samples-overview')
    return { ok: true, attachment_url: data.attachment_url }
  } catch { return { ok: false } }
}

export type DisposeSampleResult = {
  ok: boolean
  message?: string
  sample_id?: string
  status?: string
  description?: string
  attachment_url?: string | null
  sync_status?: string
}

export async function disposeSample(id: number, formData: FormData): Promise<DisposeSampleResult> {
  try {
    const res = await djangoFetch(`/api/lims/samples/${id}/dispose/`, {
      method: 'POST',
      body: formData,
    })
    const data = await res.json().catch(() => ({})) as DisposeSampleResult & { detail?: string }
    if (!res.ok) {
      return { ok: false, message: data.detail ?? data.message ?? `Error ${res.status}` }
    }
    revalidatePath('/dashboard/samples-overview')
    revalidatePath(`/dashboard/samples-overview/${id}`)
    revalidatePath('/dashboard/chain-of-custody')
    return {
      ok: true,
      sample_id: data.sample_id,
      status: data.status,
      description: data.description,
      attachment_url: data.attachment_url,
      sync_status: data.sync_status,
    }
  } catch (e) {
    return { ok: false, message: String(e) }
  }
}

// New Sample page loads await this sync before rendering (see page.tsx), and
// it's a real Django→SENAITE round trip each time — on a slow network this was
// the dominant cost of every single page load. Sample types are rarely added
// mid-session, so skip repeat syncs within a short TTL (same tradeoff already
// accepted for fetchSenaiteTitleMap's 5-min cache).
const SAMPLE_TYPE_SYNC_TTL_MS = 60 * 1000
let lastSampleTypeSync = 0

export async function syncSampleTypesFromSenaite(): Promise<void> {
  if (Date.now() - lastSampleTypeSync < SAMPLE_TYPE_SYNC_TTL_MS) return
  try {
    await djangoFetch('/api/lims/sample-types/sync-from-senaite/', { method: 'POST' })
    lastSampleTypeSync = Date.now()
  } catch { /* non-fatal — new sample page still loads */ }
}

export async function patchLabSample(id: number, patch: Record<string, unknown>): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await djangoFetch(`/api/lims/samples/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { detail?: string }
      return { ok: false, message: d.detail ?? `Error ${res.status}` }
    }
    revalidatePath('/dashboard/samples-overview')
    return { ok: true }
  } catch (e) { return { ok: false, message: String(e) } }
}

export async function updateLabSample(id: number, _state: LabSampleFormState, formData: FormData): Promise<LabSampleFormState> {
  const sample_id        = (formData.get('sample_id') as string)?.trim()
  const client           = (formData.get('client') as string)?.trim()
  const sample_type      = (formData.get('sample_type') as string)?.trim()
  const description      = (formData.get('description') as string)?.trim()
  const collection_date  = (formData.get('collection_date') as string)?.trim()
  const received_date    = (formData.get('received_date') as string)?.trim()
  const expiry_date      = (formData.get('expiry_date') as string)?.trim()
  const status           = (formData.get('status') as string)?.trim()
  const storage_location = (formData.get('storage_location') as string)?.trim()
  const barcode          = (formData.get('barcode') as string)?.trim()

  if (collection_date && new Date(collection_date) > new Date()) {
    return { errors: { collection_date: ['Sample date cannot be in the future.'] } }
  }

  const body: Record<string, unknown> = {
    ...(client           ? { client: Number(client) }           : {}),
    ...(sample_type      ? { sample_type: Number(sample_type) } : {}),
    ...(description      ? { description }      : {}),
    ...(collection_date  ? { collection_date }  : {}),
    ...(received_date    ? { received_date }    : {}),
    ...(expiry_date      ? { expiry_date }      : {}),
    ...(status           ? { status }           : {}),
    ...(storage_location ? { storage_location } : {}),
    ...(barcode          ? { barcode }          : {}),
  }

  try {
    const res = await djangoFetch(`/api/lims/samples/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      // DRF may return {detail}, {status: [...]}, {non_field_errors: [...]} or plain lists
      const firstError =
        (data.detail as string) ??
        (Array.isArray(data) ? String(data[0]) : undefined) ??
        Object.values(data).flat().map(String)[0]
      return { message: firstError ?? 'Failed to update sample.' }
    }

    // Push the supported field changes to SENAITE (source of truth). Client
    // re-assignment can't be pushed — SENAITE stores samples inside the client
    // folder — so a client change remains mirror-only.
    const updated = await res.json().catch(() => ({})) as { senaite_uid?: string; sample_type_senaite_uid?: string }
    if (updated.senaite_uid && (collection_date || sample_id || sample_type)) {
      let sampleTypeUid: string | undefined
      if (sample_type) {
        const typeRes = await djangoFetch(`/api/lims/sample-types/${sample_type}/`)
        sampleTypeUid = typeRes.ok ? ((await typeRes.json()) as { senaite_uid?: string }).senaite_uid : undefined
      }
      const token = await senaiteToken()
      const push = await updateSenaiteSample(token, updated.senaite_uid, {
        ...(collection_date ? { DateSampled: collection_date } : {}),
        ...(sample_id ? { ClientSampleID: sample_id } : {}),
        ...(sampleTypeUid ? { SampleType: sampleTypeUid } : {}),
      })
      if (!push.success) {
        console.error('[SENAITE_PUSH_FAILED]', { sample_pk: id, error: push.error })
        return { success: true, message: 'Sample updated locally, but the lab system could not be updated — it will remain authoritative until this is resolved.', id }
      }
    }

    revalidatePath('/dashboard/samples-overview')
    revalidatePath('/dashboard/samples-overview')
    return { success: true, message: 'Sample updated.', id }
  } catch (e) { return { message: String(e) } }
}


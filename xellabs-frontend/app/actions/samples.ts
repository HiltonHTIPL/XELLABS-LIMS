'use server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/lib/session'
import {
  fetchSenaiteSample,
  senaiteWorkflowAction,
  fetchSenaiteAnalysisServices,
  fetchSenaiteContactsForClient,
  SenaiteSample,
  SenaiteAnalysisService,
  SenaiteContact,
} from '@/app/lib/senaite'

import { serverToken, sessionToken } from '@/app/lib/senaite-auth'
import { logExternalAuditEvent } from '@/app/actions/audit-trail'
import { refreshSampleStatus } from '@/app/actions/sample-status'
import { logCustodyEvent } from '@/app/actions/chain-of-custody'

// ─── List ─────────────────────────────────────────────────────────────────────

export async function getSample(uid: string): Promise<SenaiteSample | null> {
  const session = await getSession()
  return fetchSenaiteSample(sessionToken(session), uid)
}

export type ReviewHistoryEntry = {
  action: string | null
  actor: string
  comments: string
  review_state: string
  time: string
  // SENAITE's own human-friendly labels for the transition/resulting state
  // (e.g. "Store sample" / "Stored") — always present on @history entries,
  // unlike `comments`, which SENAITE only actually fills in for a handful of
  // transitions. Prefer these over action/review_state for display; fall
  // back to those raw values for entries that don't have them (e.g. the
  // Django-bridged rows merged in alongside this history, which have neither).
  transition_title?: string
  state_title?: string
  // Best-effort "what the sample looks like as of now" context, attached
  // to whichever entry it's relevant for (storage location on a Stored
  // entry, sample condition on a Received entry) — not a true historical
  // value at that point in time, since SENAITE's @history carries none.
  detail?: string
}

export async function getSampleReviewHistory(uid: string): Promise<ReviewHistoryEntry[]> {
  const session = await getSession()
  const token = sessionToken(session)
  const sample = await fetchSenaiteSample(token, uid)
  if (!sample || !sample.url) return []
  try {
    // A plain GET on the AR's own URL always 500s ("No converter for making
    // <Client ...> JSON compatible") — plone.restapi can't serialize an
    // AnalysisRequest's own reference fields back out (see CLAUDE.md §16f,
    // the same class of bug as the AR read/update split). The dedicated
    // @history sub-endpoint sidesteps this entirely — it never touches the
    // AR's own field serialization, just the workflow log.
    const res = await fetch(`${sample.url}/@history`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    const entries = (Array.isArray(data) ? data : []) as Array<{
      action: string | null
      actor?: { fullname?: string; id?: string } | string
      comments: string
      review_state: string
      time: string
      transition_title?: string
      state_title?: string
    }>
    return entries.map(e => {
      const action = (e.action ?? '').toLowerCase()
      let detail = ''
      if (action === 'store' && sample.StorageLocationTitle) detail = `Stored at ${sample.StorageLocationTitle}`
      else if (action === 'receive') {
        const parts = [sample.SampleConditionTitle, sample.EnvironmentalConditionsTitle].filter(Boolean)
        if (parts.length) detail = parts.join(' · ')
      }
      return {
        action: e.action,
        actor: typeof e.actor === 'string' ? e.actor : (e.actor?.fullname || e.actor?.id || 'System'),
        comments: e.comments,
        review_state: e.review_state,
        time: e.time,
        transition_title: e.transition_title,
        state_title: e.state_title,
        detail,
      }
    })
  } catch {
    return []
  }
}

// ─── Reference data ───────────────────────────────────────────────────────────

export async function getAnalysisServices(): Promise<SenaiteAnalysisService[]> {
  return fetchSenaiteAnalysisServices(serverToken())
}

// Every real Contact under a client (not just "the first one") — lets New
// Sample's Contact/CC Contact fields be genuine pickers instead of free-text
// inputs the analyst has to retype for a client that already has contacts
// on file in SENAITE.
export async function getContactsForClient(clientSenaiteUid: string): Promise<SenaiteContact[]> {
  if (!clientSenaiteUid) return []
  return fetchSenaiteContactsForClient(serverToken(), clientSenaiteUid)
}

// ─── Workflow transitions ─────────────────────────────────────────────────────
//
// These call SENAITE's REST API directly (senaiteWorkflowAction) — no Django
// model is ever saved, so the normal TRACKED_MODELS save-signal audit logging
// never fires. logExternalAuditEvent() bridges the gap; it's fire-and-forget
// (never awaited into the result) so a logging hiccup can never block or fail
// the actual workflow transition it's recording.

export type WorkflowResult = { success: boolean; message: string }

// Chain of Custody (inventory/views.py's chain_of_custody action) matches
// bridged AuditEvent rows by `object_repr__icontains=<canonical Django
// sample_id>` (e.g. "SO-0022") — logging these transitions against the raw
// SENAITE uid instead meant every receive/verify/publish/cancel event was
// silently invisible there (confirmed live: the drawer only ever showed the
// coarse Sample.status milestones, never these transitions themselves).
// Resolve the human-readable AR id once per transition so the bridged row
// actually matches that filter.
async function resolveArId(token: string, uid: string): Promise<string> {
  const sample = await fetchSenaiteSample(token, uid)
  return sample?.id || uid
}

export async function receiveSample(uid: string): Promise<WorkflowResult> {
  const session = await getSession()
  const token = sessionToken(session)
  const result = await senaiteWorkflowAction(token, uid, 'receive')
  revalidatePath('/dashboard/samples-overview')
  if (result.success) {
    const arId = await resolveArId(token, uid)
    logExternalAuditEvent('receive', arId, undefined, 'sample')
    // Real custody handoff, not just the generic audit bridge — we genuinely
    // know a receive just happened and by whom, so it belongs in the same
    // lims.ChainOfCustody ledger the manual "Log Custody Event" UI writes to
    // (POST /api/lims/chain-of-custody/), not only the coarse AuditEvent.
    logCustodyEvent({ sampleId: arId, action: 'received', toLocation: 'Receiving', purpose: 'Sample received into the lab' })
    await refreshSampleStatus({ uid })
  }
  return { success: result.success, message: result.success ? 'Sample received.' : (result.error ?? 'Failed to receive sample.') }
}

export async function verifySample(uid: string): Promise<WorkflowResult> {
  const session = await getSession()
  const token = sessionToken(session)
  const result = await senaiteWorkflowAction(token, uid, 'verify')
  revalidatePath('/dashboard/samples-overview')
  if (result.success) {
    logExternalAuditEvent('verify', await resolveArId(token, uid), undefined, 'sample')
    await refreshSampleStatus({ uid })
  }
  // The approval is created by reconcileSampleApprovals when the Approvals page
  // loads (path-agnostic — see app/actions/approvals.ts), not here, so this same
  // "verified → awaiting approval" behaviour also applies to worksheet-driven
  // verification which never calls this function.
  return { success: result.success, message: result.success ? 'Sample verified and sent for approval.' : (result.error ?? 'Failed to verify sample.') }
}

export async function publishSample(uid: string): Promise<WorkflowResult> {
  const session = await getSession()
  const token = sessionToken(session)
  const result = await senaiteWorkflowAction(token, uid, 'publish')
  revalidatePath('/dashboard/samples-overview')
  if (result.success) {
    logExternalAuditEvent('publish', await resolveArId(token, uid), undefined, 'sample')
    await refreshSampleStatus({ uid })
  }
  return { success: result.success, message: result.success ? 'Sample published.' : (result.error ?? 'Failed to publish sample.') }
}

export async function cancelSample(uid: string): Promise<WorkflowResult> {
  const session = await getSession()
  const token = sessionToken(session)
  const result = await senaiteWorkflowAction(token, uid, 'cancel')
  revalidatePath('/dashboard/samples-overview')
  if (result.success) {
    logExternalAuditEvent('cancel', await resolveArId(token, uid), undefined, 'sample')
    await refreshSampleStatus({ uid })
  }
  return { success: result.success, message: result.success ? 'Sample cancelled.' : (result.error ?? 'Failed to cancel sample.') }
}

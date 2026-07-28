'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'
import { getSession } from '@/app/lib/session'
import { sessionToken } from '@/app/lib/senaite-auth'
import { publishSenaiteSample, fetchVerifiedSamplesForApproval } from '@/app/lib/senaite'
import { serverToken } from '@/app/lib/senaite-auth'
import { logExternalAuditEvent } from '@/app/actions/audit-trail'
import { refreshSampleStatus } from '@/app/actions/sample-status'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export type Approval = {
  id: number
  content_type: number | null
  object_id: number | null
  // SENAITE-sample subject (present for the sample sign-off flow).
  senaite_uid: string
  sample_id: string
  client_name: string
  title: string
  priority: string
  status: ApprovalStatus
  requested_by: number | null
  requested_by_name: string | null
  reviewed_by: number | null
  reviewed_by_name: string | null
  comments: string
  requested_at: string
  reviewed_at: string | null
}

export type ActionResult = { success: boolean; message: string }

export async function getApprovals(status?: ApprovalStatus): Promise<Approval[]> {
  try {
    const qs = status ? `?status=${status}&ordering=-requested_at` : '?ordering=-requested_at'
    const res = await djangoFetch(`/api/compliance/workflow/approvals/${qs}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch {
    return []
  }
}

/**
 * Reconcile the approval queue against SENAITE's truth: every sample currently
 * at review_state "verified" that has no approval row yet gets a pending one.
 * This is the single, path-agnostic trigger — it fires no matter how the sample
 * got verified (worksheet single-analysis, worksheet-level, sample detail, bulk,
 * or SENAITE's own UI). Called on Approvals page load. Non-fatal on error so the
 * page always renders.
 */
export async function reconcileSampleApprovals(): Promise<void> {
  try {
    const session = await getSession()
    const samples = await fetchVerifiedSamplesForApproval(sessionToken(session))
    if (!samples.length) return
    await djangoFetch('/api/compliance/workflow/approvals/reconcile-samples/', {
      method: 'POST',
      body: JSON.stringify({ samples }),
    })
  } catch { /* non-fatal — the page still renders with whatever's already stored */ }
}

/**
 * Create a pending approval for a verified SENAITE sample. Idempotent — the
 * backend returns any existing pending approval for the same UID rather than
 * duplicating. (Kept for the explicit single-sample path; the queue is normally
 * populated by reconcileSampleApprovals above.)
 */
export async function requestSampleApproval(params: {
  senaite_uid: string
  sample_id?: string
  client_name?: string
  title?: string
  priority?: string
}): Promise<ActionResult> {
  try {
    const res = await djangoFetch('/api/compliance/workflow/approvals/request-sample/', {
      method: 'POST',
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { detail?: string }
      return { success: false, message: d.detail ?? 'Failed to open approval request.' }
    }
    revalidatePath('/dashboard/approvals')
    return { success: true, message: 'Approval request opened.' }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

/**
 * Approve or reject an approval. `password` is verified server-side as the
 * electronic signature for the decision (workflow/views.py ApprovalViewSet.decide
 * → request.user.check_password). On a successful APPROVE of a SENAITE-sample
 * approval, the sample's workflow is then advanced verified → published
 * (Completed) via the SENAITE adapter — keeping every SENAITE transition on the
 * frontend/adapter side, never in Django.
 */
export async function decideApproval(
  id: number,
  action: 'approve' | 'reject',
  comments: string,
  password: string
): Promise<ActionResult> {
  try {
    const res = await djangoFetch(`/api/compliance/workflow/approvals/${id}/decide/`, {
      method: 'POST',
      body: JSON.stringify({ action, comments, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const d = data as { detail?: string; action?: string[]; password?: string[] }
      return {
        success: false,
        message: d.password?.[0] ?? d.detail ?? d.action?.[0] ?? `Failed to ${action} approval.`,
      }
    }

    revalidatePath('/dashboard/approvals')

    if (action === 'reject') {
      return { success: true, message: 'Approval rejected.' }
    }

    // Approved & signed. Advance the SENAITE sample to published (= Completed).
    const senaiteUid = (data as Approval).senaite_uid
    if (senaiteUid) {
      const pub = await publishSenaiteSample(serverToken(), senaiteUid)
      if (pub.success) {
        logExternalAuditEvent('publish', senaiteUid, undefined, 'sample')
        await refreshSampleStatus({ uid: senaiteUid })
        return { success: true, message: 'Approved and signed. Sample marked as completed.' }
      }
      // Decision is recorded; only the final state change failed.
      return {
        success: true,
        message: `Approved and signed, but completing the sample failed: ${pub.error ?? 'unknown error'}. `
          + 'Retry from the sample page.',
      }
    }

    return { success: true, message: 'Approval granted.' }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

/**
 * Submit a standalone electronic signature (ElectronicSignatureViewSet.sign).
 * Requires the exact content type app_label + model of the object being
 * signed for, plus the user's password (verified server-side against
 * request.user.check_password).
 */
export async function submitElectronicSignature(params: {
  app_label: string
  model: string
  object_id: number
  reason: string
  password: string
}): Promise<ActionResult> {
  try {
    const res = await djangoFetch('/api/compliance/workflow/signatures/sign/', {
      method: 'POST',
      body: JSON.stringify(params),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const d = data as { detail?: string; password?: string[]; non_field_errors?: string[] }
      return {
        success: false,
        message: d.password?.[0] ?? d.detail ?? d.non_field_errors?.[0] ?? 'Failed to submit signature.',
      }
    }
    revalidatePath('/dashboard/approvals')
    return { success: true, message: 'Electronic signature recorded.' }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

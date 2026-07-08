'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export type Approval = {
  id: number
  content_type: number
  object_id: number
  status: ApprovalStatus
  requested_by: number
  reviewed_by: number | null
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
 * Approve or reject an approval. `password` is collected in the UI as an
 * electronic-signature confirmation step (Section 6 of CLAUDE.md — e-signatures
 * required before an Approval moves to "approved"). NOTE: the backend
 * `/decide/` action (workflow/views.py ApprovalViewSet.decide) only accepts
 * `action` + `comments` — it does not currently verify a password. Real
 * password verification lives in `ElectronicSignatureViewSet.sign` (POST
 * /api/compliance/workflow/signatures/sign/), which requires `app_label` +
 * `model` strings that the Approval list/detail API does not expose (content_type
 * is serialized as a bare integer PK). We still collect and send the password
 * so the flow is ready the moment the backend adds validation, but today it is
 * NOT cryptographically enforced server-side for arbitrary approval subjects.
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
        message: d.detail ?? d.action?.[0] ?? d.password?.[0] ?? `Failed to ${action} approval.`,
      }
    }
    revalidatePath('/dashboard/approvals')
    return { success: true, message: action === 'approve' ? 'Approval granted.' : 'Approval rejected.' }
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

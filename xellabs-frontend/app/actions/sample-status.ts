'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

/**
 * Sync ONE sample's status from live SENAITE state into the Django mirror that
 * the Dashboard and Samples Overview read, then revalidate those views — so a
 * status change reflects immediately (frontend → Django → SENAITE → Django →
 * UI) instead of waiting for the 5-min pull task.
 *
 * Call it right after any sample workflow transition succeeds. Pass the sample's
 * AnalysisRequest uid, OR an analysis uid (the backend resolves its parent AR —
 * used by worksheet result/verify actions, which act on analyses).
 *
 * Non-fatal by design: SENAITE remains the source of truth and the periodic
 * pull task backstops it, so a hiccup here must never fail the transition it
 * is only mirroring.
 */
export async function refreshSampleStatus(params: { uid?: string; analysisUid?: string }): Promise<void> {
  try {
    const body = params.uid ? { senaite_uid: params.uid } : { analysis_uid: params.analysisUid ?? '' }
    await djangoFetch('/api/lims/samples/refresh-status/', { method: 'POST', body: JSON.stringify(body) })
  } catch { /* non-fatal */ }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/samples')
  revalidatePath('/dashboard/samples-overview')
}

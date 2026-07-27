'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'

// Logs a real custody handoff (collector -> courier -> accessioner -> analyst
// -> storage, or any subset) against lims.ChainOfCustody — the same ledger
// receive_sample()/dispose_sample() already write to, and the same one
// inventory/views.py's chain-of-custody lookup merges into the read-only
// timeline (CustodyTimeline.tsx). This is the missing write-side: previously
// only automatic system events populated this ledger; there was no way for
// an Accessioner/Courier/Analyst to log a manual handoff themselves.
export type CustodyAction = 'collected' | 'transferred' | 'received' | 'batched' | 'stored' | 'retrieved' | 'analysed' | 'completed' | 'disposed'
export type SealStatus = 'intact' | 'broken' | 'not_sealed'
export type CustodyCondition = 'intact' | 'damaged' | 'compromised'

export type LogCustodyEventInput = {
  // The app-wide display id (e.g. "TEST-20260722-0019" or a SENAITE id) —
  // the Chain of Custody page only ever has this string, never the Django
  // numeric PK the ChainOfCustody model's `sample` FK actually needs, so
  // logCustodyEvent resolves it server-side via the samples list endpoint.
  sampleId: string
  action: CustodyAction
  fromLocation?: string
  toLocation?: string
  receivedById?: number
  temperatureC?: string
  condition?: CustodyCondition
  sealStatus?: SealStatus
  purpose?: string
  notes?: string
}

export type LogCustodyEventResult = { success: boolean; message?: string; id?: number }

export async function logCustodyEvent(input: LogCustodyEventInput): Promise<LogCustodyEventResult> {
  try {
    // The caller can hand us any of three different identifiers for the same
    // sample — Django's own sample_id (e.g. "SO-20260724-0002"), the real
    // SENAITE-assigned id shown everywhere in the UI (e.g. "SO-0024", what
    // every auto-logged custody call in this codebase actually passes), or a
    // scanned barcode. Filtering by sample_id alone silently matched nothing
    // for the SENAITE-id case — confirmed live: every auto-logged custody
    // event (received/batched/analysed/completed) was failing to resolve and
    // therefore never actually writing a row. Mirrors the same 3-way fallback
    // already proven correct in inventory/views.py's chain_of_custody lookup
    // and _resolve_canonical_sample_id.
    let match: { id: number } | undefined
    for (const field of ['sample_id', 'senaite_ar_id', 'barcode']) {
      const lookupRes = await djangoFetch(`/api/lims/samples/?${field}=${encodeURIComponent(input.sampleId)}`)
      if (!lookupRes.ok) continue
      const lookupData = await lookupRes.json()
      match = (lookupData.results ?? lookupData ?? [])[0]
      if (match) break
    }
    if (!match) return { success: false, message: `Sample "${input.sampleId}" not found.` }

    const res = await djangoFetch('/api/lims/chain-of-custody/', {
      method: 'POST',
      body: JSON.stringify({
        sample: match.id,
        action: input.action,
        from_location: input.fromLocation ?? '',
        to_location: input.toLocation ?? '',
        received_by: input.receivedById ?? null,
        temperature_c: input.temperatureC || null,
        condition: input.condition ?? '',
        seal_status: input.sealStatus ?? '',
        purpose: input.purpose ?? '',
        notes: input.notes ?? '',
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const firstError = Object.values(err as Record<string, unknown>).flat().find(Boolean)
      return { success: false, message: (firstError as string) ?? 'Failed to log custody event.' }
    }
    const created = await res.json()
    revalidatePath('/dashboard/chain-of-custody')
    return { success: true, id: created.id }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

// Attaches a real, password-verified electronic signature to a just-logged
// custody event — reuses the same generic workflow.ElectronicSignature "sign"
// endpoint the Approvals e-signature flow already relies on (identity is
// enforced server-side by re-checking the acting user's password, never
// trusted from the client). This is what turns "who's in the Received By
// dropdown" into an actual attestation: "every individual who assumes
// possession" per the formal Chain of Custody requirement.
export async function signCustodyEvent(
  custodyEventId: number, reason: string, password: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await djangoFetch('/api/compliance/workflow/signatures/sign/', {
      method: 'POST',
      body: JSON.stringify({
        app_label: 'lims', model: 'chainofcustody', object_id: custodyEventId, reason, password,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const firstError = Object.values(err as Record<string, unknown>).flat().find(Boolean)
      return { success: false, message: (firstError as string) ?? 'Signature failed.' }
    }
    return { success: true }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

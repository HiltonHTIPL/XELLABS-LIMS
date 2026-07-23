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
export type CustodyAction = 'collected' | 'transferred' | 'received' | 'stored' | 'retrieved' | 'analysed' | 'disposed'
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

export type LogCustodyEventResult = { success: boolean; message?: string }

export async function logCustodyEvent(input: LogCustodyEventInput): Promise<LogCustodyEventResult> {
  try {
    const lookupRes = await djangoFetch(`/api/lims/samples/?sample_id=${encodeURIComponent(input.sampleId)}`)
    if (!lookupRes.ok) return { success: false, message: 'Could not resolve the sample.' }
    const lookupData = await lookupRes.json()
    const match = (lookupData.results ?? lookupData ?? [])[0]
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
    revalidatePath('/dashboard/chain-of-custody')
    return { success: true }
  } catch (e) {
    return { success: false, message: String(e) }
  }
}

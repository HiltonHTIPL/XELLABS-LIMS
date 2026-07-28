'use server'
import { revalidatePath } from 'next/cache'
import { serverToken } from '@/app/lib/senaite-auth'
import {
  fetchSetupList, createSetupItem, updateSetupItem, deactivateSetupItem,
  asArray, type SetupRecord,
} from '@/app/lib/senaite-setup'
import { SENAITE_SITE_PATH } from '@/app/lib/senaite'
import type { RefResult } from '@/app/actions/reference-definitions'

// SENAITE ReferenceSample — an Archetypes QC material stored UNDER a Supplier
// (setup/suppliers/<id>/<QC-id>). It is what a worksheet's Blank/Control rows
// point at, carrying the expected ReferenceResults used to grade QC.
//
// Two SENAITE quirks, both root-caused live (§16b/§16d family):
//  1. Setting ReferenceDefinition in the restapi CREATE body → HTTP 500
//     ("No converter for making <ReferenceDefinition> JSON compatible"): the
//     UIDReferenceField *response* serializer crashes. So we CREATE without the
//     ref (201), then PATCH it (204, no response body → no serializer crash).
//  2. SENAITE's auto-copy of ReferenceResults from the definition fires only on
//     the classic-UI event path, never via a restapi mutator — so we copy the
//     chosen definition's results ourselves and PATCH them onto the sample.
// Adapter Pattern; DRY (shared setup helpers).

export type ReferenceSampleRow = {
  uid: string; path: string; title: string
  supplierUid: string; supplierTitle: string
  referenceDefinitionUid: string; blank: boolean; hazardous: boolean
  expiryDate: string; results: RefResult[]
  catalogueNumber: string; lotNumber: string; remarks: string
  dateSampled: string; dateReceived: string; dateOpened: string
  created: string
}

export type RefSampleFormState = { success?: boolean; message?: string; errors?: Record<string, string[]> }
export type SupplierOption = { uid: string; title: string; path: string }
export type DefinitionOption = { uid: string; title: string; blank: boolean; results: RefResult[] }

function mapResults(raw: unknown): RefResult[] {
  return asArray<SetupRecord>(raw).map(r => ({
    uid: (r.uid as string) ?? (r.UID as string) ?? '',
    result: String(r.result ?? ''),
    min: String(r.min ?? ''),
    max: String(r.max ?? ''),
  })).filter(r => r.uid)
}

// yyyy-mm-dd from SENAITE's ISO datetime (or '' if none)
function isoDate(v: unknown): string {
  const s = typeof v === 'string' ? v : ''
  return s ? s.slice(0, 10) : ''
}

export async function listSupplierOptions(): Promise<SupplierOption[]> {
  const items = await fetchSetupList(serverToken(), 'Supplier', 'is_active=true')
  return items
    .map(d => ({ uid: (d.uid as string) ?? '', title: (d.title as string) ?? '', path: (d.path as string) ?? '' }))
    .filter(o => o.uid && o.title && o.path)
    .sort((a, b) => a.title.localeCompare(b.title))
}

export async function listDefinitionOptions(): Promise<DefinitionOption[]> {
  const items = await fetchSetupList(serverToken(), 'ReferenceDefinition', 'is_active=true')
  return items
    .map(d => ({
      uid: (d.uid as string) ?? '',
      title: (d.title as string) ?? '',
      blank: d.Blank === true,
      results: mapResults(d.ReferenceResults),
    }))
    .filter(o => o.uid && o.title)
    .sort((a, b) => a.title.localeCompare(b.title))
}

export async function listReferenceSamples(): Promise<ReferenceSampleRow[]> {
  const [items, suppliers] = await Promise.all([
    fetchSetupList(serverToken(), 'ReferenceSample', 'is_active=true'),
    listSupplierOptions(),
  ])
  const supTitle = new Map(suppliers.map(s => [s.uid, s.title]))
  return items.map(d => {
    const supplierUid = (d.SupplierUID as string) ?? ''
    return {
      uid: d.uid as string,
      path: (d.path as string) ?? '',
      title: d.title as string,
      supplierUid,
      supplierTitle: supTitle.get(supplierUid) ?? (d.parent_id as string) ?? '',
      referenceDefinitionUid: (d.ReferenceDefinitionUID as string) ?? '',
      blank: d.Blank === true,
      hazardous: d.Hazardous === true,
      expiryDate: isoDate(d.ExpiryDate),
      results: mapResults(d.ReferenceResults),
      catalogueNumber: (d.CatalogueNumber as string) ?? '',
      lotNumber: (d.LotNumber as string) ?? '',
      remarks: (d.Remarks as string) ?? '',
      dateSampled: isoDate(d.DateSampled),
      dateReceived: isoDate(d.DateReceived),
      dateOpened: isoDate(d.DateOpened),
      created: (d.created as string) ?? '',
    }
  })
}

type Parsed = {
  title: string; supplierPath: string; definitionUid: string
  blank: boolean; hazardous: boolean; expiryDate: string; results: RefResult[]
  catalogueNumber: string; lotNumber: string; remarks: string
  dateSampled: string; dateReceived: string; dateOpened: string
}
function parse(fd: FormData): { v: Parsed; errors: Record<string, string[]> } {
  const v: Parsed = {
    title: ((fd.get('title') as string) ?? '').trim(),
    supplierPath: ((fd.get('supplierPath') as string) ?? '').trim(),
    definitionUid: ((fd.get('definitionUid') as string) ?? '').trim(),
    blank: fd.get('blank') === 'true',
    hazardous: fd.get('hazardous') === 'true',
    expiryDate: ((fd.get('expiryDate') as string) ?? '').trim(),
    results: JSON.parse((fd.get('results') as string) || '[]') as RefResult[],
    catalogueNumber: ((fd.get('catalogueNumber') as string) ?? '').trim(),
    lotNumber: ((fd.get('lotNumber') as string) ?? '').trim(),
    remarks: ((fd.get('remarks') as string) ?? '').trim(),
    dateSampled: ((fd.get('dateSampled') as string) ?? '').trim(),
    dateReceived: ((fd.get('dateReceived') as string) ?? '').trim(),
    dateOpened: ((fd.get('dateOpened') as string) ?? '').trim(),
  }
  const errors: Record<string, string[]> = {}
  if (!v.title) errors.title = ['Name is required']
  // SENAITE marks ReferenceSample.ExpiryDate required — the create is rejected
  // server-side without it, so enforce it here for a clear inline message.
  if (!v.expiryDate) errors.expiryDate = ['Expiry date is required']
  return { v, errors }
}

// The ReferenceDefinition link + ReferenceResults are always applied via PATCH
// (never in the create body) — see the module note on the 500 serializer crash.
async function applyRefAndResults(token: string, path: string, v: Parsed): Promise<{ success: boolean; error?: string }> {
  const body: SetupRecord = {
    ReferenceResults: v.results.filter(r => r.uid).map(r => ({ uid: r.uid, result: r.result, min: r.min, max: r.max })),
    // Always send the key, even when clearing — PATCH is a partial update,
    // so omitting it when the user picks "— None —" leaves the old link
    // silently in place forever (confirmed live: PATCH with the key omitted
    // never changes ReferenceDefinition; PATCH with it explicitly null does).
    ReferenceDefinition: v.definitionUid || null,
  }
  return updateSetupItem(token, path, body)
}

export async function createReferenceSample(_p: RefSampleFormState, fd: FormData): Promise<RefSampleFormState> {
  const { v, errors } = parse(fd)
  if (!v.supplierPath) errors.supplierPath = ['Choose a supplier']
  if (Object.keys(errors).length) return { errors }

  const token = serverToken()
  // parentSubPath is relative to the site path (createSetupItem prepends it).
  const parentSubPath = v.supplierPath.replace(`${SENAITE_SITE_PATH}/`, '')
  const created = await createSetupItem(token, 'ReferenceSample', parentSubPath, {
    title: v.title,
    description: '',                 // MUST be a string (§16d)
    Blank: v.blank,
    Hazardous: v.hazardous,
    ...(v.expiryDate ? { ExpiryDate: v.expiryDate } : {}),
  })
  if (!created.success || !created.path) return { message: created.error ?? 'Failed to create reference sample.' }

  const applied = await applyRefAndResults(token, created.path, v)
  if (!applied.success) return { message: applied.error ?? 'Created, but failed to set definition/results.' }
  revalidatePath('/dashboard/reference-samples')
  return { success: true, message: `Reference sample "${v.title}" created.` }
}

export async function updateReferenceSample(_uid: string, _p: RefSampleFormState, fd: FormData): Promise<RefSampleFormState> {
  const { v, errors } = parse(fd)
  if (Object.keys(errors).length) return { errors }
  const path = ((fd.get('_path') as string) ?? '').trim()
  if (!path) return { message: 'Missing record path — cannot update.' }

  const token = serverToken()
  // Base fields first (supplier can't change on edit — a sample can't be moved).
  const base = await updateSetupItem(token, path, {
    title: v.title,
    Blank: v.blank,
    Hazardous: v.hazardous,
    ...(v.expiryDate ? { ExpiryDate: v.expiryDate } : {}),
  })
  if (!base.success) return { message: base.error ?? 'Failed to update reference sample.' }
  const applied = await applyRefAndResults(token, path, v)
  if (!applied.success) return { message: applied.error ?? 'Failed to update definition/results.' }
  revalidatePath('/dashboard/reference-samples')
  return { success: true, message: `Reference sample "${v.title}" updated.` }
}

export async function deactivateReferenceSample(path: string): Promise<{ success: boolean; message?: string }> {
  if (!path) return { success: false, message: 'Missing record path.' }
  const r = await deactivateSetupItem(serverToken(), path)
  if (!r.success) return { success: false, message: r.error ?? 'Failed to remove reference sample.' }
  revalidatePath('/dashboard/reference-samples')
  return { success: true }
}

'use server'
import { revalidatePath } from 'next/cache'
import { serverToken } from '@/app/lib/senaite-auth'
import {
  fetchSetupList, createSetupItem, updateSetupItem, deactivateSetupItem,
  asArray, type SetupRecord,
} from '@/app/lib/senaite-setup'
import { listOptions } from '@/app/lib/admin-crud'
import type { RefOption } from '@/app/dashboard/_components/AdminRefShell'

// SENAITE ReferenceDefinition — an Archetypes type at
// bika_setup/bika_referencedefinitions. It is the *template* of expected QC
// results (per analysis service: result / min / max) plus Blank & Hazardous
// flags. Reference Samples (actual QC materials) are instances that copy these
// values. Read via v1, write via plone.restapi — verified live that the
// ReferenceResults DataGrid and the Blank/Hazardous booleans persist cleanly
// through a restapi create/update body (§16d). Adapter Pattern; DRY (reuses the
// shared setup helpers).

export type RefResult = { uid: string; result: string; min: string; max: string }

export type ReferenceDefinitionRow = {
  uid: string; path: string; title: string; description: string
  blank: boolean; hazardous: boolean; results: RefResult[]
}

export type RefDefFormState = { success?: boolean; message?: string; errors?: Record<string, string[]> }

function mapResults(raw: unknown): RefResult[] {
  return asArray<SetupRecord>(raw).map(r => ({
    uid: (r.uid as string) ?? (r.UID as string) ?? '',
    result: String(r.result ?? ''),
    min: String(r.min ?? ''),
    max: String(r.max ?? ''),
  })).filter(r => r.uid)
}

export async function listReferenceDefinitions(): Promise<ReferenceDefinitionRow[]> {
  const items = await fetchSetupList(serverToken(), 'ReferenceDefinition', 'is_active=true')
  return items.map(d => ({
    uid: d.uid as string,
    path: (d.path as string) ?? '',
    title: d.title as string,
    description: (d.description as string) ?? '',
    blank: d.Blank === true,
    hazardous: d.Hazardous === true,
    results: mapResults(d.ReferenceResults),
  }))
}

export async function listServiceOptions(): Promise<RefOption[]> { return listOptions('AnalysisService') }

function buildBody(fd: FormData): { body: SetupRecord; errors: Record<string, string[]> } {
  const title = ((fd.get('title') as string) ?? '').trim()
  const description = ((fd.get('description') as string) ?? '').trim()
  const blank = fd.get('blank') === 'true'
  const hazardous = fd.get('hazardous') === 'true'
  const results = JSON.parse((fd.get('results') as string) || '[]') as RefResult[]

  const errors: Record<string, string[]> = {}
  if (!title) errors.title = ['Name is required']
  const clean = results.filter(r => r.uid)
  if (clean.some(r => !r.result && !r.min && !r.max)) {
    errors.results = ['Each row needs at least a result, min or max — or remove the row']
  }

  const body: SetupRecord = {
    title,
    description,                     // MUST be a string (§16d)
    Blank: blank,
    Hazardous: hazardous,
    ReferenceResults: clean.map(r => ({ uid: r.uid, result: r.result, min: r.min, max: r.max })),
  }
  return { body, errors }
}

export async function createReferenceDefinition(_p: RefDefFormState, fd: FormData): Promise<RefDefFormState> {
  const { body, errors } = buildBody(fd)
  if (Object.keys(errors).length) return { errors }
  const r = await createSetupItem(serverToken(), 'ReferenceDefinition', 'bika_setup/bika_referencedefinitions', body)
  if (!r.success) return { message: r.error ?? 'Failed to create reference definition.' }
  revalidatePath('/dashboard/reference-definitions')
  return { success: true, message: `Reference definition "${body.title as string}" created.` }
}

export async function updateReferenceDefinition(_uid: string, _p: RefDefFormState, fd: FormData): Promise<RefDefFormState> {
  const { body, errors } = buildBody(fd)
  if (Object.keys(errors).length) return { errors }
  const path = ((fd.get('_path') as string) ?? '').trim()
  if (!path) return { message: 'Missing record path — cannot update.' }
  const r = await updateSetupItem(serverToken(), path, body)
  if (!r.success) return { message: r.error ?? 'Failed to update reference definition.' }
  revalidatePath('/dashboard/reference-definitions')
  return { success: true, message: `Reference definition "${body.title as string}" updated.` }
}

export async function deactivateReferenceDefinition(path: string): Promise<{ success: boolean; message?: string }> {
  if (!path) return { success: false, message: 'Missing record path.' }
  const r = await deactivateSetupItem(serverToken(), path)
  if (!r.success) return { success: false, message: r.error ?? 'Failed to remove reference definition.' }
  revalidatePath('/dashboard/reference-definitions')
  return { success: true }
}

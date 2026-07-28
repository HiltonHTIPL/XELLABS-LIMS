'use server'
import { revalidatePath } from 'next/cache'
import { serverToken } from '@/app/lib/senaite-auth'
import {
  fetchSetupList, createSetupItem, updateSetupItem, deactivateSetupItem,
  fetchRestapiOverlay, type SetupRecord,
} from '@/app/lib/senaite-setup'
import { fetchSenaiteInstruments, type SenaiteInstrument } from '@/app/lib/senaite'

// SENAITE Method (bika.lims.content.method) — Archetypes-based but confirmed
// live to write/read cleanly through plain plone.restapi, even with its real
// (non-computed) "Instruments" and "Calculations" UIDReferenceFields set —
// unlike Instrument (see senaite-instruments.ts), Method has no address-style
// field to trip the inline_field_validator crash, so no custom Zope view is
// needed here. Parent folder is the top-level `methods` folder (portal_type
// "Methods"), not under bika_setup.
export type SenaiteMethodRow = {
  uid: string; path: string; title: string; description: string
  methodId: string; accredited: boolean
  instructions: string
  instrumentUids: string[]; calculationUids: string[]
  reviewState: string
}

// Unlike Instruments' "silently returns {} for a real list" bug (overlay-fixed
// below), Calculations' v1-list gap is a shape mismatch: it comes back as an
// array of bare ref objects ({uid, url, api_url}), not plain uid strings
// (confirmed live 2026-07-23) — so a plain `as string[]` cast left every
// checkbox unchecked even though the real link was correctly persisted.
// Accept either shape here: a bare string, or an object with `.uid`.
function toUidList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map(item => (typeof item === 'string' ? item : (item && typeof item === 'object' && 'uid' in item ? String((item as { uid: unknown }).uid) : '')))
    .filter(Boolean)
}

function mapRow(d: SetupRecord): SenaiteMethodRow {
  return {
    uid: d.uid as string,
    path: (d.path as string) ?? '',
    title: (d.title as string) ?? '',
    description: (d.description as string) ?? '',
    methodId: (d.MethodID as string) ?? '',
    accredited: Boolean(d.Accredited),
    instructions: (d.Instructions as string) ?? '',
    instrumentUids: toUidList(d.Instruments),
    calculationUids: toUidList(d.Calculations),
    reviewState: (d.review_state as string) ?? 'active',
  }
}

export async function listSenaiteMethods(): Promise<SenaiteMethodRow[]> {
  const token = serverToken()
  const items = await fetchSetupList(token, 'Method')
  // The v1 list API silently returns {} for Method.Instruments even when a
  // real, correctly-persisted uid list is stored (confirmed live 2026-07-23
  // by cross-checking a direct restapi GET on the same object) — same class
  // of bug as Supplier's dropped fields (CLAUDE.md §16e). Overlay a per-object
  // restapi GET for just this field so the "Linked Instruments" column and
  // edit form don't silently show empty for a Method that really has one.
  const rows = await Promise.all(items.map(async d => {
    const overlay = await fetchRestapiOverlay(token, (d.url as string) ?? '', ['Instruments'])
    return mapRow({ ...d, Instruments: overlay.Instruments ?? d.Instruments })
  }))
  return rows
}

export async function listSenaiteInstrumentOptions(): Promise<SenaiteInstrument[]> {
  return fetchSenaiteInstruments(serverToken())
}

export type SenaiteMethodFormState = { success?: boolean; message?: string; errors?: Record<string, string[]> }

function buildBody(fd: FormData) {
  const title = ((fd.get('title') as string) ?? '').trim()
  const errors: Record<string, string[]> = {}
  if (!title) errors.title = ['Name is required']
  const body: SetupRecord = {
    title,
    description: ((fd.get('description') as string) ?? '').trim(),
    MethodID: ((fd.get('methodId') as string) ?? '').trim(),
    Accredited: fd.get('accredited') === 'on' || fd.get('accredited') === 'true',
    Instructions: ((fd.get('instructions') as string) ?? '').trim(),
    Instruments: fd.getAll('instrumentUids').map(String).filter(Boolean),
    Calculations: fd.getAll('calculationUids').map(String).filter(Boolean),
  }
  return { body, errors }
}

// Reads the "methodDocument" file input (if one was chosen) and PATCHes it
// onto the Method as SENAITE's MethodDocument BlobFileField — confirmed live
// that a plain restapi PATCH with a base64-encoded body persists cleanly for
// this field (2026-07-27), same shape already used for Attachment uploads in
// core/senaite_service.py. A no-op when no file was chosen (edit forms don't
// re-upload on every save).
async function applyMethodDocument(path: string, fd: FormData) {
  const file = fd.get('methodDocument')
  if (!(file instanceof File) || file.size === 0) return
  const buf = Buffer.from(await file.arrayBuffer())
  await updateSetupItem(serverToken(), path, {
    MethodDocument: {
      data: buf.toString('base64'),
      encoding: 'base64',
      filename: file.name,
      'content-type': file.type || 'application/octet-stream',
    },
  })
}

export async function createSenaiteMethodRecord(_p: SenaiteMethodFormState, fd: FormData): Promise<SenaiteMethodFormState> {
  const { body, errors } = buildBody(fd)
  if (Object.keys(errors).length) return { errors }
  const r = await createSetupItem(serverToken(), 'Method', 'methods', body)
  if (!r.success) return { message: r.error ?? 'Failed to create method.' }
  if (r.path) await applyMethodDocument(r.path, fd)
  revalidatePath('/dashboard/methods')
  return { success: true, message: `Method "${body.title as string}" created.` }
}

export async function updateSenaiteMethodRecord(_uid: string, _p: SenaiteMethodFormState, fd: FormData): Promise<SenaiteMethodFormState> {
  const { body, errors } = buildBody(fd)
  if (Object.keys(errors).length) return { errors }
  const path = (fd.get('_path') as string) ?? ''
  if (!path) return { message: 'Missing record path — cannot update.' }
  const r = await updateSetupItem(serverToken(), path, body)
  if (!r.success) return { message: r.error ?? 'Failed to update method.' }
  await applyMethodDocument(path, fd)
  revalidatePath('/dashboard/methods')
  return { success: true, message: `Method "${body.title as string}" updated.` }
}

export async function deactivateSenaiteMethodRecord(path: string): Promise<{ success: boolean; message: string }> {
  const r = await deactivateSetupItem(serverToken(), path)
  revalidatePath('/dashboard/methods')
  return { success: r.success, message: r.success ? 'Method deactivated.' : (r.error ?? 'Failed to deactivate.') }
}

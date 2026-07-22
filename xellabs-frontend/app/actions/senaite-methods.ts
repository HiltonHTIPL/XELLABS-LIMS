'use server'
import { revalidatePath } from 'next/cache'
import { serverToken } from '@/app/lib/senaite-auth'
import {
  fetchSetupList, createSetupItem, updateSetupItem, deactivateSetupItem, type SetupRecord,
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

function mapRow(d: SetupRecord): SenaiteMethodRow {
  return {
    uid: d.uid as string,
    path: (d.path as string) ?? '',
    title: (d.title as string) ?? '',
    description: (d.description as string) ?? '',
    methodId: (d.MethodID as string) ?? '',
    accredited: Boolean(d.Accredited),
    instructions: (d.Instructions as string) ?? '',
    instrumentUids: Array.isArray(d.Instruments) ? (d.Instruments as string[]) : [],
    calculationUids: Array.isArray(d.Calculations) ? (d.Calculations as string[]) : [],
    reviewState: (d.review_state as string) ?? 'active',
  }
}

export async function listSenaiteMethods(): Promise<SenaiteMethodRow[]> {
  const items = await fetchSetupList(serverToken(), 'Method')
  return items.map(mapRow)
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

export async function createSenaiteMethodRecord(_p: SenaiteMethodFormState, fd: FormData): Promise<SenaiteMethodFormState> {
  const { body, errors } = buildBody(fd)
  if (Object.keys(errors).length) return { errors }
  const r = await createSetupItem(serverToken(), 'Method', 'methods', body)
  if (!r.success) return { message: r.error ?? 'Failed to create method.' }
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
  revalidatePath('/dashboard/methods')
  return { success: true, message: `Method "${body.title as string}" updated.` }
}

export async function deactivateSenaiteMethodRecord(path: string): Promise<{ success: boolean; message: string }> {
  const r = await deactivateSetupItem(serverToken(), path)
  revalidatePath('/dashboard/methods')
  return { success: r.success, message: r.success ? 'Method deactivated.' : (r.error ?? 'Failed to deactivate.') }
}

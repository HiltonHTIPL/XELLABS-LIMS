// Server-side CRUD glue shared by every config-driven Administration entity
// (DRY). Each entity's 'use server' action file supplies an EntityConfig and
// thin async wrappers; the real work lives here. Not a 'use server' module
// itself — these are plain helpers invoked from within server actions, so
// revalidatePath() runs in a valid server-action context.
import { revalidatePath } from 'next/cache'
import { serverToken } from './senaite-auth'
import {
  fetchSetupList, createSetupItem, updateSetupItem, type SetupRecord,
} from './senaite-setup'
import type { AdminFormState } from '@/app/dashboard/_components/AdminRefShell'

export type EntityConfig = {
  portalType: string
  parentSubPath: string
  revalidate: string
  singular: string
  buildBody: (fd: FormData) => { body: SetupRecord; errors: Record<string, string[]> }
  // Field names typed zope.schema.Float in SENAITE's schema — see
  // forceFloatLiterals in senaite-setup.ts for why this is needed at all.
  floatFields?: string[]
}

export async function listEntity<T>(
  portalType: string,
  map: (d: SetupRecord) => T,
): Promise<T[]> {
  const items = await fetchSetupList(serverToken(), portalType)
  return items.map(map)
}

// Fetch a portal type as {uid,title} options for select/multiselect fields.
export async function listOptions(portalType: string): Promise<{ uid: string; title: string }[]> {
  const items = await fetchSetupList(serverToken(), portalType)
  return items
    .map(d => ({ uid: (d.uid as string) ?? '', title: (d.title as string) ?? '' }))
    .filter(o => o.uid && o.title)
    .sort((a, b) => a.title.localeCompare(b.title))
}

export async function createEntity(cfg: EntityConfig, fd: FormData): Promise<AdminFormState> {
  const { body, errors } = cfg.buildBody(fd)
  if (Object.keys(errors).length) return { errors }
  const r = await createSetupItem(serverToken(), cfg.portalType, cfg.parentSubPath, body, cfg.floatFields)
  if (!r.success) return { message: r.error ?? `Failed to create ${cfg.singular.toLowerCase()}.` }
  revalidatePath(cfg.revalidate)
  return { success: true, message: `${cfg.singular} "${body.title as string}" created.` }
}

export async function updateEntity(cfg: EntityConfig, fd: FormData): Promise<AdminFormState> {
  const { body, errors } = cfg.buildBody(fd)
  if (Object.keys(errors).length) return { errors }
  const path = (fd.get('_path') as string) ?? ''
  if (!path) return { message: 'Missing record path — cannot update.' }
  const r = await updateSetupItem(serverToken(), path, body, cfg.floatFields)
  if (!r.success) return { message: r.error ?? `Failed to update ${cfg.singular.toLowerCase()}.` }
  revalidatePath(cfg.revalidate)
  return { success: true, message: `${cfg.singular} "${body.title as string}" updated.` }
}

// --- small field parsers reused by buildBody implementations ---------------
export const str = (fd: FormData, name: string) => ((fd.get(name) as string) ?? '').trim()
export const strList = (fd: FormData, name: string) =>
  fd.getAll(name).map(v => String(v)).filter(Boolean)

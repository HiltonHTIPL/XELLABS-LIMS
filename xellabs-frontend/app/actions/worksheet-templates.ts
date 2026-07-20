'use server'
import { revalidatePath } from 'next/cache'
import { serverToken } from '@/app/lib/senaite-auth'
import {
  fetchSetupList, createSetupItem, updateSetupItem, deactivateSetupItem,
  asArray, type SetupRecord,
} from '@/app/lib/senaite-setup'
import { listOptions } from '@/app/lib/admin-crud'
import type { RefOption } from '@/app/dashboard/_components/AdminRefShell'

// --- SENAITE WorksheetTemplate (Dexterity type at setup/worksheettemplates) ---
// Read via the v1 list API; write via plone.restapi (createSetupItem/
// updateSetupItem) — the same read-v1 / write-restapi split every setup module
// uses (Adapter Pattern; SENAITE quirks stay isolated in senaite-setup.ts).
//
// Live schema (verified via @types/WorksheetTemplate):
//   title, description, num_of_positions, instrument[uid], restrict_to_method[uid],
//   services[{uid}], template_layout[{pos,type,blank_ref[],control_ref[],
//   reference_proxy,dup_proxy,dup}]
// Position `type` vocabulary (bika.lims ANALYSIS_TYPES): a=Analysis (routine),
// b=Blank, c=Control, d=Duplicate.

export type WtPositionType = 'a' | 'b' | 'c' | 'd'

export type WtPosition = {
  pos: number
  type: WtPositionType
  ref: string          // ReferenceDefinition uid — for Blank(b)/Control(c)
  dup: number | null   // duplicate-of position number — for Duplicate(d)
}

export type WorksheetTemplateRow = {
  uid: string
  path: string
  title: string
  description: string
  numOfPositions: number
  instrumentUid: string
  restrictToMethodUid: string
  serviceUids: string[]
  positions: WtPosition[]
}

export type WorksheetTemplateFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

// Normalize a UIDReferenceField value (v1 may return a uid string, {uid}/{UID}
// object, or a single-element array of either) to a plain uid string.
function refUid(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return refUid(v[0])
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    return (o.uid as string) ?? (o.UID as string) ?? ''
  }
  return ''
}

function refUidList(v: unknown): string[] {
  return asArray(v).map(refUid).filter(Boolean)
}

function mapPositions(raw: unknown): WtPosition[] {
  return asArray<SetupRecord>(raw)
    .map(r => {
      const type = (r.type as WtPositionType) ?? 'a'
      return {
        pos: Number(r.pos) || 0,
        type,
        ref: type === 'b' ? refUid(r.blank_ref) : type === 'c' ? refUid(r.control_ref) : '',
        dup: type === 'd' && r.dup != null ? Number(r.dup) : null,
      }
    })
    .filter(p => p.pos > 0)
    .sort((a, b) => a.pos - b.pos)
}

export async function listWorksheetTemplates(): Promise<WorksheetTemplateRow[]> {
  // is_active=true → hide records removed via the deactivate transition.
  const items = await fetchSetupList(serverToken(), 'WorksheetTemplate', 'is_active=true')
  return items.map(d => ({
    uid: d.uid as string,
    path: (d.path as string) ?? '',
    title: d.title as string,
    description: (d.description as string) ?? '',
    numOfPositions: Number(d.num_of_positions) || 0,
    instrumentUid: refUid(d.instrument),
    restrictToMethodUid: refUid(d.restrict_to_method),
    serviceUids: refUidList(d.services),
    positions: mapPositions(d.template_layout),
  }))
}

// Option loaders for the form's reference selects.
export async function listInstrumentOptions(): Promise<RefOption[]> { return listOptions('Instrument') }
export async function listMethodOptions(): Promise<RefOption[]> { return listOptions('Method') }
export async function listServiceOptions(): Promise<RefOption[]> { return listOptions('AnalysisService') }
export async function listReferenceDefinitionOptions(): Promise<RefOption[]> { return listOptions('ReferenceDefinition') }

// Build the SENAITE restapi body from the submitted form. The complex fields
// (positions grid + service uids) travel as JSON in hidden inputs, mirroring
// SampleTemplates' proven approach.
function buildBody(fd: FormData): { body: SetupRecord; errors: Record<string, string[]> } {
  const title = ((fd.get('title') as string) ?? '').trim()
  const description = ((fd.get('description') as string) ?? '').trim()
  const numOfPositions = Number((fd.get('numOfPositions') as string) ?? '0') || 0
  const instrumentUid = ((fd.get('instrumentUid') as string) ?? '').trim()
  const restrictToMethodUid = ((fd.get('restrictToMethodUid') as string) ?? '').trim()
  const serviceUids = JSON.parse((fd.get('serviceUids') as string) || '[]') as string[]
  const positions = JSON.parse((fd.get('positions') as string) || '[]') as WtPosition[]

  const errors: Record<string, string[]> = {}
  if (!title) errors.title = ['Template name is required']
  if (numOfPositions < 0) errors.numOfPositions = ['Number of positions cannot be negative']

  const routinePositions = new Set(positions.filter(p => p.type === 'a').map(p => p.pos))
  for (const p of positions) {
    if (!p.pos || p.pos < 1) { errors.positions = ['Every position needs a position number']; break }
    if ((p.type === 'b' || p.type === 'c') && !p.ref) {
      errors.positions = ['Blank/Control positions need a Reference Definition — add one under Administration → Reference Definitions first']
      break
    }
    if (p.type === 'd' && (!p.dup || !routinePositions.has(p.dup))) {
      errors.positions = ['Duplicate positions must point at an existing Analysis position']
      break
    }
  }

  const body: SetupRecord = {
    title,
    description,                                    // MUST be a string, never omitted (SENAITE §16d)
    num_of_positions: numOfPositions,
    instrument: instrumentUid ? [instrumentUid] : [],
    restrict_to_method: restrictToMethodUid ? [restrictToMethodUid] : [],
    services: serviceUids.map(uid => ({ uid })),
    template_layout: positions.map(p => ({
      pos: p.pos,
      type: p.type,
      blank_ref: p.type === 'b' && p.ref ? [p.ref] : [],
      control_ref: p.type === 'c' && p.ref ? [p.ref] : [],
      // reference_proxy is the visible Choice the SENAITE form uses to set
      // blank_ref/control_ref; dup_proxy is the visible Choice that sets dup.
      // Over REST the dup_proxy vocab only accepts 0 at create — the real
      // duplicate-of position lives in `dup` (verified live). reference_proxy
      // takes the ReferenceDefinition uid for QC rows.
      reference_proxy: (p.type === 'b' || p.type === 'c') && p.ref ? p.ref : null,
      dup_proxy: p.type === 'd' ? 0 : null,
      dup: p.type === 'd' ? p.dup : null,
    })),
  }
  return { body, errors }
}

export async function createWorksheetTemplate(
  _prev: WorksheetTemplateFormState,
  fd: FormData,
): Promise<WorksheetTemplateFormState> {
  const { body, errors } = buildBody(fd)
  if (Object.keys(errors).length) return { errors }
  const r = await createSetupItem(serverToken(), 'WorksheetTemplate', 'setup/worksheettemplates', body)
  if (!r.success) return { message: r.error ?? 'Failed to create worksheet template.' }
  revalidatePath('/dashboard/worksheet-templates')
  return { success: true, message: `Worksheet template "${body.title as string}" created.` }
}

export async function updateWorksheetTemplate(
  _prev: WorksheetTemplateFormState,
  fd: FormData,
): Promise<WorksheetTemplateFormState> {
  const { body, errors } = buildBody(fd)
  if (Object.keys(errors).length) return { errors }
  const path = ((fd.get('_path') as string) ?? '').trim()
  if (!path) return { message: 'Missing record path — cannot update.' }
  const r = await updateSetupItem(serverToken(), path, body)
  if (!r.success) return { message: r.error ?? 'Failed to update worksheet template.' }
  revalidatePath('/dashboard/worksheet-templates')
  return { success: true, message: `Worksheet template "${body.title as string}" updated.` }
}

export async function deactivateWorksheetTemplate(path: string): Promise<{ success: boolean; message?: string }> {
  if (!path) return { success: false, message: 'Missing record path.' }
  const r = await deactivateSetupItem(serverToken(), path)
  if (!r.success) return { success: false, message: r.error ?? 'Failed to remove worksheet template.' }
  revalidatePath('/dashboard/worksheet-templates')
  return { success: true }
}

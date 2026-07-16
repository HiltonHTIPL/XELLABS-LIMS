'use server'
import { createEntity, updateEntity, listEntity, listOptions, str, strList, type EntityConfig } from '@/app/lib/admin-crud'
import type { SetupRecord } from '@/app/lib/senaite-setup'
import type { AdminFormState } from '@/app/dashboard/_components/AdminRefShell'

function refUids(v: unknown): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v.map(x => (typeof x === 'string' ? x : ((x as Record<string, unknown>)?.uid as string))).filter(Boolean)
  if (typeof v === 'string') return [v]
  if (typeof v === 'object') { const u = (v as Record<string, unknown>).uid as string; return u ? [u] : [] }
  return []
}

const CFG: EntityConfig = {
  portalType: 'InterpretationTemplate',
  parentSubPath: 'setup/interpretationtemplates',
  revalidate: '/dashboard/interpretation-templates',
  singular: 'Interpretation template',
  buildBody: (fd) => {
    const title = str(fd, 'title')
    const text = str(fd, 'text')
    const description = str(fd, 'description')
    const sample_types = strList(fd, 'sample_types')
    const analysis_templates = strList(fd, 'analysis_templates')
    const errors: Record<string, string[]> = {}
    if (!title) errors.title = ['Name is required']
    const body: SetupRecord = { title, text, description, sample_types, analysis_templates }
    return { body, errors }
  },
}

export type InterpretationTemplateRow = {
  uid: string; path: string; title: string; text: string; description: string
  sample_types: string[]; analysis_templates: string[]
}

export async function listInterpretationTemplates(): Promise<InterpretationTemplateRow[]> {
  return listEntity('InterpretationTemplate', d => ({
    uid: d.uid as string,
    path: (d.path as string) ?? '',
    title: d.title as string,
    text: (d.text as string) ?? '',
    description: (d.description as string) ?? '',
    sample_types: refUids(d.sample_types),
    analysis_templates: refUids(d.analysis_templates),
  }))
}
export async function listSampleTypeOptions() { return listOptions('SampleType') }
// The analysis_templates field only accepts objects of portal_type "ARTemplate"
// (SENAITE's pre-rename name). In this build sample templates are stored as
// "SampleTemplate", so ARTemplate resolves to an empty set — matching SENAITE's
// own widget behaviour. Sourcing options from ARTemplate guarantees we never
// offer an option the field's validator would reject on save.
export async function listAnalysisTemplateOptions() { return listOptions('ARTemplate') }
export async function createInterpretationTemplate(_p: AdminFormState, fd: FormData) { return createEntity(CFG, fd) }
export async function updateInterpretationTemplate(_uid: string, _p: AdminFormState, fd: FormData) { return updateEntity(CFG, fd) }

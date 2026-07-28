'use server'
import { createEntity, updateEntity, listOptions, str, strList, type EntityConfig } from '@/app/lib/admin-crud'
import { serverToken } from '@/app/lib/senaite-auth'
import { fetchSetupList, fetchRestapiOverlay, type SetupRecord } from '@/app/lib/senaite-setup'
import type { AdminFormState } from '@/app/dashboard/_components/AdminRefShell'

// v1's list serialization omits text/sample_types/analysis_templates entirely
// for InterpretationTemplate, even though restapi confirms all three persist
// correctly on write — same read/write split as Suppliers (§16d). Without this
// overlay, AdminRefShell.openEdit() pre-fills the edit form from the (empty)
// row data and a save-without-changes wipes out the real text/refs via PATCH.
const OVERLAY_FIELDS = ['text', 'sample_types', 'analysis_templates']

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

function textValue(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object') return String((v as Record<string, unknown>).data ?? '')
  return ''
}

export async function listInterpretationTemplates(): Promise<InterpretationTemplateRow[]> {
  const token = serverToken()
  const items = await fetchSetupList(token, 'InterpretationTemplate')
  const overlays = await Promise.all(items.map(d => fetchRestapiOverlay(token, (d.url as string) ?? '', OVERLAY_FIELDS)))
  return items.map((d, i) => {
    const merged = { ...d, ...overlays[i] }
    return {
      uid: merged.uid as string,
      path: (merged.path as string) ?? '',
      title: merged.title as string,
      text: textValue(merged.text),
      description: (merged.description as string) ?? '',
      sample_types: refUids(merged.sample_types),
      analysis_templates: refUids(merged.analysis_templates),
    }
  })
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

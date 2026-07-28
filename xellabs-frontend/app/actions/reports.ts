'use server'
import { revalidatePath } from 'next/cache'
import { djangoFetch } from '@/app/lib/django'
import { getSession } from '@/app/lib/session'

export type ReportType = 'coa' | 'worksheet' | 'qc' | 'inventory' | 'instrument' | 'custom'
export type ReportStatus = 'draft' | 'final' | 'cancelled' | 'failed'

export type Report = {
  id: number
  report_id: string
  report_type: ReportType
  title: string
  sample: number | null
  sample_id: string | null
  client_name: string | null
  client_id: number | null
  sample_type_name: string | null
  collection_date: string | null
  status: ReportStatus
  generated_by: number
  generated_by_name: string | null
  file: string | null
  created_at: string
  published_at: string | null
}

export type ReportFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
  report?: Report
}

export async function getReports(): Promise<Report[]> {
  try {
    const res = await djangoFetch('/api/reports/?ordering=-created_at&limit=200')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export async function getReport(id: number): Promise<Report | null> {
  try {
    const res = await djangoFetch(`/api/reports/${id}/`)
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

export async function createAndGenerateReport(
  _state: ReportFormState,
  formData: FormData
): Promise<ReportFormState> {
  const sampleId    = formData.get('sample') as string
  const title       = (formData.get('title') as string)?.trim()
  const reportType  = (formData.get('report_type') as ReportType) || 'coa'

  const errors: Record<string, string[]> = {}
  if (!sampleId) errors.sample = ['Sample is required']
  if (!title)    errors.title  = ['Title is required']
  if (Object.keys(errors).length) return { errors }

  // 1. Create the report record
  const createRes = await djangoFetch('/api/reports/', {
    method: 'POST',
    body: JSON.stringify({
      report_type: reportType,
      title,
      sample: parseInt(sampleId, 10),
    }),
  })

  if (!createRes.ok) {
    const errBody = await createRes.json().catch(() => ({}))
    const fieldErrors: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(errBody)) {
      fieldErrors[k] = Array.isArray(v) ? (v as string[]) : [String(v)]
    }
    if (Object.keys(fieldErrors).length) return { errors: fieldErrors }
    return { message: 'Failed to create report.' }
  }

  const report: Report = await createRes.json()

  // 2. Trigger generation (only COA supports PDF generation)
  if (reportType === 'coa') {
    const genRes = await djangoFetch(`/api/reports/${report.id}/generate/`, { method: 'POST' })
    if (!genRes.ok) {
      return { message: 'Report created but PDF generation failed to start. Try generating from the list.', report }
    }
  }

  revalidatePath('/dashboard/reports')
  return { success: true, message: `Report "${report.report_id}" created.`, report }
}

export async function triggerGenerate(reportId: number): Promise<{ ok: boolean; message: string }> {
  const res = await djangoFetch(`/api/reports/${reportId}/generate/`, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { ok: false, message: (body as Record<string,string>).detail ?? 'Generation failed.' }
  }
  return { ok: true, message: 'Generation started.' }
}

export async function pollReport(id: number): Promise<Report | null> {
  return getReport(id)
}

/** Proxy the Django PDF download as a blob URL-ready response. */
export async function getReportDownloadUrl(reportId: number): Promise<string | null> {
  try {
    const session = await getSession()
    if (!session) return null
    return `/api/report-download/${reportId}`
  } catch { return null }
}

// ── Report Templates ────────────────────────────────────────────────────────

export type TemplateField = {
  key: string
  label: string
  value: string
  visible: boolean
  section: string
  editable_value: boolean
}

export type ReportTemplate = {
  id: number
  name: string
  report_type: ReportType
  is_active: boolean
  fields: TemplateField[]
  header_color: string
  logo: string | null
  logo_url: string | null
  client: number | null
  created_by: number
  created_at: string
  updated_at: string
}

export async function getActiveTemplate(reportType: ReportType = 'coa'): Promise<ReportTemplate | null> {
  try {
    const res = await djangoFetch(`/api/reports/templates/active/?report_type=${reportType}`)
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

export async function getDefaultFields(): Promise<TemplateField[]> {
  try {
    const res = await djangoFetch('/api/reports/templates/defaults/')
    if (!res.ok) return []
    return await res.json()
  } catch { return [] }
}

export async function getTemplates(): Promise<ReportTemplate[]> {
  try {
    const res = await djangoFetch('/api/reports/templates/?ordering=-updated_at')
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data ?? []
  } catch { return [] }
}

export type TemplateSaveState = { success?: boolean; message?: string; template?: ReportTemplate }

export async function saveTemplate(
  _state: TemplateSaveState,
  formData: FormData
): Promise<TemplateSaveState> {
  const id           = formData.get('id') as string
  const name         = (formData.get('name') as string)?.trim()
  const report_type  = (formData.get('report_type') as ReportType) || 'coa'
  const fieldsRaw    = formData.get('fields') as string
  const header_color = (formData.get('header_color') as string) || '#003366'
  const clientId     = formData.get('client') as string | null

  if (!name)      return { message: 'Template name is required.' }
  if (!fieldsRaw) return { message: 'Fields are required.' }

  let fields: TemplateField[]
  try { fields = JSON.parse(fieldsRaw) } catch { return { message: 'Invalid fields data.' } }

  const payload: Record<string, unknown> = { name, report_type, fields, header_color }
  if (clientId) payload.client = parseInt(clientId, 10)

  const method = id ? 'PATCH' : 'POST'
  const url    = id ? `/api/reports/templates/${id}/` : '/api/reports/templates/'

  const res = await djangoFetch(url, { method, body: JSON.stringify(payload) })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { message: (body as Record<string, string>).detail ?? 'Failed to save template.' }
  }

  const template: ReportTemplate = await res.json()
  revalidatePath('/dashboard/settings/report-templates')
  return { success: true, message: `Template "${template.name}" saved.`, template }
}

export async function duplicateTemplate(id: number): Promise<{ ok: boolean; template?: ReportTemplate; message?: string }> {
  const res = await djangoFetch(`/api/reports/templates/${id}/duplicate/`, { method: 'POST' })
  if (!res.ok) return { ok: false, message: 'Failed to duplicate template.' }
  const template: ReportTemplate = await res.json()
  revalidatePath('/dashboard/settings/report-templates')
  return { ok: true, template }
}

export async function deleteTemplate(id: number): Promise<{ ok: boolean; message?: string }> {
  const res = await djangoFetch(`/api/reports/templates/${id}/`, { method: 'DELETE' })
  if (!res.ok) return { ok: false, message: 'Failed to delete template.' }
  revalidatePath('/dashboard/settings/report-templates')
  return { ok: true }
}

export async function setActiveTemplate(id: number): Promise<{ ok: boolean; message?: string }> {
  const res = await djangoFetch(`/api/reports/templates/${id}/set-active/`, { method: 'POST' })
  if (!res.ok) return { ok: false, message: 'Failed to set active.' }
  revalidatePath('/dashboard/settings/report-templates')
  return { ok: true }
}

export async function cancelReport(reportId: number): Promise<{ ok: boolean; report?: Report; message?: string }> {
  const res = await djangoFetch(`/api/reports/${reportId}/cancel/`, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { ok: false, message: (body as Record<string,string>).detail ?? 'Failed to cancel report.' }
  }
  revalidatePath('/dashboard/reports')
  return { ok: true, report: await res.json() }
}

export async function regenerateReport(reportId: number): Promise<{ ok: boolean; message: string }> {
  const res = await djangoFetch(`/api/reports/${reportId}/regenerate/`, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { ok: false, message: (body as Record<string,string>).detail ?? 'Regeneration failed.' }
  }
  return { ok: true, message: 'Regeneration started.' }
}

export async function bulkGenerateReports(reportIds: number[]): Promise<{ ok: boolean; failed: number[] }> {
  const results = await Promise.all(reportIds.map(id => triggerGenerate(id)))
  const failed = reportIds.filter((_, i) => !results[i].ok)
  return { ok: failed.length === 0, failed }
}

export async function getReportDraftCount(): Promise<number> {
  try {
    const res = await djangoFetch('/api/reports/?status=draft&limit=1')
    if (!res.ok) return 0
    const data = await res.json()
    return data.count ?? 0
  } catch { return 0 }
}

export async function uploadTemplateLogo(templateId: number, file: File): Promise<{ ok: boolean; logo_url?: string; message?: string }> {
  const fd = new FormData()
  fd.append('logo', file)
  const res = await djangoFetch(`/api/reports/templates/${templateId}/`, {
    method: 'PATCH',
    body: fd,
    headers: {},
  })
  if (!res.ok) return { ok: false, message: 'Logo upload failed.' }
  const data = await res.json()
  return { ok: true, logo_url: data.logo_url }
}

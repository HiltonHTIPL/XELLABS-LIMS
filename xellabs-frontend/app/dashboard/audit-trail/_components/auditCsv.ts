import type { AuditEvent } from '@/app/actions/audit-trail'

// Human-readable labels for the raw `app_label.model` content-type strings.
export const RECORD_TYPE_LABELS: Record<string, string> = {
  'lims.sample': 'Sample',
  'lims.result': 'Result',
  'lims.analysisrequest': 'Analysis Request',
  'lims.worksheet': 'Worksheet',
  'lims.analysisspecification': 'Analysis Specification',
  'lims.method': 'Method',
  'lims.sampletemplate': 'Sample Template',
  'lims.sampletype': 'Sample Type',
  'lims.analysis': 'Analysis',
}

export function recordTypeLabel(raw: string | null | undefined): string {
  if (!raw) return '—'
  return RECORD_TYPE_LABELS[raw] ?? raw
}

// Raw DataChangeLog.field_name values are the literal Django model field
// (e.g. "last_synced_from_senaite") — internal backend naming is fine (see
// CLAUDE.md §11a), but it must never surface verbatim in this user-facing
// audit UI/export. Known internal-only fields get a brand-neutral label;
// anything else falls back to a humanized version with "senaite" stripped.
const FIELD_NAME_LABELS: Record<string, string> = {
  last_synced_from_senaite: 'Last Synced',
  senaite_uid: 'External Reference ID',
}

export function fieldNameLabel(raw: string | null | undefined): string {
  if (!raw) return '—'
  if (FIELD_NAME_LABELS[raw]) return FIELD_NAME_LABELS[raw]
  const humanized = raw
    .replace(/_/g, ' ')
    .replace(/\bsenaite\b/gi, '')
    .trim()
    .replace(/\s+/g, ' ')
  return humanized.replace(/\b\w/g, ch => ch.toUpperCase())
}

// Wrap a field in quotes and escape internal quotes when it contains a comma,
// quote, or newline — standard RFC-4180 CSV escaping.
function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function flattenChanges(e: AuditEvent): string {
  if (!e.changes || e.changes.length === 0) return ''
  return e.changes
    .map(c => {
      const base = `${fieldNameLabel(c.field_name)}: ${c.old_value ?? ''} -> ${c.new_value ?? ''}`
      return c.reason ? `${base} [${c.reason}]` : base
    })
    .join('; ')
}

const HEADERS = [
  'Timestamp', 'User', 'Action', 'Source', 'Record Type', 'Object', 'IP Address', 'Changes',
]

export function buildAuditCsv(rows: AuditEvent[]): string {
  const lines = [HEADERS.map(csvCell).join(',')]
  for (const e of rows) {
    const cells = [
      e.timestamp ?? '',
      e.user_display ?? '',
      e.action ?? '',
      e.source || 'manual',
      recordTypeLabel(e.content_type_label),
      e.object_repr || (e.object_id != null ? String(e.object_id) : ''),
      e.ip_address ?? '',
      flattenChanges(e),
    ]
    lines.push(cells.map(c => csvCell(String(c))).join(','))
  }
  return lines.join('\r\n')
}

export function downloadAuditCsv(rows: AuditEvent[], filename = 'audit-events.csv'): void {
  const csv = buildAuditCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

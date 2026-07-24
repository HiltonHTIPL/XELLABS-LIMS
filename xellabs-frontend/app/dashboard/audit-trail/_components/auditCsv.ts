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

const FIELD_LABELS: Record<string, string> = {
  requested_analyses: 'Requested Analyses',
  assigned_tests_count: 'Total Tests Assigned',
  analysis_package: 'Analysis Package',
  result_value: 'Result Value',
  status: 'Status',
  priority: 'Priority',
  condition: 'Sample Condition',
  description: 'Description / Notes',
  storage_location: 'Storage Location',
  expiry_date: 'Expiration Date',
  due_date: 'Due Date',
  analyst: 'Assigned Analyst',
  specification: 'Specification',
  method: 'Method',
  unit: 'Unit of Measure',
  senaite_uid: 'SENAITE UID',
  updated_at: 'Updated At',
}

export function formatFieldName(raw: string | null | undefined): string {
  if (!raw) return '—'
  if (FIELD_LABELS[raw]) return FIELD_LABELS[raw]
  const cleaned = raw.replace(/\bresult_value\b/g, 'Result Value').replace(/_/g, ' ')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

export function cleanEventTitle(event: AuditEvent): string {
  const repr = event.object_repr || (event.object_id ? `#${event.object_id}` : '')
  if (!repr) return recordTypeLabel(event.content_type_label)
  if (repr.startsWith('Analysis Result: ')) {
    const afterPrefix = repr.replace('Analysis Result: ', '')
    const parts = afterPrefix.split('•')
    return parts[0].trim()
  }
  if (repr.startsWith('Sample #')) {
    return repr
  }
  if (repr.includes('•')) {
    const parts = repr.split('•')
    return parts[0].trim()
  }
  return repr
}

// Wrap a field in quotes and escape internal quotes when it contains a comma,
// quote, or newline — standard RFC-4180 CSV escaping.
function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function filterIgnoredChanges<T extends { field_name?: string }>(changes: T[] | undefined | null): T[] {
  if (!changes) return []
  return changes.filter(c => {
    if (!c.field_name) return false
    const fn = c.field_name.toLowerCase()
    return !fn.includes('senaite') && !fn.includes('last_synced')
  })
}

function flattenChanges(e: AuditEvent): string {
  const visible = filterIgnoredChanges(e.changes)
  if (visible.length === 0) return ''
  return visible
    .map(c => {
      const base = `${formatFieldName(c.field_name)}: ${c.old_value ?? ''} -> ${c.new_value ?? ''}`
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

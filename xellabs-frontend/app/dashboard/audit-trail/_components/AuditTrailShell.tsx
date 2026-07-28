'use client'
import { useMemo, useState, useRef } from 'react'
import {
  PageHeader, Card, Field, StatusChip, EmptyState, MI, Btn,
  inputStyle, selectStyle, T,
} from '../../_components/ui'
import DataTable, { type DataTableColumn } from '../../_components/DataTable'
import type { AuditEvent, LoginEvent, SecurityEvent, RecordVersion } from '@/app/actions/audit-trail'
import { recordTypeLabel, downloadAuditCsv, formatFieldName, cleanEventTitle, filterIgnoredChanges } from './auditCsv'

type Tab = 'events' | 'logins' | 'security' | 'versions'

/* ------------------------- Audit Events: per-action color pill ------------------------- */
// Distinct, muted/professional color per AuditEvent.action — used only in this table,
// replacing the generic StatusChip which collapses unrelated actions into few tones.
const ACTION_COLORS: Record<string, { bg: string; fg: string }> = {
  create: { bg: '#ECFDF5', fg: '#047857' },
  update: { bg: '#EFF6FF', fg: '#1D4ED8' },
  delete: { bg: '#FEF2F2', fg: '#B91C1C' },
  view: { bg: '#F3F4F6', fg: '#4B5563' },
  approve: { bg: '#F0FDFA', fg: '#0F766E' },
  reject: { bg: '#FEF2F2', fg: '#B91C1C' },
  sign: { bg: '#F5F3FF', fg: '#6D28D9' },
  print: { bg: '#F3F4F6', fg: '#4B5563' },
  instrument_import: { bg: '#ECFEFF', fg: '#0E7490' },
  receive: { bg: '#FFFBEB', fg: '#B45309' },
  submit: { bg: '#EEF2FF', fg: '#4338CA' },
  verify: { bg: '#F0FDFA', fg: '#0F766E' },
  complete: { bg: '#F1F5F9', fg: '#334155' },
  store: { bg: '#FFFBEB', fg: '#B45309' },
  dispose: { bg: '#FBEAEA', fg: '#7F1D1D' },
}
const DEFAULT_ACTION_COLOR = { bg: '#F3F4F6', fg: '#374151' }

function ActionPill({ action }: { action: string }) {
  const c = ACTION_COLORS[action] ?? DEFAULT_ACTION_COLOR
  return (
    <span
      className="inline-flex items-center whitespace-nowrap"
      style={{
        backgroundColor: c.bg, color: c.fg, borderRadius: 8, padding: '2px 8px',
        fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
      }}
    >
      {action.replace(/_/g, ' ')}
    </span>
  )
}

function fmt(ts: string | null | undefined) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts
  return d.toLocaleString()
}

function TabBtn({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: string; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5"
      style={{
        padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        border: `1px solid ${active ? T.primary : T.cardBorder}`,
        backgroundColor: active ? T.primary : '#fff',
        color: active ? '#fff' : T.muted,
      }}
    >
      <MI name={icon} size={15} color={active ? '#fff' : T.muted} />
      {label}
      <span
        style={{
          fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 7px',
          backgroundColor: active ? 'rgba(255,255,255,0.25)' : '#F1F3F9',
          color: active ? '#fff' : T.muted,
        }}
      >
        {count}
      </span>
    </button>
  )
}

/* --------------------------------- Audit Events --------------------------------- */

/** Slide-over showing one event's field-level Changes + its record's own History
 *  — DataTable has no row-expansion feature, so this replaces the old inline
 *  expandable table rows. */
/** Inline dropdown panel showing event's field-level Changes */
export function EventDetailsDropdown({ event, onOpenSideView }: { event: AuditEvent; onOpenSideView?: (e: AuditEvent) => void }) {
  const changes = filterIgnoredChanges(event.changes)
  const hasChanges = changes.length > 0
  const isResultEvent = event.content_type_label === 'lims.result' || event.object_repr?.startsWith('Analysis Result:')
  const analysisTitle = cleanEventTitle(event)
  const primaryReason = changes.find(c => c.reason)?.reason || '—'

  return (
    <div style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 16, border: '1px solid #E2E8F0', marginTop: 4, marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: T.heading, margin: 0 }}>
          Field Changes — {analysisTitle}
        </p>
        <span style={{ fontSize: 12, color: T.muted }}>{fmt(event.timestamp)}</span>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: 6, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
              <th style={thStyleLocal}>Field</th>
              <th style={thStyleLocal}>Old Value</th>
              <th style={thStyleLocal}>New Value</th>
              <th style={thStyleLocal}>Reason</th>
              {isResultEvent && onOpenSideView && <th style={thStyleLocal}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isResultEvent ? (
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ ...tdStyleLocal, fontWeight: 600, color: '#111827' }}>{analysisTitle}</td>
                <td style={{ ...tdStyleLocal, color: '#9CA3AF' }}>—</td>
                <td style={{ ...tdStyleLocal, color: '#9CA3AF' }}>—</td>
                <td style={{ ...tdStyleLocal, color: '#4B5563' }}>{primaryReason}</td>
                {onOpenSideView && (
                  <td style={tdStyleLocal}>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center gap-1"
                      style={{ cursor: 'pointer' }}
                      onClick={() => onOpenSideView(event)}
                    >
                      <span>View Results</span>
                      <MI name="view_sidebar" size={13} color="#0154FC" />
                    </button>
                  </td>
                )}
              </tr>
            ) : hasChanges ? (
              changes.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ ...tdStyleLocal, fontWeight: 600 }}>{formatFieldName(c.field_name)}</td>
                  <td style={{ ...tdStyleLocal, color: '#EF4444' }}>{c.old_value ?? '—'}</td>
                  <td style={{ ...tdStyleLocal, color: '#10B981', fontWeight: 600 }}>{c.new_value ?? '—'}</td>
                  <td style={{ ...tdStyleLocal, color: '#6B7280' }}>{c.reason || '—'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ ...tdStyleLocal, color: T.muted }}>No specific field changes recorded for this event.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AnalysisSideViewPanel({ event, history, onClose }: { event: AuditEvent; history: AuditEvent[]; onClose: () => void }) {
  const changes = filterIgnoredChanges(event.changes)
  return (
    <div
      style={{
        width: 380,
        minWidth: 340,
        backgroundColor: '#fff',
        borderRadius: 12,
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignSelf: 'flex-start',
        position: 'sticky',
        top: 20,
        maxHeight: 'calc(100vh - 140px)',
        overflowY: 'auto',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
        <div className="flex items-center gap-2">
          <MI name="analytics" size={18} color="#0154FC" />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.heading }}>
            {cleanEventTitle(event)}
          </h3>
        </div>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.muted }}>
          <MI name="close" size={18} />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div style={{ fontSize: 13, color: T.muted, backgroundColor: '#F1F5F9', padding: '6px 10px', borderRadius: 6 }}>
          <span style={{ fontWeight: 600, color: '#1E293B' }}>{event.object_repr || event.object_id}</span>
          <br />
          {fmt(event.timestamp)} • User: {event.user_display ?? 'System'}
        </div>

        {changes.length > 0 ? (
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.heading, marginBottom: 6 }}>Result Changes</p>
            <div style={{ borderRadius: 6, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={thStyleLocal}>Field</th>
                    <th style={thStyleLocal}>Old Value</th>
                    <th style={thStyleLocal}>New Value</th>
                    <th style={thStyleLocal}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ ...tdStyleLocal, fontWeight: 600 }}>{formatFieldName(c.field_name)}</td>
                      <td style={{ ...tdStyleLocal, color: '#EF4444' }}>{c.old_value ?? '—'}</td>
                      <td style={{ ...tdStyleLocal, color: '#10B981', fontWeight: 600 }}>{c.new_value ?? '—'}</td>
                      <td style={{ ...tdStyleLocal, color: '#6B7280' }}>{c.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>No specific result field changes recorded for this event.</p>
        )}


      </div>
    </div>
  )
}

const thStyleLocal = { textAlign: 'left' as const, fontSize: 12, fontWeight: 700, color: T.muted, padding: '6px 10px', borderBottom: `1px solid ${T.cardBorder}` }
const tdStyleLocal = { fontSize: 13, color: T.text, padding: '6px 10px', borderBottom: `1px solid ${T.rowBorder}` }

export function AuditEventsTable({ events }: { events: AuditEvent[] }) {
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | number | null>(null)
  const [selectedDrawerEvent, setSelectedDrawerEvent] = useState<AuditEvent | null>(null)

  const actions = useMemo(() => Array.from(new Set(events.map(e => e.action))).sort(), [events])
  const users = useMemo(
    () => Array.from(new Set(events.map(e => e.user_display).filter((u): u is string => !!u))).sort(),
    [events],
  )
  const types = useMemo(
    () => Array.from(new Set(events.map(e => e.content_type_label).filter((t): t is string => !!t))).sort(),
    [events],
  )

  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null
    const rows = events.filter(e => {
      if (action && e.action !== action) return false
      if (userFilter && e.user_display !== userFilter) return false
      if (typeFilter && e.content_type_label !== typeFilter) return false
      if (fromTs !== null || toTs !== null) {
        const t = new Date(e.timestamp).getTime()
        if (fromTs !== null && t < fromTs) return false
        if (toTs !== null && t > toTs) return false
      }
      if (search) {
        const s = search.toLowerCase()
        const hay = `${e.user_display ?? ''} ${e.object_repr ?? ''} ${e.content_type_label ?? ''} ${e.action} ${e.source ?? ''}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
    rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return rows
  }, [events, search, action, dateFrom, dateTo, userFilter, typeFilter])

  const historyFor = (e: AuditEvent) =>
    events
      .filter(ev => ev.content_type === e.content_type && ev.object_id === e.object_id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  if (events.length === 0) {
    return <EmptyState icon="fact_check" title="No audit events" sub="Sample, result, and approval activity will appear here." />
  }

  const columns: DataTableColumn<AuditEvent>[] = [
    { id: 'timestamp', label: 'Timestamp', sortable: true, minWidth: 170, render: e => fmt(e.timestamp) },
    { id: 'user_display', label: 'User', sortable: true, minWidth: 120, render: e => e.user_display ?? '—' },
    { id: 'action', label: 'Action', sortable: true, minWidth: 120, render: e => <ActionPill action={e.action} /> },
    { id: 'source', label: 'Source', sortable: true, minWidth: 100, render: e => e.source || 'manual' },
    { id: 'content_type_label', label: 'Record Type', sortable: true, minWidth: 140, render: e => recordTypeLabel(e.content_type_label) },
    { id: 'object_repr', label: 'Object', sortable: true, minWidth: 160, render: e => e.object_repr || (e.object_id ?? '—') },
    { id: 'ip_address', label: 'IP Address', sortable: true, minWidth: 120, render: e => e.ip_address ?? '—' },
  ]

  return (
    <div>
      <div className="flex items-end gap-2 mb-3 flex-wrap">
        <Field label="Search" className="flex-1" >
          <input
            style={inputStyle} className="w-full outline-none bg-white"
            placeholder="Search user, record, type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </Field>
        <Field label="Action">
          <select style={selectStyle} value={action} onChange={e => setAction(e.target.value)}>
            <option value="">All actions</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="User">
          <select style={selectStyle} value={userFilter} onChange={e => setUserFilter(e.target.value)}>
            <option value="">All users</option>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Record Type">
          <select style={selectStyle} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {types.map(t => <option key={t} value={t}>{recordTypeLabel(t)}</option>)}
          </select>
        </Field>
        <Field label="From">
          <input type="date" style={inputStyle} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" style={inputStyle} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </Field>
        <Btn variant="outline" icon="download" onClick={() => downloadAuditCsv(filtered)} disabled={filtered.length === 0}>
          Export CSV
        </Btn>
      </div>
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          <DataTable
            data={filtered}
            columns={columns}
            persistKey="audit-trail-events"
            expandedRowIds={expandedId !== null ? [expandedId] : []}
            renderRowDetails={e => (
              <EventDetailsDropdown event={e} onOpenSideView={ev => setSelectedDrawerEvent(prev => prev?.id === ev.id ? null : ev)} />
            )}
            rowActions={e => {
              const isExp = expandedId === e.id
              return (
                <button
                  type="button"
                  title={isExp ? "Collapse details" : "Expand details dropdown"}
                  className="px-2 py-1 rounded hover:bg-gray-100 flex items-center gap-1"
                  style={{
                    cursor: 'pointer',
                    border: '1px solid #E5E7EB',
                    backgroundColor: isExp ? '#EFF6FF' : '#fff',
                    color: isExp ? '#1D4ED8' : '#374151',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    setExpandedId(prev => {
                      const next = prev === e.id ? null : e.id
                      // close side panel when switching to a different row
                      if (next !== prev) setSelectedDrawerEvent(null)
                      return next
                    })
                  }}
                >
                  <span>{isExp ? 'Hide' : 'Details'}</span>
                  <MI name={isExp ? 'expand_less' : 'expand_more'} size={16} color={isExp ? '#1D4ED8' : '#6B7280'} />
                </button>
              )
            }}
            emptyMessage="No matching events."
          />
        </div>

        {selectedDrawerEvent && (
          <AnalysisSideViewPanel
            event={selectedDrawerEvent}
            history={historyFor(selectedDrawerEvent)}
            onClose={() => setSelectedDrawerEvent(null)}
          />
        )}
      </div>
    </div>
  )
}

/* --------------------------------- Login Events ---------------------------------- */

function LoginEventsTable({ events }: { events: LoginEvent[] }) {
  const [search, setSearch] = useState('')
  const [result, setResult] = useState('')

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (result === 'success' && !e.success) return false
      if (result === 'failed' && e.success) return false
      if (search) {
        const s = search.toLowerCase()
        const hay = `${e.username_attempted} ${e.ip_address ?? ''} ${e.user_agent ?? ''}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [events, search, result])

  if (events.length === 0) {
    return <EmptyState icon="login" title="No login events" sub="Login attempts will appear here." />
  }

  const columns: DataTableColumn<LoginEvent>[] = [
    { id: 'timestamp', label: 'Timestamp', sortable: true, minWidth: 170, render: e => fmt(e.timestamp) },
    { id: 'username_attempted', label: 'Username Attempted', sortable: true, minWidth: 160 },
    { id: 'user', label: 'User', sortable: true, minWidth: 100, render: e => e.user ?? '—' },
    { id: 'success', label: 'Result', sortable: true, minWidth: 100, render: e => <StatusChip status={e.success ? 'success' : 'failed'} /> },
    { id: 'ip_address', label: 'IP Address', sortable: true, minWidth: 120, render: e => e.ip_address ?? '—' },
    { id: 'user_agent', label: 'User Agent', minWidth: 260, render: e => <span title={e.user_agent}>{e.user_agent || '—'}</span> },
  ]

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Field label="Search" className="flex-1" >
          <input
            style={inputStyle} className="w-full outline-none bg-white"
            placeholder="Search username, IP, user agent…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </Field>
        <Field label="Result">
          <select style={selectStyle} value={result} onChange={e => setResult(e.target.value)}>
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </Field>
      </div>
      <DataTable data={filtered} columns={columns} persistKey="audit-trail-logins" emptyMessage="No matching login events." />
    </div>
  )
}

/* -------------------------------- Security Events -------------------------------- */

function SecurityEventsTable({ events }: { events: SecurityEvent[] }) {
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState('')

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (severity && e.severity !== severity) return false
      if (search) {
        const s = search.toLowerCase()
        const hay = `${e.event_type} ${e.description} ${e.ip_address ?? ''}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [events, search, severity])

  if (events.length === 0) {
    return <EmptyState icon="gpp_maybe" title="No security events" sub="Permission-denied and unauthorized access attempts will appear here." />
  }

  const columns: DataTableColumn<SecurityEvent>[] = [
    { id: 'timestamp', label: 'Timestamp', sortable: true, minWidth: 170, render: e => fmt(e.timestamp) },
    { id: 'user', label: 'User', sortable: true, minWidth: 100, render: e => e.user ?? '—' },
    { id: 'event_type', label: 'Event Type', sortable: true, minWidth: 140 },
    { id: 'severity', label: 'Severity', sortable: true, minWidth: 110, render: e => <StatusChip status={e.severity} /> },
    { id: 'description', label: 'Description', minWidth: 300 },
    { id: 'ip_address', label: 'IP Address', sortable: true, minWidth: 120, render: e => e.ip_address ?? '—' },
  ]

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Field label="Search" className="flex-1" >
          <input
            style={inputStyle} className="w-full outline-none bg-white"
            placeholder="Search type, description, IP…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </Field>
        <Field label="Severity">
          <select style={selectStyle} value={severity} onChange={e => setSeverity(e.target.value)}>
            <option value="">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </Field>
      </div>
      <DataTable data={filtered} columns={columns} persistKey="audit-trail-security" emptyMessage="No matching security events." />
    </div>
  )
}

/* -------------------------------- Record Versions --------------------------------- */

/** Small centered modal showing one version's immutable JSON snapshot — replaces
 *  the old inline expandable row (DataTable has no row-expansion feature). */
function VersionSnapshotModal({ version, onClose }: { version: RecordVersion; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} />
      <div style={{ position: 'relative', width: 'min(640px, 92%)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: T.heading, margin: 0 }}>
            {version.content_type} #{version.object_id} — v{version.version_number}
          </p>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.muted }}>
            <MI name="close" size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: T.text, margin: 0 }}>
            {JSON.stringify(version.data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}

function RecordVersionsTable({ versions }: { versions: RecordVersion[] }) {
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<RecordVersion | null>(null)

  const filtered = useMemo(() => {
    if (!search) return versions
    const s = search.toLowerCase()
    return versions.filter(v => `${v.changed_by_display ?? ''} ${v.object_id} ${v.reason ?? ''}`.toLowerCase().includes(s))
  }, [versions, search])

  if (versions.length === 0) {
    return <EmptyState icon="history" title="No record versions" sub="Immutable field-level snapshots will appear here." />
  }

  const columns: DataTableColumn<RecordVersion>[] = [
    { id: 'created_at', label: 'Created At', sortable: true, minWidth: 170, render: v => fmt(v.created_at) },
    { id: 'content_type', label: 'Content Type', sortable: true, minWidth: 140 },
    { id: 'object_id', label: 'Object ID', sortable: true, minWidth: 100 },
    { id: 'version_number', label: 'Version', sortable: true, minWidth: 90, render: v => `v${v.version_number}` },
    { id: 'changed_by_display', label: 'Changed By', sortable: true, minWidth: 140, render: v => v.changed_by_display ?? '—' },
    { id: 'reason', label: 'Reason', minWidth: 200, render: v => v.reason || '—' },
  ]

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Field label="Search" className="flex-1" >
          <input
            style={inputStyle} className="w-full outline-none bg-white"
            placeholder="Search changed by, object id, reason…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </Field>
      </div>
      <DataTable
        data={filtered}
        columns={columns}
        persistKey="audit-trail-versions"
        rowActions={v => (
          <button type="button" title="View snapshot" className="p-1 rounded hover:bg-gray-100" style={{ cursor: 'pointer' }} onClick={() => setViewing(v)}>
            <MI name="visibility" size={17} color={T.muted} />
          </button>
        )}
        emptyMessage="No matching record versions."
      />
      {viewing && <VersionSnapshotModal version={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

/* ------------------------------------- Shell -------------------------------------- */

export default function AuditTrailShell({
  initialAuditEvents, initialLoginEvents, initialSecurityEvents, initialRecordVersions,
}: {
  initialAuditEvents: AuditEvent[]
  initialLoginEvents: LoginEvent[]
  initialSecurityEvents: SecurityEvent[]
  initialRecordVersions: RecordVersion[]
}) {
  const [tab, setTab] = useState<Tab>('events')

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0 }}>
      <PageHeader title="Audit Trail" subtitle="Read-only compliance log of system activity, logins, security events, and record history" backHref="/dashboard/admin" />

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <TabBtn active={tab === 'events'} onClick={() => setTab('events')} icon="fact_check" label="Audit Events" count={initialAuditEvents.length} />
        <TabBtn active={tab === 'logins'} onClick={() => setTab('logins')} icon="login" label="Login Events" count={initialLoginEvents.length} />
        <TabBtn active={tab === 'security'} onClick={() => setTab('security')} icon="gpp_maybe" label="Security Events" count={initialSecurityEvents.length} />
        <TabBtn active={tab === 'versions'} onClick={() => setTab('versions')} icon="history" label="Record Versions" count={initialRecordVersions.length} />
      </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <Card pad={false} bodyClassName="p-4">
        {tab === 'events' && <AuditEventsTable events={initialAuditEvents} />}
        {tab === 'logins' && <LoginEventsTable events={initialLoginEvents} />}
        {tab === 'security' && <SecurityEventsTable events={initialSecurityEvents} />}
        {tab === 'versions' && <RecordVersionsTable versions={initialRecordVersions} />}
      </Card>
      </div>
    </div>
  )
}

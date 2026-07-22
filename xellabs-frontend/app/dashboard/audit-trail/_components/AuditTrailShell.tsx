'use client'
import { Fragment, useMemo, useState } from 'react'
import {
  PageHeader, Card, StatCard, Field, StatusChip, Pagination, EmptyState, MI, Btn,
  thStyle, tdStyle, inputStyle, selectStyle, T,
} from '../../_components/ui'
import type { AuditEvent, LoginEvent, SecurityEvent, RecordVersion } from '@/app/actions/audit-trail'
import { recordTypeLabel, downloadAuditCsv } from './auditCsv'

const stickyThStyle = { ...thStyle, position: 'sticky' as const, top: 0, zIndex: 1 }

type Tab = 'events' | 'logins' | 'security' | 'versions'
const PAGE_SIZE = 15

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
const DEFAULT_ACTION_COLOR = { bg: '#F3F4F6', fg: '#6B7280' }

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

function AuditEventsTable({ events }: { events: AuditEvent[] }) {
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedChanges, setExpandedChanges] = useState<number | null>(null)
  const [expandedHistory, setExpandedHistory] = useState<number | null>(null)

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
    rows.sort((a, b) => {
      const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      return sortDir === 'asc' ? diff : -diff
    })
    return rows
  }, [events, search, action, dateFrom, dateTo, userFilter, typeFilter, sortDir])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const historyFor = (e: AuditEvent) =>
    events
      .filter(ev => ev.content_type === e.content_type && ev.object_id === e.object_id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  if (events.length === 0) {
    return <EmptyState icon="fact_check" title="No audit events" sub="Sample, result, and approval activity will appear here." />
  }

  return (
    <div>
      <div className="flex items-end gap-2 mb-3 flex-wrap">
        <Field label="Search" className="flex-1" >
          <input
            style={inputStyle} className="w-full outline-none bg-white"
            placeholder="Search user, record, type…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </Field>
        <Field label="Action">
          <select style={selectStyle} value={action} onChange={e => { setAction(e.target.value); setPage(1) }}>
            <option value="">All actions</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="User">
          <select style={selectStyle} value={userFilter} onChange={e => { setUserFilter(e.target.value); setPage(1) }}>
            <option value="">All users</option>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Record Type">
          <select style={selectStyle} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}>
            <option value="">All types</option>
            {types.map(t => <option key={t} value={t}>{recordTypeLabel(t)}</option>)}
          </select>
        </Field>
        <Field label="From">
          <input type="date" style={inputStyle} value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} />
        </Field>
        <Field label="To">
          <input type="date" style={inputStyle} value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} />
        </Field>
        <Btn variant="outline" icon="download" onClick={() => downloadAuditCsv(filtered)} disabled={filtered.length === 0}>
          Export CSV
        </Btn>
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon="search_off" title="No matching events" sub="Try adjusting your search or filters." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th
                    style={{ ...stickyThStyle, cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                  >
                    Timestamp {sortDir === 'asc' ? '▲' : '▼'}
                  </th>
                  <th style={stickyThStyle}>User</th>
                  <th style={stickyThStyle}>Action</th>
                  <th style={stickyThStyle}>Source</th>
                  <th style={stickyThStyle}>Record Type</th>
                  <th style={stickyThStyle}>Object</th>
                  <th style={stickyThStyle}>IP Address</th>
                  <th style={stickyThStyle}></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(e => {
                  const isChangesOpen = expandedChanges === e.id
                  const isHistoryOpen = expandedHistory === e.id
                  const hasChanges = e.changes && e.changes.length > 0
                  return (
                    <Fragment key={e.id}>
                      <tr>
                        <td style={tdStyle}>{fmt(e.timestamp)}</td>
                        <td style={tdStyle}>{e.user_display ?? '—'}</td>
                        <td style={tdStyle}><ActionPill action={e.action} /></td>
                        <td style={tdStyle}>{e.source || 'manual'}</td>
                        <td style={tdStyle}>{recordTypeLabel(e.content_type_label)}</td>
                        <td style={tdStyle}>{e.object_repr || (e.object_id ?? '—')}</td>
                        <td style={tdStyle}>{e.ip_address ?? '—'}</td>
                        <td style={tdStyle}>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              title="Record history"
                              className="p-1 rounded hover:bg-gray-100"
                              style={{ cursor: 'pointer' }}
                              onClick={() => setExpandedHistory(isHistoryOpen ? null : e.id)}
                            >
                              <MI name="history" size={17} color={isHistoryOpen ? T.primary : T.muted} />
                            </button>
                            {hasChanges && (
                              <button
                                type="button"
                                title="Field changes"
                                className="p-1 rounded hover:bg-gray-100"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setExpandedChanges(isChangesOpen ? null : e.id)}
                              >
                                <MI name={isChangesOpen ? 'expand_less' : 'expand_more'} size={18} color={T.muted} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isChangesOpen && hasChanges && (
                        <tr>
                          <td colSpan={8} style={{ ...tdStyle, backgroundColor: T.tableHeadBg, padding: 12 }}>
                            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  <th style={{ ...thStyle, backgroundColor: 'transparent' }}>Field</th>
                                  <th style={{ ...thStyle, backgroundColor: 'transparent' }}>Old Value</th>
                                  <th style={{ ...thStyle, backgroundColor: 'transparent' }}>New Value</th>
                                  <th style={{ ...thStyle, backgroundColor: 'transparent' }}>Reason</th>
                                </tr>
                              </thead>
                              <tbody>
                                {e.changes.map(c => (
                                  <tr key={c.id}>
                                    <td style={tdStyle}>{c.field_name}</td>
                                    <td style={{ ...tdStyle, color: T.danger }}>{c.old_value ?? '—'}</td>
                                    <td style={{ ...tdStyle, color: T.success }}>{c.new_value ?? '—'}</td>
                                    <td style={tdStyle}>{c.reason || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                      {isHistoryOpen && (
                        <tr>
                          <td colSpan={8} style={{ ...tdStyle, backgroundColor: T.tableHeadBg, padding: 12 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: T.heading, marginBottom: 8 }}>
                              History for {recordTypeLabel(e.content_type_label)} — {e.object_repr || e.object_id}
                            </p>
                            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  <th style={{ ...thStyle, backgroundColor: 'transparent' }}>Timestamp</th>
                                  <th style={{ ...thStyle, backgroundColor: 'transparent' }}>Action</th>
                                  <th style={{ ...thStyle, backgroundColor: 'transparent' }}>User</th>
                                  <th style={{ ...thStyle, backgroundColor: 'transparent' }}>Source</th>
                                </tr>
                              </thead>
                              <tbody>
                                {historyFor(e).map(h => (
                                  <tr key={h.id}>
                                    <td style={tdStyle}>{fmt(h.timestamp)}</td>
                                    <td style={tdStyle}><StatusChip status={h.action} /></td>
                                    <td style={tdStyle}>{h.user_display ?? '—'}</td>
                                    <td style={tdStyle}>{h.source || 'manual'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-3">
            <Pagination page={page} pages={pages} onPage={setPage} showTotal totalItems={filtered.length} />
          </div>
        </>
      )}
    </div>
  )
}

/* --------------------------------- Login Events ---------------------------------- */

function LoginEventsTable({ events }: { events: LoginEvent[] }) {
  const [search, setSearch] = useState('')
  const [result, setResult] = useState('')
  const [page, setPage] = useState(1)

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

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (events.length === 0) {
    return <EmptyState icon="login" title="No login events" sub="Login attempts will appear here." />
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Field label="Search" className="flex-1" >
          <input
            style={inputStyle} className="w-full outline-none bg-white"
            placeholder="Search username, IP, user agent…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </Field>
        <Field label="Result">
          <select style={selectStyle} value={result} onChange={e => { setResult(e.target.value); setPage(1) }}>
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </Field>
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon="search_off" title="No matching login events" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Timestamp</th>
                  <th style={thStyle}>Username Attempted</th>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Result</th>
                  <th style={thStyle}>IP Address</th>
                  <th style={thStyle}>User Agent</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(e => (
                  <tr key={e.id}>
                    <td style={tdStyle}>{fmt(e.timestamp)}</td>
                    <td style={tdStyle}>{e.username_attempted}</td>
                    <td style={tdStyle}>{e.user ?? '—'}</td>
                    <td style={tdStyle}><StatusChip status={e.success ? 'success' : 'failed'} /></td>
                    <td style={tdStyle}>{e.ip_address ?? '—'}</td>
                    <td style={{ ...tdStyle, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.user_agent}>{e.user_agent || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-3">
            <Pagination page={page} pages={pages} onPage={setPage} showTotal totalItems={filtered.length} />
          </div>
        </>
      )}
    </div>
  )
}

/* -------------------------------- Security Events -------------------------------- */

function SecurityEventsTable({ events }: { events: SecurityEvent[] }) {
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState('')
  const [page, setPage] = useState(1)

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

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (events.length === 0) {
    return <EmptyState icon="gpp_maybe" title="No security events" sub="Permission-denied and unauthorized access attempts will appear here." />
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Field label="Search" className="flex-1" >
          <input
            style={inputStyle} className="w-full outline-none bg-white"
            placeholder="Search type, description, IP…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </Field>
        <Field label="Severity">
          <select style={selectStyle} value={severity} onChange={e => { setSeverity(e.target.value); setPage(1) }}>
            <option value="">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </Field>
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon="search_off" title="No matching security events" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Timestamp</th>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Event Type</th>
                  <th style={thStyle}>Severity</th>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(e => (
                  <tr key={e.id}>
                    <td style={tdStyle}>{fmt(e.timestamp)}</td>
                    <td style={tdStyle}>{e.user ?? '—'}</td>
                    <td style={tdStyle}>{e.event_type}</td>
                    <td style={tdStyle}><StatusChip status={e.severity} /></td>
                    <td style={{ ...tdStyle, maxWidth: 340 }}>{e.description}</td>
                    <td style={tdStyle}>{e.ip_address ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-3">
            <Pagination page={page} pages={pages} onPage={setPage} showTotal totalItems={filtered.length} />
          </div>
        </>
      )}
    </div>
  )
}

/* -------------------------------- Record Versions --------------------------------- */

function RecordVersionsTable({ versions }: { versions: RecordVersion[] }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<number | null>(null)

  const filtered = useMemo(() => {
    if (!search) return versions
    const s = search.toLowerCase()
    return versions.filter(v => `${v.changed_by_display ?? ''} ${v.object_id} ${v.reason ?? ''}`.toLowerCase().includes(s))
  }, [versions, search])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (versions.length === 0) {
    return <EmptyState icon="history" title="No record versions" sub="Immutable field-level snapshots will appear here." />
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Field label="Search" className="flex-1" >
          <input
            style={inputStyle} className="w-full outline-none bg-white"
            placeholder="Search changed by, object id, reason…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </Field>
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon="search_off" title="No matching record versions" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Created At</th>
                  <th style={thStyle}>Content Type</th>
                  <th style={thStyle}>Object ID</th>
                  <th style={thStyle}>Version</th>
                  <th style={thStyle}>Changed By</th>
                  <th style={thStyle}>Reason</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(v => {
                  const key = `${v.content_type}-${v.object_id}-${v.version_number}`
                  const isOpen = expanded === v.id
                  return (
                    <Fragment key={key}>
                      <tr style={{ cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : v.id)}>
                        <td style={tdStyle}>{fmt(v.created_at)}</td>
                        <td style={tdStyle}>{v.content_type}</td>
                        <td style={tdStyle}>{v.object_id}</td>
                        <td style={tdStyle}>v{v.version_number}</td>
                        <td style={tdStyle}>{v.changed_by_display ?? '—'}</td>
                        <td style={tdStyle}>{v.reason || '—'}</td>
                        <td style={tdStyle}><MI name={isOpen ? 'expand_less' : 'expand_more'} size={18} color={T.muted} /></td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={7} style={{ ...tdStyle, backgroundColor: T.tableHeadBg }}>
                            <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: T.text, margin: 0 }}>
                              {JSON.stringify(v.data, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-3">
            <Pagination page={page} pages={pages} onPage={setPage} showTotal totalItems={filtered.length} />
          </div>
        </>
      )}
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
  const failedLogins = initialLoginEvents.filter(e => !e.success).length
  const criticalSecurity = initialSecurityEvents.filter(e => e.severity === 'critical' || e.severity === 'high').length

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0 }}>
      <PageHeader title="Audit Trail" subtitle="Read-only compliance log of system activity, logins, security events, and record history" backHref="/dashboard/admin" />

      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard icon="fact_check" label="Audit Events" value={initialAuditEvents.length} />
        <StatCard icon="login" label="Login Events" value={initialLoginEvents.length} sub={failedLogins ? `${failedLogins} failed` : undefined} iconColor={failedLogins ? T.danger : T.primary} iconBg={failedLogins ? '#FEF2F2' : undefined} />
        <StatCard icon="gpp_maybe" label="Security Events" value={initialSecurityEvents.length} sub={criticalSecurity ? `${criticalSecurity} high/critical` : undefined} iconColor={criticalSecurity ? T.danger : T.primary} iconBg={criticalSecurity ? '#FEF2F2' : undefined} />
        <StatCard icon="history" label="Record Versions" value={initialRecordVersions.length} />
      </div>

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

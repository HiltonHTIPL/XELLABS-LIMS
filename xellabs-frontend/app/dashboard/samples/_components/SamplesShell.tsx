'use client'
import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { receiveSample } from '@/app/actions/samples'
import { SenaiteSample, SenaiteSampleType, SenaiteAnalysisService, mapSenaiteState, mapSenaitePriority } from '@/app/lib/senaite'
import { DjangoClient } from '@/app/actions/clients'
import { T, MI, PageHeader, StatCard, Chip, StatusChip, Btn, IconBtn, Card, thStyle, tdStyle, linkStyle, Pagination, EmptyState } from '../../_components/ui'

type Props = {
  initialSamples: SenaiteSample[]
  clients: DjangoClient[]
  sampleTypes: SenaiteSampleType[]
  analysisServices: SenaiteAnalysisService[]
}
type ClientOption = { uid: string; name: string; client_id: string }

function fmtDate(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) }
  catch { return d }
}

const PAGE_SIZE = 25

export default function SamplesShell({ initialSamples, clients, sampleTypes, analysisServices }: Props) {
  const router = useRouter()
  const [samples] = useState(initialSamples)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterSampleType, setFilterSampleType] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [page, setPage] = useState(1)
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [kebabOpen, setKebabOpen] = useState<string | null>(null)
  const [kebabPos, setKebabPos] = useState<{ top: number; left: number } | null>(null)
  const kebabRef = useRef<HTMLButtonElement | null>(null)

  const clientOptions: ClientOption[] = clients
    .filter(c => c.senaite_uid)
    .map(c => ({ uid: c.senaite_uid!, name: c.name, client_id: c.client_id }))

  const allStatuses = [...new Set(samples.map(s => mapSenaiteState(s.review_state)))]
  const allClients  = [...new Set(samples.map(s => s.ClientTitle).filter(Boolean))]
  const allTypes    = [...new Set(samples.map(s => s.SampleTypeTitle).filter(Boolean))]

  const filtered = samples.filter(s => {
    const stateLabel = mapSenaiteState(s.review_state)
    const priorityLabel = mapSenaitePriority(s.Priority)
    if (search && !s.id.toLowerCase().includes(search.toLowerCase()) && !s.ClientTitle.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus && stateLabel !== filterStatus) return false
    if (filterPriority && priorityLabel !== filterPriority) return false
    if (filterClient && s.ClientTitle !== filterClient) return false
    if (filterSampleType && s.SampleTypeTitle !== filterSampleType) return false
    return true
  })

  const pages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function clearFilters() {
    setSearch(''); setFilterStatus(''); setFilterPriority(''); setFilterClient(''); setFilterSampleType(''); setPage(1)
  }

  function handleReceive(uid: string) {
    startTransition(async () => {
      const result = await receiveSample(uid)
      setActionMsg({ text: result.message, ok: result.success })
      setTimeout(() => setActionMsg(null), 3000)
      router.refresh()
    })
  }

  function openKebab(e: React.MouseEvent<HTMLButtonElement>, uid: string) {
    const rect = e.currentTarget.getBoundingClientRect()
    setKebabPos({ top: rect.bottom + 4, left: rect.left - 120 })
    setKebabOpen(uid === kebabOpen ? null : uid)
    kebabRef.current = e.currentTarget
  }

  const [now, setNow] = useState('')
  useEffect(() => {
    // Client-only timestamp: starts empty so server and client render the same
    // HTML, then fills in after mount — avoids a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
  }, [])

  const kpis = [
    { label: 'Logged',          value: samples.length,                                                              icon: 'post_add',      iconBg: '#EFF6FF', iconColor: T.primary },
    { label: 'Received',        value: samples.filter(s => s.review_state === 'sample_received').length,            icon: 'science',       iconBg: '#EEF2FF', iconColor: '#6366F1' },
    { label: 'In Process',      value: samples.filter(s => s.review_state === 'to_be_sampled').length,              icon: 'person',        iconBg: '#F5F3FF', iconColor: '#7C3AED' },
    { label: 'To Be Verified',  value: samples.filter(s => s.review_state === 'to_be_verified').length,             icon: 'fact_check',    iconBg: '#FFF7ED', iconColor: T.warning },
    { label: 'On Hold for QA',  value: samples.filter(s => s.review_state === 'sample_due').length,                 icon: 'pause_circle',  iconBg: '#FEF2F2', iconColor: T.danger },
    { label: 'Completed',       value: samples.filter(s => ['verified','published'].includes(s.review_state)).length,icon: 'task_alt',     iconBg: '#DBEAFE', iconColor: T.success },
    { label: 'Overdue',         value: 0,                                                                           icon: 'schedule',      iconBg: '#FEF2F2', iconColor: T.danger },
  ]

  const inputSt: React.CSSProperties = {
    height: 34, borderRadius: 10, border: `1px solid ${T.inputBorder}`, fontSize: 12,
    padding: '0 10px', color: T.text, backgroundColor: '#fff', width: '100%', outline: 'none',
  }

  return (
    <div style={{ backgroundColor: T.pageBg, minHeight: '100%', padding: 20, boxSizing: 'border-box' }}>

      {/* Toast */}
      {actionMsg && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl flex items-center gap-2"
          style={{ backgroundColor: actionMsg.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${actionMsg.ok ? '#93C5FD' : '#FECACA'}`, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
          <MI name={actionMsg.ok ? 'check_circle' : 'error_outline'} size={16} color={actionMsg.ok ? T.success : T.danger} />
          <span style={{ fontSize: 13, color: actionMsg.ok ? '#0154FC' : '#991B1B' }}>{actionMsg.text}</span>
        </div>
      )}

      {/* Kebab menu */}
      {kebabOpen && kebabPos && (
        <div
          style={{ position: 'fixed', top: kebabPos.top, left: kebabPos.left, zIndex: 9999, backgroundColor: '#fff', border: `1px solid ${T.cardBorder}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 160 }}
          onMouseLeave={() => setKebabOpen(null)}
        >
          <Link href={`/dashboard/samples/${kebabOpen}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', fontSize: 13, color: T.text, textDecoration: 'none' }}>
            <MI name="visibility" size={15} color={T.muted} /> View Detail
          </Link>
          <button onClick={() => { handleReceive(kebabOpen); setKebabOpen(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', fontSize: 13, color: T.text, width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}>
            <MI name="move_to_inbox" size={15} color={T.muted} /> Receive
          </button>
        </div>
      )}

      <PageHeader
        title="Samples"
        subtitle="Manage and track laboratory samples throughout their lifecycle."
        right={
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 12, color: T.faint }}>Last updated: {now}</span>
            <IconBtn icon="refresh" size={16} onClick={() => router.refresh()} />
            <Btn variant="primary" icon="add" onClick={() => router.push('/dashboard/samples/new')}>New Sample</Btn>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(7,1fr)' }}>
        {kpis.map(k => (
          <StatCard key={k.label} icon={k.icon} iconBg={k.iconBg} iconColor={k.iconColor} label={k.label} value={k.value} />
        ))}
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4" style={{ alignItems: 'flex-start' }}>

        {/* Main column */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">

          {/* Filter card */}
          <Card pad={false}>
            <div style={{ padding: '12px 16px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 8 }}>Search Samples</p>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                <div className="flex items-center gap-2 px-3" style={{ ...inputSt, padding: '0 10px' }}>
                  <MI name="search" size={14} color={T.faint} />
                  <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                    placeholder="Sample ID or client…" style={{ border: 'none', outline: 'none', fontSize: 12, color: T.text, backgroundColor: 'transparent', flex: 1 }} />
                </div>
                <select value={filterSampleType} onChange={e => { setFilterSampleType(e.target.value); setPage(1) }} style={inputSt}>
                  <option value="">Sample Type</option>
                  {allTypes.map(t => <option key={t}>{t}</option>)}
                </select>
                <select value={filterClient} onChange={e => { setFilterClient(e.target.value); setPage(1) }} style={inputSt}>
                  <option value="">Client</option>
                  {allClients.map(c => <option key={c}>{c}</option>)}
                </select>
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }} style={inputSt}>
                  <option value="">Status</option>
                  {allStatuses.map(s => <option key={s}>{s}</option>)}
                </select>
                <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setPage(1) }} style={inputSt}>
                  <option value="">Priority</option>
                  {['Critical','High','Normal','Low','Routine'].map(p => <option key={p}>{p}</option>)}
                </select>
                <Btn variant="ghost" onClick={clearFilters}>Clear</Btn>
              </div>
            </div>
          </Card>

          {/* Actions row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Btn variant="primary" icon="add" onClick={() => router.push('/dashboard/samples/new')}>New Sample</Btn>
              <Btn variant="outline" icon="call_received">Receive Sample</Btn>
              <Btn variant="outline" icon="file_download">Export</Btn>
              <Btn variant="outline" icon="checklist">Bulk Actions</Btn>
            </div>
            <span style={{ fontSize: 12, color: T.muted }}>
              {filtered.length === 0 ? '0 results' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
            </span>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <Card pad={false}>
              <EmptyState icon="science" title="No samples found" sub="Adjust your filters or create a new sample." />
            </Card>
          ) : (
            <Card pad={false}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}><input type="checkbox" style={{ accentColor: T.primary }} /></th>
                      {['Sample ID','Client','Sample Type','Condition','Status','Priority','Received Date','Due Date','TAT','Analyst','Actions'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(s => {
                      const stateLabel    = mapSenaiteState(s.review_state)
                      const priorityLabel = mapSenaitePriority(s.Priority)
                      const acceptable = !['invalid','cancelled'].includes(s.review_state)
                      return (
                        <tr key={s.uid}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAFBFE')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                          <td style={tdStyle}><input type="checkbox" style={{ accentColor: T.primary }} /></td>
                          <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                            <Link href={`/dashboard/samples/${s.uid}`} style={linkStyle}>
                              {s.id || s.uid.slice(0, 8)}
                            </Link>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ fontSize: 13, color: T.text }}>{s.ClientTitle || '—'}</div>
                            {s.ClientID && <div style={{ fontSize: 11, color: T.faint }}>{s.ClientID}</div>}
                          </td>
                          <td style={tdStyle}>{s.SampleTypeTitle || '—'}</td>
                          <td style={tdStyle}>
                            <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12.5, color: T.text }}>
                              <span className="rounded-full shrink-0" style={{ width: 7, height: 7, backgroundColor: acceptable ? T.success : T.danger }} />
                              {acceptable ? 'Acceptable' : 'Compromised'}
                            </span>
                          </td>
                          <td style={tdStyle}><StatusChip status={stateLabel} /></td>
                          <td style={tdStyle}><StatusChip status={priorityLabel} /></td>
                          <td style={{ ...tdStyle, fontSize: 12, color: T.muted, whiteSpace: 'nowrap' }}>{fmtDate(s.DateSampled)}</td>
                          <td style={{ ...tdStyle, fontSize: 12, color: T.muted, whiteSpace: 'nowrap' }}>{fmtDate(s.DateDue)}</td>
                          <td style={{ ...tdStyle, fontSize: 12, color: T.text, textAlign: 'center' }}>—</td>
                          <td style={{ ...tdStyle, fontSize: 12, color: T.muted }}>—</td>
                          <td style={tdStyle}>
                            <button onClick={e => openKebab(e, s.uid)}
                              className="p-1 rounded-lg hover:bg-gray-100"
                              style={{ cursor: 'pointer', background: 'none', border: 'none' }}>
                              <MI name="more_vert" size={16} color={T.muted} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
                <span style={{ fontSize: 12, color: T.muted }}>Showing {(page-1)*PAGE_SIZE+1} to {Math.min(page*PAGE_SIZE, filtered.length)} of {filtered.length} results</span>
                <Pagination page={page} pages={pages} onPage={p => { setPage(p); window.scrollTo(0, 0) }} />
              </div>
            </Card>
          )}
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-4" style={{ width: 280, flexShrink: 0 }}>

          {/* Quick Actions */}
          <Card title="Quick Actions">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'New Sample',     icon: 'add_circle',    bg: '#EFF6FF', color: T.primary,   href: '/dashboard/samples/new' },
                { label: 'Receive Sample', icon: 'call_received', bg: '#DBEAFE', color: T.success,   href: '/dashboard/sample-receipts' },
                { label: 'Export Samples', icon: 'file_download', bg: '#F5F3FF', color: '#7C3AED',   href: '#' },
                { label: 'Bulk Actions',   icon: 'checklist',     bg: '#FFF7ED', color: T.warning,   href: '#' },
              ].map(a => (
                <Link key={a.label} href={a.href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, padding: '14px 8px', backgroundColor: a.bg }}>
                  <MI name={a.icon} size={20} color={a.color} />
                  <span style={{ fontSize: 11, color: a.color, fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{a.label}</span>
                </Link>
              ))}
            </div>
          </Card>

          {/* Recent Alerts */}
          <Card title="Recent Alerts" action={<a href="#" style={{ fontSize: 12, color: T.primary }}>View all</a>}>
            <div className="flex flex-col gap-2">
              {[
                { msg: '32 samples are overdue', sub: 'Requires immediate attention', tone: 'red' as const },
                { msg: '18 samples on hold for QA', sub: 'Pending quality review', tone: 'orange' as const },
                { msg: '204 samples to be verified', sub: 'Analyst review required', tone: 'blue' as const },
              ].map((a, i) => (
                <div key={i} className="flex items-start justify-between gap-2 py-2" style={{ borderBottom: i < 2 ? `1px solid ${T.rowBorder}` : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: T.heading }}>{a.msg}</p>
                    <p style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>{a.sub}</p>
                  </div>
                  <Chip tone={a.tone}>{a.tone === 'red' ? 'High' : a.tone === 'orange' ? 'Medium' : 'Info'}</Chip>
                </div>
              ))}
            </div>
          </Card>

          {/* Saved Views */}
          <Card title="Saved Views" action={<a href="#" style={{ fontSize: 12, color: T.primary }}>View all</a>}>
            <div className="flex flex-col gap-0.5">
              {[
                { label: 'My Samples',          count: samples.length,  tone: 'blue' as const },
                { label: 'High Priority',        count: samples.filter(s => mapSenaitePriority(s.Priority) === 'High').length, tone: 'blue' as const },
                { label: 'Overdue Samples',      count: 0,               tone: 'red' as const },
                { label: 'Samples by Client',    count: allClients.length, tone: 'blue' as const },
              ].map((v, i) => (
                <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: i < 3 ? `1px solid ${T.rowBorder}` : 'none' }}>
                  <div className="flex items-center gap-2">
                    <MI name="bookmark" size={14} color={T.faint} />
                    <span style={{ fontSize: 12.5, color: T.text }}>{v.label}</span>
                  </div>
                  <Chip tone={v.tone}>{v.count}</Chip>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Btn variant="outline" fullWidth icon="add">Save New View</Btn>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

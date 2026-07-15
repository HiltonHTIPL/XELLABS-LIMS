'use client'
import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { receiveSample, verifySample, publishSample, type WorkflowResult } from '@/app/actions/samples'
import { SenaiteSample, SenaiteSampleType, SenaiteAnalysisService, SenaiteSampleTemplate, SenaiteRefOption, mapSenaiteState, mapSenaitePriority } from '@/app/lib/senaite'
import { DjangoClient } from '@/app/actions/clients'
import { AnalysisProfile } from '@/app/actions/analysis-profiles'
import { T, MI, PageHeader, StatCard, Chip, StatusChip, Btn, IconBtn, Card, thStyle, tdStyle, linkStyle, Pagination, EmptyState } from '../../_components/ui'
import NewSamplePage from '../new/_components/NewSamplePage'

type Props = {
  initialSamples: SenaiteSample[]
  clients: DjangoClient[]
  sampleTypes: SenaiteSampleType[]
  analysisServices: SenaiteAnalysisService[]
  sampleTemplates: SenaiteSampleTemplate[]
  sampleContainers: SenaiteRefOption[]
  analysisProfiles: AnalysisProfile[]
}
type ClientOption = { uid: string; name: string; client_id: string }

function fmtDate(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) }
  catch { return d }
}

const PAGE_SIZE = 25

const SAVED_VIEWS_LS_KEY = 'xl_senaite_samples_saved_views'
type SavedView = { name: string; filters: { search: string; status: string; priority: string; sampleType: string; client: string } }

export default function SamplesShell({ initialSamples, clients, sampleTypes, analysisServices, sampleTemplates, sampleContainers, analysisProfiles }: Props) {
  const router = useRouter()
  const [samples] = useState(initialSamples)
  const [showNewSample, setShowNewSample] = useState(false)
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false)
  const [bulkMenuPos, setBulkMenuPos] = useState<{ top: number; right: number } | null>(null)
  const bulkBtnRef = useRef<HTMLButtonElement>(null)
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(SAVED_VIEWS_LS_KEY)
      return raw ? (JSON.parse(raw) as SavedView[]) : []
    } catch { return [] }
  })

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

  function toggleAll() {
    if (selected.size === paged.length) setSelected(new Set())
    else setSelected(new Set(paged.map(s => s.uid)))
  }
  function toggleRow(uid: string) {
    setSelected(prev => { const n = new Set(prev); n.has(uid) ? n.delete(uid) : n.add(uid); return n })
  }

  function handleReceiveSelected() {
    if (selected.size === 0) { setActionMsg({ text: 'Select at least one sample first.', ok: false }); setTimeout(() => setActionMsg(null), 3000); return }
    startTransition(async () => {
      const uids = [...selected]
      const results = await Promise.all(uids.map(uid => receiveSample(uid)))
      const okCount = results.filter(r => r.success).length
      setActionMsg({ text: `Received ${okCount} of ${uids.length} sample(s).`, ok: okCount === uids.length })
      setTimeout(() => setActionMsg(null), 4000)
      setSelected(new Set())
      router.refresh()
    })
  }

  function openBulkMenu() {
    if (selected.size === 0) { setActionMsg({ text: 'Select at least one sample first.', ok: false }); setTimeout(() => setActionMsg(null), 3000); return }
    const rect = bulkBtnRef.current!.getBoundingClientRect()
    setBulkMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setBulkMenuOpen(o => !o)
  }

  function runBulkWorkflow(action: (uid: string) => Promise<WorkflowResult>, label: string) {
    setBulkMenuOpen(false)
    startTransition(async () => {
      const uids = [...selected]
      const results = await Promise.all(uids.map(uid => action(uid)))
      const okCount = results.filter(r => r.success).length
      setActionMsg({ text: `${label}: ${okCount} of ${uids.length} succeeded.`, ok: okCount === uids.length })
      setTimeout(() => setActionMsg(null), 4000)
      setSelected(new Set())
      router.refresh()
    })
  }

  function handleExport() {
    const headers = ['Sample ID', 'Client', 'Sample Type', 'Status', 'Priority', 'Date Sampled', 'Due Date']
    const rows = filtered.map(s => [
      s.id || s.uid, s.ClientTitle || '', s.SampleTypeTitle || '',
      mapSenaiteState(s.review_state), mapSenaitePriority(s.Priority), fmtDate(s.DateSampled), fmtDate(s.DateDue),
    ])
    const esc = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v)
    const csv = [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `samples-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function persistSavedViews(next: SavedView[]) {
    setSavedViews(next)
    try { localStorage.setItem(SAVED_VIEWS_LS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }
  function saveNewView() {
    const name = window.prompt('Name this view:')
    if (!name) return
    const snapshot = { search, status: filterStatus, priority: filterPriority, sampleType: filterSampleType, client: filterClient }
    persistSavedViews([...savedViews.filter(v => v.name !== name), { name, filters: snapshot }])
  }
  function applySavedView(v: SavedView) {
    setSearch(v.filters.search); setFilterStatus(v.filters.status); setFilterPriority(v.filters.priority)
    setFilterSampleType(v.filters.sampleType); setFilterClient(v.filters.client)
    setPage(1)
  }

  const [now, setNow] = useState('')
  useEffect(() => {
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

      {/* Bulk actions menu */}
      {bulkMenuOpen && bulkMenuPos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9990 }} onClick={() => setBulkMenuOpen(false)} />
          <div style={{ position: 'fixed', top: bulkMenuPos.top, right: bulkMenuPos.right, zIndex: 9999, backgroundColor: '#fff', border: `1px solid ${T.cardBorder}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 200, padding: '6px 0' }}>
            <button onClick={() => runBulkWorkflow(receiveSample, 'Receive')} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: T.text, textAlign: 'left' }}>
              <MI name="move_to_inbox" size={15} color={T.muted} /> Receive Selected
            </button>
            <button onClick={() => runBulkWorkflow(verifySample, 'Verify')} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: T.text, textAlign: 'left' }}>
              <MI name="fact_check" size={15} color={T.muted} /> Verify Selected
            </button>
            <button onClick={() => runBulkWorkflow(publishSample, 'Publish')} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: T.text, textAlign: 'left' }}>
              <MI name="task_alt" size={15} color={T.muted} /> Publish Selected
            </button>
          </div>
        </>
      )}

      <PageHeader
        title="Samples"
        subtitle="Manage and track laboratory samples throughout their lifecycle."
        right={
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 12, color: T.faint }}>Last updated: {now}</span>
            <IconBtn icon="refresh" size={16} onClick={() => router.refresh()} />
            <Btn variant="primary" icon="add" onClick={() => setShowNewSample(true)}>New Sample</Btn>
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
              <Btn variant="primary" icon="add" onClick={() => setShowNewSample(true)}>New Sample</Btn>
              <Btn variant="outline" icon="call_received" onClick={handleReceiveSelected}>Receive Sample{selected.size > 0 ? ` (${selected.size})` : ''}</Btn>
              <Btn variant="outline" icon="file_download" onClick={handleExport}>Export</Btn>
              <button ref={bulkBtnRef} onClick={openBulkMenu} type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ border: `1px solid ${T.inputBorder}`, backgroundColor: bulkMenuOpen ? '#F3F4F6' : '#fff', color: T.text, cursor: 'pointer' }}>
                <MI name="checklist" size={14} color={T.muted} /> Bulk Actions{selected.size > 0 ? ` (${selected.size})` : ''}
              </button>
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
                      <th style={thStyle}><input type="checkbox" checked={paged.length > 0 && selected.size === paged.length} onChange={toggleAll} style={{ accentColor: T.primary }} /></th>
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
                          <td style={tdStyle}><input type="checkbox" checked={selected.has(s.uid)} onChange={() => toggleRow(s.uid)} style={{ accentColor: T.primary }} /></td>
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
                { label: 'New Sample',     icon: 'add_circle',    bg: '#EFF6FF', color: T.primary,   action: () => setShowNewSample(true) },
                { label: 'Receive Sample', icon: 'call_received', bg: '#DBEAFE', color: T.success,   action: () => router.push('/dashboard/sample-receipts') },
                { label: 'Export Samples', icon: 'file_download', bg: '#F5F3FF', color: '#7C3AED',   action: handleExport },
                { label: 'Bulk Actions',   icon: 'checklist',     bg: '#FFF7ED', color: T.warning,   action: openBulkMenu },
              ].map(a => (
                <button key={a.label} onClick={a.action} type="button" style={{ border: 'none', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, padding: '14px 8px', backgroundColor: a.bg, cursor: 'pointer' }}>
                  <MI name={a.icon} size={20} color={a.color} />
                  <span style={{ fontSize: 11, color: a.color, fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{a.label}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Recent Alerts */}
          <Card title="Recent Alerts" action={<Link href="/dashboard/samples-overview" style={{ fontSize: 12, color: T.primary }}>View all</Link>}>
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
          <Card title="Saved Views" action={<Link href="/dashboard/samples-overview" style={{ fontSize: 12, color: T.primary }}>View all</Link>}>
            <div className="flex flex-col gap-0.5">
              {[
                { label: 'My Samples',          count: samples.length,  tone: 'blue' as const, onClick: clearFilters },
                { label: 'High Priority',        count: samples.filter(s => mapSenaitePriority(s.Priority) === 'High').length, tone: 'blue' as const, onClick: () => { setFilterPriority('High'); setPage(1) } },
                { label: 'Overdue Samples',      count: 0,               tone: 'red' as const, onClick: () => {} },
                { label: 'Samples by Client',    count: allClients.length, tone: 'blue' as const, onClick: clearFilters },
              ].map((v, i) => (
                <button key={i} onClick={v.onClick} type="button"
                  className="flex items-center justify-between py-2 w-full" style={{ borderBottom: i < 3 ? `1px solid ${T.rowBorder}` : 'none', border: 'none', background: 'none', cursor: 'pointer', padding: '8px 0' }}>
                  <div className="flex items-center gap-2">
                    <MI name="bookmark" size={14} color={T.faint} />
                    <span style={{ fontSize: 12.5, color: T.text }}>{v.label}</span>
                  </div>
                  <Chip tone={v.tone}>{v.count}</Chip>
                </button>
              ))}
              {savedViews.map(v => (
                <button key={v.name} onClick={() => applySavedView(v)} type="button"
                  className="flex items-center justify-between py-2 w-full" style={{ borderTop: `1px solid ${T.rowBorder}`, border: 'none', background: 'none', cursor: 'pointer', padding: '8px 0' }}>
                  <div className="flex items-center gap-2">
                    <MI name="bookmark" size={14} color={T.primary} />
                    <span style={{ fontSize: 12.5, color: T.text }}>{v.name}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-3">
              <Btn variant="outline" fullWidth icon="add" onClick={saveNewView}>Save New View</Btn>
            </div>
          </Card>
        </div>
      </div>

      {/* ── New Sample drawer ── */}
      <div style={{ position: 'fixed', top: 56, bottom: 40, left: 0, right: 0, zIndex: 200, pointerEvents: showNewSample ? 'auto' : 'none' }}>
        <div onClick={() => setShowNewSample(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showNewSample ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '75%', minWidth: 720, maxWidth: 1040, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showNewSample ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', overflowY: 'auto' }}>
          {showNewSample && (
            <NewSamplePage
              clients={clientOptions}
              sampleTypes={sampleTypes}
              analysisServices={analysisServices}
              sampleTemplates={sampleTemplates}
              sampleContainers={sampleContainers}
              analysisProfiles={analysisProfiles}
              onClose={() => setShowNewSample(false)}
              onCreated={() => { setShowNewSample(false); router.refresh() }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

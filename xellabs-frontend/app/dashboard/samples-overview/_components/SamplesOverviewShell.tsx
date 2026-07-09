'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { type LabSample, type SampleStats, type DjangoSampleType, patchLabSample } from '@/app/actions/lab-samples'
import { type DjangoClient } from '@/app/actions/clients'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

// ── Column config ─────────────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { key: 'client',          label: 'Client',           defaultVisible: true  },
  { key: 'sample_type',     label: 'Sample Type',      defaultVisible: true  },
  { key: 'condition',       label: 'Condition',        defaultVisible: false },
  { key: 'status',          label: 'Status',           defaultVisible: true  },
  { key: 'priority',        label: 'Priority',         defaultVisible: true  },
  { key: 'received_date',   label: 'Received Date',    defaultVisible: true  },
  { key: 'due_date',        label: 'Due Date',         defaultVisible: false },
  { key: 'tat',             label: 'TAT (Days)',       defaultVisible: false },
  { key: 'analyst',         label: 'Assigned Analyst', defaultVisible: false },
  { key: 'storage',         label: 'Storage',          defaultVisible: false },
] as const
type ColKey = typeof ALL_COLUMNS[number]['key']
const DEFAULT_VISIBLE = new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
const LS_KEY = 'xl_samples_cols'
const SAVED_FILTERS_LS_KEY = 'xl_samples_saved_filters'

type FilterSnapshot = {
  search: string; sampleType: string; client: string; status: string
  priority: string; from: string; to: string; overdue: boolean
}
type SavedFilter = { name: string; filters: FilterSnapshot }

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'registered',      label: 'Logged' },
  { value: 'received',        label: 'Received' },
  { value: 'in_progress',     label: 'In Process' },
  { value: 'results_pending', label: 'To Be Verified' },
  { value: 'on_hold_for_qa',  label: 'On Hold for QA' },
  { value: 'published',       label: 'Completed' },
  { value: 'rejected',        label: 'Rejected' },
  { value: 'disposed',        label: 'Disposed' },
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'high',   label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low',    label: 'Low' },
]

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  registered:      { bg: '#EFF6FF', color: '#1D4ED8', label: 'Logged' },
  received:        { bg: '#DBEAFE', color: '#0154FC', label: 'Received' },
  in_progress:     { bg: '#DBEAFE', color: '#1E40AF', label: 'In Process' },
  results_pending: { bg: '#FEF3C7', color: '#92400E', label: 'To Be Verified' },
  reviewed:        { bg: '#E0E7FF', color: '#3730A3', label: 'Reviewed' },
  published:       { bg: '#DBEAFE', color: '#0154FC', label: 'Completed' },
  rejected:        { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
  disposed:        { bg: '#F3F4F6', color: '#6B7280', label: 'Disposed' },
  on_hold_for_qa:  { bg: '#FFF7ED', color: '#C2410C', label: 'On Hold for QA' },
}

const PRIORITY_BADGE: Record<string, { bg: string; color: string }> = {
  high:   { bg: '#FEE2E2', color: '#991B1B' },
  medium: { bg: '#FEF3C7', color: '#92400E' },
  low:    { bg: '#DBEAFE', color: '#0154FC' },
}

const CONDITION_BADGE: Record<string, { color: string }> = {
  good:           { color: '#0154FC' },
  acceptable:     { color: '#2563EB' },
  compromised:    { color: '#DC2626' },
  not_acceptable: { color: '#DC2626' },
}

const STAT_CARDS = [
  { key: 'all',            label: 'All',              icon: 'view_list',       iconColor: '#6B7280', iconBg: '#F3F4F6' },
  { key: 'logged',         label: 'Logged',           icon: 'inbox',           iconColor: '#3B82F6', iconBg: '#EFF6FF' },
  { key: 'received',       label: 'Received',         icon: 'move_to_inbox',   iconColor: '#0154FC', iconBg: '#DBEAFE' },
  { key: 'in_process',     label: 'In Process',       icon: 'autorenew',       iconColor: '#6366F1', iconBg: '#EEF2FF' },
  { key: 'to_be_verified', label: 'To Be Verified',   icon: 'pending_actions', iconColor: '#F59E0B', iconBg: '#FFFBEB' },
  { key: 'on_hold_for_qa', label: 'On Hold for QA',   icon: 'pause_circle',    iconColor: '#F97316', iconBg: '#FFF7ED' },
  { key: 'completed',      label: 'Completed',        icon: 'check_circle',    iconColor: '#0154FC', iconBg: '#DBEAFE' },
  { key: 'overdue',        label: 'Overdue',          icon: 'schedule',        iconColor: '#EF4444', iconBg: '#FEF2F2' },
] as const

function tatDays(receivedDate: string | null, nowMs: number | null): number | null {
  if (!receivedDate || nowMs === null) return null
  return Math.floor((nowMs - new Date(receivedDate).getTime()) / (1000 * 60 * 60 * 24))
}

function isOverdueSample(s: LabSample): boolean {
  return Boolean(s.expiry_date && new Date(s.expiry_date) < new Date() && !['published', 'disposed', 'rejected'].includes(s.status))
}

// Maps a stat card key to the status filter value it represents (or 'overdue' as a special case)
const STAT_CARD_STATUS: Record<string, string> = {
  logged: 'registered',
  received: 'received',
  in_process: 'in_progress',
  to_be_verified: 'results_pending',
  on_hold_for_qa: 'on_hold_for_qa',
  completed: 'published',
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Main Shell ────────────────────────────────────────────────────────────────
type Props = { initialSamples: LabSample[]; sampleTypes: DjangoSampleType[]; stats: SampleStats; clients: DjangoClient[] }

export default function SamplesOverviewShell({ initialSamples, sampleTypes, stats, clients }: Props) {
  const router = useRouter()
  const [samples, setSamples] = useState(initialSamples)
  const [nowMs, setNowMs] = useState<number | null>(null)
  useEffect(() => {
    // Client-only timestamp: starts empty so server and client render the same
    // HTML, then fills in after mount — avoids a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowMs(Date.now())
  }, [])
  const [search, setSearch] = useState('')
  const [filterSampleType, setFilterSampleType] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterOverdue, setFilterOverdue] = useState(false)

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(1)
  const [actionMenu, setActionMenu] = useState<{ id: number; top: number; right: number } | null>(null)
  const PAGE_SIZE = 25

  const filtered = samples.filter(s => {
    if (search && !s.sample_id.toLowerCase().includes(search.toLowerCase()) &&
        !s.client_name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterSampleType && String(s.sample_type) !== filterSampleType) return false
    if (filterClient && String(s.client) !== filterClient) return false
    if (filterStatus) {
      if (filterStatus === 'on_hold_for_qa') { if (!s.hold_for_qa) return false }
      else { if (s.status !== filterStatus) return false }
    }
    if (filterPriority && s.priority !== filterPriority) return false
    if (filterFrom && s.received_date && new Date(s.received_date) < new Date(filterFrom)) return false
    if (filterTo && s.received_date && new Date(s.received_date) > new Date(filterTo)) return false
    if (filterOverdue && !isOverdueSample(s)) return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function clearFilters() {
    setSearch(''); setFilterSampleType(''); setFilterClient('')
    setFilterStatus(''); setFilterPriority(''); setFilterFrom(''); setFilterTo('')
    setFilterOverdue(false)
    setPage(1)
  }
  function handleStatCardClick(cardKey: string) {
    setPage(1)
    if (cardKey === 'all') {
      setFilterStatus('')
      setFilterOverdue(false)
      return
    }
    if (cardKey === 'overdue') {
      const next = !filterOverdue
      setFilterOverdue(next)
      if (next) setFilterStatus('')
      return
    }
    const statusValue = STAT_CARD_STATUS[cardKey]
    setFilterOverdue(false)
    setFilterStatus(prev => (prev === statusValue ? '' : statusValue))
  }
  function toggleAll() {
    if (selected.size === paginated.length) setSelected(new Set())
    else setSelected(new Set(paginated.map(s => s.id)))
  }
  function toggleRow(id: number) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function openActionMenu(e: React.MouseEvent<HTMLButtonElement>, id: number) {
    const rect = e.currentTarget.getBoundingClientRect()
    setActionMenu({ id, top: rect.bottom + 4, right: window.innerWidth - rect.right })
  }
  function getSampleStatusDisplay(s: LabSample) {
    if (s.hold_for_qa) return STATUS_BADGE['on_hold_for_qa']
    return STATUS_BADGE[s.status] ?? { bg: '#F3F4F6', color: '#374151', label: s.status }
  }

  // ── Export to CSV ──
  function handleExport() {
    const headers = ['Sample ID', 'Client', 'Sample Type', 'Condition', 'Status', 'Priority', 'Received Date', 'Due Date', 'Storage']
    const rows = filtered.map(s => [
      s.sample_id, s.client_name, s.sample_type_name, s.condition || '',
      getSampleStatusDisplay(s).label, s.priority || '', fmt(s.received_date), fmt(s.expiry_date), s.storage_location || '',
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

  // ── Saved Filters ──
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(SAVED_FILTERS_LS_KEY)
      return raw ? (JSON.parse(raw) as SavedFilter[]) : []
    } catch { return [] }
  })
  const [savedFiltersOpen, setSavedFiltersOpen] = useState(false)
  const [savedFiltersPos, setSavedFiltersPos] = useState<{ top: number; right: number } | null>(null)
  const savedFiltersBtnRef = useRef<HTMLButtonElement>(null)
  const [saveFilterModalOpen, setSaveFilterModalOpen] = useState(false)
  const [newFilterName, setNewFilterName] = useState('')

  function currentFilterSnapshot(): FilterSnapshot {
    return { search, sampleType: filterSampleType, client: filterClient, status: filterStatus, priority: filterPriority, from: filterFrom, to: filterTo, overdue: filterOverdue }
  }
  function persistSavedFilters(next: SavedFilter[]) {
    setSavedFilters(next)
    try { localStorage.setItem(SAVED_FILTERS_LS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }
  function openSavedFilters() {
    const rect = savedFiltersBtnRef.current!.getBoundingClientRect()
    setSavedFiltersPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setSavedFiltersOpen(o => !o)
  }
  function saveCurrentFilters() {
    setNewFilterName('')
    setSaveFilterModalOpen(true)
  }
  function confirmSaveFilter() {
    const name = newFilterName.trim()
    if (!name) return
    const snapshot = currentFilterSnapshot()
    const next = [...savedFilters.filter(f => f.name !== name), { name, filters: snapshot }]
    persistSavedFilters(next)
    setSaveFilterModalOpen(false)
    setSavedFiltersOpen(false)
  }
  function applySavedFilter(f: SavedFilter) {
    setSearch(f.filters.search); setFilterSampleType(f.filters.sampleType); setFilterClient(f.filters.client)
    setFilterStatus(f.filters.status); setFilterPriority(f.filters.priority)
    setFilterFrom(f.filters.from); setFilterTo(f.filters.to); setFilterOverdue(f.filters.overdue)
    setPage(1)
    setSavedFiltersOpen(false)
  }
  function deleteSavedFilter(name: string) {
    persistSavedFilters(savedFilters.filter(f => f.name !== name))
  }

  // ── Bulk Actions ──
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false)
  const [bulkMenuPos, setBulkMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [bulkPending, setBulkPending] = useState(false)
  const bulkBtnRef = useRef<HTMLButtonElement>(null)

  function openBulkMenu() {
    if (selected.size === 0) return
    const rect = bulkBtnRef.current!.getBoundingClientRect()
    setBulkMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setBulkMenuOpen(o => !o)
  }
  async function runBulkPatch(patch: Record<string, unknown>) {
    setBulkPending(true)
    setBulkMenuOpen(false)
    try {
      await Promise.all([...selected].map(id => patchLabSample(id, patch)))
      setSamples(prev => prev.map(s => (selected.has(s.id) ? { ...s, ...patch } : s)))
      setSelected(new Set())
    } finally {
      setBulkPending(false)
    }
  }

  // ── Delete (soft — marks as disposed, never hard-deletes for audit/compliance reasons) ──
  const [deletingId, setDeletingId] = useState<number | null>(null)
  async function handleDeleteSample(id: number) {
    const sample = samples.find(s => s.id === id)
    if (!sample) return
    if (!window.confirm(`Mark sample "${sample.sample_id}" as disposed? This cannot be undone and the record will move to the Disposed status.`)) return
    setDeletingId(id)
    try {
      const result = await patchLabSample(id, { status: 'disposed' })
      if (result.ok) setSamples(prev => prev.map(s => (s.id === id ? { ...s, status: 'disposed' } : s)))
      else window.alert(result.message ?? 'Failed to update sample.')
    } finally {
      setDeletingId(null)
    }
  }

  const sel ={ border: '1px solid #D1D5DB', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#374151', background: '#fff', outline: 'none', cursor: 'pointer' as const }
  const [now, setNow] = useState('')
  useEffect(() => {
    setNow(new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }))
  }, [])

  // Column chooser
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(() => {
    if (typeof window === 'undefined') return DEFAULT_VISIBLE
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) return new Set(JSON.parse(saved) as ColKey[])
    } catch { /* ignore */ }
    return DEFAULT_VISIBLE
  })
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const [colMenuPos, setColMenuPos] = useState<{ top: number; right: number } | null>(null)
  const colBtnRef = useRef<HTMLButtonElement>(null)

  function openColMenu() {
    const rect = colBtnRef.current!.getBoundingClientRect()
    setColMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setColMenuOpen(o => !o)
  }
  function toggleCol(key: ColKey) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      try { localStorage.setItem(LS_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }
  const vis = (key: ColKey) => visibleCols.has(key)

  return (
    // Outer: flex row, full height, no overflow — nothing scrolls here
    <div style={{ display: 'flex', height: '100%', background: '#F9FAFB', overflow: 'hidden' }}>

      {/* ── Main column: flex column, full height ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', padding: '24px 24px 0 24px' }}>

        {/* ── STATIC: header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Samples</h1>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Manage and track laboratory samples throughout their lifecycle.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>Last updated: {now}</span>
            <button onClick={() => router.refresh()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <MI name="refresh" size={18} color="#6B7280" />
            </button>
          </div>
        </div>

        {/* ── STATIC: stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 10, marginBottom: 20, flexShrink: 0 }}>
          {STAT_CARDS.map(card => {
            const count = card.key === 'all' ? samples.length : stats[card.key as keyof SampleStats]
            const isActive = card.key === 'all'
              ? (filterStatus === '' && !filterOverdue)
              : card.key === 'overdue' ? filterOverdue : (filterStatus !== '' && filterStatus === STAT_CARD_STATUS[card.key])
            return (
              <button key={card.key} onClick={() => handleStatCardClick(card.key)}
                style={{
                  background: isActive ? card.iconBg : '#fff',
                  borderRadius: 10, padding: '14px 12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                  border: isActive ? `1px solid ${card.iconColor}` : '1px solid #E5E7EB',
                  cursor: 'pointer', textAlign: 'left', font: 'inherit',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MI name={card.icon} size={14} color={card.iconColor} />
                  </div>
                  <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 500, lineHeight: 1.2 }}>{card.label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.key === 'overdue' ? '#EF4444' : '#111827' }}>{count.toLocaleString()}</div>
              </button>
            )
          })}
        </div>

        {/* ── STATIC: filters ── */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #E5E7EB', marginBottom: 14, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><MI name="search" size={14} color="#9CA3AF" /></span>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search by Sample ID or Client..."
                style={{ ...sel, paddingLeft: 30, width: '100%', boxSizing: 'border-box' as const }} />
            </div>
            <select value={filterSampleType} onChange={e => { setFilterSampleType(e.target.value); setPage(1) }} style={sel}>
              <option value="">All Types</option>
              {sampleTypes.map(st => <option key={st.id} value={String(st.id)}>{st.name}</option>)}
            </select>
            <select value={filterClient} onChange={e => { setFilterClient(e.target.value); setPage(1) }} style={sel}>
              <option value="">All Clients</option>
              {clients.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }} style={sel}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setPage(1) }} style={sel}>
              {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1) }} style={{ ...sel, fontSize: 11 }} />
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>–</span>
              <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1) }} style={{ ...sel, fontSize: 11 }} />
            </div>
            <button onClick={clearFilters} style={{ ...sel, background: '#F3F4F6', fontWeight: 500 }}>Clear</button>
          </div>
        </div>

        {/* ── STATIC: table toolbar ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => router.push('/dashboard/samples-overview/new')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: 'none', background: '#2563EB', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <MI name="add" size={16} /><span>New Sample</span>
            </button>
            <button onClick={handleExport}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <MI name="download" size={16} /><span>Export</span>
            </button>
            <button ref={colBtnRef} onClick={openColMenu}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: '1px solid #D1D5DB', background: colMenuOpen ? '#F3F4F6' : '#fff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <MI name="view_column" size={16} /><span>Columns</span>
            </button>
            <button ref={bulkBtnRef} onClick={openBulkMenu} disabled={selected.size === 0 || bulkPending}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: '1px solid #D1D5DB', background: bulkMenuOpen ? '#F3F4F6' : '#fff', color: selected.size === 0 ? '#9CA3AF' : '#374151', fontSize: 13, fontWeight: 500, cursor: selected.size === 0 ? 'default' : 'pointer', opacity: bulkPending ? 0.6 : 1 }}>
              <MI name="checklist" size={16} color={selected.size === 0 ? '#9CA3AF' : undefined} /><span>Bulk Actions{selected.size > 0 ? ` (${selected.size})` : ''}</span>
            </button>
            <button ref={savedFiltersBtnRef} onClick={openSavedFilters}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: '1px solid #D1D5DB', background: savedFiltersOpen ? '#F3F4F6' : '#fff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <MI name="filter_list" size={16} /><span>Saved Filters</span>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              {filtered.length === 0 ? 'No results' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #D1D5DB', background: page === 1 ? '#F9FAFB' : '#fff', cursor: page === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MI name="chevron_left" size={16} color={page === 1 ? '#D1D5DB' : '#374151'} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #D1D5DB', background: page === p ? '#2563EB' : '#fff', color: page === p ? '#fff' : '#374151', fontSize: 12, fontWeight: page === p ? 600 : 400, cursor: 'pointer' }}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #D1D5DB', background: page === totalPages ? '#F9FAFB' : '#fff', cursor: page === totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MI name="chevron_right" size={16} color={page === totalPages ? '#D1D5DB' : '#374151'} />
              </button>
            </div>
          </div>
        </div>

        {/* ── SCROLLABLE: table + pagination + footer ── */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>

          <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #E5E7EB', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
                  <th style={{ padding: '10px 12px', width: 36 }}>
                    <input type="checkbox" checked={paginated.length > 0 && selected.size === paginated.length} onChange={toggleAll} />
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Sample ID</th>
                  {vis('client')        && <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Client</th>}
                  {vis('sample_type')   && <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Sample Type</th>}
                  {vis('condition')     && <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Condition</th>}
                  {vis('status')        && <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Status</th>}
                  {vis('priority')      && <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Priority</th>}
                  {vis('received_date') && <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Received Date</th>}
                  {vis('due_date')      && <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Due Date</th>}
                  {vis('tat')           && <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>TAT (Days)</th>}
                  {vis('analyst')       && <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Assigned Analyst</th>}
                  {vis('storage')       && <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Storage</th>}
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Actions</th>
                  <th style={{ padding: '10px 12px', width: 36 }} />
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={14} style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No samples found.</td></tr>
                ) : paginated.map((s, idx) => {
                  const badge = getSampleStatusDisplay(s)
                  const pBadge = PRIORITY_BADGE[s.priority] ?? { bg: '#F3F4F6', color: '#374151' }
                  const condColor = CONDITION_BADGE[s.condition]?.color ?? '#6B7280'
                  const tat = tatDays(s.received_date, nowMs)
                  const isOverdue = isOverdueSample(s)
                  const canReceive = s.status === 'registered'
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6', background: idx % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleRow(s.id)} />
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', minWidth: 120 }}>
                        <span style={{ color: '#2563EB', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap', display: 'inline-block' }}
                          onClick={() => router.push(`/dashboard/samples-overview/${s.id}`)}>
                          {s.sample_id}
                        </span>
                      </td>
                      {vis('client')        && <td style={{ padding: '10px 12px', color: '#374151' }}>{s.client_name}</td>}
                      {vis('sample_type')   && <td style={{ padding: '10px 12px', color: '#374151' }}>{s.sample_type_name}</td>}
                      {vis('condition')     && <td style={{ padding: '10px 12px' }}>
                        {s.condition ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: condColor, flexShrink: 0 }} />
                            <span style={{ color: condColor, textTransform: 'capitalize', fontWeight: 500 }}>{s.condition.replace('_', ' ')}</span>
                          </span>
                        ) : <span style={{ color: '#9CA3AF' }}>—</span>}
                      </td>}
                      {vis('status')        && <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: badge.bg, color: badge.color, borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
                          {badge.label}
                        </span>
                      </td>}
                      {vis('priority')      && <td style={{ padding: '10px 12px' }}>
                        {s.priority ? (
                          <span style={{ background: pBadge.bg, color: pBadge.color, borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11, textTransform: 'capitalize' }}>
                            {s.priority}
                          </span>
                        ) : <span style={{ color: '#9CA3AF' }}>—</span>}
                      </td>}
                      {vis('received_date') && <td style={{ padding: '10px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{fmt(s.received_date)}</td>}
                      {vis('due_date')      && <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: isOverdue ? '#EF4444' : '#374151', fontWeight: isOverdue ? 600 : 400 }}>{fmt(s.expiry_date)}</span>
                      </td>}
                      {vis('tat')           && <td style={{ padding: '10px 12px', color: '#374151', textAlign: 'center' }}>
                        {tat !== null ? <span style={{ fontWeight: 600, color: tat > 7 ? '#EF4444' : '#374151' }}>{tat}</span> : <span style={{ color: '#9CA3AF' }}>—</span>}
                      </td>}
                      {vis('analyst')       && <td style={{ padding: '10px 12px', color: '#374151' }}>{s.received_by_name || <span style={{ color: '#9CA3AF' }}>—</span>}</td>}
                      {vis('storage')       && <td style={{ padding: '10px 12px', color: '#374151', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.storage_location || <span style={{ color: '#9CA3AF' }}>—</span>}
                      </td>}
                      <td style={{ padding: '10px 12px', width: 100, whiteSpace: 'nowrap' }}>
                        {canReceive ? (
                          <button
                            onClick={() => router.push(`/dashboard/sample-receipts?id=${s.id}`)}
                            title="Receive sample"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid #0154FC', background: '#DBEAFE', color: '#0154FC', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <MI name="move_to_inbox" size={13} color="#0154FC" />
                            Receive
                          </button>
                        ) : null}
                      </td>
                      <td style={{ padding: '10px 12px', width: 36, textAlign: 'center' }}>
                        <button onClick={e => openActionMenu(e, s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, color: '#6B7280' }}>
                          <MI name="more_vert" size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} results
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #D1D5DB', background: page === 1 ? '#F9FAFB' : '#fff', cursor: page === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MI name="chevron_left" size={16} color={page === 1 ? '#D1D5DB' : '#374151'} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #D1D5DB', background: page === p ? '#2563EB' : '#fff', color: page === p ? '#fff' : '#374151', fontSize: 12, fontWeight: page === p ? 600 : 400, cursor: 'pointer' }}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #D1D5DB', background: page === totalPages ? '#F9FAFB' : '#fff', cursor: page === totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MI name="chevron_right" size={16} color={page === totalPages ? '#D1D5DB' : '#374151'} />
              </button>
            </div>
          </div>
        </div>
        {/* end scrollable */}
      </div>

      {/* ── Column chooser dropdown ── */}
      {colMenuOpen && colMenuPos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9990 }} onClick={() => setColMenuOpen(false)} />
          <div style={{ position: 'fixed', top: colMenuPos.top, right: colMenuPos.right, zIndex: 9999, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 200, padding: '8px 0', overflow: 'hidden' }}>
            <div style={{ padding: '6px 14px 8px', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Toggle Columns</span>
            </div>
            {ALL_COLUMNS.map(col => (
              <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#374151' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <input type="checkbox" checked={vis(col.key)} onChange={() => toggleCol(col.key)}
                  style={{ width: 14, height: 14, accentColor: '#2563EB', cursor: 'pointer' }} />
                {col.label}
              </label>
            ))}
          </div>
        </>
      )}

      {/* ── Bulk actions dropdown ── */}
      {bulkMenuOpen && bulkMenuPos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9990 }} onClick={() => setBulkMenuOpen(false)} />
          <div style={{ position: 'fixed', top: bulkMenuPos.top, right: bulkMenuPos.right, zIndex: 9999, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, padding: '8px 0', overflow: 'hidden' }}>
            <div style={{ padding: '6px 14px 8px', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{selected.size} Selected</span>
            </div>
            <button onClick={() => runBulkPatch({ hold_for_qa: true })}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#374151', textAlign: 'left' }}>
              <MI name="pause_circle" size={15} color="#F97316" /> Put On Hold for QA
            </button>
            <button onClick={() => runBulkPatch({ hold_for_qa: false })}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#374151', textAlign: 'left' }}>
              <MI name="play_circle" size={15} color="#10B981" /> Release Hold
            </button>
            <div style={{ borderTop: '1px solid #F3F4F6', margin: '4px 0' }} />
            {PRIORITY_OPTIONS.filter(o => o.value).map(o => (
              <button key={o.value} onClick={() => runBulkPatch({ priority: o.value })}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#374151', textAlign: 'left' }}>
                <MI name="flag" size={15} color={PRIORITY_BADGE[o.value]?.color ?? '#6B7280'} /> Set Priority: {o.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Saved filters dropdown ── */}
      {savedFiltersOpen && savedFiltersPos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9990 }} onClick={() => setSavedFiltersOpen(false)} />
          <div style={{ position: 'fixed', top: savedFiltersPos.top, right: savedFiltersPos.right, zIndex: 9999, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 240, padding: '8px 0', overflow: 'hidden' }}>
            <div style={{ padding: '6px 14px 8px', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Saved Filters</span>
            </div>
            {savedFilters.length === 0 ? (
              <p style={{ padding: '10px 14px', fontSize: 12, color: '#9CA3AF' }}>No saved filters yet.</p>
            ) : savedFilters.map(f => (
              <div key={f.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 6px' }}>
                <button onClick={() => applySavedFilter(f)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, padding: '9px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#374151', textAlign: 'left' }}>
                  <MI name="bookmark" size={15} color="#2563EB" /> {f.name}
                </button>
                <button onClick={() => deleteSavedFilter(f.name)} title="Delete"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 6, borderRadius: 4, color: '#9CA3AF' }}>
                  <MI name="close" size={14} />
                </button>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #F3F4F6', marginTop: 4 }}>
              <button onClick={saveCurrentFilters}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#2563EB', fontWeight: 600, textAlign: 'left' }}>
                <MI name="add" size={15} color="#2563EB" /> Save Current Filters
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Save filter view modal ── */}
      {saveFilterModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setSaveFilterModalOpen(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} />
          <div style={{ position: 'relative', width: 360, backgroundColor: '#fff', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', padding: 20 }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Name this filter view</h3>
            <input
              autoFocus
              value={newFilterName}
              onChange={e => setNewFilterName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmSaveFilter() }}
              placeholder="e.g. My Overdue Samples"
              className="w-full px-3 py-2 text-sm rounded-lg outline-none mb-4"
              style={{ border: '1px solid #D1D5DB', color: '#111827' }}
            />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setSaveFilterModalOpen(false)}
                style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmSaveFilter} disabled={!newFilterName.trim()}
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: newFilterName.trim() ? 'pointer' : 'not-allowed', opacity: newFilterName.trim() ? 1 : 0.5 }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Action menu ── */}
      {actionMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9990 }} onClick={() => setActionMenu(null)} />
          <div style={{ position: 'fixed', top: actionMenu.top, right: actionMenu.right, zIndex: 9999, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 160, overflow: 'hidden' }}>
            {[
              { icon: 'visibility',     label: 'View Details',   action: () => router.push(`/dashboard/samples-overview/${actionMenu.id}`) },
              { icon: 'move_to_inbox',  label: 'Receive Sample', action: () => { router.push(`/dashboard/sample-receipts?id=${actionMenu.id}`); setActionMenu(null) } },
              { icon: 'edit',           label: 'Edit Sample',    action: () => router.push(`/dashboard/samples-overview/${actionMenu.id}?edit=1`) },
              { icon: 'delete_outline', label: 'Delete',         action: () => handleDeleteSample(actionMenu.id), danger: true },
            ].map(item => (
              <button key={item.label} onClick={() => { item.action(); setActionMenu(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: (item as { danger?: boolean }).danger ? '#EF4444' : '#374151', textAlign: 'left' }}>
                <MI name={item.icon} size={15} color={(item as { danger?: boolean }).danger ? '#EF4444' : '#6B7280'} />
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

    </div>
  )
}

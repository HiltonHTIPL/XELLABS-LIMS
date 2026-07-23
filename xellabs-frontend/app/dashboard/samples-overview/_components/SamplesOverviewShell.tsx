'use client'
import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DataTable, { type DataTableColumn } from '../../_components/DataTable'
import { type LabSample, type DjangoSampleType, patchLabSample } from '@/app/actions/lab-samples'
import { sampleDisplayId as displayId } from '@/app/lib/sampleDisplay'
import DisposeSampleModal from './DisposeSampleModal'
import BulkDisposeSampleModal from './BulkDisposeSampleModal'

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

// Structural (non-data) column widths — checkbox/actions/menu never resize.
const CHECKBOX_WIDTH = 36
const ACTIONS_WIDTH = 130
const MENU_WIDTH = 48
// Up to this many data columns stretch evenly to fill the table area exactly
// (no dead space). Beyond it, every column keeps the width it had AT 8 columns
// (no shrinking) and the extra ones only become reachable by scrolling.
const TARGET_FILL_COLUMNS = 8
const MIN_COL_WIDTH = 120
const FALLBACK_COL_WIDTH = 140 // used only before the container is first measured client-side
type SortKey = ColKey | 'sample_id'

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
  disposed:        { bg: '#F3F4F6', color: '#374151', label: 'Disposed' },
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
  { key: 'all',            label: 'All',              icon: 'view_list',       iconColor: '#374151', iconBg: '#F3F4F6' },
  { key: 'logged',         label: 'Logged',           icon: 'inbox',           iconColor: '#3B82F6', iconBg: '#EFF6FF' },
  { key: 'received',       label: 'Received',         icon: 'move_to_inbox',   iconColor: '#0154FC', iconBg: '#DBEAFE' },
  { key: 'in_process',     label: 'In Process',       icon: 'autorenew',       iconColor: '#6366F1', iconBg: '#EEF2FF' },
  { key: 'to_be_verified', label: 'To Be Verified',   icon: 'pending_actions', iconColor: '#F59E0B', iconBg: '#FFFBEB' },
  { key: 'on_hold_for_qa', label: 'On Hold for QA',   icon: 'pause_circle',    iconColor: '#F97316', iconBg: '#FFF7ED' },
  { key: 'completed',      label: 'Completed',        icon: 'check_circle',    iconColor: '#0154FC', iconBg: '#DBEAFE' },
  { key: 'overdue',        label: 'Overdue',          icon: 'schedule',        iconColor: '#EF4444', iconBg: '#FEF2F2' },
  { key: 'past_retention', label: 'Disposed',         icon: 'delete_sweep',    iconColor: '#991B1B', iconBg: '#FEE2E2' },
] as const

function tatDays(receivedDate: string | null, nowMs: number | null): number | null {
  if (!receivedDate || nowMs === null) return null
  return Math.floor((nowMs - new Date(receivedDate).getTime()) / (1000 * 60 * 60 * 24))
}

function isOverdueSample(s: LabSample): boolean {
  return Boolean(s.expiry_date && new Date(s.expiry_date) < new Date() && !['published', 'disposed', 'rejected'].includes(s.status))
}

function isPastRetentionSample(s: LabSample): boolean {
  return Boolean(s.expiry_date && new Date(s.expiry_date) < new Date() && s.status !== 'disposed')
}

function isNearingRetentionSample(s: LabSample): boolean {
  if (!s.expiry_date || s.status === 'disposed') return false
  const exp = new Date(s.expiry_date).getTime()
  const now = Date.now()
  const diffDays = (exp - now) / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= 7
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
type Props = { initialSamples: LabSample[]; sampleTypes: DjangoSampleType[]; clients: { uid: string; title: string; ClientID: string }[] }

export default function SamplesOverviewShell({ initialSamples, sampleTypes, clients }: Props) {
  const router = useRouter()
  // Pre-select a Client when arriving from that client's "Client ID" link
  // (/dashboard/samples-overview?client=<senaite-uid>). The SENAITE uid is the
  // single client identity used everywhere — samples carry it as
  // client_senaite_uid, so the filter matches on it directly (no Django id).
  const initialClientId = useSearchParams().get('client') ?? ''
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
  const [filterClient, setFilterClient] = useState(initialClientId)
  // Arrived via a Client's "Client ID" link — lock the client filter to a
  // permanent read-only chip instead of a switchable dropdown, since the
  // whole point of that link is "this client's samples only".
  const [clientLocked] = useState(Boolean(initialClientId))
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterOverdue, setFilterOverdue] = useState(false)
  const [filterPastRetention, setFilterPastRetention] = useState(false)

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(1)
  const [actionMenu, setActionMenu] = useState<{ id: number; top: number; right: number } | null>(null)

  // Base filters exclude the status/overdue toggle so the stat cards (which ARE
  // the status buckets) don't collapse when one status is selected. The client
  // filter matches on the SENAITE client uid carried on each sample.
  function matchesBaseFilters(s: LabSample): boolean {
    if (search && !displayId(s).toLowerCase().includes(search.toLowerCase()) &&
        !s.client_name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterSampleType && String(s.sample_type) !== filterSampleType) return false
    if (filterClient && s.client_senaite_uid !== filterClient) return false
    if (filterPriority && s.priority !== filterPriority) return false
    if (filterFrom && s.received_date && new Date(s.received_date) < new Date(filterFrom)) return false
    if (filterTo && s.received_date && new Date(s.received_date) > new Date(filterTo)) return false
    // Active lists exclude disposed; use Status → Disposed to see them.
    if (!filterStatus && !filterOverdue && !filterPastRetention && s.status === 'disposed') return false
    return true
  }

  const filtered = samples.filter(s => {
    if (!matchesBaseFilters(s)) return false
    if (filterStatus) {
      if (filterStatus === 'on_hold_for_qa') { if (!s.hold_for_qa) return false }
      else { if (s.status !== filterStatus) return false }
    }
    if (filterOverdue && !isOverdueSample(s)) return false
    if (filterPastRetention && !isPastRetentionSample(s)) return false
    return true
  })

  // Stat-card counts derive from the same in-memory sample set the table uses,
  // scoped by the base filters (incl. the selected client) but NOT by the
  // status/overdue toggle — so each card shows how many of that client's
  // samples sit in each status.
  const statScope = samples.filter(matchesBaseFilters)
  const statCounts: Record<string, number> = {
    all: statScope.length,
    logged: statScope.filter(s => s.status === 'registered').length,
    received: statScope.filter(s => s.status === 'received').length,
    in_process: statScope.filter(s => s.status === 'in_progress').length,
    to_be_verified: statScope.filter(s => s.status === 'results_pending').length,
    on_hold_for_qa: statScope.filter(s => s.hold_for_qa).length,
    completed: statScope.filter(s => s.status === 'published').length,
    overdue: statScope.filter(isOverdueSample).length,
    past_retention: statScope.filter(isPastRetentionSample).length,
  }

  function clearFilters() {
    setSearch(''); setFilterSampleType('')
    // Client filter is intentionally left alone when locked (arrived via a
    // Client ID link) — "Clear" resets the other filters, not the client scope.
    if (!clientLocked) setFilterClient('')
    setFilterStatus(''); setFilterPriority(''); setFilterFrom(''); setFilterTo('')
    setFilterOverdue(false)
    setFilterPastRetention(false)
    setPage(1)
  }
  function handleStatCardClick(cardKey: string) {
    setPage(1)
    if (cardKey === 'all') {
      setFilterStatus('')
      setFilterOverdue(false)
      setFilterPastRetention(false)
      return
    }
    if (cardKey === 'overdue') {
      const next = !filterOverdue
      setFilterOverdue(next)
      if (next) {
        setFilterStatus('')
        setFilterPastRetention(false)
      }
      return
    }
    if (cardKey === 'past_retention') {
      const next = !filterPastRetention
      setFilterPastRetention(next)
      if (next) {
        setFilterStatus('')
        setFilterOverdue(false)
      }
      return
    }
    const statusValue = STAT_CARD_STATUS[cardKey]
    setFilterOverdue(false)
    setFilterPastRetention(false)
    setFilterStatus(prev => (prev === statusValue ? '' : statusValue))
  }
  function openActionMenu(e: React.MouseEvent<HTMLButtonElement>, id: number) {
    const rect = e.currentTarget.getBoundingClientRect()
    setActionMenu({ id, top: rect.bottom + 4, right: window.innerWidth - rect.right })
  }
  function getSampleStatusDisplay(s: LabSample) {
    if (s.hold_for_qa) return STATUS_BADGE['on_hold_for_qa']
    return STATUS_BADGE[s.status] ?? { bg: '#F3F4F6', color: '#374151', label: s.status }
  }

  // ── Sample navigation ──
  // Opening a sample from the list navigates to its own full page rather
  // than an inline drawer — SENAITE-backed samples go to /dashboard/samples/[uid],
  // Django-only samples go to /dashboard/samples-overview/[id].
  function openDetail(senaiteUid: string | undefined, djangoId: number) {
    if (senaiteUid) router.push(`/dashboard/samples/${senaiteUid}`)
    else router.push(`/dashboard/samples-overview/${djangoId}`)
  }

  // ── Export to CSV ──
  function handleExport() {
    const headers = ['Sample ID', 'Client', 'Sample Type', 'Condition', 'Status', 'Priority', 'Received Date', 'Due Date', 'Storage']
    const rows = filtered.map(s => [
      displayId(s), s.client_name, s.sample_type_name, s.condition || '',
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
  // Slot the DataTable portals its layout controls (Reset layout + Views) into,
  // so they sit inline next to Saved Filters instead of on their own row.
  const tableControlsRef = useRef<HTMLDivElement>(null)
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

  // ── Dispose (regulatory basis + optional certificate) ──
  const [disposeTarget, setDisposeTarget] = useState<LabSample | null>(null)
  const [bulkDisposeModalOpen, setBulkDisposeModalOpen] = useState(false)
  const [bulkDisposeSummary, setBulkDisposeSummary] = useState<{ disposed: number; skipped: { id: number; reason: string }[] } | null>(null)

  const sel ={ border: '1px solid #D1D5DB', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#374151', background: '#fff', outline: 'none', cursor: 'pointer' as const }
  const [now, setNow] = useState('')
  useEffect(() => {
    // Client-only timestamp: starts empty so server and client render the same
    // HTML, then fills in after mount — avoids a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }))
  }, [])

  // Column chooser
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(DEFAULT_VISIBLE)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) setVisibleCols(new Set(JSON.parse(saved) as ColKey[]))
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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

  const COLUMN_META: Record<SortKey, { minWidth: number; weight: number }> = {
  sample_id:     { minWidth: 110, weight: 1.0 },
  client:        { minWidth: 160, weight: 1.5 },
  sample_type:   { minWidth: 150, weight: 1.4 },
  condition:     { minWidth: 110, weight: 1.0 },
  status:        { minWidth: 120, weight: 1.1 },
  priority:      { minWidth: 100, weight: 0.9 },
  received_date: { minWidth: 130, weight: 1.1 },
  due_date:      { minWidth: 130, weight: 1.1 },
  tat:           { minWidth: 90,  weight: 0.8 },
  analyst:       { minWidth: 140, weight: 1.2 },
  storage:       { minWidth: 130, weight: 1.1 },
}

  const orderedVisibleCols = ALL_COLUMNS.filter(c => vis(c.key))

  // ── Shared DataTable rows/columns ──
  // Each row carries the original LabSample under `_s` (renders read it) plus a
  // primitive per-column sort field keyed by the same id the column uses, so the
  // table engine can order by value (dates as epoch ms, status by its label,
  // etc.) — matching the previous hand-rolled sortAccessor. Columns are built
  // from the live `orderedVisibleCols` so the existing Columns chooser still
  // drives which columns show.
  type OverviewRow = {
    id: number; _s: LabSample
    sample_id: string; client: string; sample_type: string; condition: string; status: string
    priority: string; received_date: number; due_date: number; tat: number; analyst: string; storage: string
  }
  const overviewRows: OverviewRow[] = filtered.map(s => ({
    id: s.id, _s: s,
    sample_id: displayId(s),
    client: s.client_name ?? '',
    sample_type: s.sample_type_name ?? '',
    condition: s.condition ?? '',
    status: getSampleStatusDisplay(s).label,
    priority: s.priority ?? '',
    received_date: s.received_date ? new Date(s.received_date).getTime() : -Infinity,
    due_date: s.expiry_date ? new Date(s.expiry_date).getTime() : -Infinity,
    tat: tatDays(s.received_date, nowMs) ?? -Infinity,
    analyst: s.received_by_name ?? '',
    storage: s.storage_location ?? '',
  }))

  function cellContent(s: LabSample, key: SortKey): ReactNode {
    const badge = getSampleStatusDisplay(s)
    const pBadge = PRIORITY_BADGE[s.priority] ?? { bg: '#F3F4F6', color: '#374151' }
    const condColor = CONDITION_BADGE[s.condition]?.color ?? '#374151'
    const tat = tatDays(s.received_date, nowMs)
    const isOverdue = isOverdueSample(s)
    switch (key) {
      case 'sample_id':
        return (
          <span style={{ color: '#2563EB', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap', display: 'inline-block' }}
            onClick={() => openDetail(s.senaite_uid, s.id)}>
            {displayId(s)}
          </span>
        )
      case 'client':        return <span style={{ color: '#374151' }}>{s.client_name}</span>
      case 'sample_type':   return <span style={{ color: '#374151' }}>{s.sample_type_name}</span>
      case 'condition':
        return s.condition ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: condColor, flexShrink: 0 }} />
            <span style={{ color: condColor, textTransform: 'capitalize', fontWeight: 500 }}>{s.condition.replace('_', ' ')}</span>
          </span>
        ) : <span style={{ color: '#374151' }}>—</span>
      case 'status': {
        const isNearingRetStatus = isNearingRetentionSample(s)
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: badge.bg, color: badge.color, borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
              {badge.label}
            </span>
            {isNearingRetStatus ? (
              <span style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 12, padding: '2px 7px', fontWeight: 600, fontSize: 10, whiteSpace: 'nowrap' }}>
                Nearing Retention
              </span>
            ) : null}
          </div>
        )
      }
      case 'priority':
        return s.priority ? (
          <span style={{ background: pBadge.bg, color: pBadge.color, borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11, textTransform: 'capitalize' }}>
            {s.priority}
          </span>
        ) : <span style={{ color: '#374151' }}>—</span>
      case 'received_date': return <span style={{ color: '#374151', whiteSpace: 'nowrap' }}>{fmt(s.received_date)}</span>
      case 'due_date': {
        const isNearingRetDue = isNearingRetentionSample(s)
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: isOverdue ? '#EF4444' : '#374151', fontWeight: isOverdue ? 600 : 400, whiteSpace: 'nowrap' }}>{fmt(s.expiry_date)}</span>
            {isNearingRetDue ? (
              <span style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 12, padding: '2px 7px', fontWeight: 600, fontSize: 10, whiteSpace: 'nowrap' }}>
                Nearing Retention
              </span>
            ) : null}
          </div>
        )
      }
      case 'tat':
        return tat !== null ? <span style={{ fontWeight: 600, color: tat > 7 ? '#EF4444' : '#374151' }}>{tat}</span> : <span style={{ color: '#374151' }}>—</span>
      case 'analyst':       return s.received_by_name || <span style={{ color: '#374151' }}>—</span>
      case 'storage':       return s.storage_location || <span style={{ color: '#374151' }}>—</span>
      default: return null
    }
  }

  const overviewColumns: DataTableColumn<OverviewRow>[] = [
    { id: 'sample_id', label: 'Sample ID', sortable: true, minWidth: COLUMN_META.sample_id.minWidth, render: r => cellContent(r._s, 'sample_id') },
    ...orderedVisibleCols.map(c => ({
      id: c.key,
      label: c.label,
      sortable: true,
      minWidth: COLUMN_META[c.key]?.minWidth ?? 120,
      render: (r: OverviewRow) => cellContent(r._s, c.key),
    })),
  ]

  return (
    // Outer: flex row, full height, no overflow — nothing scrolls here
    <div style={{ display: 'flex', height: '100%', minHeight: 0, background: '#F9FAFB', overflow: 'hidden' }}>

      {/* ── Main column: flex column, full height ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden', padding: '24px 24px 0 24px' }}>

        {/* ── STATIC: header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Samples</h1>
            <p style={{ fontSize: 13, color: '#374151', margin: '4px 0 0' }}>Manage and track laboratory samples throughout their lifecycle.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#374151' }}>Last updated: {now}</span>
            <button onClick={() => router.refresh()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <MI name="refresh" size={18} color="#374151" />
            </button>
          </div>
        </div>

        {/* ── STATIC: stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20, flexShrink: 0 }}>
          {STAT_CARDS.map(card => {
            const count = statCounts[card.key] ?? 0
            const isActive = card.key === 'all'
              ? (!filterStatus && !filterOverdue && !filterPastRetention)
              : card.key === 'overdue'
              ? filterOverdue
              : card.key === 'past_retention'
              ? filterPastRetention
              : (filterStatus !== '' && filterStatus === STAT_CARD_STATUS[card.key])
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
                  <span style={{ fontSize: 11, color: '#374151', fontWeight: 500, lineHeight: 1.2 }}>{card.label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.key === 'past_retention' ? '#991B1B' : (card.key === 'overdue' ? '#EF4444' : '#111827') }}>{count.toLocaleString()}</div>
              </button>
            )
          })}
        </div>

        {bulkDisposeSummary && (
          <div style={{ background: bulkDisposeSummary.skipped.length > 0 ? '#FFFBEB' : '#ECFDF5', border: `1px solid ${bulkDisposeSummary.skipped.length > 0 ? '#FCD34D' : '#A7F3D0'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, color: bulkDisposeSummary.skipped.length > 0 ? '#92400E' : '#065F46' }}>
              Successfully disposed <strong>{bulkDisposeSummary.disposed} sample(s)</strong>.
              {bulkDisposeSummary.skipped.length > 0 && (
                <span style={{ marginLeft: 8 }}>
                  Skipped {bulkDisposeSummary.skipped.length} sample(s): {bulkDisposeSummary.skipped.map(s => `ID ${s.id} (${s.reason})`).join('; ')}
                </span>
              )}
            </div>
            <button onClick={() => setBulkDisposeSummary(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', padding: 2 }}>
              <MI name="close" size={16} />
            </button>
          </div>
        )}

        {/* ── STATIC: filters ── */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #E5E7EB', marginBottom: 14, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><MI name="search" size={14} color="#374151" /></span>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search by Sample ID or Client..."
                style={{ ...sel, paddingLeft: 30, width: '100%', boxSizing: 'border-box' as const }} />
            </div>
            <select value={filterSampleType} onChange={e => { setFilterSampleType(e.target.value); setPage(1) }} style={sel}>
              <option value="">All Types</option>
              {sampleTypes.map(st => <option key={st.id} value={String(st.id)}>{st.name}</option>)}
            </select>
            {clientLocked ? (
              <div style={{ ...sel, display: 'flex', alignItems: 'center', background: '#F9FAFB', cursor: 'default' }}>
                <span style={{ fontWeight: 600, color: '#111827' }}>
                  {clients.find(c => c.uid === filterClient)?.title ?? 'Client'}
                </span>
              </div>
            ) : (
              <select value={filterClient} onChange={e => { setFilterClient(e.target.value); setPage(1) }} style={sel}>
                <option value="">All Clients</option>
                {clients.map(c => <option key={c.uid} value={c.uid}>{c.title}</option>)}
              </select>
            )}
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }} style={sel}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setPage(1) }} style={sel}>
              {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1) }} style={{ ...sel, fontSize: 11 }} />
              <span style={{ fontSize: 11, color: '#374151' }}>–</span>
              <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1) }} style={{ ...sel, fontSize: 11 }} />
            </div>
            <button onClick={clearFilters} style={{ ...sel, background: '#F3F4F6', fontWeight: 500 }}>Clear</button>
          </div>
        </div>

        {/* ── STATIC: table toolbar ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => router.push(filterClient ? `/dashboard/samples-overview/new?client=${filterClient}` : '/dashboard/samples-overview/new')}
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
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: '1px solid #D1D5DB', background: bulkMenuOpen ? '#F3F4F6' : '#fff', color: selected.size === 0 ? '#374151' : '#374151', fontSize: 13, fontWeight: 500, cursor: selected.size === 0 ? 'default' : 'pointer', opacity: bulkPending ? 0.6 : 1 }}>
              <MI name="checklist" size={16} color={selected.size === 0 ? '#374151' : undefined} /><span>Bulk Actions{selected.size > 0 ? ` (${selected.size})` : ''}</span>
            </button>
            <button ref={savedFiltersBtnRef} onClick={openSavedFilters}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: '1px solid #D1D5DB', background: savedFiltersOpen ? '#F3F4F6' : '#fff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <MI name="filter_list" size={16} /><span>Saved Filters</span>
            </button>
            <div ref={tableControlsRef} style={{ display: 'flex', alignItems: 'center', gap: 8 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#374151' }}>
              {filtered.length === 0 ? 'No results' : `${filtered.length} results`}
            </span>
          </div>
        </div>

        {/* ── Table area fills remaining space; the shared DataTable owns scroll, sort, and pagination. ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <DataTable<OverviewRow>
            data={overviewRows}
            columns={overviewColumns}
            selectable
            onSelectionChange={ids => setSelected(new Set(ids as number[]))}
            persistKey="samples-overview"
            controlsTargetRef={tableControlsRef}
            emptyMessage="No samples found."
            rowActions={r => {
              const s = r._s
              const canReceive = s.status === 'registered'
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {canReceive ? (
                    <button
                      onClick={() => router.push(`/dashboard/sample-receipts?id=${s.id}`)}
                      title="Receive sample"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid #0154FC', background: '#DBEAFE', color: '#0154FC', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <MI name="move_to_inbox" size={13} color="#0154FC" />
                      Receive
                    </button>
                  ) : null}
                  <button onClick={e => openActionMenu(e, s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, color: '#374151' }}>
                    <MI name="more_vert" size={16} />
                  </button>
                </div>
              )
            }}
          />
        </div>
        {/* end table area */}
      </div>

      {/* ── Column chooser dropdown ── */}
      {colMenuOpen && colMenuPos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9990 }} onClick={() => setColMenuOpen(false)} />
          <div style={{ position: 'fixed', top: colMenuPos.top, right: colMenuPos.right, zIndex: 9999, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 200, padding: '8px 0', overflowY: 'auto', overflowX: 'hidden', maxHeight: `calc(100vh - ${colMenuPos.top + 12}px)` }}>
            <div style={{ padding: '6px 14px 8px', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Toggle Columns</span>
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
              <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{selected.size} Selected</span>
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
                <MI name="flag" size={15} color={PRIORITY_BADGE[o.value]?.color ?? '#374151'} /> Set Priority: {o.label}
              </button>
            ))}
            <div style={{ borderTop: '1px solid #F3F4F6', margin: '4px 0' }} />
            <button onClick={() => { setBulkMenuOpen(false); setBulkDisposeModalOpen(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#DC2626', textAlign: 'left' }}>
              <MI name="delete_forever" size={15} color="#DC2626" /> Dispose Selected ({selected.size})
            </button>
          </div>
        </>
      )}

      {/* ── Saved filters dropdown ── */}
      {savedFiltersOpen && savedFiltersPos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9990 }} onClick={() => setSavedFiltersOpen(false)} />
          <div style={{ position: 'fixed', top: savedFiltersPos.top, right: savedFiltersPos.right, zIndex: 9999, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 240, padding: '8px 0', overflow: 'hidden' }}>
            <div style={{ padding: '6px 14px 8px', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Saved Filters</span>
            </div>
            {savedFilters.length === 0 ? (
              <p style={{ padding: '10px 14px', fontSize: 12, color: '#374151' }}>No saved filters yet.</p>
            ) : savedFilters.map(f => (
              <div key={f.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 6px' }}>
                <button onClick={() => applySavedFilter(f)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, padding: '9px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#374151', textAlign: 'left' }}>
                  <MI name="bookmark" size={15} color="#2563EB" /> {f.name}
                </button>
                <button onClick={() => deleteSavedFilter(f.name)} title="Delete"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 6, borderRadius: 4, color: '#374151' }}>
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
        <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', left: 0, right: 0, bottom: 'var(--dashboard-footer-h)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              { icon: 'visibility',     label: 'View Details',   action: () => openDetail(filtered.find(s => s.id === actionMenu.id)?.senaite_uid, actionMenu.id) },
              { icon: 'move_to_inbox',  label: 'Receive Sample', action: () => { router.push(`/dashboard/sample-receipts?id=${actionMenu.id}`); setActionMenu(null) } },
              { icon: 'edit',           label: 'Edit Sample',    action: () => router.push(`/dashboard/samples-overview/new?edit=${actionMenu.id}`) },
              { icon: 'delete_outline', label: 'Dispose', action: () => setDisposeTarget(samples.find(s => s.id === actionMenu.id) ?? null), danger: true },
            ].map(item => (
              <button key={item.label} onClick={() => { item.action(); setActionMenu(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: (item as { danger?: boolean }).danger ? '#EF4444' : '#374151', textAlign: 'left' }}>
                <MI name={item.icon} size={15} color={(item as { danger?: boolean }).danger ? '#EF4444' : '#374151'} />
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {disposeTarget && (
        <DisposeSampleModal
          sampleId={disposeTarget.id}
          sampleLabel={displayId(disposeTarget)}
          onClose={() => setDisposeTarget(null)}
          onDisposed={update => {
            setSamples(prev => prev.map(s =>
              s.id === disposeTarget.id
                ? { ...s, ...update }
                : s
            ))
          }}
        />
      )}

      {bulkDisposeModalOpen && (
        <BulkDisposeSampleModal
          sampleIds={[...selected]}
          onClose={() => setBulkDisposeModalOpen(false)}
          onDisposed={(disposedIds, skipped) => {
            if (disposedIds.length > 0) {
              setSamples(prev => prev.map(s => (disposedIds.includes(s.id) ? { ...s, status: 'disposed' } : s)))
            }
            setSelected(new Set())
            setBulkDisposeSummary({ disposed: disposedIds.length, skipped })
            router.refresh()
          }}
        />
      )}

    </div>
  )
}

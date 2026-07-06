'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { type LabSample, type SampleStats, type DjangoSampleType, receiveLabSample } from '@/app/actions/lab-samples'
import { type DjangoClient } from '@/app/actions/clients'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'registered',      label: 'Logged' },
  { value: 'received',        label: 'Received' },
  { value: 'in_progress',     label: 'In Process' },
  { value: 'results_pending', label: 'To Be Verified' },
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
  { key: 'logged',         label: 'Logged',           icon: 'inbox',           iconColor: '#3B82F6', iconBg: '#EFF6FF' },
  { key: 'received',       label: 'Received',         icon: 'move_to_inbox',   iconColor: '#0154FC', iconBg: '#DBEAFE' },
  { key: 'in_process',     label: 'In Process',       icon: 'autorenew',       iconColor: '#6366F1', iconBg: '#EEF2FF' },
  { key: 'to_be_verified', label: 'To Be Verified',   icon: 'pending_actions', iconColor: '#F59E0B', iconBg: '#FFFBEB' },
  { key: 'on_hold_for_qa', label: 'On Hold for QA',   icon: 'pause_circle',    iconColor: '#F97316', iconBg: '#FFF7ED' },
  { key: 'completed',      label: 'Completed',        icon: 'check_circle',    iconColor: '#0154FC', iconBg: '#DBEAFE' },
  { key: 'overdue',        label: 'Overdue',          icon: 'schedule',        iconColor: '#EF4444', iconBg: '#FEF2F2' },
] as const

function tatDays(receivedDate: string | null): number | null {
  if (!receivedDate) return null
  return Math.floor((Date.now() - new Date(receivedDate).getTime()) / (1000 * 60 * 60 * 24))
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Receive Sample Modal ──────────────────────────────────────────────────────
function ReceiveSampleModal({ sample, onClose, onDone }: { sample: LabSample; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({ condition: 'acceptable', seal_condition: 'intact', seal_number: '', quantity_received: '', quantity_unit: 'tubes', sampling_deviation: 'none', storage_requirement: 'room_temp', priority: sample.priority || 'medium', hold_for_qa: false, collector: '', location: '', notes: '' })
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))
  const inp = { border: '1px solid #D1D5DB', color: '#111827', borderRadius: 6, padding: '7px 10px', fontSize: 13, width: '100%', outline: 'none' }
  const lbl = { fontSize: 12, fontWeight: 600 as const, color: '#374151', marginBottom: 4, display: 'block' as const }

  async function handleSubmit() {
    setLoading(true); setErr('')
    const res = await receiveLabSample(sample.id, form)
    setLoading(false)
    if (res.success) { onDone(); onClose() } else setErr(res.message ?? 'Failed.')
  }

  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>Receive Sample — {sample.sample_id}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><MI name="close" size={20} color="#6B7280" /></button>
        </div>
        {err && <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 14 }}>{err}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label style={lbl}>Condition</label>
              <select value={form.condition} onChange={e => set('condition', e.target.value)} style={inp}>
                <option value="good">Good</option><option value="acceptable">Acceptable</option>
                <option value="compromised">Compromised</option><option value="not_acceptable">Not Acceptable</option>
              </select></div>
            <div><label style={lbl}>Seal Condition</label>
              <select value={form.seal_condition} onChange={e => set('seal_condition', e.target.value)} style={inp}>
                <option value="intact">Intact</option><option value="broken">Broken</option><option value="missing">Missing</option>
              </select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label style={lbl}>Quantity Received</label>
              <input type="number" value={form.quantity_received} onChange={e => set('quantity_received', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Unit</label>
              <select value={form.quantity_unit} onChange={e => set('quantity_unit', e.target.value)} style={inp}>
                <option value="tubes">Tubes</option><option value="vials">Vials</option>
                <option value="bags">Bags</option><option value="slides">Slides</option>
              </select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label style={lbl}>Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} style={inp}>
                <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select></div>
            <div><label style={lbl}>Storage Requirement</label>
              <select value={form.storage_requirement} onChange={e => set('storage_requirement', e.target.value)} style={inp}>
                <option value="room_temp">Room Temperature</option><option value="2_8c">2–8 °C</option>
                <option value="minus_20c">-20 °C</option><option value="minus_80c">-80 °C</option>
              </select></div>
          </div>
          <div><label style={lbl}>Location</label><input value={form.location} onChange={e => set('location', e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' as const }} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="holdqa" checked={form.hold_for_qa} onChange={e => set('hold_for_qa', e.target.checked)} />
            <label htmlFor="holdqa" style={{ fontSize: 13, color: '#374151', cursor: 'pointer' }}>Hold for QA review</label>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #D1D5DB', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151', fontWeight: 500 }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: '#0B1E47', color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Receiving…' : 'Mark as Received'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Shell ────────────────────────────────────────────────────────────────
type Props = { initialSamples: LabSample[]; sampleTypes: DjangoSampleType[]; stats: SampleStats; clients: DjangoClient[] }

export default function SamplesOverviewShell({ initialSamples, sampleTypes, stats, clients }: Props) {
  const router = useRouter()
  const [samples, setSamples] = useState(initialSamples)
  const [search, setSearch] = useState('')
  const [filterSampleType, setFilterSampleType] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [receiveSample, setReceiveSample] = useState<LabSample | null>(null)
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
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function clearFilters() {
    setSearch(''); setFilterSampleType(''); setFilterClient('')
    setFilterStatus(''); setFilterPriority(''); setFilterFrom(''); setFilterTo('')
    setPage(1)
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

  const sel = { border: '1px solid #D1D5DB', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#374151', background: '#fff', outline: 'none', cursor: 'pointer' as const }
  const [now, setNow] = useState('')
  useEffect(() => {
    setNow(new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }))
  }, [])

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 20, flexShrink: 0 }}>
          {STAT_CARDS.map(card => {
            const count = stats[card.key as keyof SampleStats]
            return (
              <div key={card.key} style={{ background: '#fff', borderRadius: 10, padding: '14px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #E5E7EB' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MI name={card.icon} size={14} color={card.iconColor} />
                  </div>
                  <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 500, lineHeight: 1.2 }}>{card.label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.key === 'overdue' ? '#EF4444' : '#111827' }}>{count.toLocaleString()}</div>
              </div>
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
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <MI name="download" size={16} /><span>Export</span>
            </button>
            {selected.size > 0 && (
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                <MI name="checklist" size={16} /><span>Bulk Actions ({selected.size})</span>
              </button>
            )}
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
                  {['Sample ID', 'Client', 'Sample Type', 'Condition', 'Status', 'Priority', 'Received Date', 'Due Date', 'TAT (Days)', 'Assigned Analyst', 'Storage', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={13} style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No samples found.</td></tr>
                ) : paginated.map((s, idx) => {
                  const badge = getSampleStatusDisplay(s)
                  const pBadge = PRIORITY_BADGE[s.priority] ?? { bg: '#F3F4F6', color: '#374151' }
                  const condColor = CONDITION_BADGE[s.condition]?.color ?? '#6B7280'
                  const tat = tatDays(s.received_date)
                  const isOverdue = s.expiry_date && new Date(s.expiry_date) < new Date() && !['published', 'disposed', 'rejected'].includes(s.status)
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
                      <td style={{ padding: '10px 12px', color: '#374151' }}>{s.client_name}</td>
                      <td style={{ padding: '10px 12px', color: '#374151' }}>{s.sample_type_name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {s.condition ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: condColor, flexShrink: 0 }} />
                            <span style={{ color: condColor, textTransform: 'capitalize', fontWeight: 500 }}>{s.condition.replace('_', ' ')}</span>
                          </span>
                        ) : <span style={{ color: '#9CA3AF' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: badge.bg, color: badge.color, borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {s.priority ? (
                          <span style={{ background: pBadge.bg, color: pBadge.color, borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11, textTransform: 'capitalize' }}>
                            {s.priority}
                          </span>
                        ) : <span style={{ color: '#9CA3AF' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{fmt(s.received_date)}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: isOverdue ? '#EF4444' : '#374151', fontWeight: isOverdue ? 600 : 400 }}>{fmt(s.expiry_date)}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#374151', textAlign: 'center' }}>
                        {tat !== null ? <span style={{ fontWeight: 600, color: tat > 7 ? '#EF4444' : '#374151' }}>{tat}</span> : <span style={{ color: '#9CA3AF' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#374151' }}>{s.received_by_name || <span style={{ color: '#9CA3AF' }}>—</span>}</td>
                      <td style={{ padding: '10px 12px', color: '#374151', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.storage_location || <span style={{ color: '#9CA3AF' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {canReceive && (
                            <button
                              onClick={() => setReceiveSample(s)}
                              title="Receive sample"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid #0154FC', background: '#DBEAFE', color: '#0154FC', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <MI name="move_to_inbox" size={13} color="#0154FC" />
                              Receive
                            </button>
                          )}
                          <button onClick={e => openActionMenu(e, s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, color: '#6B7280' }}>
                            <MI name="more_vert" size={16} />
                          </button>
                        </div>
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

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF' }}>
            <span>© 2025 XelLabs LIMS. All rights reserved.</span>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ cursor: 'pointer', color: '#6B7280' }}>Privacy Policy</span>
              <span style={{ cursor: 'pointer', color: '#6B7280' }}>Terms of Use</span>
              <span style={{ cursor: 'pointer', color: '#6B7280' }}>Security</span>
            </div>
          </div>
        </div>
        {/* end scrollable */}
      </div>

      {/* ── Right sidebar (its own scroll) ── */}
      <div style={{ width: 240, flexShrink: 0, overflowY: 'auto', padding: '24px 16px 24px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '0 0 10px' }}>Quick Actions</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { icon: 'add_circle',    label: 'New Sample',      color: '#2563EB', action: () => router.push('/dashboard/samples-overview/new') },
              { icon: 'download',      label: 'Export Samples',  color: '#7C3AED', action: () => {} },
              { icon: 'checklist',     label: 'Bulk Actions',    color: '#D97706', action: () => {} },
              { icon: 'filter_list',   label: 'Saved Filters',   color: '#0154FC', action: () => {} },
            ].map(qa => (
              <button key={qa.label} onClick={qa.action}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 6px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer' }}>
                <MI name={qa.icon} size={20} color={qa.color} />
                <span style={{ fontSize: 10, color: '#374151', fontWeight: 500, textAlign: 'center', lineHeight: 1.2 }}>{qa.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: 0 }}>Recent Alerts</p>
            <span style={{ fontSize: 11, color: '#2563EB', cursor: 'pointer' }}>View all</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.overdue > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MI name="schedule" size={14} color="#EF4444" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', margin: '0 0 2px' }}>{stats.overdue} samples are overdue</p>
                  <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>Requires immediate review</p>
                </div>
                <span style={{ fontSize: 9, background: '#FEE2E2', color: '#991B1B', borderRadius: 10, padding: '2px 6px', fontWeight: 600 }}>High</span>
              </div>
            )}
            {stats.on_hold_for_qa > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MI name="pause_circle" size={14} color="#F97316" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', margin: '0 0 2px' }}>{stats.on_hold_for_qa} on hold for QA</p>
                  <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>Awaiting quality review</p>
                </div>
                <span style={{ fontSize: 9, background: '#FEF3C7', color: '#92400E', borderRadius: 10, padding: '2px 6px', fontWeight: 600 }}>Medium</span>
              </div>
            )}
            {stats.to_be_verified > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MI name="pending_actions" size={14} color="#F59E0B" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', margin: '0 0 2px' }}>{stats.to_be_verified} to be verified</p>
                  <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>Pending verification step</p>
                </div>
                <span style={{ fontSize: 9, background: '#DBEAFE', color: '#1E40AF', borderRadius: 10, padding: '2px 6px', fontWeight: 600 }}>Info</span>
              </div>
            )}
            {stats.overdue === 0 && stats.on_hold_for_qa === 0 && stats.to_be_verified === 0 && (
              <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '10px 0' }}>No active alerts</p>
            )}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: 0 }}>Saved Views</p>
            <span style={{ fontSize: 11, color: '#2563EB', cursor: 'pointer' }}>View all</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'My Samples',           count: filtered.filter(s => s.received_by_name).length },
              { label: 'High Priority Samples', count: filtered.filter(s => s.priority === 'high').length },
              { label: 'Overdue Samples',       count: stats.overdue },
              { label: 'Samples by Client',     count: samples.length },
            ].map(v => (
              <div key={v.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', background: '#F9FAFB' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MI name="bookmarks" size={12} color="#6B7280" />
                  <span style={{ fontSize: 11, color: '#374151' }}>{v.label}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#2563EB' }}>{v.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Action menu ── */}
      {actionMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9990 }} onClick={() => setActionMenu(null)} />
          <div style={{ position: 'fixed', top: actionMenu.top, right: actionMenu.right, zIndex: 9999, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 160, overflow: 'hidden' }}>
            {[
              { icon: 'visibility',     label: 'View Details',   action: () => router.push(`/dashboard/samples-overview/${actionMenu.id}`) },
              { icon: 'move_to_inbox',  label: 'Receive Sample', action: () => { const s = samples.find(x => x.id === actionMenu.id); if (s) { setReceiveSample(s); setActionMenu(null) } } },
              { icon: 'edit',           label: 'Edit Sample',    action: () => {} },
              { icon: 'delete_outline', label: 'Delete',         action: () => {}, danger: true },
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

      {receiveSample && (
        <ReceiveSampleModal sample={receiveSample} onClose={() => setReceiveSample(null)}
          onDone={() => { setSamples(prev => prev.map(s => s.id === receiveSample.id ? { ...s, status: 'received' } : s)); router.refresh() }} />
      )}
    </div>
  )
}

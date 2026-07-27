'use client'
import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createWorksheet, updateWorksheetFields, type WorksheetTemplateOption } from '@/app/actions/senaite-worksheets'
import type { WorksheetListItem, LabAnalyst } from '@/app/lib/senaite-worksheets'
import type { RefOption } from '@/app/dashboard/_components/AdminRefShell'
import DataTable, { type DataTableColumn } from '../../_components/DataTable'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const STATE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  open:           { bg: '#DBEAFE', color: '#1E40AF', label: 'Open' },
  to_be_verified: { bg: '#FEF3C7', color: '#92400E', label: 'To be verified' },
  verified:       { bg: '#DCFCE7', color: '#166534', label: 'Verified' },
  rejected:       { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
}

function StateBadge({ state }: { state: string }) {
  const s = STATE_BADGE[state] ?? { bg: '#F3F4F6', color: '#374151', label: state || '—' }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color, fontSize: 11, fontWeight: 600 }}>
      {s.label}
    </span>
  )
}

// SENAITE worksheet-list review-state filter tabs (worksheets.pt). Each maps to
// the set of review_states it shows; `mine` additionally filters to the current
// user's own worksheets.
type TabId = 'active' | 'open' | 'to_be_verified' | 'verified' | 'all' | 'mine'
const TABS: { id: TabId; label: string; states?: string[] }[] = [
  { id: 'active',         label: 'Active',         states: ['open', 'to_be_verified'] },
  { id: 'open',           label: 'Open',           states: ['open'] },
  { id: 'to_be_verified', label: 'To be verified', states: ['to_be_verified'] },
  { id: 'verified',       label: 'Verified',       states: ['verified'] },
  { id: 'all',            label: 'All' },
  { id: 'mine',           label: 'Mine',           states: ['open', 'to_be_verified'] },
]

// Locale-independent date format — toLocaleDateString renders differently on the
// server vs the browser and causes a hydration mismatch, so format explicitly.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

type Props = {
  initialWorksheets: WorksheetListItem[]
  templates: WorksheetTemplateOption[]
  instruments: RefOption[]
  analysts: LabAnalyst[]
  currentUserId: string
}

export default function WorksheetsShell({ initialWorksheets, templates, instruments, analysts, currentUserId }: Props) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [templateUid, setTemplateUid] = useState('')
  const [instrumentUid, setInstrumentUid] = useState('')
  const [createAnalyst, setCreateAnalyst] = useState('')
  const [busy, startTransition] = useTransition()
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [tab, setTab] = useState<TabId>('active')
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([])
  const [showReassign, setShowReassign] = useState(false)
  const [bulkAnalyst, setBulkAnalyst] = useState('')

  // id → full name for display; falls back to the raw id when a stored analyst
  // isn't in the current lab-member list (e.g. a legacy/removed member).
  const analystName = useMemo(() => {
    const m = new Map(analysts.map(a => [a.id, a.fullname]))
    return (id: string) => (id ? (m.get(id) ?? id) : '—')
  }, [analysts])

  function flash(ok: boolean, msg: string) {
    setToast({ ok, msg }); setTimeout(() => setToast(null), 5000)
  }

  function openCreate() { setTemplateUid(''); setInstrumentUid(''); setCreateAnalyst(''); setShowCreate(true) }
  function closeCreate() { if (!busy) setShowCreate(false) }

  // Picking a template auto-fills its configured instrument (SENAITE parity),
  // but the user can still override the instrument afterwards.
  function onTemplateChange(uid: string) {
    setTemplateUid(uid)
    const t = templates.find(x => x.uid === uid)
    if (t?.instrumentUid) setInstrumentUid(t.instrumentUid)
  }

  // Row id = uid (unique); keep the worksheet business id as `wsId` for the
  // Worksheet column + row navigation. `createdSort` (epoch) lets the engine
  // order the Created column, which renders a formatted date string.
  type Row = WorksheetListItem & { id: string; wsId: string; createdSort: number }
  const allRows: Row[] = initialWorksheets.map(w => ({
    ...w,
    id: w.uid,
    wsId: w.id,
    createdSort: w.created ? (new Date(w.created).getTime() || 0) : 0,
  }))

  // Count per tab for the tab labels (SENAITE shows counts on each tab).
  function rowsForTab(t: TabId): Row[] {
    const def = TABS.find(x => x.id === t)!
    let r = def.states ? allRows.filter(w => def.states!.includes(w.reviewState)) : allRows
    if (t === 'mine') r = r.filter(w => w.analystId && w.analystId === currentUserId)
    return r
  }
  const tabCounts = useMemo(() => {
    const c = {} as Record<TabId, number>
    for (const t of TABS) c[t.id] = rowsForTab(t.id).length
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWorksheets, currentUserId])
  const rows = rowsForTab(tab)

  // Inline analyst reassignment (SENAITE's editable Analyst column) — only
  // meaningful while the worksheet is still open.
  function reassignRow(w: Row, analystId: string) {
    startTransition(async () => {
      const r = await updateWorksheetFields(w.path, w.wsId, { analyst: analystId })
      if (r.success) { flash(true, `${w.wsId} reassigned to ${analystName(analystId) || 'Unassigned'}.`); router.refresh() }
      else flash(false, r.error ?? 'Reassign failed.')
    })
  }

  // Bulk reassign every selected OPEN worksheet to one analyst.
  function bulkReassign() {
    const targets = allRows.filter(w => selectedIds.includes(w.id) && w.reviewState === 'open')
    if (!targets.length) { flash(false, 'Select one or more open worksheets to reassign.'); return }
    startTransition(async () => {
      let ok = 0
      for (const w of targets) {
        const r = await updateWorksheetFields(w.path, w.wsId, { analyst: bulkAnalyst })
        if (r.success) ok++
      }
      setShowReassign(false); setBulkAnalyst('')
      flash(ok > 0, `Reassigned ${ok}/${targets.length} worksheet${targets.length !== 1 ? 's' : ''}.`)
      router.refresh()
    })
  }

  const columns: DataTableColumn<Row>[] = [
    {
      id: 'progress', label: 'Progress', sortable: true, minWidth: 130,
      render: w => (
        <div className="flex items-center gap-2">
          <div className="rounded-full overflow-hidden" style={{ width: 64, height: 6, backgroundColor: '#E5E7EB' }}>
            <div style={{ width: `${Math.min(100, Math.max(0, w.progress))}%`, height: '100%', backgroundColor: w.progress >= 100 ? '#22C55E' : '#0154FC' }} />
          </div>
          <span className="text-xs" style={{ color: '#374151' }}>{Math.round(w.progress)}%</span>
        </div>
      ),
    },
    {
      id: 'wsId', label: 'Worksheet', sortable: true, minWidth: 160,
      render: w => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
            <MI name="grid_view" size={13} color="#0154FC" />
          </div>
          <span className="text-xs font-semibold" style={{ color: '#0154FC' }}>{w.wsId}</span>
        </div>
      ),
    },
    {
      id: 'analystId', label: 'Analyst', sortable: true, minWidth: 170,
      render: w => (
        w.reviewState === 'open' ? (
          <span onClick={e => e.stopPropagation()}>
            <select
              value={w.analystId} disabled={busy}
              onChange={e => reassignRow(w, e.target.value)}
              className="px-2 py-1 text-xs rounded-lg outline-none"
              style={{ border: '1px solid #D1D5DB', color: '#111827', maxWidth: 150 }}>
              <option value="">Unassigned</option>
              {analysts.map(a => <option key={a.id} value={a.id}>{a.fullname}</option>)}
              {w.analystId && !analysts.some(a => a.id === w.analystId) && <option value={w.analystId}>{w.analystId}</option>}
            </select>
          </span>
        ) : <span className="text-xs" style={{ color: '#374151' }}>{analystName(w.analystId)}</span>
      ),
    },
    {
      id: 'templateTitle', label: 'Template', sortable: true, minWidth: 150,
      render: w => <span className="text-xs" style={{ color: '#374151' }}>{w.templateTitle || '—'}</span>,
    },
    {
      id: 'instrumentTitle', label: 'Instrument', sortable: true, minWidth: 150,
      render: w => <span className="text-xs" style={{ color: '#374151' }}>{w.instrumentTitle || '—'}</span>,
    },
    {
      id: 'numRegularSamples', label: 'Samples', sortable: true, minWidth: 90, align: 'center',
      render: w => <span className="text-xs" style={{ color: '#374151' }}>{w.numRegularSamples}</span>,
    },
    {
      id: 'numQcAnalyses', label: 'QC Analyses', sortable: true, minWidth: 100, align: 'center',
      render: w => <span className="text-xs" style={{ color: '#374151' }}>{w.numQcAnalyses}</span>,
    },
    {
      id: 'numRegularAnalyses', label: 'Routine Analyses', sortable: true, minWidth: 120, align: 'center',
      render: w => <span className="text-xs" style={{ color: '#374151' }}>{w.numRegularAnalyses}</span>,
    },
    {
      id: 'reviewState', label: 'State', sortable: true, minWidth: 130,
      render: w => <StateBadge state={w.reviewState} />,
    },
    {
      id: 'createdSort', label: 'Created', sortable: true, minWidth: 130,
      render: w => <span className="text-xs" style={{ color: '#374151' }}>{fmtDate(w.created)}</span>,
    },
  ]

  function submitCreate() {
    if (!createAnalyst) { flash(false, 'Analyst must be specified.'); return }
    startTransition(async () => {
      const r = await createWorksheet({
        analyst: createAnalyst,
        template: templateUid || undefined,
        instrument: instrumentUid || undefined,
      })
      if (r.success && r.id) {
        setShowCreate(false)
        router.push(`/dashboard/worksheets/${r.id}`)
      } else {
        flash(false, r.error ?? 'Failed to create worksheet.')
      }
    })
  }

  const selectedOpenCount = allRows.filter(w => selectedIds.includes(w.id) && w.reviewState === 'open').length

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-4" style={{ flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Worksheets</h1>
          <p className="text-sm mt-0.5" style={{ color: '#374151' }}>Create worksheets from templates — routine analyses and QC positions are laid out automatically</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowReassign(true)} disabled={selectedOpenCount === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: '#fff', color: selectedOpenCount === 0 ? '#9CA3AF' : '#374151', border: '1px solid #E8EAF2', cursor: selectedOpenCount === 0 ? 'default' : 'pointer' }}>
            <MI name="person_add" size={16} color={selectedOpenCount === 0 ? '#9CA3AF' : '#374151'} /> Reassign{selectedOpenCount ? ` (${selectedOpenCount})` : ''}
          </button>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={16} color="#fff" /> New Worksheet
          </button>
        </div>
      </div>

      {/* Review-state filter tabs */}
      <div className="flex items-center gap-1 mb-3 flex-wrap" style={{ flexShrink: 0 }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: active ? '#0154FC' : '#fff', color: active ? '#fff' : '#374151', border: `1px solid ${active ? '#0154FC' : '#E8EAF2'}`, cursor: 'pointer' }}>
              {t.label}
              <span className="inline-flex items-center justify-center rounded-full" style={{ minWidth: 18, height: 18, padding: '0 5px', fontSize: 10, backgroundColor: active ? 'rgba(255,255,255,0.25)' : '#F3F4F6', color: active ? '#fff' : '#6B7280' }}>{tabCounts[t.id]}</span>
            </button>
          )
        })}
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, color: toast.ok ? '#0154FC' : '#991B1B', flexShrink: 0 }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* Create drawer */}
      <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', bottom: 'var(--dashboard-footer-h)', left: 0, right: 0, zIndex: 200, pointerEvents: showCreate ? 'auto' : 'none' }}>
        <div onClick={closeCreate} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showCreate ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 480, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showCreate ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
                <MI name="add" size={16} color="#0154FC" />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>New Worksheet</h2>
                <p style={{ fontSize: 12, color: '#1F2937', fontWeight: 500 }}>Pick a template to auto-lay-out positions and pull in pending analyses</p>
              </div>
            </div>
            <button onClick={closeCreate} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#374151" /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                Analyst <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select value={createAnalyst} onChange={e => setCreateAnalyst(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: `1px solid ${createAnalyst ? '#D1D5DB' : '#FCA5A5'}`, color: '#111827' }}>
                <option value="">Select analyst…</option>
                {analysts.map(a => <option key={a.id} value={a.id}>{a.fullname}</option>)}
              </select>
              {analysts.length === 0 && (
                <p className="mt-1" style={{ fontSize: 10, color: '#B45309' }}>No lab analysts found — create lab users under Administration → Users first.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Worksheet Template</label>
              <select value={templateUid} onChange={e => onTemplateChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                <option value="">None — blank worksheet</option>
                {templates.map(t => <option key={t.uid} value={t.uid}>{t.title}</option>)}
              </select>
              <p className="mt-1" style={{ fontSize: 10, color: '#374151' }}>
                A template fills routine positions from received samples&rsquo; pending analyses and adds any Blank / Control / Duplicate QC positions it defines.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                Instrument <span className="font-normal" style={{ color: '#374151' }}>(optional)</span>
              </label>
              <select value={instrumentUid} onChange={e => setInstrumentUid(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                <option value="">None</option>
                {instruments.map(i => <option key={i.uid} value={i.uid}>{i.title}</option>)}
              </select>
            </div>
          </div>

          <div className="px-5 py-4 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button type="button" onClick={closeCreate} disabled={busy}
              style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button type="button" onClick={submitCreate} disabled={busy || !createAnalyst} className="flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: busy || !createAnalyst ? 'not-allowed' : 'pointer', opacity: busy || !createAnalyst ? 0.6 : 1 }}>
              <MI name={busy ? 'hourglass_top' : 'check'} size={13} color="#fff" />
              {busy ? 'Creating…' : 'Create Worksheet'}
            </button>
          </div>
        </div>
      </div>

      {/* Bulk reassign dialog */}
      <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', bottom: 'var(--dashboard-footer-h)', left: 0, right: 0, zIndex: 200, pointerEvents: showReassign ? 'auto' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div onClick={() => !busy && setShowReassign(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showReassign ? 1 : 0, transition: 'opacity 0.2s ease' }} />
        {showReassign && (
          <div className="bg-white rounded-xl" style={{ position: 'relative', width: 380, boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Reassign {selectedOpenCount} worksheet{selectedOpenCount !== 1 ? 's' : ''}</h2>
              <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Only open worksheets can be reassigned.</p>
            </div>
            <div className="px-5 py-4">
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Analyst</label>
              <select value={bulkAnalyst} onChange={e => setBulkAnalyst(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                <option value="">Unassigned</option>
                {analysts.map(a => <option key={a.id} value={a.id}>{a.fullname}</option>)}
              </select>
            </div>
            <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #F3F4F6' }}>
              <button type="button" onClick={() => setShowReassign(false)} disabled={busy}
                style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={bulkReassign} disabled={busy} className="flex items-center gap-1.5"
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                <MI name="person_add" size={13} color="#fff" /> Reassign
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {initialWorksheets.length === 0 ? (
          <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="grid_view" size={36} color="#D1D5DB" />
            <p className="mt-2 text-sm font-medium" style={{ color: '#374151' }}>No worksheets yet</p>
            <p className="text-xs mt-0.5" style={{ color: '#374151' }}>Create one from a template to lay out analyses and QC automatically</p>
            <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
              <MI name="add" size={13} color="#fff" /> New Worksheet
            </button>
          </div>
        ) : (
          <DataTable<Row>
            data={rows}
            columns={columns}
            selectable
            searchable
            persistKey="worksheets"
            emptyMessage="No worksheets in this view."
            onSelectionChange={setSelectedIds}
            onRowClick={w => router.push(`/dashboard/worksheets/${w.wsId}${w.numAnalyses === 0 ? '/add' : ''}`)}
          />
        )}
      </div>
    </div>
  )
}

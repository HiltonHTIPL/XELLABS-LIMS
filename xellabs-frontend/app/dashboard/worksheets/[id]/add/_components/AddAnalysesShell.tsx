'use client'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { addAnalysesToWorksheet, applyWorksheetTemplate, type WorksheetTemplateOption } from '@/app/actions/senaite-worksheets'
import { PRIORITY_LABEL, type WorksheetInfo, type UnassignedAnalysis } from '@/app/lib/senaite-worksheets'
import DataTable, { type DataTableColumn } from '../../../../_components/DataTable'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

const PRIORITY_COLOR: Record<number, { bg: string; color: string }> = {
  1: { bg: '#FEE2E2', color: '#991B1B' },
  2: { bg: '#FFEDD5', color: '#9A3412' },
  3: { bg: '#F3F4F6', color: '#374151' },
  4: { bg: '#DBEAFE', color: '#1E40AF' },
  5: { bg: '#F1F5F9', color: '#64748B' },
}

type FilterId = 'all' | 'services' | 'method'

export default function AddAnalysesShell({
  worksheet, unassigned, templates, serviceMethodMap,
}: {
  worksheet: WorksheetInfo
  unassigned: UnassignedAnalysis[]
  templates: WorksheetTemplateOption[]
  serviceMethodMap: Record<string, string[]>
}) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([])
  const [templateUid, setTemplateUid] = useState('')
  const [filter, setFilter] = useState<FilterId>('all')

  function flash(ok: boolean, msg: string) { setToast({ ok, msg }); setTimeout(() => setToast(null), 5000) }

  // When this worksheet already has a template assigned, SENAITE offers a
  // "Filter by template services" tab that narrows the pool to the template's
  // own services. (SENAITE also has a "by method" tab; deferred — the v1
  // Analysis list doesn't expose a comparable method uid.)
  const wsTemplate = templates.find(t => t.uid === worksheet.templateUid)
  const templateServiceUids = useMemo(() => new Set(wsTemplate?.serviceUids ?? []), [wsTemplate])
  const templateMethodUid = wsTemplate?.restrictToMethodUid ?? ''

  const rows = useMemo(() => {
    let r = unassigned
    if (filter === 'services' && templateServiceUids.size) {
      r = r.filter(a => templateServiceUids.has(a.serviceUid))
    } else if (filter === 'method' && templateMethodUid) {
      // Keep analyses whose service supports the template's restricted method.
      r = r.filter(a => (serviceMethodMap[a.serviceUid] ?? []).includes(templateMethodUid))
    }
    return r.map(a => ({ ...a, id: a.uid }))
  }, [unassigned, filter, templateServiceUids, templateMethodUid, serviceMethodMap])

  // Available filter tabs for this worksheet's template (SENAITE only shows the
  // service/method tabs when the template defines them).
  const filterTabs: { id: FilterId; label: string }[] = [
    { id: 'all', label: 'All' },
    ...(wsTemplate ? [{ id: 'services' as FilterId, label: 'Template services' }] : []),
    ...(templateMethodUid ? [{ id: 'method' as FilterId, label: 'Template method' }] : []),
  ]

  type Row = UnassignedAnalysis & { id: string }

  const columns: DataTableColumn<Row>[] = [
    {
      id: 'priority', label: 'Priority', sortable: true, minWidth: 100,
      render: a => {
        const c = PRIORITY_COLOR[a.priority] ?? PRIORITY_COLOR[3]
        return <span className="text-xs font-semibold rounded-full" style={{ padding: '2px 8px', backgroundColor: c.bg, color: c.color }}>{PRIORITY_LABEL[a.priority] ?? 'Medium'}</span>
      },
    },
    { id: 'clientTitle', label: 'Client', sortable: true, minWidth: 160, render: a => <span className="text-xs" style={{ color: '#374151' }}>{a.clientTitle || '—'}</span> },
    { id: 'sampleId', label: 'Request ID', sortable: true, minWidth: 120, render: a => <span className="text-xs font-medium" style={{ color: '#0154FC' }}>{a.sampleId || '—'}</span> },
    { id: 'categoryTitle', label: 'Category', sortable: true, minWidth: 150, render: a => <span className="text-xs" style={{ color: '#374151' }}>{a.categoryTitle || '—'}</span> },
    { id: 'title', label: 'Analysis', sortable: true, minWidth: 200, render: a => <span className="text-xs" style={{ color: '#111827' }}>{a.title || '—'}</span> },
    { id: 'dateReceived', label: 'Date Received', sortable: true, minWidth: 130, render: a => <span className="text-xs" style={{ color: '#374151' }}>{fmtDate(a.dateReceived)}</span> },
    { id: 'dueDate', label: 'Due Date', sortable: true, minWidth: 130, render: a => <span className="text-xs" style={{ color: '#374151' }}>{fmtDate(a.dueDate)}</span> },
  ]

  function assignSelected() {
    const picked = unassigned.filter(a => selectedIds.includes(a.uid))
    if (!picked.length) { flash(false, 'Select one or more analyses to assign.'); return }
    const meta = picked.map(a => ({ uid: a.uid, sampleId: a.sampleId, title: a.title }))
    startTransition(async () => {
      const r = await addAnalysesToWorksheet(worksheet.path, worksheet.id, picked.map(a => a.uid), meta)
      if (r.success) { flash(true, `Assigned ${picked.length} analysis${picked.length !== 1 ? 'es' : ''} to ${worksheet.id}.`); router.refresh() }
      else flash(false, r.error ?? 'Failed to assign analyses.')
    })
  }

  function applyTemplate() {
    if (!templateUid) { flash(false, 'Pick a template to apply.'); return }
    startTransition(async () => {
      const r = await applyWorksheetTemplate(worksheet.path, templateUid)
      if (r.success) router.push(`/dashboard/worksheets/${worksheet.id}`)
      else flash(false, r.error ?? 'Failed to apply template.')
    })
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/worksheets" className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="arrow_back" size={16} color="#374151" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Add Analyses</h1>
              <span className="text-xs font-semibold" style={{ color: '#0154FC' }}>{worksheet.id}</span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#374151' }}>Select pending analyses to lay onto this worksheet, or apply a template</p>
          </div>
        </div>
        <Link href={`/dashboard/worksheets/${worksheet.id}`}
          className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, backgroundColor: '#fff', color: '#374151', border: '1px solid #E8EAF2' }}>
          Open worksheet <MI name="arrow_forward" size={14} color="#374151" />
        </Link>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* Apply template */}
      <div className="bg-white rounded-xl px-4 py-4 mb-4" style={{ border: '1px solid #E8EAF2' }}>
        <div className="flex items-end gap-3 flex-wrap">
          <div style={{ minWidth: 260 }}>
            <label className="block mb-1" style={{ fontSize: 10, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Apply a worksheet template</label>
            <select value={templateUid} onChange={e => setTemplateUid(e.target.value)} className="w-full px-2.5 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
              <option value="">Select template…</option>
              {templates.map(t => <option key={t.uid} value={t.uid}>{t.title}</option>)}
            </select>
          </div>
          <button onClick={applyTemplate} disabled={busy || !templateUid} className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, padding: '9px 16px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: busy || !templateUid ? 'not-allowed' : 'pointer', opacity: busy || !templateUid ? 0.6 : 1 }}>
            <MI name="dashboard_customize" size={14} color="#fff" /> Apply template
          </button>
          <span className="text-xs" style={{ color: '#6B7280' }}>Fills routine positions from pending analyses and adds the template&rsquo;s QC positions.</span>
        </div>
      </div>

      {/* Unassigned analyses listing */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
        <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Pending analyses</h2>
            <span className="text-xs" style={{ color: '#6B7280' }}>{rows.length} available</span>
            {filterTabs.length > 1 && (
              <div className="flex items-center gap-1 ml-2">
                {filterTabs.map(f => (
                  <button key={f.id} onClick={() => setFilter(f.id)} className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                    style={{ backgroundColor: filter === f.id ? '#0154FC' : '#fff', color: filter === f.id ? '#fff' : '#374151', border: `1px solid ${filter === f.id ? '#0154FC' : '#E8EAF2'}`, cursor: 'pointer' }}>
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={assignSelected} disabled={busy || selectedIds.length === 0} className="flex items-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: busy || selectedIds.length === 0 ? 'not-allowed' : 'pointer', opacity: busy || selectedIds.length === 0 ? 0.5 : 1 }}>
            <MI name="playlist_add_check" size={14} color="#fff" /> Assign to worksheet{selectedIds.length ? ` (${selectedIds.length})` : ''}
          </button>
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <MI name="inbox" size={32} color="#D1D5DB" />
            <p className="mt-2 text-sm" style={{ color: '#374151' }}>No pending analyses</p>
            <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Receive samples to make their analyses available here.</p>
          </div>
        ) : (
          <DataTable<Row>
            data={rows}
            columns={columns}
            selectable
            searchable
            persistKey="worksheet-add-analyses"
            emptyMessage="No pending analyses."
            onSelectionChange={setSelectedIds}
          />
        )}
      </div>
    </div>
  )
}

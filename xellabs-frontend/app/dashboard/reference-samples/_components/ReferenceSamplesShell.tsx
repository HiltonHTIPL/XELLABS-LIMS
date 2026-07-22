'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReferenceResultsGrid, { type RefResultRow } from '../../_components/ReferenceResultsGrid'
import DataTable, { type DataTableColumn } from '../../_components/DataTable'
import type { RefOption } from '../../_components/AdminRefShell'
import {
  createReferenceSample, updateReferenceSample, deactivateReferenceSample,
  type ReferenceSampleRow, type RefSampleFormState, type SupplierOption, type DefinitionOption,
} from '@/app/actions/reference-samples'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

type Vals = {
  title: string; supplierPath: string; definitionUid: string
  blank: boolean; hazardous: boolean; expiryDate: string; results: RefResultRow[]
}
const BLANK: Vals = { title: '', supplierPath: '', definitionUid: '', blank: false, hazardous: false, expiryDate: '', results: [] }

export default function ReferenceSamplesShell({
  rows, suppliers, definitions, services,
}: {
  rows: ReferenceSampleRow[]
  suppliers: SupplierOption[]
  definitions: DefinitionOption[]
  services: RefOption[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ReferenceSampleRow | null>(null)
  const [vals, setVals] = useState<Vals>(BLANK)
  const isEditing = editing !== null

  const [state, action, pending] = useActionState(
    async (prev: RefSampleFormState, fd: FormData) => {
      const result = isEditing
        ? await updateReferenceSample(editing!.uid, prev, fd)
        : await createReferenceSample(prev, fd)
      if (result.success) { setShowForm(false); setEditing(null); setVals(BLANK); router.refresh() }
      return result
    },
    {},
  )

  function openCreate() { setEditing(null); setVals(BLANK); setShowForm(true) }
  function openEdit(row: ReferenceSampleRow) {
    setEditing(row)
    setVals({
      title: row.title, supplierPath: '', definitionUid: row.referenceDefinitionUid,
      blank: row.blank, hazardous: row.hazardous, expiryDate: row.expiryDate, results: row.results,
    })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditing(null) }
  async function remove(row: ReferenceSampleRow) {
    if (!confirm(`Remove reference sample "${row.title}"?`)) return
    const r = await deactivateReferenceSample(row.path)
    if (r.success) router.refresh(); else alert(r.message ?? 'Failed to remove.')
  }

  // Selecting a definition copies its expected results into the editable grid.
  function pickDefinition(uid: string) {
    const def = definitions.find(d => d.uid === uid)
    setVals(v => ({
      ...v,
      definitionUid: uid,
      blank: def ? def.blank : v.blank,
      results: def ? def.results.map(r => ({ ...r })) : v.results,
    }))
  }

  const base = 'w-full px-3 py-2 text-xs rounded-lg outline-none'
  const bstyle = { border: '1px solid #D1D5DB', color: '#111827' } as const

  // ReferenceSampleRow has only `uid`, so key rows by uid. `typeLabel` is a
  // derived primitive so the Type column (rendered from the `blank` boolean)
  // is sortable.
  type Row = ReferenceSampleRow & { id: string; typeLabel: string }
  const dataRows: Row[] = rows.map(r => ({ ...r, id: r.uid, typeLabel: r.blank ? 'Blank' : 'Control' }))
  const columns: DataTableColumn<Row>[] = [
    {
      id: 'title', label: 'Name', sortable: true, minWidth: 200,
      render: r => <span className="text-xs truncate" style={{ color: '#111827', fontWeight: 500 }}>{r.title}</span>,
    },
    {
      id: 'supplierTitle', label: 'Supplier', sortable: true, minWidth: 160,
      render: r => <span className="text-xs truncate" style={{ color: '#374151' }}>{r.supplierTitle || '—'}</span>,
    },
    {
      id: 'typeLabel', label: 'Type', sortable: true, minWidth: 110,
      render: r => <span className="text-xs" style={{ color: '#374151' }}>{r.blank ? 'Blank' : 'Control'}</span>,
    },
    {
      id: 'expiryDate', label: 'Expiry', sortable: true, minWidth: 120,
      render: r => <span className="text-xs" style={{ color: '#374151' }}>{r.expiryDate || '—'}</span>,
    },
  ]

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-3" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="arrow_back" size={16} color="#374151" />
          </Link>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Reference Samples</h1>
            <p className="text-sm mt-0.5" style={{ color: '#374151' }}>QC materials (control / blank) used on worksheets for quality control</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New Reference Sample
        </button>
      </div>

      {/* Drawer */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: showForm ? 'auto' : 'none' }}>
        <div onClick={closeForm} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showForm ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 480, maxWidth: '92vw', backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showForm ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEditing ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEditing ? 'edit' : 'colorize'} size={16} color={isEditing ? '#2563EB' : '#0154FC'} />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEditing ? `Edit — ${editing.title}` : 'New Reference Sample'}</h2>
            </div>
            <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#374151" /></button>
          </div>

          <form action={action} className="flex flex-col flex-1 min-h-0">
            {isEditing && editing.path && <input type="hidden" name="_path" value={editing.path} />}
            <input type="hidden" name="title" value={vals.title} />
            <input type="hidden" name="supplierPath" value={vals.supplierPath} />
            <input type="hidden" name="definitionUid" value={vals.definitionUid} />
            <input type="hidden" name="blank" value={String(vals.blank)} />
            <input type="hidden" name="hazardous" value={String(vals.hazardous)} />
            <input type="hidden" name="expiryDate" value={vals.expiryDate} />
            <input type="hidden" name="results" value={JSON.stringify(vals.results)} />

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {!isEditing && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Supplier <span style={{ color: '#EF4444' }}>*</span></label>
                  <select className={base} style={bstyle} value={vals.supplierPath} onChange={e => setVals(v => ({ ...v, supplierPath: e.target.value }))}>
                    <option value="">— Select supplier —</option>
                    {suppliers.map(s => <option key={s.uid} value={s.path}>{s.title}</option>)}
                  </select>
                  {suppliers.length === 0 && <p className="mt-0.5" style={{ fontSize: 10, color: '#374151' }}>No suppliers yet — add one under Administration → Suppliers first.</p>}
                  {state.errors?.supplierPath && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.supplierPath[0]}</p>}
                </div>
              )}
              {isEditing && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Supplier</label>
                  <input className={base} style={{ ...bstyle, backgroundColor: '#F9FAFB', color: '#374151' }} value={editing.supplierTitle} disabled />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Name <span style={{ color: '#EF4444' }}>*</span></label>
                <input className={base} style={bstyle} placeholder="e.g. pH 7 Control Lot A" value={vals.title} onChange={e => setVals(v => ({ ...v, title: e.target.value }))} />
                {state.errors?.title && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.title[0]}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Reference Definition</label>
                <select className={base} style={bstyle} value={vals.definitionUid} onChange={e => pickDefinition(e.target.value)}>
                  <option value="">— None —</option>
                  {definitions.map(d => <option key={d.uid} value={d.uid}>{d.title}</option>)}
                </select>
                <p className="mt-0.5" style={{ fontSize: 10, color: '#374151' }}>Selecting a definition copies its expected results below (editable).</p>
              </div>
              <div className="flex gap-4 items-end">
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#374151' }}>
                  <input type="checkbox" checked={vals.blank} onChange={e => setVals(v => ({ ...v, blank: e.target.checked }))} /> Blank
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#374151' }}>
                  <input type="checkbox" checked={vals.hazardous} onChange={e => setVals(v => ({ ...v, hazardous: e.target.checked }))} /> Hazardous
                </label>
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Expiry Date <span style={{ color: '#EF4444' }}>*</span></label>
                  <input type="date" className={base} style={bstyle} value={vals.expiryDate} onChange={e => setVals(v => ({ ...v, expiryDate: e.target.value }))} />
                  {state.errors?.expiryDate && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.expiryDate[0]}</p>}
                </div>
              </div>
              <ReferenceResultsGrid
                services={services}
                rows={vals.results}
                onChange={r => setVals(v => ({ ...v, results: r }))}
              />
              {state.message && !state.success && <p className="text-xs" style={{ color: '#DC2626' }}>{state.message}</p>}
            </div>

            <div className="px-6 py-4 flex gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
              <button type="button" onClick={closeForm} className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium" style={{ border: '1px solid #D1D5DB', color: '#374151' }}>
                <MI name="close" size={13} color="#374151" /> Cancel
              </button>
              <div className="flex-1" />
              <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium text-white" style={{ backgroundColor: pending ? '#DBEAFE' : isEditing ? '#2563EB' : '#0154FC', cursor: pending ? 'not-allowed' : 'pointer' }}>
                <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
                {pending ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {state.success && (
        <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#DBEAFE', border: '1px solid #93C5FD', color: '#0154FC', flexShrink: 0 }}>
          <div className="flex items-center gap-2"><MI name="check_circle" size={13} color="#0154FC" /><span>{state.message}</span></div>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {rows.length === 0 ? (
          <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="colorize" size={36} color="#D1D5DB" />
            <p className="mt-2 text-sm font-medium" style={{ color: '#374151' }}>No reference samples yet</p>
            <p className="text-xs mt-0.5" style={{ color: '#374151' }}>Create QC materials to use as Blank/Control on worksheets</p>
            <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
              <MI name="add" size={13} color="#fff" /> New Reference Sample
            </button>
          </div>
        ) : (
          <DataTable<Row>
            data={dataRows}
            columns={columns}
            searchable
            persistKey="reference-samples"
            emptyMessage="No reference samples found."
            rowActions={row => (
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(row)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}><MI name="edit" size={14} color="#6B7280" /></button>
                <button onClick={() => remove(row)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}><MI name="delete_outline" size={14} color="#DC2626" /></button>
              </div>
            )}
          />
        )}
      </div>
    </div>
  )
}

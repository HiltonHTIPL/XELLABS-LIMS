'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReferenceResultsGrid, { type RefResultRow } from '../../_components/ReferenceResultsGrid'
import type { RefOption } from '../../_components/AdminRefShell'
import {
  createReferenceDefinition, updateReferenceDefinition, deactivateReferenceDefinition,
  type ReferenceDefinitionRow, type RefDefFormState,
} from '@/app/actions/reference-definitions'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

type Vals = { title: string; description: string; blank: boolean; hazardous: boolean; results: RefResultRow[] }
const BLANK: Vals = { title: '', description: '', blank: false, hazardous: false, results: [] }

export default function ReferenceDefinitionsShell({
  rows, services,
}: { rows: ReferenceDefinitionRow[]; services: RefOption[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ReferenceDefinitionRow | null>(null)
  const [vals, setVals] = useState<Vals>(BLANK)
  const isEditing = editing !== null

  const [state, action, pending] = useActionState(
    async (prev: RefDefFormState, fd: FormData) => {
      const result = isEditing
        ? await updateReferenceDefinition(editing!.uid, prev, fd)
        : await createReferenceDefinition(prev, fd)
      if (result.success) { setShowForm(false); setEditing(null); setVals(BLANK); router.refresh() }
      return result
    },
    {},
  )

  function openCreate() { setEditing(null); setVals(BLANK); setShowForm(true) }
  function openEdit(row: ReferenceDefinitionRow) {
    setEditing(row)
    setVals({ title: row.title, description: row.description, blank: row.blank, hazardous: row.hazardous, results: row.results })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditing(null) }
  async function remove(row: ReferenceDefinitionRow) {
    if (!confirm(`Remove reference definition "${row.title}"?`)) return
    const r = await deactivateReferenceDefinition(row.path)
    if (r.success) router.refresh(); else alert(r.message ?? 'Failed to remove.')
  }

  const base = 'w-full px-3 py-2 text-xs rounded-lg outline-none'
  const bstyle = { border: '1px solid #D1D5DB', color: '#111827' } as const

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-3" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="arrow_back" size={16} color="#6B7280" />
          </Link>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Reference Definitions</h1>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Expected QC values (result / range) per analysis — templates for Reference Samples</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New Definition
        </button>
      </div>

      {/* Drawer */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: showForm ? 'auto' : 'none' }}>
        <div onClick={closeForm} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showForm ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 480, maxWidth: '92vw', backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showForm ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEditing ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEditing ? 'edit' : 'straighten'} size={16} color={isEditing ? '#2563EB' : '#0154FC'} />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEditing ? `Edit — ${editing.title}` : 'New Reference Definition'}</h2>
            </div>
            <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
          </div>

          <form action={action} className="flex flex-col flex-1 min-h-0">
            {isEditing && editing.path && <input type="hidden" name="_path" value={editing.path} />}
            <input type="hidden" name="title" value={vals.title} />
            <input type="hidden" name="description" value={vals.description} />
            <input type="hidden" name="blank" value={String(vals.blank)} />
            <input type="hidden" name="hazardous" value={String(vals.hazardous)} />
            <input type="hidden" name="results" value={JSON.stringify(vals.results)} />

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Name <span style={{ color: '#EF4444' }}>*</span></label>
                <input className={base} style={bstyle} placeholder="e.g. pH Buffer 7.0 QC" value={vals.title} onChange={e => setVals(v => ({ ...v, title: e.target.value }))} />
                {state.errors?.title && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.title[0]}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Notes</label>
                <textarea rows={2} className={`${base} resize-none`} style={bstyle} value={vals.description} onChange={e => setVals(v => ({ ...v, description: e.target.value }))} />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#374151' }}>
                  <input type="checkbox" checked={vals.blank} onChange={e => setVals(v => ({ ...v, blank: e.target.checked }))} /> Blank definition
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#374151' }}>
                  <input type="checkbox" checked={vals.hazardous} onChange={e => setVals(v => ({ ...v, hazardous: e.target.checked }))} /> Hazardous
                </label>
              </div>
              <ReferenceResultsGrid
                services={services}
                rows={vals.results}
                onChange={r => setVals(v => ({ ...v, results: r }))}
                error={state.errors?.results?.[0]}
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

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {rows.length === 0 ? (
          <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="straighten" size={36} color="#D1D5DB" />
            <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No reference definitions yet</p>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create one to define expected QC values</p>
            <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
              <MI name="add" size={13} color="#fff" /> New Definition
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
            <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <colgroup><col style={{ width: '42%' }} /><col style={{ width: '20%' }} /><col style={{ width: '22%' }} /><col style={{ width: '16%' }} /></colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                  {['Name', 'Expected Results', 'Flags', ''].map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.uid} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs truncate" style={{ color: '#111827', fontWeight: 500 }}>{row.title}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: '#6B7280' }}>{row.results.length} {row.results.length === 1 ? 'service' : 'services'}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: '#6B7280' }}>{[row.blank ? 'Blank' : '', row.hazardous ? 'Hazardous' : ''].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(row)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}><MI name="edit" size={14} color="#6B7280" /></button>
                        <button onClick={() => remove(row)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}><MI name="delete_outline" size={14} color="#DC2626" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>{rows.length} definition{rows.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

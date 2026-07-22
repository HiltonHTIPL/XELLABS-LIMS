'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleMethodActive, type Method } from '@/app/actions/methods'
import type { Calculation } from '@/app/actions/calculations'
import type { InstrumentOption } from '@/app/actions/instrument-maintenance'
import type { SenaiteMethodRow } from '@/app/actions/senaite-methods'
import type { SenaiteInstrument, SenaiteCalculation } from '@/app/lib/senaite'
import MethodFormDrawer from './MethodFormDrawer'
import DataTable, { type DataTableColumn } from '../../_components/DataTable'
import SenaiteMethodsShell from './SenaiteMethodsShell'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export default function MethodsShell({ initialMethods, calculations, instruments, senaiteMethods, senaiteInstruments, senaiteCalculations }: {
  initialMethods: Method[]; calculations: Calculation[]; instruments: InstrumentOption[]
  senaiteMethods: SenaiteMethodRow[]; senaiteInstruments: SenaiteInstrument[]; senaiteCalculations: SenaiteCalculation[]
}) {
  const [tab, setTab] = useState<'catalog' | 'docs'>('catalog')
  const router = useRouter()
  const [showDrawer, setShowDrawer] = useState(false)
  const [editing, setEditing] = useState<Method | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [, startTransition] = useTransition()

  function openCreate() { setEditing(null); setShowDrawer(true) }
  function openEdit(m: Method) { setEditing(m); setShowDrawer(true) }
  function closeDrawer() { setShowDrawer(false) }
  function handleSaved(_saved: Method | null, message: string) {
    setShowDrawer(false)
    setEditing(null)
    setToast({ ok: true, msg: message })
    setTimeout(() => setToast(null), 4000)
    router.refresh()
  }

  // Per-row pending state — a single shared `busy` flag disabled every toggle
  // in the table while one request was in flight.
  const [togglingId, setTogglingId] = useState<number | null>(null)

  function toggle(m: Method) {
    setTogglingId(m.id)
    startTransition(async () => {
      const r = await toggleMethodActive(m.id, !m.is_active)
      setToast({ ok: r.success, msg: r.message })
      setTimeout(() => setToast(null), 3000)
      if (r.success) router.refresh()
      setTogglingId(null)
    })
  }

  // Columns reproduce the previous hand-rolled cells exactly. Status sorts by
  // the boolean `is_active` field directly; every other column by its own field.
  const columns: DataTableColumn<Method>[] = [
    {
      id: 'name', label: 'Name', sortable: true, minWidth: 200,
      render: m => <span className="text-xs font-medium" style={{ color: '#111827' }}>{m.name}</span>,
    },
    {
      id: 'code', label: 'Code', sortable: true, minWidth: 120,
      render: m => <span className="font-mono text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>{m.code}</span>,
    },
    {
      id: 'description', label: 'Description', sortable: true, minWidth: 300,
      render: m => <span className="text-xs truncate" style={{ color: '#374151' }}>{m.description || '—'}</span>,
    },
    {
      id: 'is_active', label: 'Status', sortable: true, minWidth: 120,
      render: m => (
        <button onClick={() => toggle(m)} disabled={togglingId === m.id}
          className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, color: m.is_active ? '#0154FC' : '#374151', background: 'none', border: 'none', cursor: 'pointer' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: m.is_active ? '#0154FC' : '#374151', display: 'inline-block' }} />
          {m.is_active ? 'Active' : 'Inactive'}
        </button>
      ),
    },
  ]

  const tabBar = (
    <div className="flex items-center gap-1 px-5 pt-4" style={{ flexShrink: 0, backgroundColor: '#F7F8FC', borderBottom: '1px solid #E8EAF2' }}>
      {([['catalog', 'Methods'], ['docs', 'Documentation Records']] as const).map(([key, label]) => (
        <button key={key} onClick={() => setTab(key)}
          className="px-4 py-2 text-sm font-semibold"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: tab === key ? '#0154FC' : '#6B7280',
            borderBottom: tab === key ? '2px solid #0154FC' : '2px solid transparent',
          }}>
          {label}
        </button>
      ))}
    </div>
  )

  if (tab === 'catalog') {
    return (
      <div style={{ backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tabBar}
        <div style={{ flex: 1, minHeight: 0 }}>
          <SenaiteMethodsShell rows={senaiteMethods} instruments={senaiteInstruments} calculations={senaiteCalculations} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {tabBar}
      <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-5" style={{ flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Documentation Records</h1>
          <p className="mt-1" style={{ fontSize: 13, color: '#6B7280' }}>Local accreditation, instructions and document tracking per method</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#2563EB', border: 'none', cursor: 'pointer' }}>
          <MI name="add" size={15} color="#fff" /> New Method
        </button>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ flexShrink: 0,
          backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      <MethodFormDrawer
        open={showDrawer}
        onClose={closeDrawer}
        editing={editing}
        calculations={calculations}
        instruments={instruments}
        onSaved={handleSaved}
      />

      {/* Table */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {initialMethods.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2', borderRadius: 14 }}>
          <MI name="biotech" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#374151' }}>No methods yet</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Method
          </button>
        </div>
      ) : (
        <DataTable<Method>
          data={initialMethods}
          columns={columns}
          searchable
          persistKey="methods"
          emptyMessage="No methods found."
          rowActions={m => (
            <button onClick={() => openEdit(m)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }} title="Edit">
              <MI name="edit" size={14} color="#6B7280" />
            </button>
          )}
        />
      )}
      </div>
      </div>
    </div>
  )
}

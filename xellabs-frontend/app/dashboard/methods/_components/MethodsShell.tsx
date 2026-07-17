'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleMethodActive, type Method } from '@/app/actions/methods'
import type { Calculation } from '@/app/actions/calculations'
import type { InstrumentOption } from '@/app/actions/instrument-maintenance'
import MethodFormDrawer from './MethodFormDrawer'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export default function MethodsShell({ initialMethods, calculations, instruments }: {
  initialMethods: Method[]; calculations: Calculation[]; instruments: InstrumentOption[]
}) {
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

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-5" style={{ flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Methods</h1>
          <p className="mt-1" style={{ fontSize: 13, color: '#6B7280' }}>Manage analytical methods used in testing</p>
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
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      {initialMethods.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2', borderRadius: 14 }}>
          <MI name="biotech" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No methods yet</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Method
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '28%' }} /><col style={{ width: '14%' }} /><col style={{ width: '38%' }} /><col style={{ width: '12%' }} /><col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Code', 'Description', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialMethods.map((m, i) => (
                <tr key={m.id} style={{ borderBottom: i < initialMethods.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-xs font-medium" style={{ color: '#111827' }}>{m.name}</td>
                  <td className="px-3 py-2.5"><span className="font-mono text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>{m.code}</span></td>
                  <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#6B7280' }}>{m.description || '—'}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => toggle(m)} disabled={togglingId === m.id}
                      className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, color: m.is_active ? '#0154FC' : '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: m.is_active ? '#0154FC' : '#9CA3AF', display: 'inline-block' }} />
                      {m.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => openEdit(m)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                      <MI name="edit" size={14} color="#9CA3AF" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialMethods.length} method{initialMethods.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

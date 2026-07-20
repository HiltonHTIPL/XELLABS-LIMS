'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createWorksheet, type WorksheetListItem,
} from '@/app/actions/senaite-worksheets'
import type { RefOption } from '@/app/dashboard/_components/AdminRefShell'

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
  const s = STATE_BADGE[state] ?? { bg: '#F3F4F6', color: '#6B7280', label: state || '—' }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color, fontSize: 11, fontWeight: 600 }}>
      {s.label}
    </span>
  )
}

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
  templates: RefOption[]
  instruments: RefOption[]
}

export default function WorksheetsShell({ initialWorksheets, templates, instruments }: Props) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [templateUid, setTemplateUid] = useState('')
  const [instrumentUid, setInstrumentUid] = useState('')
  const [busy, startTransition] = useTransition()
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  function openCreate() { setTemplateUid(''); setInstrumentUid(''); setShowCreate(true) }
  function closeCreate() { if (!busy) setShowCreate(false) }

  function submitCreate() {
    startTransition(async () => {
      const r = await createWorksheet({
        template: templateUid || undefined,
        instrument: instrumentUid || undefined,
      })
      if (r.success && r.id) {
        setShowCreate(false)
        router.push(`/dashboard/worksheets/${r.id}`)
      } else {
        setToast({ ok: false, msg: r.error ?? 'Failed to create worksheet.' })
        setTimeout(() => setToast(null), 5000)
      }
    })
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-4" style={{ flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Worksheets</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Create worksheets from templates — routine analyses and QC positions are laid out automatically</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={16} color="#fff" /> New Worksheet
        </button>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, color: toast.ok ? '#0154FC' : '#991B1B', flexShrink: 0 }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* Create drawer */}
      <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, zIndex: 200, pointerEvents: showCreate ? 'auto' : 'none' }}>
        <div onClick={closeCreate} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showCreate ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 480, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showCreate ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
                <MI name="add" size={16} color="#0154FC" />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>New Worksheet</h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>Pick a template to auto-lay-out positions and pull in pending analyses</p>
              </div>
            </div>
            <button onClick={closeCreate} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Worksheet Template</label>
              <select value={templateUid} onChange={e => setTemplateUid(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                <option value="">None — blank worksheet</option>
                {templates.map(t => <option key={t.uid} value={t.uid}>{t.title}</option>)}
              </select>
              <p className="mt-1" style={{ fontSize: 10, color: '#9CA3AF' }}>
                A template fills routine positions from received samples&rsquo; pending analyses and adds any Blank / Control / Duplicate QC positions it defines.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                Instrument <span className="font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
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
            <button type="button" onClick={submitCreate} disabled={busy} className="flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
              <MI name={busy ? 'hourglass_top' : 'check'} size={13} color="#fff" />
              {busy ? 'Creating…' : 'Create Worksheet'}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {initialWorksheets.length === 0 ? (
          <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="grid_view" size={36} color="#D1D5DB" />
            <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No worksheets yet</p>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create one from a template to lay out analyses and QC automatically</p>
            <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
              <MI name="add" size={13} color="#fff" /> New Worksheet
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                  {['Worksheet', 'Analyst', 'Template', 'Instrument', 'Analyses', 'Status', 'Created'].map(h => (
                    <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {initialWorksheets.map((w, i) => (
                  <tr key={w.uid} onClick={() => router.push(`/dashboard/worksheets/${w.id}`)}
                    style={{ borderBottom: i < initialWorksheets.length - 1 ? '1px solid #F9FAFB' : 'none', cursor: 'pointer' }} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                          <MI name="grid_view" size={13} color="#0154FC" />
                        </div>
                        <span className="text-xs font-semibold" style={{ color: '#0154FC' }}>{w.id}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#374151' }}>{w.analyst || '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{w.templateTitle || '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{w.instrumentTitle || '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#374151' }}>{w.numAnalyses}</td>
                    <td className="px-3 py-2.5"><StateBadge state={w.reviewState} /></td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#9CA3AF' }}>{fmtDate(w.created)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialWorksheets.length} worksheet{initialWorksheets.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

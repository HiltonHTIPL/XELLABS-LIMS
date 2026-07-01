'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createWorksheet, type SenaiteWorksheet } from '@/app/actions/worksheets'
import { type SenaiteWorksheet as WS } from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const STATE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  open:              { bg: '#CCFBF1', color: '#0F766E', label: 'Open' },
  'to_be_verified':  { bg: '#FEF3C7', color: '#92400E', label: 'To Be Verified' },
  verified:          { bg: '#DCFCE7', color: '#166534', label: 'Verified' },
  rejected:          { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
}

export default function WorksheetsShell({ initialWorksheets }: { initialWorksheets: WS[] }) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  function handleCreate() {
    startTransition(async () => {
      const result = await createWorksheet()
      setToast({ ok: result.success, msg: result.message })
      setTimeout(() => setToast(null), 4000)
      if (result.success) router.push(`/dashboard/worksheets/${result.uid}`)
    })
  }

  return (
    <div style={{ padding: '12px 20px 0', backgroundColor: '#F5F6FA', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#111827' }}>Worksheets</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Assign analyses to worksheets and enter results</p>
        </div>
        <button onClick={handleCreate} disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#14B8A6', opacity: busy ? 0.7 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}>
          <MI name={busy ? 'hourglass_top' : 'add'} size={15} color="#fff" />
          {busy ? 'Creating…' : 'New Worksheet'}
        </button>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${toast.ok ? '#A7F3D0' : '#FECACA'}`, color: toast.ok ? '#065F46' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#10B981' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {initialWorksheets.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E5E7EB' }}>
          <MI name="table_chart" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No worksheets yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create a worksheet to start assigning analyses</p>
          <button onClick={handleCreate} disabled={busy}
            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ backgroundColor: '#14B8A6' }}>
            <MI name="add" size={13} color="#fff" /> New Worksheet
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '20%' }} /><col style={{ width: '25%' }} /><col style={{ width: '15%' }} /><col style={{ width: '18%' }} /><col style={{ width: '14%' }} /><col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Worksheet ID', 'Title', 'Analyses', 'Analyst', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialWorksheets.map((w, i) => {
                const badge = STATE_BADGE[w.review_state] ?? { bg: '#F3F4F6', color: '#374151', label: w.review_state }
                return (
                  <tr key={w.uid} style={{ borderBottom: i < initialWorksheets.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <Link href={`/dashboard/worksheets/${w.uid}`} className="text-xs font-semibold font-mono" style={{ color: '#2563EB', textDecoration: 'none' }}>{w.id}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#374151' }}>{w.title || w.id}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{w.analyses_count} analysis/analyses</td>
                    <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#6B7280' }}>{w.AnalystTitle || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: badge.bg, color: badge.color }}>{badge.label}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/dashboard/worksheets/${w.uid}`} className="p-1 rounded hover:bg-gray-100 flex items-center justify-center" style={{ textDecoration: 'none' }}>
                        <MI name="arrow_forward" size={14} color="#9CA3AF" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialWorksheets.length} worksheet{initialWorksheets.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

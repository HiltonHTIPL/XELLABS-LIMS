'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { type EnrichedWorksheet, createDjangoWorksheet } from '@/app/actions/django-worksheets'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  open:             { bg: '#EFF6FF', color: '#1D4ED8', label: 'Open' },
  in_progress:      { bg: '#DBEAFE', color: '#1E40AF', label: 'In Progress' },
  to_be_verified:   { bg: '#FEF3C7', color: '#92400E', label: 'To Be Verified' },
  verified:         { bg: '#DBEAFE', color: '#0154FC', label: 'Verified' },
  rejected:         { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
}

export default function LabWorksheetsShell({ initialWorksheets }: { initialWorksheets: EnrichedWorksheet[] }) {
  const router = useRouter()
  const [worksheets, setWorksheets] = useState(initialWorksheets)
  const [busy, startTransition] = useTransition()
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  function handleCreate() {
    startTransition(async () => {
      const res = await createDjangoWorksheet()
      if (res.success) {
        setToast({ ok: true, msg: 'Worksheet created.' })
        setTimeout(() => setToast(null), 3000)
        router.refresh()
      } else {
        setToast({ ok: false, msg: res.message })
        setTimeout(() => setToast(null), 3000)
      }
    })
  }

  const th = { padding: '10px 14px', textAlign: 'left' as const, fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' as const }
  const td = { padding: '12px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #F3F4F6' }

  return (
    <div style={{ padding: 24, minHeight: '100%', backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em', margin: 0 }}>Lab Worksheets</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Create and manage worksheets for analysis result entry</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={busy}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8, border: 'none', backgroundColor: '#0154FC', color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          <MI name="add" size={16} color="#fff" />
          {busy ? 'Creating…' : 'New Worksheet'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 8, marginBottom: 16, backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, fontSize: 13, color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error_outline'} size={16} color={toast.ok ? '#0154FC' : '#991B1B'} />
          {toast.msg}
        </div>
      )}

      {/* Worksheets table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8EAF2', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {worksheets.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
            <MI name="assignment" size={48} color="#D1D5DB" />
            <p style={{ fontSize: 13, marginTop: 12 }}>No worksheets yet</p>
            <button onClick={handleCreate} style={{ fontSize: 12, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', marginTop: 8, textDecoration: 'underline' }}>
              Create the first one
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={th}>Worksheet ID</th>
                  <th style={th}>Status</th>
                  <th style={th}>Assignments</th>
                  <th style={th}>Completed</th>
                  <th style={th}>Created</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {worksheets.map(ws => {
                  const badge = STATUS_BADGE[ws.status] || { bg: '#F3F4F6', color: '#6B7280', label: ws.status }
                  return (
                    <tr key={ws.id} style={{ background: ws.id % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                      <td style={{ ...td, fontWeight: 600, color: '#2563EB', cursor: 'pointer' }} onClick={() => router.push(`/dashboard/lab-worksheets/${ws.id}`)}>{ws.ws_id}</td>
                      <td style={td}><span style={{ background: badge.bg, color: badge.color, borderRadius: 20, padding: '3px 10px', fontWeight: 600, fontSize: 11 }}>{badge.label}</span></td>
                      <td style={td}>{ws.assignment_count}</td>
                      <td style={td}>{ws.completed_count} / {ws.assignment_count}</td>
                      <td style={td}>{fmt(ws.created_at)}</td>
                      <td style={td}>
                        <button onClick={() => router.push(`/dashboard/lab-worksheets/${ws.id}`)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', fontSize: 11, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                          Open
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

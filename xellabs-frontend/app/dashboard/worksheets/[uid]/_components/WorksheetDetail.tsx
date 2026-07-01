'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { assignAnalyses, submitResult } from '@/app/actions/worksheets'
import { type SenaiteAnalysis } from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const STATE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  unassigned:      { bg: '#F3F4F6', color: '#6B7280',  label: 'Unassigned' },
  assigned:        { bg: '#DBEAFE', color: '#1E40AF',  label: 'Assigned' },
  'to_be_verified':{ bg: '#FEF3C7', color: '#92400E',  label: 'To Be Verified' },
  verified:        { bg: '#DCFCE7', color: '#166534',  label: 'Verified' },
  rejected:        { bg: '#FEE2E2', color: '#991B1B',  label: 'Rejected' },
}

type Props = {
  worksheetUid: string
  analyses: SenaiteAnalysis[]
  unassigned: SenaiteAnalysis[]
}

export default function WorksheetDetail({ worksheetUid, analyses, unassigned }: Props) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [showAssign, setShowAssign] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [results, setResults] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function toggleSelect(uid: string) {
    setSelected(s => s.includes(uid) ? s.filter(x => x !== uid) : [...s, uid])
  }

  function handleAssign() {
    if (!selected.length) return
    startTransition(async () => {
      const result = await assignAnalyses(worksheetUid, selected)
      showToast(result.success, result.message)
      if (result.success) { setSelected([]); setShowAssign(false); router.refresh() }
    })
  }

  function handleSubmitResult(analysisUid: string) {
    const val = results[analysisUid]?.trim()
    if (!val) return
    setSubmitting(analysisUid)
    startTransition(async () => {
      const result = await submitResult(worksheetUid, analysisUid, val)
      showToast(result.success, result.message)
      setSubmitting(null)
      if (result.success) router.refresh()
    })
  }

  return (
    <div style={{ padding: '12px 20px 0', backgroundColor: '#F5F6FA', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Link href="/dashboard/worksheets" className="flex items-center gap-1 text-xs font-medium" style={{ color: '#6B7280', textDecoration: 'none' }}>
          <MI name="arrow_back" size={14} color="#6B7280" /> Worksheets
        </Link>
        <MI name="chevron_right" size={14} color="#D1D5DB" />
        <span className="text-xs font-semibold font-mono" style={{ color: '#111827' }}>{worksheetUid.slice(0, 12)}…</span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#111827' }}>Worksheet</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>{analyses.length} analysis/analyses assigned</p>
        </div>
        <button onClick={() => setShowAssign(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#2563EB' }}>
          <MI name="playlist_add" size={15} color="#fff" /> Add Analyses
        </button>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${toast.ok ? '#A7F3D0' : '#FECACA'}`, color: toast.ok ? '#065F46' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#10B981' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* Assign modal */}
      {showAssign && (
        <div onClick={e => { if (e.currentTarget === e.target) setShowAssign(false) }}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 16, width: 540, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Add Analyses to Worksheet</h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>{unassigned.length} unassigned analysis/analyses available</p>
              </div>
              <button onClick={() => setShowAssign(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <MI name="close" size={16} color="#9CA3AF" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {unassigned.length === 0 ? (
                <p className="text-xs text-center py-8" style={{ color: '#9CA3AF' }}>No unassigned analyses — register samples with tests to get analyses here.</p>
              ) : (
                <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                  {unassigned.map((a, i) => (
                    <label key={a.uid} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                      style={{ borderBottom: i < unassigned.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                      <input type="checkbox" checked={selected.includes(a.uid)} onChange={() => toggleSelect(a.uid)} style={{ accentColor: '#2563EB' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium" style={{ color: '#111827' }}>{a.title} <span style={{ color: '#9CA3AF' }}>({a.Keyword})</span></p>
                        <p style={{ fontSize: 10, color: '#6B7280' }}>{a.SampleID} — {a.ClientTitle}</p>
                      </div>
                      {a.Unit && <span style={{ fontSize: 10, color: '#9CA3AF' }}>{a.Unit}</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 11, color: '#6B7280' }}>{selected.length} selected</span>
              <div className="flex gap-2">
                <button onClick={() => setShowAssign(false)} style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleAssign} disabled={!selected.length || busy}
                  className="flex items-center gap-1.5"
                  style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: selected.length ? '#2563EB' : '#9CA3AF', color: '#fff', border: 'none', cursor: selected.length ? 'pointer' : 'not-allowed' }}>
                  <MI name="playlist_add_check" size={13} color="#fff" />
                  {busy ? 'Assigning…' : `Assign ${selected.length}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analyses table with inline result entry */}
      {analyses.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E5E7EB' }}>
          <MI name="playlist_add" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No analyses assigned yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Click "Add Analyses" to assign from registered samples</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '18%' }} /><col style={{ width: '12%' }} /><col style={{ width: '18%' }} /><col style={{ width: '10%' }} /><col style={{ width: '15%' }} /><col style={{ width: '18%' }} /><col style={{ width: '9%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Test', 'Keyword', 'Sample', 'Unit', 'Status', 'Enter Result', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analyses.map((a, i) => {
                const badge = STATE_BADGE[a.review_state] ?? { bg: '#F3F4F6', color: '#374151', label: a.review_state }
                const canEnter = a.review_state === 'assigned' || a.review_state === 'unassigned'
                const isSubmitting = submitting === a.uid
                return (
                  <tr key={a.uid} style={{ borderBottom: i < analyses.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-xs font-medium" style={{ color: '#111827' }}>{a.title}</td>
                    <td className="px-3 py-2.5"><span className="font-mono text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>{a.Keyword}</span></td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#374151' }}>{a.SampleID || '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{a.Unit || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: badge.bg, color: badge.color }}>{badge.label}</span>
                    </td>
                    <td className="px-3 py-2">
                      {canEnter ? (
                        <input
                          type="text"
                          placeholder={a.Result ?? 'Enter value…'}
                          value={results[a.uid] ?? ''}
                          onChange={e => setResults(r => ({ ...r, [a.uid]: e.target.value }))}
                          className="w-full px-2 py-1 text-xs rounded outline-none"
                          style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                          onKeyDown={e => { if (e.key === 'Enter') handleSubmitResult(a.uid) }}
                        />
                      ) : (
                        <span className="text-xs font-semibold" style={{ color: '#374151' }}>{a.Result ?? '—'}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {canEnter && (
                        <button
                          onClick={() => handleSubmitResult(a.uid)}
                          disabled={!results[a.uid]?.trim() || isSubmitting}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                          style={{ backgroundColor: results[a.uid]?.trim() ? '#14B8A6' : '#E5E7EB', color: results[a.uid]?.trim() ? '#fff' : '#9CA3AF', border: 'none', cursor: results[a.uid]?.trim() ? 'pointer' : 'not-allowed' }}>
                          <MI name={isSubmitting ? 'hourglass_top' : 'check'} size={12} color={results[a.uid]?.trim() ? '#fff' : '#9CA3AF'} />
                          {isSubmitting ? '…' : 'Submit'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{analyses.length} analysis/analyses — press Enter or click Submit to save a result</p>
          </div>
        </div>
      )}
    </div>
  )
}

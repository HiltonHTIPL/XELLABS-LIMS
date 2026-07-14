'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { type EnrichedWorksheet, assignToWorksheet, submitResultValue, verifyResult, submitWorksheetForReview, verifyWorksheet, rejectWorksheet, assignWorksheetAnalyst, assignWorksheetInstrument, assignWorksheetMethod } from '@/app/actions/django-worksheets'
import { type AnalysisRequest } from '@/app/actions/analysis-requests'
import { type LimsTest } from '@/app/actions/tests'
import { type InstrumentOption } from '@/app/actions/instrument-maintenance'
import { type Method } from '@/app/actions/methods'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  open:             { bg: '#EFF6FF', color: '#1D4ED8', label: 'Open' },
  in_progress:      { bg: '#DBEAFE', color: '#1E40AF', label: 'In Progress' },
  to_be_verified:   { bg: '#FEF3C7', color: '#92400E', label: 'To Be Verified' },
  verified:         { bg: '#DBEAFE', color: '#0154FC', label: 'Verified' },
  rejected:         { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
}

const RESULT_STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  pending:    { bg: '#F3F4F6', color: '#6B7280' },
  submitted:  { bg: '#DBEAFE', color: '#0154FC' },
  verified:   { bg: '#DBEAFE', color: '#0154FC' },
  rejected:   { bg: '#FEE2E2', color: '#991B1B' },
}

type Props = {
  worksheet: EnrichedWorksheet; ars: AnalysisRequest[]; tests: LimsTest[]; users: { id: number; name: string }[]
  instruments: InstrumentOption[]; methods: Method[]
}

export default function LabWorksheetDetail({ worksheet: initialWs, ars, tests, users, instruments, methods }: Props) {
  const router = useRouter()
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedAr, setSelectedAr] = useState('')
  const [selectedTest, setSelectedTest] = useState('')
  const [resultValues, setResultValues] = useState<Record<number, string>>({})
  const [busy, startTransition] = useTransition()
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3000)
  }

  function handleAssign() {
    if (!selectedAr || !selectedTest) return
    startTransition(async () => {
      const res = await assignToWorksheet(initialWs.id, Number(selectedAr), Number(selectedTest))
      if (res.success) {
        showToast(true, res.message)
        setSelectedAr('')
        setSelectedTest('')
        setShowAssignModal(false)
        router.refresh()
      } else {
        showToast(false, res.message)
      }
    })
  }

  function handleSubmitResult(resultId: number) {
    const value = resultValues[resultId]?.trim()
    if (!value) {
      showToast(false, 'Enter a result value')
      return
    }
    startTransition(async () => {
      const res = await submitResultValue(resultId, value)
      if (res.success) {
        showToast(true, res.message)
        router.refresh()
      } else {
        showToast(false, res.message)
      }
    })
  }

  function handleVerifyResult(resultId: number) {
    startTransition(async () => {
      const res = await verifyResult(resultId)
      if (res.success) {
        showToast(true, res.message)
        router.refresh()
      } else {
        showToast(false, res.message)
      }
    })
  }

  function handleAssignAnalyst(userId: number) {
    if (!userId) return
    startTransition(async () => {
      const res = await assignWorksheetAnalyst(initialWs.id, userId)
      if (res.success) {
        showToast(true, res.message)
        router.refresh()
      } else {
        showToast(false, res.message)
      }
    })
  }

  function handleAssignInstrument(instrumentId: string) {
    startTransition(async () => {
      const res = await assignWorksheetInstrument(initialWs.id, instrumentId ? Number(instrumentId) : null)
      if (res.success) {
        showToast(true, res.message)
        router.refresh()
      } else {
        showToast(false, res.message)
      }
    })
  }

  function handleAssignMethod(methodId: string) {
    startTransition(async () => {
      const res = await assignWorksheetMethod(initialWs.id, methodId ? Number(methodId) : null)
      if (res.success) {
        showToast(true, res.message)
        router.refresh()
      } else {
        showToast(false, res.message)
      }
    })
  }

  function handleSubmitWorksheet() {
    startTransition(async () => {
      const res = await submitWorksheetForReview(initialWs.id)
      if (res.success) {
        showToast(true, res.message)
        router.refresh()
      } else {
        showToast(false, res.message)
      }
    })
  }

  function handleVerifyWorksheet() {
    startTransition(async () => {
      const res = await verifyWorksheet(initialWs.id)
      if (res.success) {
        showToast(true, res.message)
        router.refresh()
      } else {
        showToast(false, res.message)
      }
    })
  }

  function handleRejectWorksheet() {
    startTransition(async () => {
      const res = await rejectWorksheet(initialWs.id)
      if (res.success) {
        showToast(true, res.message)
        router.refresh()
      } else {
        showToast(false, res.message)
      }
    })
  }

  const badge = STATUS_BADGE[initialWs.status] || { bg: '#F3F4F6', color: '#6B7280', label: initialWs.status }
  const canAddAssignments = ['open', 'in_progress'].includes(initialWs.status)
  const canSubmit = ['open', 'in_progress'].includes(initialWs.status) && initialWs.assignments.every(a => a.result_status === 'verified')
  const canVerify = initialWs.status === 'to_be_verified'

  return (
    <div style={{ padding: 24, minHeight: '100%', backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <button onClick={() => router.push('/dashboard/worksheets')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 13, marginBottom: 6 }}>
            ← Worksheets
          </button>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em', margin: 0 }}>{initialWs.ws_id}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ background: badge.bg, color: badge.color, borderRadius: 20, padding: '4px 12px', fontWeight: 600, fontSize: 12, display: 'inline-block' }}>
              {badge.label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MI name="person" size={14} color="#6B7280" />
              <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Assigned to</span>
              <select
                value={initialWs.analyst ?? ''}
                onChange={e => handleAssignAnalyst(Number(e.target.value))}
                disabled={busy || !['open', 'in_progress'].includes(initialWs.status)}
                style={{ padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, color: '#374151', background: '#fff', cursor: 'pointer' }}
              >
                <option value="" disabled>Select user…</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MI name="precision_manufacturing" size={14} color="#6B7280" />
              <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Instrument</span>
              <select
                value={initialWs.instrument ?? ''}
                onChange={e => handleAssignInstrument(e.target.value)}
                disabled={busy || !['open', 'in_progress'].includes(initialWs.status)}
                style={{ padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, color: '#374151', background: '#fff', cursor: 'pointer' }}
              >
                <option value="">None</option>
                {instruments.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MI name="biotech" size={14} color="#6B7280" />
              <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Method</span>
              <select
                value={initialWs.method ?? ''}
                onChange={e => handleAssignMethod(e.target.value)}
                disabled={busy || !['open', 'in_progress'].includes(initialWs.status)}
                style={{ padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, color: '#374151', background: '#fff', cursor: 'pointer' }}
              >
                <option value="">None</option>
                {methods.filter(m => m.is_active).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canAddAssignments && (
            <button onClick={() => setShowAssignModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
              <MI name="add" size={16} color="#374151" />
              Assign Test
            </button>
          )}
          {canSubmit && (
            <button onClick={handleSubmitWorksheet} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: 'none', background: '#0154FC', color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
              <MI name="send" size={16} color="#fff" />
              Submit for Review
            </button>
          )}
          {canVerify && (
            <button onClick={handleVerifyWorksheet} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: 'none', background: '#10B981', color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
              <MI name="check" size={16} color="#fff" />
              Verify Worksheet
            </button>
          )}
          {canVerify && (
            <button onClick={handleRejectWorksheet} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: '1px solid #DC2626', background: '#fff', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
              <MI name="close" size={16} color="#DC2626" />
              Reject Worksheet
            </button>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 8, marginBottom: 16, backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, fontSize: 13, color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error_outline'} size={16} color={toast.ok ? '#0154FC' : '#991B1B'} />
          {toast.msg}
        </div>
      )}

      {/* Assignments table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8EAF2', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {initialWs.assignments.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
            <MI name="assignment" size={48} color="#D1D5DB" />
            <p style={{ fontSize: 13, marginTop: 12 }}>No assignments yet</p>
            {canAddAssignments && (
              <button onClick={() => setShowAssignModal(true)} style={{ fontSize: 12, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', marginTop: 8, textDecoration: 'underline' }}>
                Add the first one
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>AR ID</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>Sample</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>Test</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>Instrument</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>Method</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>Result Value</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {initialWs.assignments.map((a, i) => {
                  const rBadge = RESULT_STATUS_BADGE[a.result_status] || { bg: '#F3F4F6', color: '#6B7280' }
                  const canEdit = ['pending'].includes(a.result_status) && canAddAssignments
                  const canVerifyResult = a.result_status === 'submitted'
                  return (
                    <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#2563EB', fontWeight: 600 }}>{a.ar_id}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{a.sample_id}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{a.test_name}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{a.instrument_name || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{a.method_name || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {canEdit ? (
                          <input
                            type="text"
                            value={(a.result_id != null ? resultValues[a.result_id] : undefined) ?? a.result_value ?? ''}
                            onChange={e => { if (a.result_id != null) setResultValues(prev => ({ ...prev, [a.result_id as number]: e.target.value })) }}
                            placeholder="Enter value"
                            style={{ padding: '6px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, width: '100%', maxWidth: 120 }}
                          />
                        ) : (
                          <span style={{ fontSize: 13, color: '#374151' }}>{a.result_value || '—'}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: rBadge.bg, color: rBadge.color, borderRadius: 20, padding: '3px 10px', fontWeight: 600, fontSize: 11 }}>
                          {a.result_status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12 }}>
                        {canEdit && a.result_id != null && (
                          <button
                            onClick={() => handleSubmitResult(a.result_id as number)}
                            disabled={busy}
                            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#0154FC', color: '#fff', fontSize: 11, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}
                          >
                            Submit
                          </button>
                        )}
                        {canVerifyResult && a.result_id != null && (
                          <button
                            onClick={() => handleVerifyResult(a.result_id as number)}
                            disabled={busy}
                            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#10B981', color: '#fff', fontSize: 11, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}
                          >
                            Verify
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign modal */}
      {showAssignModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 400, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#14265E', margin: '0 0 16px' }}>Assign Test to Worksheet</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Analysis Request</label>
              <select
                value={selectedAr}
                onChange={e => setSelectedAr(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, outline: 'none' }}
              >
                <option value="">Select…</option>
                {ars.map(ar => (
                  <option key={ar.id} value={ar.id}>
                    {ar.ar_id} — {ar.sample_id}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Test</label>
              <select
                value={selectedTest}
                onChange={e => setSelectedTest(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, outline: 'none' }}
              >
                <option value="">Select…</option>
                {tests.filter(t => t.is_active).map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAssignModal(false)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={busy || !selectedAr || !selectedTest}
                style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0154FC', color: '#fff', fontSize: 12, fontWeight: 600, cursor: busy || !selectedAr || !selectedTest ? 'not-allowed' : 'pointer', opacity: busy || !selectedAr || !selectedTest ? 0.6 : 1 }}
              >
                {busy ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

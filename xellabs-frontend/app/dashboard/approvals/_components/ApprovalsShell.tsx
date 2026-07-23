'use client'
import { useMemo, useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { decideApproval, type Approval, type ApprovalStatus } from '@/app/actions/approvals'
import { getSample } from '@/app/actions/samples'
import { Card, Btn, MI, T, Chip } from '@/app/dashboard/_components/ui'
import DataTable, { type DataTableColumn } from '../../_components/DataTable'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDateTime(v: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function relTime(v: string | null): string {
  if (!v) return '—'
  const d = new Date(v).getTime()
  if (Number.isNaN(d)) return '—'
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h} hr${h > 1 ? 's' : ''} ago`
  const days = Math.floor(h / 24); if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`
  const mo = Math.floor(days / 30); return `${mo} month${mo > 1 ? 's' : ''} ago`
}

type Tone = 'gray' | 'blue' | 'orange' | 'green' | 'red'
function priorityTone(p: string): Tone {
  const s = (p || '').toLowerCase()
  if (s === 'high') return 'red'
  if (s === 'low') return 'gray'
  return 'orange' // medium / unknown
}

// Single-stage sign-off: the workflow "step" is derived from the decision state.
function stepLabel(status: ApprovalStatus): string {
  return status === 'approved' ? 'Completed' : status === 'rejected' ? 'Rejected' : 'Verify Results'
}
function stepTone(status: ApprovalStatus): Tone {
  return status === 'approved' ? 'green' : status === 'rejected' ? 'red' : 'blue'
}

// Sample lifecycle stepper — position derived from the sample's real SENAITE state.
const LIFECYCLE = ['Logged', 'Received', 'In Progress', 'Results Entered', 'Verification', 'Completed'] as const
function currentStep(reviewState: string | null): number {
  switch (reviewState) {
    case 'registered':
    case 'sample_due': return 1
    case 'sample_received': return 3
    case 'to_be_verified': return 4
    case 'verified': return 5
    case 'published': return 6
    default: return 5 // a pending approval sits at "verified" awaiting sign-off
  }
}

function isThisMonth(v: string | null): boolean {
  if (!v) return false
  const d = new Date(v); const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatTile({ icon, iconBg, iconColor, label, labelColor, value, sub }: {
  icon: string; iconBg: string; iconColor: string; label: string; labelColor: string; value: number; sub: string
}) {
  return (
    <div className="bg-white flex items-center gap-2.5" style={{ flex: 1, minWidth: 130, border: `1px solid ${T.cardBorder}`, borderRadius: T.cardRadius, boxShadow: T.cardShadow, padding: '10px 12px' }}>
      <div className="flex items-center justify-center shrink-0" style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: iconBg }}>
        <MI name={icon} size={15} color={iconColor} />
      </div>
      <div className="min-w-0">
        <p style={{ fontSize: 10.5, fontWeight: 600, color: labelColor, marginBottom: 1 }}>{label}</p>
        <p style={{ fontSize: 17, fontWeight: 800, color: T.heading, lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 9, color: T.faint, marginTop: 2 }}>{sub}</p>
      </div>
    </div>
  )
}

function WorkflowStepper({ reviewState }: { reviewState: string | null }) {
  const cur = currentStep(reviewState)
  return (
    <div className="flex items-start justify-between" style={{ gap: 2 }}>
      {LIFECYCLE.map((label, i) => {
        const n = i + 1
        const done = n < cur, active = n === cur
        const color = done ? T.success : active ? T.primary : '#D1D5DB'
        return (
          <div key={label} className="flex flex-col items-center" style={{ flex: 1, position: 'relative' }}>
            {i < LIFECYCLE.length - 1 && (
              <div style={{ position: 'absolute', top: 11, left: '50%', width: '100%', height: 2, backgroundColor: n < cur ? T.success : '#E5E7EB' }} />
            )}
            <div className="flex items-center justify-center" style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: done ? T.success : active ? '#EFF6FF' : '#F3F4F6', border: `2px solid ${color}`, zIndex: 1 }}>
              {done ? <MI name="check" size={13} color="#fff" /> : <div style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: color }} />}
            </div>
            <span style={{ fontSize: 9.5, fontWeight: active ? 700 : 500, color: active ? T.primary : done ? T.text : T.faint, marginTop: 5, textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ approval, currentUserId, onClose, onDone }: {
  approval: Approval
  currentUserId: string
  onClose: () => void
  onDone: (msg: string, ok: boolean) => void
}) {
  const [reviewState, setReviewState] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [comments, setComments] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  // Slide-in animation: mount at translateX(100%), flip to 0 on next tick.
  const [open, setOpen] = useState(false)
  useEffect(() => { const t = setTimeout(() => setOpen(true), 10); return () => clearTimeout(t) }, [])
  const close = () => { setOpen(false); setTimeout(onClose, 280) }

  const decided = approval.status !== 'pending'
  const isOwn = String(approval.requested_by) === String(currentUserId)

  useEffect(() => {
    let active = true
    setReviewState(null)
    if (approval.senaite_uid) {
      getSample(approval.senaite_uid).then(s => { if (active) setReviewState(s?.review_state ?? null) })
    }
    return () => { active = false }
  }, [approval.senaite_uid])

  function submit(decision: 'approve' | 'reject') {
    if (!password) { setError('Enter your password to sign this decision.'); return }
    if (decision === 'reject' && !comments.trim()) { setError('A reason is required to reject.'); return }
    setError('')
    startTransition(async () => {
      const r = await decideApproval(approval.id, decision, comments, password)
      onDone(r.message, r.success)
      if (r.success) close()
      else setError(r.message)
    })
  }

  return (
    <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', bottom: 'var(--dashboard-footer-h)', left: 0, right: 0, zIndex: 400 }}>
      {/* Dimming backdrop */}
      <div
        onClick={close}
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', opacity: open ? 1 : 0, transition: 'opacity 0.25s ease-in-out' }}
      />
      {/* Sliding panel */}
      <div
        className="bg-white flex flex-col"
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(420px, 94%)',
          boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', overflow: 'hidden',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${T.cardBorder}`, flexShrink: 0 }}>
        <h2 style={{ fontSize: 11.5, fontWeight: 700, color: T.heading }}>Approval Details</h2>
        <button onClick={close} className="p-1 rounded-lg hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
          <MI name="close" size={16} color={T.faint} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4" style={{ minHeight: 0 }}>
        <div className="flex items-center gap-2 flex-wrap">
          <Chip tone={stepTone(approval.status)}>{stepLabel(approval.status)}</Chip>
          <Chip tone={priorityTone(approval.priority)}>{(approval.priority || 'Medium')} Priority</Chip>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p style={{ fontSize: 10.5, color: T.faint }}>Sample ID</p>
            {approval.senaite_uid
              ? <Link href={`/dashboard/samples/${approval.senaite_uid}`} style={{ fontSize: 12, fontWeight: 700, color: T.primary }}>{approval.sample_id || '—'}</Link>
              : <span style={{ fontSize: 12, fontWeight: 700, color: T.heading }}>{approval.sample_id || '—'}</span>}
          </div>
          <div>
            <p style={{ fontSize: 10.5, color: T.faint }}>Client</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: T.heading }}>{approval.client_name || '—'}</p>
          </div>
        </div>
        <div>
          <p style={{ fontSize: 10.5, color: T.faint }}>Analysis</p>
          <p style={{ fontSize: 12, fontWeight: 600, color: T.heading }}>{approval.title || '—'}</p>
        </div>

        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: T.heading, marginBottom: 10 }}>Workflow Progress</p>
          <WorkflowStepper reviewState={reviewState} />
        </div>

        <div className="grid grid-cols-2 gap-3" style={{ borderTop: `1px solid ${T.rowBorder}`, paddingTop: 12 }}>
          <div>
            <p style={{ fontSize: 10.5, color: T.faint }}>Requested By</p>
            <p style={{ fontSize: 11.5, fontWeight: 600, color: T.heading }}>{approval.requested_by_name || (approval.requested_by ? `User #${approval.requested_by}` : 'System (verified)')}</p>
          </div>
          <div>
            <p style={{ fontSize: 10.5, color: T.faint }}>Requested On</p>
            <p style={{ fontSize: 11.5, fontWeight: 600, color: T.heading }}>{fmtDateTime(approval.requested_at)}</p>
          </div>
        </div>

        {decided && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p style={{ fontSize: 10.5, color: T.faint }}>Reviewed By</p>
              <p style={{ fontSize: 11.5, fontWeight: 600, color: T.heading }}>{approval.reviewed_by_name || '—'}</p>
            </div>
            <div>
              <p style={{ fontSize: 10.5, color: T.faint }}>Reviewed On</p>
              <p style={{ fontSize: 11.5, fontWeight: 600, color: T.heading }}>{fmtDateTime(approval.reviewed_at)}</p>
            </div>
          </div>
        )}

        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: T.heading, marginBottom: 6 }}>Comments</p>
          {approval.comments
            ? <div style={{ fontSize: 12, color: T.text, backgroundColor: '#F9FAFB', padding: '8px 10px', borderRadius: 8, fontStyle: 'italic' }}>&ldquo;{approval.comments}&rdquo;</div>
            : <p style={{ fontSize: 12, color: T.faint }}>No comments yet.</p>}
        </div>
      </div>

      {/* Decision footer — inline electronic signature */}
      {!decided && (
        <div className="px-4 py-3 flex flex-col gap-2" style={{ borderTop: `1px solid ${T.cardBorder}`, flexShrink: 0, backgroundColor: '#FafBFC' }}>
          {isOwn && (
            <div className="flex items-center gap-1.5" style={{ fontSize: 10.5, color: '#B45309', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', padding: '5px 8px', borderRadius: 6 }}>
              <MI name="info" size={12} color="#B45309" /> You requested this — ideally another reviewer should sign it off.
            </div>
          )}
          <textarea
            rows={2} value={comments} onChange={e => { setComments(e.target.value); setError('') }}
            placeholder="Reason / comments (required to reject)…"
            className="w-full outline-none resize-none"
            style={{ borderRadius: 8, border: `1px solid ${T.inputBorder}`, fontSize: 12, padding: '7px 10px', color: T.text }}
          />
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'} value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Digital signature — enter your password"
              className="w-full outline-none"
              style={{ height: 34, borderRadius: 8, border: `1px solid ${error ? T.danger : T.inputBorder}`, fontSize: 12, padding: '0 34px 0 10px', color: T.text }}
            />
            <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', cursor: 'pointer' }}>
              <MI name={showPw ? 'visibility_off' : 'visibility'} size={15} color={T.faint} />
            </button>
          </div>
          {error && <p style={{ fontSize: 11, color: T.danger }}>{error}</p>}
          <div className="flex items-center gap-2">
            <Btn variant="success" style={{ flex: 1, justifyContent: 'center' }} disabled={pending} onClick={() => submit('approve')}>
              <MI name={pending ? 'hourglass_top' : 'check_circle'} size={14} /> Approve
            </Btn>
            <Btn variant="danger" style={{ flex: 1, justifyContent: 'center' }} disabled={pending} onClick={() => submit('reject')}>
              <MI name="cancel" size={14} /> Reject
            </Btn>
          </div>
          <p style={{ fontSize: 9.5, color: T.faint, textAlign: 'center' }}>Approving signs the record and marks the sample as completed.</p>
        </div>
      )}
      </div>
    </div>
  )
}

// ── Main shell ───────────────────────────────────────────────────────────────

type FilterValue = 'all' | ApprovalStatus
type AssignedValue = 'all' | 'queue' | 'mine'

type ApprovalRow = Approval & { _step: string; _waitingTs: number }

export default function ApprovalsShell({ initialApprovals, currentUserId }: {
  initialApprovals: Approval[]
  currentUserId: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState<FilterValue>('pending')
  const [assigned, setAssigned] = useState<AssignedValue>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showFilters, setShowFilters] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  const isMine = useCallback((a: Approval) => String(a.requested_by) === String(currentUserId), [currentUserId])

  // Stats (honest — computed from real records)
  const stats = useMemo(() => ({
    pending: initialApprovals.filter(a => a.status === 'pending').length,
    myQueue: initialApprovals.filter(a => a.status === 'pending' && !isMine(a)).length,
    approved: initialApprovals.filter(a => a.status === 'approved' && isThisMonth(a.reviewed_at)).length,
    rejected: initialApprovals.filter(a => a.status === 'rejected' && isThisMonth(a.reviewed_at)).length,
    total: initialApprovals.length,
  }), [initialApprovals, isMine])

  const filtered = useMemo(() => {
    const fromTs = from ? new Date(from).getTime() : null
    const toTs = to ? new Date(to).getTime() + 86_400_000 : null // inclusive end-of-day
    return initialApprovals.filter(a => {
      if (status !== 'all' && a.status !== status) return false
      if (assigned === 'queue' && (a.status !== 'pending' || isMine(a))) return false
      if (assigned === 'mine' && !isMine(a)) return false
      if (fromTs || toTs) {
        const ts = a.requested_at ? new Date(a.requested_at).getTime() : 0
        if (fromTs && ts < fromTs) return false
        if (toTs && ts > toTs) return false
      }
      return true
    })
  }, [initialApprovals, status, assigned, from, to, isMine])

  const rows: ApprovalRow[] = useMemo(() => filtered.map(a => ({
    ...a,
    _step: stepLabel(a.status),
    _waitingTs: a.requested_at ? (new Date(a.requested_at).getTime() || 0) : 0,
  })), [filtered])

  const selected = useMemo(() => initialApprovals.find(a => a.id === selectedId) ?? null, [initialApprovals, selectedId])

  const recentHistory = useMemo(
    () => initialApprovals.filter(a => a.status !== 'pending')
      .sort((a, b) => new Date(b.reviewed_at ?? 0).getTime() - new Date(a.reviewed_at ?? 0).getTime())
      .slice(0, 5),
    [initialApprovals]
  )
  const myQueueList = useMemo(
    () => initialApprovals.filter(a => a.status === 'pending' && !isMine(a)).slice(0, 6),
    [initialApprovals, isMine]
  )

  function handleDone(msg: string, ok: boolean) {
    setToast({ ok, msg }); setTimeout(() => setToast(null), 5000)
    if (ok) { setSelectedId(null); router.refresh() }
  }

  function exportCsv() {
    const head = ['ID', 'Sample', 'Client', 'Analysis', 'Priority', 'Status', 'Requested By', 'Requested At', 'Reviewed By', 'Reviewed At', 'Comments']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = filtered.map(a => [a.id, a.sample_id, a.client_name, a.title, a.priority, a.status, a.requested_by_name, a.requested_at, a.reviewed_by_name, a.reviewed_at, a.comments].map(esc).join(','))
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a')
    link.href = url; link.download = 'approvals.csv'; link.click(); URL.revokeObjectURL(url)
  }

  const columns: DataTableColumn<ApprovalRow>[] = [
    { id: 'priority', label: 'Priority', sortable: true, minWidth: 100, render: a => <Chip tone={priorityTone(a.priority)}>{a.priority || 'Medium'}</Chip> },
    { id: 'sample_id', label: 'Sample ID', sortable: true, minWidth: 110, render: a => (
      a.senaite_uid
        ? <Link href={`/dashboard/samples/${a.senaite_uid}`} style={{ fontWeight: 700, color: T.primary }}>{a.sample_id || '—'}</Link>
        : <span style={{ fontWeight: 700, color: T.heading }}>{a.sample_id || '—'}</span>
    ) },
    { id: 'client_name', label: 'Client', sortable: true, minWidth: 150, render: a => a.client_name || '—' },
    { id: '_step', label: 'Workflow Step', sortable: true, minWidth: 130, render: a => <Chip tone={stepTone(a.status)}>{stepLabel(a.status)}</Chip> },
    { id: 'requested_by_name', label: 'Requested By', sortable: true, minWidth: 130, render: a => a.requested_by_name || (a.requested_by ? `User #${a.requested_by}` : 'System (verified)') },
    { id: '_waitingTs', label: 'Waiting Since', sortable: true, minWidth: 130, render: a => (
      <div><div style={{ fontSize: 12, color: T.text }}>{relTime(a.requested_at)}</div><div style={{ fontSize: 10.5, color: T.faint }}>{fmtDateTime(a.requested_at)}</div></div>
    ) },
  ]

  const selInput = { height: 28, borderRadius: 7, border: `1px solid ${T.inputBorder}`, fontSize: 11, padding: '0 8px', color: T.text, backgroundColor: '#fff' } as const

  return (
    <div style={{ padding: 16, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3" style={{ flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 800, color: T.heading, letterSpacing: '-0.02em', margin: 0 }}>Approvals</h1>
          <p style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>Review, verify and sign pending laboratory approvals</p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="outline" icon="refresh" onClick={() => router.refresh()}>Refresh</Btn>
          <Btn variant="outline" icon="filter_list" onClick={() => setShowFilters(v => !v)}>Filters</Btn>
          <Btn variant="outline" icon="download" onClick={exportCsv}>Export</Btn>
        </div>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ flexShrink: 0, backgroundColor: toast.ok ? '#ECFDF5' : '#FEF2F2', border: toast.ok ? '1px solid #A7F3D0' : '1px solid #FECACA', color: toast.ok ? '#047857' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? T.success : T.danger} />
          {toast.msg}
        </div>
      )}

      {/* Stat tiles */}
      <div className="flex items-stretch gap-2.5 mb-3 flex-wrap" style={{ flexShrink: 0 }}>
        <StatTile icon="fact_check" iconBg="#EFF6FF" iconColor={T.primary} label="Pending" labelColor={T.primary} value={stats.pending} sub="Requires action" />
        <StatTile icon="assignment_ind" iconBg="#F5F3FF" iconColor="#7C3AED" label="My Queue" labelColor="#7C3AED" value={stats.myQueue} sub="Awaiting your review" />
        <StatTile icon="check_circle" iconBg="#ECFDF5" iconColor={T.success} label="Approved" labelColor={T.success} value={stats.approved} sub="This month" />
        <StatTile icon="cancel" iconBg="#FEF2F2" iconColor={T.danger} label="Rejected" labelColor={T.danger} value={stats.rejected} sub="This month" />
        <StatTile icon="inbox" iconBg="#F3F4F6" iconColor="#4B5563" label="Total" labelColor="#4B5563" value={stats.total} sub="All time" />
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="bg-white flex items-end gap-3 mb-3 flex-wrap" style={{ flexShrink: 0, border: `1px solid ${T.cardBorder}`, borderRadius: T.cardRadius, padding: '9px 12px' }}>
          <div>
            <label style={{ fontSize: 10.5, color: T.faint, display: 'block', marginBottom: 4 }}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as FilterValue)} style={selInput}>
              <option value="all">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10.5, color: T.faint, display: 'block', marginBottom: 4 }}>Assigned To</label>
            <select value={assigned} onChange={e => setAssigned(e.target.value as AssignedValue)} style={selInput}>
              <option value="all">All Users</option><option value="queue">My Queue</option><option value="mine">Requested by me</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10.5, color: T.faint, display: 'block', marginBottom: 4 }}>From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={selInput} />
          </div>
          <div>
            <label style={{ fontSize: 10.5, color: T.faint, display: 'block', marginBottom: 4 }}>To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={selInput} />
          </div>
          {(from || to || assigned !== 'all' || status !== 'pending') && (
            <button onClick={() => { setStatus('pending'); setAssigned('all'); setFrom(''); setTo('') }} style={{ fontSize: 11, color: T.primary, background: 'none', border: 'none', cursor: 'pointer', height: 32 }}>Reset</button>
          )}
        </div>
      )}

      {/* Body: table (+ bottom panels) | detail panel */}
      <div className="flex gap-4" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div className="flex flex-col gap-4" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          <Card pad={false}>
            <div className="px-4 pt-2.5" style={{ fontSize: 11, color: T.muted }}>{filtered.length} approval{filtered.length === 1 ? '' : 's'} found</div>
            <DataTable<ApprovalRow>
              data={rows}
              columns={columns}
              searchable
              persistKey="approvals"
              emptyMessage="No approval requests match this filter. Approvals appear here once a sample is verified."
              rowActions={a => (
                <Btn variant={selectedId === a.id ? 'primary' : 'outline'} style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => setSelectedId(a.id)}>
                  <MI name="visibility" size={13} /> Review
                </Btn>
              )}
            />
          </Card>

          {/* Bottom panels */}
          <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Card title="Recent Approval History" icon="history">
              {recentHistory.length === 0 ? (
                <p style={{ fontSize: 12, color: T.faint }}>No decisions yet.</p>
              ) : (
                <div className="flex flex-col">
                  {recentHistory.map((a, i) => (
                    <div key={a.id} className="flex items-start gap-3" style={{ paddingBottom: i < recentHistory.length - 1 ? 12 : 0 }}>
                      <MI name={a.status === 'approved' ? 'check_circle' : 'cancel'} size={16} color={a.status === 'approved' ? T.success : T.danger} />
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: T.heading }}>{a.sample_id || a.senaite_uid} — {a.status === 'approved' ? 'Approved' : 'Rejected'}</div>
                        <div style={{ fontSize: 11, color: T.muted }}>by {a.reviewed_by_name || '—'} · {fmtDateTime(a.reviewed_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="My Queue" icon="assignment_ind">
              {myQueueList.length === 0 ? (
                <p style={{ fontSize: 12, color: T.faint }}>Nothing awaiting your review.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {myQueueList.map(a => (
                    <button key={a.id} onClick={() => setSelectedId(a.id)} className="flex items-center justify-between gap-2 text-left" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                      <span className="flex items-center gap-2 min-w-0">
                        <MI name="science" size={14} color={T.primary} />
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: T.primary }}>{a.sample_id || a.senaite_uid}</span>
                        <span style={{ fontSize: 11.5, color: T.muted }} className="truncate">{a.client_name}</span>
                      </span>
                      <Chip tone="blue">{stepLabel(a.status)}</Chip>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {selected && (
        <DetailPanel key={selected.id} approval={selected} currentUserId={currentUserId} onClose={() => setSelectedId(null)} onDone={handleDone} />
      )}
    </div>
  )
}

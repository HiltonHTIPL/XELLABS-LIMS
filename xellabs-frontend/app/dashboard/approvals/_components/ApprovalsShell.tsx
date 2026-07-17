'use client'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { decideApproval, type Approval, type ApprovalStatus } from '@/app/actions/approvals'
import {
  PageHeader, Card, Btn, StatusChip, EmptyState, MI, T, thStyle, tdStyle,
} from '@/app/dashboard/_components/ui'

type FilterValue = 'all' | ApprovalStatus

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function fmtDate(v: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString()
}

/** Electronic-signature confirmation modal — re-enter password before an approve/reject is applied. */
function SignatureModal({
  approval, decision, onClose, onDone,
}: {
  approval: Approval
  decision: 'approve' | 'reject'
  onClose: () => void
  onDone: (msg: string, ok: boolean) => void
}) {
  const [password, setPassword] = useState('')
  const [comments, setComments] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const isApprove = decision === 'approve'

  function submit() {
    if (!password) { setError('Password is required to sign this decision.'); return }
    setError('')
    startTransition(async () => {
      const result = await decideApproval(approval.id, decision, comments, password)
      onDone(result.message, result.success)
      if (result.success) onClose()
    })
  }

  return (
    <div
      onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1000 }}
    >
      <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', right: 0, bottom: 'var(--dashboard-footer-h)', width: 420, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isApprove ? '#ECFDF5' : '#FEF2F2' }}>
              <MI name={isApprove ? 'verified' : 'block'} size={16} color={isApprove ? T.success : T.danger} />
            </div>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: T.heading }}>
                {isApprove ? 'Approve' : 'Reject'} — Approval #{approval.id}
              </h2>
              <p style={{ fontSize: 10, color: T.faint }}>Re-enter your password to sign this decision</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
            <MI name="close" size={16} color={T.faint} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <div>
            <label className="block mb-1.5" style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
              Comments {isApprove ? '' : <span style={{ color: T.danger }}>*</span>}
            </label>
            <textarea
              rows={2}
              value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder={isApprove ? 'Optional notes…' : 'Reason for rejection…'}
              className="w-full outline-none resize-none"
              style={{ borderRadius: 10, border: `1px solid ${T.inputBorder}`, fontSize: 13, padding: '8px 12px', color: T.text }}
            />
          </div>
          <div>
            <label className="block mb-1.5" style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
              Password <span style={{ color: T.danger }}>*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Re-enter your account password"
              autoFocus
              className="w-full outline-none"
              style={{ height: 36, borderRadius: 10, border: `1px solid ${error ? T.danger : T.inputBorder}`, fontSize: 13, padding: '0 12px', color: T.text }}
            />
            {error && <p className="mt-1" style={{ fontSize: 11, color: T.danger }}>{error}</p>}
            <p className="mt-1.5" style={{ fontSize: 10.5, color: T.faint }}>
              This confirms your identity as an electronic signature for this decision.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <Btn variant="outline" onClick={onClose} disabled={pending}>Cancel</Btn>
          <Btn variant={isApprove ? 'success' : 'danger'} onClick={submit} disabled={pending || (!isApprove && !comments)}>
            <MI name={pending ? 'hourglass_top' : 'draw'} size={14} />
            {pending ? 'Signing…' : isApprove ? 'Sign & Approve' : 'Sign & Reject'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

export default function ApprovalsShell({ initialApprovals }: { initialApprovals: Approval[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterValue>('pending')
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [modal, setModal] = useState<{ approval: Approval; decision: 'approve' | 'reject' } | null>(null)

  const filtered = useMemo(
    () => filter === 'all' ? initialApprovals : initialApprovals.filter(a => a.status === filter),
    [initialApprovals, filter]
  )

  function handleDone(msg: string, ok: boolean) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4000)
    if (ok) router.refresh()
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0 }}>
      <PageHeader
        title="Approvals"
        subtitle="Review and sign pending approval requests"
        backHref="/dashboard/admin"
      />

      {toast && (
        <div
          className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{
            backgroundColor: toast.ok ? '#ECFDF5' : '#FEF2F2',
            border: toast.ok ? '1px solid #A7F3D0' : '1px solid #FECACA',
            color: toast.ok ? '#047857' : '#991B1B',
          }}
        >
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? T.success : T.danger} />
          {toast.msg}
        </div>
      )}
      </div>

      <div className="flex items-center gap-2 mb-4" style={{ flexShrink: 0 }}>
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${filter === f.value ? T.primary : T.inputBorder}`,
              backgroundColor: filter === f.value ? T.primary : '#fff',
              color: filter === f.value ? '#fff' : T.text,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <Card pad={false}>
        {filtered.length === 0 ? (
          <EmptyState icon="fact_check" title="No approvals" sub="There are no approval requests matching this filter." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Subject</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Requested By</th>
                  <th style={thStyle}>Requested At</th>
                  <th style={thStyle}>Reviewed By</th>
                  <th style={thStyle}>Reviewed At</th>
                  <th style={thStyle}>Comments</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id}>
                    <td style={tdStyle}>#{a.id}</td>
                    <td style={tdStyle}>
                      Content type #{a.content_type} · Object #{a.object_id}
                    </td>
                    <td style={tdStyle}><StatusChip status={a.status} /></td>
                    <td style={tdStyle}>User #{a.requested_by}</td>
                    <td style={tdStyle}>{fmtDate(a.requested_at)}</td>
                    <td style={tdStyle}>{a.reviewed_by ? `User #${a.reviewed_by}` : '—'}</td>
                    <td style={tdStyle}>{fmtDate(a.reviewed_at)}</td>
                    <td style={tdStyle} className="max-w-xs truncate">{a.comments || '—'}</td>
                    <td style={tdStyle}>
                      {a.status === 'pending' ? (
                        <div className="flex items-center gap-1.5">
                          <Btn variant="success" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => setModal({ approval: a, decision: 'approve' })}>
                            <MI name="check" size={13} /> Approve
                          </Btn>
                          <Btn variant="danger" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => setModal({ approval: a, decision: 'reject' })}>
                            <MI name="close" size={13} /> Reject
                          </Btn>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </div>

      {modal && (
        <SignatureModal
          approval={modal.approval}
          decision={modal.decision}
          onClose={() => setModal(null)}
          onDone={handleDone}
        />
      )}
    </div>
  )
}

'use client'
import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SenaiteSample, mapSenaiteState, mapSenaitePriority } from '@/app/lib/senaite'
import { receiveSample, verifySample, getSampleReviewHistory } from '@/app/actions/samples'
import { getAuditEvents } from '@/app/actions/audit-trail'
import { getLabSampleBySenaiteUid, type LabSample } from '@/app/actions/lab-samples'
import { EditDrawer } from '../../../samples-overview/[id]/_components/SampleOverviewDetail'
import ChainOfCustodyDrawer from '../../../samples-overview/[id]/_components/ChainOfCustodyDrawer'
import LiveBarcode from '../../../_components/LiveBarcode'
import { T, MI, Breadcrumb, Btn, StatusChip } from '../../../_components/ui'
import type { CSSProperties } from 'react'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return d }
}

function fmtShort(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return d }
}

// Local presentation atoms mirroring the Sample Overview detail layout so both
// sample-detail pages read the same (DRY on look; each keeps its own data source).
const th: CSSProperties = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: `1px solid ${T.cardBorder}`, whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '10px 12px', fontSize: 12, color: T.text, borderBottom: `1px solid ${T.rowBorder}`, whiteSpace: 'nowrap' }
const cardStyle: CSSProperties = { background: '#fff', borderRadius: 12, border: `1px solid ${T.cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const secTitle: CSSProperties = { fontSize: 13, fontWeight: 700, color: T.heading, margin: 0 }

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${T.rowBorder}`, gap: 8 }}>
      <span style={{ fontSize: 12, color: T.faint }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  )
}

// Friendly labels for the Django-bridged action names (see
// logExternalAuditEvent call sites in app/actions/samples.ts and
// senaite-worksheets.ts) — shown in place of the raw "Transition: <action>"
// SENAITE's own review-history entries get.
const BRIDGED_ACTION_LABEL: Record<string, string> = {
  assign_to_worksheet: 'Analysis Assigned to Worksheet',
  remove_from_worksheet: 'Analysis Removed from Worksheet',
  receive: 'Sample Received',
  verify: 'Sample Verified',
  publish: 'Sample Published',
  cancel: 'Sample Cancelled',
  create: 'Sample Created',
  submit: 'Result Submitted',
}

function bridgedEventComment(ev: { extra_data: Record<string, unknown> | null }): string {
  const extra = ev.extra_data ?? {}
  const title = extra.title as string | undefined
  const worksheetId = extra.worksheetId as string | undefined
  if (title && worksheetId) return `${title} — Worksheet ${worksheetId}`
  if (worksheetId) return `Worksheet ${worksheetId}`
  return ''
}

type Props = { sample: SenaiteSample | null; uid: string; loading?: boolean; onClose?: () => void }

export default function SampleDetailClient({ sample, uid, loading }: Props) {
  const router = useRouter()
  const [showAuditTrail, setShowAuditTrail] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [auditHistory, setAuditHistory] = useState<any[]>([])

  useEffect(() => {
    if (!sample?.uid) return
    // Two sources, merged: SENAITE's own @history (workflow transitions —
    // receive/verify/publish/etc. driven through the AR itself) and Django's
    // AuditEvent table (bridged log_external rows — actions like assigning
    // this sample's analysis to a Worksheet happen entirely against
    // SENAITE's REST API and never touch the AR's own history at all, so
    // without this second source they'd never show up here).
    Promise.all([
      getSampleReviewHistory(sample.uid),
      sample.id ? getAuditEvents({ object_repr_contains: sample.id }) : Promise.resolve([]),
    ]).then(([reviewHistory, bridgedEvents]) => {
      const bridged = bridgedEvents.map(ev => ({
        action: ev.action,
        actor: ev.user_display ?? 'System',
        comments: bridgedEventComment(ev),
        review_state: '',
        time: ev.timestamp,
      }))
      const merged = [...(reviewHistory || []), ...bridged]
      merged.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      setAuditHistory(merged)
    })
  }, [sample?.uid, sample?.id])

  // The Django-mirrored LabSample (same record this SENAITE sample syncs
  // with) — resolved from the SENAITE uid (neither caller of this component
  // has a Django id on hand), so Edit Sample / Storage History match the
  // button row already offered on the Django-only Sample Detail view
  // (SampleOverviewDetail).
  const [labSample, setLabSample] = useState<LabSample | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showChainOfCustody, setShowChainOfCustody] = useState(false)
  // Set client-side only so TAT (which depends on "now") never causes an
  // SSR/client hydration mismatch.
  const [nowMs, setNowMs] = useState<number | null>(null)
  useEffect(() => { setNowMs(Date.now()) }, [])
  useEffect(() => {
    let active = true
    if (sample?.uid) {
      getLabSampleBySenaiteUid(sample.uid).then(s => { if (active) setLabSample(s) })
    } else {
      setLabSample(null)
    }
    return () => { active = false }
  }, [sample?.uid])

  function openStorageHistory() {
    setTimeout(() => document.getElementById('storage-info')?.scrollIntoView({ behavior: 'smooth' }), 0)
  }

  function doAction(fn: (uid: string) => Promise<{ success: boolean; message: string }>) {
    startTransition(async () => {
      const result = await fn(uid)
      setActionMsg({ text: result.message, ok: result.success })
      setTimeout(() => setActionMsg(null), 3000)
      if (result.success) router.refresh()
    })
  }

  if (!sample) {
    if (loading) {
      return (
        <div className="flex items-center justify-center" style={{ backgroundColor: T.pageBg, minHeight: '100%' }}>
          <div style={{ fontSize: 13, color: T.muted }}>Loading sample details...</div>
        </div>
      )
    }
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', backgroundColor: T.pageBg, minHeight: '100%' }}>
        <MI name="science" size={48} color={T.cardBorder} />
        <p style={{ fontSize: 16, color: T.muted, marginTop: 12 }}>Sample not found</p>
        <p style={{ fontSize: 13, color: T.faint }}>UID: {uid}</p>
        <Link href="/dashboard/samples-overview" style={{ fontSize: 13, color: T.primary, marginTop: 16, display: 'inline-block' }}>← Back to Samples</Link>
      </div>
    )
  }

  const stateLabel    = mapSenaiteState(sample.review_state)
  const priorityLabel = mapSenaitePriority(sample.Priority)
  const canReceive = sample.review_state === 'registered' || sample.review_state === 'sample_due'
  const canVerify  = sample.review_state === 'to_be_verified'
  const canPublish = sample.review_state === 'verified'
  const pastRetention = !!labSample?.expiry_date && nowMs !== null && new Date(labSample.expiry_date).getTime() < nowMs

  return (
    <div style={{ padding: 20, minHeight: '100%', backgroundColor: T.pageBg }}>

      {/* Toast */}
      {actionMsg && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl flex items-center gap-2"
          style={{ backgroundColor: actionMsg.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${actionMsg.ok ? '#93C5FD' : '#FECACA'}`, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
          <MI name={actionMsg.ok ? 'check_circle' : 'error_outline'} size={16} color={actionMsg.ok ? T.success : T.danger} />
          <span style={{ fontSize: 13, color: actionMsg.ok ? '#0154FC' : '#991B1B' }}>{actionMsg.text}</span>
        </div>
      )}

      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: 'Samples', href: '/dashboard/samples-overview' }, { label: 'Sample Detail' }]} />

      {/* Title row */}
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.heading, letterSpacing: '-0.02em', margin: 0 }}>Sample Detail</h1>
        <div className="flex items-center gap-2">
          <Btn variant="primary" icon="edit" onClick={() => router.push(`/dashboard/samples-overview/new?edit=${labSample!.id}`)} disabled={!labSample}>Edit Sample</Btn>
          <Btn variant="outline" icon="inventory_2" onClick={openStorageHistory}>Storage History</Btn>
          <Btn variant="outline" icon="shield" onClick={() => setShowAuditTrail(true)}>Audit Trail</Btn>
          <Btn variant="outline" icon="link" onClick={() => setShowChainOfCustody(true)}>Chain of Custody</Btn>
          <Btn variant="outline" icon="print" onClick={() => window.print()}>Print</Btn>
          {canReceive && <Btn variant="success" icon="move_to_inbox" onClick={() => doAction(receiveSample)} disabled={isPending}>Receive</Btn>}
          {canVerify  && <Btn style={{ backgroundColor: '#6366F1', color: '#fff' }} icon="verified" onClick={() => doAction(verifySample)} disabled={isPending}>Verify</Btn>}
          {canPublish && (
            <span className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, color: '#B45309', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', padding: '7px 12px', borderRadius: 8 }}>
              <MI name="pending_actions" size={15} color="#B45309" /> Awaiting Approval
            </span>
          )}
        </div>
      </div>

      {showEdit && labSample && (
        <EditDrawer sample={labSample} onClose={() => setShowEdit(false)} onSaved={() => router.refresh()} />
      )}

      {showChainOfCustody && (
        <ChainOfCustodyDrawer sampleId={sample.id} open={showChainOfCustody} onClose={() => setShowChainOfCustody(false)} />
      )}

      {/* Retention banner */}
      {pastRetention && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs mb-4"
          style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
          <MI name="schedule" size={16} color="#DC2626" />
          <span>
            Past retention — due date {fmtShort(labSample?.expiry_date ?? null)} has passed.
            Dispose the sample and record the regulatory basis for compliance documentation.
          </span>
        </div>
      )}

      {/* Hero card */}
      <div style={{ ...cardStyle, padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Icon + ID + chips */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', paddingRight: 20, borderRight: `1px solid ${T.cardBorder}` }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MI name="science" size={28} color={T.primary} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: T.heading }}>{sample.id}</span>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                  onClick={() => navigator.clipboard?.writeText(sample.id)}>
                  <MI name="content_copy" size={14} color={T.faint} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <StatusChip status={stateLabel} />
                {priorityLabel !== 'Normal' && <StatusChip status={priorityLabel} />}
                {labSample?.hold_for_qa && <StatusChip status="On Hold for QA" />}
              </div>
            </div>
          </div>

          {/* Meta grid */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
            {[
              { label: 'Client', value: sample.ClientTitle },
              { label: 'Batch / Project', value: labSample?.batch_id },
              { label: 'Sample Type', value: sample.SampleTypeTitle },
              { label: 'Priority', value: priorityLabel },
            ].map((m, i, arr) => (
              <div key={m.label} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length - 1 ? `1px solid ${T.cardBorder}` : 'none', padding: '0 14px' }}>
                <p style={{ fontSize: 11, color: T.faint, margin: '0 0 4px' }}>{m.label}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: m.label === 'Priority' && priorityLabel === 'High' ? '#DC2626' : T.heading, margin: 0, textTransform: 'capitalize' }}>{m.value || '—'}</p>
              </div>
            ))}
          </div>

          {/* Barcode */}
          <div style={{ textAlign: 'center', paddingLeft: 20, borderLeft: `1px solid ${T.cardBorder}` }}>
            <p style={{ fontSize: 11, color: T.faint, margin: '0 0 6px' }}>Sample Bar Code</p>
            <div style={{ height: 32, width: 160 }}><LiveBarcode value={labSample?.barcode || sample.id} height={32} /></div>
            <p style={{ fontSize: 11, fontWeight: 600, color: T.heading, margin: '4px 0 0', letterSpacing: '0.05em' }}>{sample.id}</p>
          </div>
        </div>

        {/* second meta row */}
        <div style={{ display: 'flex', marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.cardBorder}`, gap: 14, flexWrap: 'wrap' }}>
          {[
            { label: 'Collected On', value: fmtDate(sample.DateSampled) },
            { label: 'Received On', value: fmtDate(sample.DateReceived) },
            { label: 'Due Date', value: fmtShort(sample.DateDue), icon: 'event' },
            { label: 'Received By', value: labSample?.received_by_name },
            // TAT counts from receipt (same as the samples list), not collection.
            { label: 'TAT (Days)', value: sample.DateReceived && nowMs !== null ? String(Math.max(0, Math.floor((nowMs - new Date(sample.DateReceived).getTime()) / 86400000))) : '—' },
          ].map((m, i, arr) => (
            <div key={m.label} style={{ flex: 1, minWidth: 130, textAlign: 'center', borderRight: i < arr.length - 1 ? `1px solid ${T.cardBorder}` : 'none' }}>
              <p style={{ fontSize: 11, color: T.faint, margin: '0 0 4px' }}>{m.label}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: T.heading, margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {m.icon && <MI name={m.icon} size={13} color={T.faint} />}{m.value || '—'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Sample Info + Requested Analyses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: 16, marginBottom: 16 }}>
        <div style={{ ...cardStyle, padding: 18, minWidth: 0 }}>
          <p style={{ ...secTitle, marginBottom: 8 }}>Sample Information</p>
          <InfoRow label="Matrix" value={sample.SampleTypeTitle} />
          <InfoRow label="Container" value={labSample?.container_type ?? ''} />
          <InfoRow label="Collection Point" value={labSample?.sample_point ?? ''} />
          <InfoRow label="Collected By" value={labSample?.contact_name ?? ''} />
          <InfoRow label="Received By" value={labSample?.received_by_name ?? ''} />
          <InfoRow label="Receipt Condition" value={labSample?.condition ?? ''} />
          <InfoRow label="Barcode / Accession" value={labSample?.barcode || sample.id} />
          <InfoRow label="Client ID" value={sample.ClientID} />
          <InfoRow label="Client Sample ID" value={sample.ClientSampleID} />
          <InfoRow label="Current Storage Location" value={labSample?.storage_location || 'Not stored yet'} />
          <InfoRow label="Preferred Storage Location" value={labSample?.preferred_storage_location ?? ''} />
          <InfoRow label="Preservation" value={labSample?.preservation ?? ''} />
          <InfoRow label="Sample Notes" value={labSample?.description ?? ''} />
        </div>

        <div style={{ ...cardStyle, overflow: 'hidden', minWidth: 0 }}>
          <p style={{ ...secTitle, padding: '14px 18px 10px' }}>Requested Analyses ({sample.Analyses.length})</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Test / Method', 'Keyword', 'Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {sample.Analyses.length === 0 ? (
                  <tr><td colSpan={3} style={{ ...td, textAlign: 'center', color: T.faint, padding: '24px 12px' }}>No analyses requested yet.</td></tr>
                ) : sample.Analyses.map((a, i) => (
                  <tr key={`${a.uid}-${i}`}>
                    <td style={{ ...td, fontWeight: 600 }}>{a.title}</td>
                    <td style={{ ...td, color: T.muted }}>{a.Keyword}</td>
                    <td style={td}><StatusChip status={mapSenaiteState(a.review_state)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Storage Information + Documents */}
      <div id="storage-info" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 16 }}>
        <div style={{ ...cardStyle, overflow: 'hidden', minWidth: 0 }}>
          <p style={{ ...secTitle, padding: '14px 18px 10px' }}>Storage Information</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Location', 'Requirement', 'Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {labSample?.storage_location ? (
                  <tr>
                    <td style={{ ...td, fontWeight: 600, color: T.primary }}>{labSample.storage_location}</td>
                    <td style={td}>—</td>
                    <td style={td}><StatusChip status="Active" /></td>
                  </tr>
                ) : (
                  <tr><td colSpan={3} style={{ ...td, textAlign: 'center', color: T.faint, padding: '24px 12px' }}>No storage location assigned yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 18, minWidth: 0 }}>
          <p style={{ ...secTitle, marginBottom: 10 }}>Documents</p>
          {labSample?.attachment_url ? (
            <a href={labSample.attachment_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ border: `1px solid ${T.cardBorder}`, textDecoration: 'none', backgroundColor: '#F9FAFB' }}>
              <MI name="description" size={18} color="#0154FC" />
              <span style={{ fontSize: 12, fontWeight: 600, color: T.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {decodeURIComponent(labSample.attachment_url.split('/').pop() ?? 'Attachment')}
              </span>
              <MI name="open_in_new" size={13} color={T.faint} />
            </a>
          ) : (
            <div style={{ textAlign: 'center', padding: '18px 0', color: T.faint }}>
              <MI name="description" size={28} color="#D1D5DB" />
              <p style={{ fontSize: 12, marginTop: 8 }}>No documents uploaded for this sample yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Audit Trail Drawer */}
      <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', bottom: 'var(--dashboard-footer-h)', left: 0, right: 0, zIndex: 300, pointerEvents: showAuditTrail ? 'auto' : 'none' }}>
        <div
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', opacity: showAuditTrail ? 1 : 0, transition: 'opacity 0.2s ease-in-out' }}
          onClick={() => setShowAuditTrail(false)}
        />
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(560px, 92%)', backgroundColor: '#fff',
          boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
          transform: showAuditTrail ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)' 
        }}>
          <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
            <div className="flex items-center gap-2 text-[#14265E]">
              <MI name="shield" size={20} />
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Audit Trail</h2>
            </div>
            <button onClick={() => setShowAuditTrail(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#374151' }}>
              <MI name="close" size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            {auditHistory.length === 0 ? (
              <div className="text-center py-10">
                <MI name="history" size={48} color="#D1D5DB" />
                <p className="text-sm font-medium text-gray-900 mt-4">No History</p>
                <p className="text-xs text-gray-500 mt-1">There are no audit events recorded for this sample.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {auditHistory.map((entry, idx) => (
                  <div key={idx} className="flex gap-4 group">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full border-2 border-white box-content z-10 mt-1" style={{ backgroundColor: '#0154FC' }} />
                      {idx < auditHistory.length - 1 && (
                        <div className="w-[2px] flex-1 bg-gray-200 my-1" />
                      )}
                    </div>
                    <div className="pb-6 flex-1">
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>
                        {BRIDGED_ACTION_LABEL[entry.action] ?? entry.transition_title
                          ?? (entry.action ? `Transition: ${entry.action}` : 'Created')}
                      </div>
                      <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>
                        {fmtDate(entry.time)} by <span style={{ fontWeight: 500 }}>{entry.actor}</span>
                      </div>
                      {(entry.state_title || entry.review_state) && (
                        <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, backgroundColor: '#EFF6FF', color: T.primary, fontWeight: 500 }}>
                          Status: {entry.state_title || mapSenaiteState(entry.review_state)}
                        </div>
                      )}
                      {entry.detail && (
                        <div style={{ marginTop: 6, fontSize: 12, color: T.text }}>
                          {entry.detail}
                        </div>
                      )}
                      {entry.comments && (
                        <div style={{ marginTop: 6, fontSize: 12, color: T.text, backgroundColor: '#F9FAFB', padding: '6px 10px', borderRadius: 6, fontStyle: 'italic' }}>
                          "{entry.comments}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

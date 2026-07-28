'use client'
import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import JsBarcode from 'jsbarcode'
import { SenaiteSample, mapSenaiteState, mapSenaitePriority } from '@/app/lib/senaite'
import { receiveSample, verifySample } from '@/app/actions/samples'
import { getLabSampleBySenaiteUid, type LabSample } from '@/app/actions/lab-samples'
import { getAnalysisRequestsForSample } from '@/app/actions/analysis-requests'
import { EditDrawer } from '../../../samples-overview/[id]/_components/SampleOverviewDetail'
import ChainOfCustodyDrawer from '../../../samples-overview/[id]/_components/ChainOfCustodyDrawer'
import LiveBarcode from '../../../_components/LiveBarcode'
import { T, MI, Breadcrumb, Btn, StatusChip } from '../../../_components/ui'
import type { CSSProperties } from 'react'

// Pin timeZone explicitly — without it, toLocaleString() uses the runtime's
// own local timezone, which is UTC on the server (Docker container) but the
// browser's local zone (e.g. IST, UTC+5:30) on the client. That produces two
// different strings for the exact same date and fails SSR hydration (React
// "server rendered text didn't match the client", confirmed live — a
// consistent ~5.5hr offset). Fixing the zone makes server and client agree.
function fmtDate(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) }
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

type Props = { sample: SenaiteSample | null; uid: string; loading?: boolean; onClose?: () => void }

export default function SampleDetailClient({ sample, uid, loading }: Props) {
  const router = useRouter()
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  // The Django-mirrored LabSample (same record this SENAITE sample syncs
  // with) — resolved from the SENAITE uid (neither caller of this component
  // has a Django id on hand), so Edit Sample / Storage History match the
  // button row already offered on the Django-only Sample Detail view
  // (SampleOverviewDetail).
  const [labSample, setLabSample] = useState<LabSample | null>(null)
  // The Django-local AnalysisRequest record for this sample — its ar_id
  // (e.g. "AR-20260723-0007") is the real per-sample request identifier
  // used elsewhere in the app (Administration > Analysis Requests). SENAITE
  // itself has no separate "AR id" concept (Sample and AnalysisRequest are
  // the same object there), so this only exists in the Django mirror.
  const [arId, setArId] = useState<string | null>(null)
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
  useEffect(() => {
    let active = true
    if (labSample?.id) {
      getAnalysisRequestsForSample(labSample.id).then(ars => { if (active) setArId(ars[0]?.ar_id ?? null) })
    } else {
      setArId(null)
    }
    return () => { active = false }
  }, [labSample?.id])

  function openStorageHistory() {
    setTimeout(() => document.getElementById('storage-info')?.scrollIntoView({ behavior: 'smooth' }), 0)
  }

  // Dedicated barcode-label print — mirrors Storage Manager's Print Location
  // Label pattern (render off-screen, hand a data URL to a small popup that
  // auto-prints) instead of window.print()-ing the whole Sample Detail page.
  function handlePrintBarcode() {
    if (!sample) return
    const code = labSample?.barcode || sample.id
    const canvas = document.createElement('canvas')
    try {
      JsBarcode(canvas, code, { format: 'CODE128', height: 60, width: 2, displayValue: false, margin: 0 })
    } catch {
      setActionMsg({ text: 'Unable to generate barcode for this sample.', ok: false })
      setTimeout(() => setActionMsg(null), 3000)
      return
    }
    const dataUrl = canvas.toDataURL('image/png')
    const w = window.open('', '_blank', 'width=420,height=320')
    if (!w) {
      setActionMsg({ text: 'Pop-up blocked — allow pop-ups to print the barcode.', ok: false })
      setTimeout(() => setActionMsg(null), 3000)
      return
    }
    w.document.write(`<!doctype html><html><head><title>Sample Barcode</title>
      <style>body{font-family:Arial,sans-serif;text-align:center;padding:24px}img{width:260px;height:60px}
      h2{margin:8px 0 2px;font-size:16px}p{margin:2px 0;color:#444;font-size:12px}.code{font-size:14px;font-weight:700;letter-spacing:1px;margin-top:6px}</style>
      </head><body>
      <img src="${dataUrl}" />
      <h2>${sample.id}</h2>
      <p>${sample.ClientTitle || ''}${sample.ClientTitle ? ' · ' : ''}${sample.SampleTypeTitle || ''}</p>
      <div class="code">${code}</div>
      <script>window.onload=function(){window.print()}</script>
      </body></html>`)
    w.document.close()
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
          <Btn variant="outline" icon="shield" onClick={() => router.push(`/dashboard/samples/${uid}/audit-trail`)}>Audit Trail</Btn>
          <Btn variant="outline" icon="link" onClick={() => setShowChainOfCustody(true)}>Chain of Custody</Btn>
          <Btn variant="outline" icon="print" onClick={handlePrintBarcode}>Print</Btn>
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
              <thead><tr>{['Analysis Request ID', 'Test / Method', 'Keyword', 'Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {sample.Analyses.length === 0 ? (
                  <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: T.faint, padding: '24px 12px' }}>No analyses requested yet.</td></tr>
                ) : sample.Analyses.map((a, i) => (
                  <tr key={`${a.uid}-${i}`}>
                    {/* getRequestID() on every SENAITE Analysis just returns
                        the parent sample's own id (correct per SENAITE's
                        model — Sample and AnalysisRequest are one object
                        there — but useless to show here since it's
                        identical to this page's own title on every row).
                        The real per-sample "AR ID" (e.g. "AR-20260723-0007",
                        matching Administration > Analysis Requests) lives on
                        the Django-local AnalysisRequest record instead. */}
                    <td style={{ ...td, color: T.primary, fontWeight: 600 }}>{arId ?? sample.id}</td>
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

    </div>
  )
}

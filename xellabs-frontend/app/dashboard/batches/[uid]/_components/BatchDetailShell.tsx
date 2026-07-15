'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { type SenaiteBatch, type SenaiteSample, type SenaiteAnalysisFull, mapSenaiteState, mapSenaitePriority } from '@/app/lib/senaite'
import { receiveSample, cancelSample } from '@/app/actions/samples'
import { getAnalysesByUids, submitBatchResult, getUnassignedSamples, assignSamplesToBatch } from '@/app/actions/batches'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function StatusBadge({ state }: { state: string }) {
  const MAP: Record<string, { label: string; bg: string; color: string }> = {
    open:      { label: 'Open',      bg: '#DCFCE7', color: '#15803D' },
    closed:    { label: 'Closed',    bg: '#F3F4F6', color: '#374151' },
    cancelled: { label: 'Cancelled', bg: '#FEF2F2', color: '#991B1B' },
  }
  const s = MAP[state] ?? { label: state, bg: '#F3F4F6', color: '#374151' }
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function SampleStateBadge({ state }: { state: string }) {
  const MAP: Record<string, { bg: string; color: string }> = {
    sample_due:      { bg: '#FEF3C7', color: '#92400E' },
    sample_received: { bg: '#DBEAFE', color: '#1D4ED8' },
    to_be_verified:  { bg: '#EDE9FE', color: '#6D28D9' },
    verified:        { bg: '#DCFCE7', color: '#15803D' },
    published:       { bg: '#DCFCE7', color: '#15803D' },
    cancelled:       { bg: '#FEF2F2', color: '#991B1B' },
    rejected:        { bg: '#FEF2F2', color: '#991B1B' },
    invalid:         { bg: '#FEF2F2', color: '#991B1B' },
  }
  const s = MAP[state] ?? { bg: '#F3F4F6', color: '#374151' }
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>
      {mapSenaiteState(state)}
    </span>
  )
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function BatchDetailShell({
  batch, samples, djangoIdByUid,
}: {
  batch: SenaiteBatch
  samples: SenaiteSample[]
  djangoIdByUid: Record<string, number>
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [, startTransition] = useTransition()

  // Results entry
  const [resultsOpen, setResultsOpen] = useState(false)
  const [resultsLoading, setResultsLoading] = useState(false)
  const [resultsList, setResultsList] = useState<SenaiteAnalysisFull[]>([])
  const [resultsValues, setResultsValues] = useState<Record<string, string>>({})
  const [resultsSubmitting, setResultsSubmitting] = useState(false)

  // Add Samples — pick existing samples with no Batch assigned yet
  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addCandidates, setAddCandidates] = useState<SenaiteSample[]>([])
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set())
  const [addSearch, setAddSearch] = useState('')
  const [addSubmitting, setAddSubmitting] = useState(false)

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function toggle(uid: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid); else next.add(uid)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev => prev.size === samples.length ? new Set() : new Set(samples.map(s => s.uid)))
  }

  // Only samples still in "Sample Due" can be received — matches SENAITE's own
  // workflow guard, avoids firing a transition that's guaranteed to be rejected.
  const selectedSamples = samples.filter(s => selected.has(s.uid))
  const receivableCount = selectedSamples.filter(s => s.review_state === 'sample_due').length
  const cancellableCount = selectedSamples.filter(s => !['cancelled', 'invalid', 'rejected'].includes(s.review_state)).length

  function runBulk(action: (uid: string) => Promise<{ success: boolean; message: string }>, eligible: SenaiteSample[], doneMsg: string) {
    if (eligible.length === 0) return
    setBusy(true)
    startTransition(async () => {
      const results = await Promise.all(eligible.map(s => action(s.uid)))
      const failed = results.filter(r => !r.success)
      setBusy(false)
      setSelected(new Set())
      if (failed.length > 0) {
        showToast(false, `${failed.length} of ${eligible.length} failed: ${failed[0].message}`)
      } else {
        showToast(true, `${eligible.length} sample${eligible.length > 1 ? 's' : ''} ${doneMsg}.`)
      }
      router.refresh()
    })
  }

  function handleReceive() {
    runBulk(receiveSample, selectedSamples.filter(s => s.review_state === 'sample_due'), 'received')
  }
  function handleCancel() {
    runBulk(cancelSample, selectedSamples.filter(s => !['cancelled', 'invalid', 'rejected'].includes(s.review_state)), 'cancelled')
  }

  async function openResults() {
    // Each SenaiteSample's own Analyses[].uid list is trustworthy object data
    // (not a broken search filter — see getAnalysesByUids) so gather every
    // analysis uid across the selected samples and enrich with full details.
    const uids = Array.from(new Set(selectedSamples.flatMap(s => s.Analyses.map(a => a.uid))))
    setResultsOpen(true)
    setResultsLoading(true)
    const analyses = await getAnalysesByUids(uids)
    setResultsList(analyses)
    setResultsValues({})
    setResultsLoading(false)
  }

  function closeResults() {
    setResultsOpen(false)
    setResultsList([])
    setResultsValues({})
  }

  async function submitResults() {
    const entries = Object.entries(resultsValues).filter(([, v]) => v.trim() !== '')
    if (entries.length === 0) { closeResults(); return }
    setResultsSubmitting(true)
    const outcomes = await Promise.all(entries.map(([uid, value]) => submitBatchResult(uid, value)))
    const failed = outcomes.filter(o => !o.success)
    setResultsSubmitting(false)
    closeResults()
    if (failed.length > 0) {
      showToast(false, `${failed.length} of ${entries.length} result(s) failed: ${failed[0].message}`)
    } else {
      showToast(true, `${entries.length} result${entries.length > 1 ? 's' : ''} submitted.`)
    }
    setSelected(new Set())
    router.refresh()
  }

  // batch.ClientUID scopes the picker to that client; an unassigned batch (no
  // client) shows every unbatched sample across all clients — per spec.
  async function openAdd() {
    setAddOpen(true)
    setAddLoading(true)
    const candidates = await getUnassignedSamples(batch.ClientUID || undefined)
    setAddCandidates(candidates)
    setAddSelected(new Set())
    setAddSearch('')
    setAddLoading(false)
  }

  function closeAdd() {
    setAddOpen(false)
    setAddCandidates([])
    setAddSelected(new Set())
  }

  function toggleAddSelected(uid: string) {
    setAddSelected(prev => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid); else next.add(uid)
      return next
    })
  }

  const addFiltered = addCandidates.filter(s => {
    const q = addSearch.trim().toLowerCase()
    if (!q) return true
    return (s.id || s.title).toLowerCase().includes(q) || s.ClientTitle.toLowerCase().includes(q) || s.SampleTypeTitle.toLowerCase().includes(q)
  })

  async function submitAdd() {
    if (addSelected.size === 0) { closeAdd(); return }
    setAddSubmitting(true)
    const result = await assignSamplesToBatch(batch.uid, Array.from(addSelected))
    setAddSubmitting(false)
    closeAdd()
    showToast(result.success, result.message)
    router.refresh()
  }

  const toolbarBtn = {
    fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8,
    border: '1px solid #D1D5DB', background: '#fff', color: '#374151', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <button onClick={() => router.push('/dashboard/batches')} className="flex items-center gap-1 mb-2" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 13, padding: 0 }}>
        <MI name="arrow_back" size={16} color="#6B7280" /> Back to Batches
      </button>

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
            <MI name="layers" size={22} color="#0154FC" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>{batch.title}</h1>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>{batch.id}</span>
              <StatusBadge state={batch.review_state} />
            </div>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
              {batch.ClientTitle ? `${batch.ClientTitle}${batch.ClientID ? ` (${batch.ClientID})` : ''}` : 'No client assigned'}
              {batch.ClientBatchID ? ` · Client Batch ID: ${batch.ClientBatchID}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ backgroundColor: '#fff', color: '#374151', border: '1px solid #D1D5DB', cursor: 'pointer' }}>
            <MI name="playlist_add" size={15} color="#374151" /> Add Samples
          </button>
          <Link href={`/dashboard/samples-overview/new?batch=${batch.uid}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC', textDecoration: 'none' }}>
            <MI name="add" size={15} color="#fff" /> Create Sample
          </Link>
        </div>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Samples', value: samples.length, icon: 'science' },
          { label: 'Progress', value: `${batch.getProgress}%`, icon: 'trending_up' },
          { label: 'Date', value: fmtDate(batch.BatchDate), icon: 'event' },
          { label: 'Created', value: fmtDate(batch.created), icon: 'schedule' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl p-3" style={{ border: '1px solid #E8EAF2' }}>
            <div className="flex items-center gap-2 mb-1">
              <MI name={card.icon} size={14} color="#9CA3AF" />
              <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{card.value}</div>
          </div>
        ))}
      </div>

      {(batch.description || batch.Remarks) && (
        <div className="bg-white rounded-xl p-3 mb-4" style={{ border: '1px solid #E8EAF2' }}>
          {batch.description && <p className="text-xs" style={{ color: '#374151' }}>{batch.description}</p>}
          {batch.Remarks && <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>{batch.Remarks}</p>}
        </div>
      )}

      {/* Bulk action toolbar — only appears once something is selected */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <button onClick={handleReceive} disabled={busy || receivableCount === 0} style={{ ...toolbarBtn, opacity: receivableCount === 0 ? 0.5 : 1, cursor: receivableCount === 0 ? 'not-allowed' : 'pointer' }}>
            <MI name="inbox" size={14} color="#374151" /> Receive {receivableCount > 0 && <span style={{ background: '#DBEAFE', color: '#1D4ED8', borderRadius: 999, padding: '1px 6px', fontSize: 10 }}>{receivableCount}</span>}
          </button>
          <button onClick={openResults} disabled={busy} style={toolbarBtn}>
            <MI name="grid_view" size={14} color="#374151" /> {selected.size === 1 ? 'Enter Results' : 'Multi Results'} <span style={{ background: '#DBEAFE', color: '#1D4ED8', borderRadius: 999, padding: '1px 6px', fontSize: 10 }}>{selected.size}</span>
          </button>
          <button disabled title="Coming soon" style={{ ...toolbarBtn, opacity: 0.5, cursor: 'not-allowed' }}>
            <MI name="print" size={14} color="#9CA3AF" /> Print stickers <span style={{ background: '#F3F4F6', color: '#6B7280', borderRadius: 999, padding: '1px 6px', fontSize: 10 }}>{selected.size}</span>
          </button>
          <button disabled title="Coming soon" style={{ ...toolbarBtn, opacity: 0.5, cursor: 'not-allowed' }}>
            <MI name="content_copy" size={14} color="#9CA3AF" /> Copy to new <span style={{ background: '#F3F4F6', color: '#6B7280', borderRadius: 999, padding: '1px 6px', fontSize: 10 }}>{selected.size}</span>
          </button>
          <button onClick={handleCancel} disabled={busy || cancellableCount === 0}
            style={{ ...toolbarBtn, background: '#DC2626', color: '#fff', border: 'none', opacity: cancellableCount === 0 ? 0.5 : 1, cursor: cancellableCount === 0 ? 'not-allowed' : 'pointer' }}>
            <MI name="cancel" size={14} color="#fff" /> Cancel {cancellableCount > 0 && <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 999, padding: '1px 6px', fontSize: 10 }}>{cancellableCount}</span>}
          </button>
        </div>
      )}

      {/* Samples table */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Samples logged under this batch</h2>
        </div>
        {samples.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <MI name="science" size={32} color="#D1D5DB" />
            <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No samples in batch</p>
            <p className="text-xs mt-0.5 mb-3" style={{ color: '#9CA3AF' }}>Add an existing unassigned sample, or register a new one for this batch</p>
            <div className="flex items-center gap-2">
              <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: '#fff', color: '#374151', border: '1px solid #D1D5DB', cursor: 'pointer' }}>
                <MI name="playlist_add" size={13} color="#374151" /> Add Samples
              </button>
              <Link href={`/dashboard/samples-overview/new?batch=${batch.uid}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC', textDecoration: 'none' }}>
                <MI name="add" size={13} color="#fff" /> Create Sample
              </Link>
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                <th className="px-3 py-2" style={{ width: 32 }}>
                  <input type="checkbox" checked={selected.size === samples.length} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                </th>
                {['Sample ID', 'Client', 'Sample Type', 'Date Sampled', 'Priority', 'Status'].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {samples.map((s, i) => {
                const djangoId = djangoIdByUid[s.uid]
                return (
                  <tr key={s.uid} style={{ borderBottom: i < samples.length - 1 ? '1px solid #F9FAFB' : 'none', backgroundColor: selected.has(s.uid) ? '#F0F7FF' : undefined }} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={selected.has(s.uid)} onChange={() => toggle(s.uid)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td className="px-3 py-2.5">
                      {djangoId ? (
                        <Link href={`/dashboard/samples-overview/${djangoId}`} className="text-xs font-mono px-2 py-0.5 rounded-full hover:underline" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>
                          {s.id || s.title}
                        </Link>
                      ) : (
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F3F4F6', color: '#6B7280', fontWeight: 600 }}>
                          {s.id || s.title}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{s.ClientTitle || '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{s.SampleTypeTitle || '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{fmtDate(s.DateSampled)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{mapSenaitePriority(s.Priority)}</td>
                    <td className="px-3 py-2.5"><SampleStateBadge state={s.review_state} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
          <p style={{ fontSize: 10, color: '#9CA3AF' }}>{samples.length} sample{samples.length !== 1 ? 's' : ''}{selected.size > 0 ? ` · ${selected.size} selected` : ''}</p>
        </div>
      </div>

      {/* Results entry modal — single sample or multiple, same table */}
      {resultsOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <div onClick={closeResults} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} />
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, background: '#fff', width: 640, maxWidth: '90vw', display: 'flex', flexDirection: 'column', boxShadow: '-6px 0 32px rgba(0,0,0,0.18)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{selectedSamples.length === 1 ? 'Enter Results' : 'Multi Results'}</h2>
                <p style={{ fontSize: 11, color: '#9CA3AF' }}>{selectedSamples.length} sample{selectedSamples.length !== 1 ? 's' : ''} selected</p>
              </div>
              <button onClick={closeResults} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <MI name="close" size={16} color="#9CA3AF" />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
              {resultsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <p style={{ fontSize: 12, color: '#9CA3AF' }}>Loading analyses…</p>
                </div>
              ) : resultsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <MI name="science" size={28} color="#D1D5DB" />
                  <p className="mt-2 text-sm" style={{ color: '#6B7280' }}>No analyses to enter results for</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>The selected sample(s) have no analyses attached yet</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                      {['Sample', 'Analysis', 'Result', 'Unit'].map(h => (
                        <th key={h} className="px-2 py-2 text-left" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultsList.map(a => (
                      <tr key={a.uid} style={{ borderBottom: '1px solid #F9FAFB' }}>
                        <td className="px-2 py-2 text-xs" style={{ color: '#6B7280' }}>{a.sampleId}</td>
                        <td className="px-2 py-2 text-xs font-medium" style={{ color: '#111827' }}>{a.title || a.Keyword}</td>
                        <td className="px-2 py-2">
                          <input
                            defaultValue={a.Result}
                            onChange={e => setResultsValues(prev => ({ ...prev, [a.uid]: e.target.value }))}
                            placeholder="Enter result"
                            className="text-xs rounded outline-none"
                            style={{ border: '1px solid #D1D5DB', padding: '5px 8px', width: 120 }}
                          />
                        </td>
                        <td className="px-2 py-2 text-xs" style={{ color: '#9CA3AF' }}>{a.Unit || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #F3F4F6' }}>
              <button onClick={closeResults} disabled={resultsSubmitting} style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={submitResults} disabled={resultsSubmitting || resultsList.length === 0}
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: resultsSubmitting ? 'not-allowed' : 'pointer', opacity: resultsSubmitting ? 0.7 : 1 }}>
                {resultsSubmitting ? 'Submitting…' : 'Submit Results'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Samples modal — pick from samples not yet assigned to any batch,
          scoped to this batch's client when it has one, otherwise every client */}
      {addOpen && (
        <div onClick={closeAdd} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 680, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Add Samples to Batch</h2>
                <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                  {batch.ClientTitle ? `Showing unassigned samples for ${batch.ClientTitle}` : 'Showing unassigned samples across all clients'}
                </p>
              </div>
              <button onClick={closeAdd} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <MI name="close" size={16} color="#9CA3AF" />
              </button>
            </div>

            <div className="px-5 pt-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB' }}>
                <MI name="search" size={14} color="#9CA3AF" />
                <input
                  type="text"
                  value={addSearch}
                  onChange={e => setAddSearch(e.target.value)}
                  placeholder="Search sample ID, client, sample type..."
                  className="flex-1 bg-transparent text-xs outline-none"
                  style={{ color: '#374151' }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
              {addLoading ? (
                <div className="flex items-center justify-center py-10">
                  <p style={{ fontSize: 12, color: '#9CA3AF' }}>Loading unassigned samples…</p>
                </div>
              ) : addFiltered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <MI name="science" size={28} color="#D1D5DB" />
                  <p className="mt-2 text-sm" style={{ color: '#6B7280' }}>No unassigned samples found</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                    {batch.ClientTitle ? `Every sample for ${batch.ClientTitle} is already in a batch.` : 'Every sample is already assigned to a batch.'}
                  </p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <th className="px-2 py-2" style={{ width: 28 }}>
                        <input
                          type="checkbox"
                          checked={addFiltered.length > 0 && addFiltered.every(s => addSelected.has(s.uid))}
                          onChange={() => setAddSelected(prev => prev.size === addFiltered.length ? new Set() : new Set(addFiltered.map(s => s.uid)))}
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                      {['Sample ID', 'Client', 'Sample Type', 'Date Sampled', 'Status'].map(h => (
                        <th key={h} className="px-2 py-2 text-left" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {addFiltered.map(s => (
                      <tr key={s.uid} style={{ borderBottom: '1px solid #F9FAFB', backgroundColor: addSelected.has(s.uid) ? '#F0F7FF' : undefined, cursor: 'pointer' }} onClick={() => toggleAddSelected(s.uid)}>
                        <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={addSelected.has(s.uid)} onChange={() => toggleAddSelected(s.uid)} style={{ cursor: 'pointer' }} />
                        </td>
                        <td className="px-2 py-2 text-xs font-mono font-semibold" style={{ color: '#2563EB' }}>{s.id || s.title}</td>
                        <td className="px-2 py-2 text-xs" style={{ color: '#6B7280' }}>{s.ClientTitle || '—'}</td>
                        <td className="px-2 py-2 text-xs" style={{ color: '#6B7280' }}>{s.SampleTypeTitle || '—'}</td>
                        <td className="px-2 py-2 text-xs" style={{ color: '#6B7280' }}>{fmtDate(s.DateSampled)}</td>
                        <td className="px-2 py-2"><SampleStateBadge state={s.review_state} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-2" style={{ borderTop: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>{addSelected.size} selected</span>
              <div className="flex items-center gap-2">
                <button onClick={closeAdd} disabled={addSubmitting} style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={submitAdd} disabled={addSubmitting || addSelected.size === 0}
                  style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: addSubmitting ? 'not-allowed' : 'pointer', opacity: addSubmitting || addSelected.size === 0 ? 0.6 : 1 }}>
                  {addSubmitting ? 'Adding…' : `Add ${addSelected.size || ''} Sample${addSelected.size === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

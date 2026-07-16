'use client'
import { useState, useActionState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBatch, setBatchState, type BatchFormState } from '@/app/actions/batches'
import { type SenaiteBatch } from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({
  label, name, placeholder, required, error, hint, value, onChange, as,
}: {
  label: string; name: string; placeholder?: string; required?: boolean
  error?: string; hint?: string; value: string; onChange: (v: string) => void
  as?: 'textarea'
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
        {hint && <span className="ml-1 font-normal" style={{ color: '#9CA3AF' }}>{hint}</span>}
      </label>
      {as === 'textarea' ? (
        <textarea
          name={name} placeholder={placeholder} rows={3} value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none"
          style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
        />
      ) : (
        <input
          name={name} placeholder={placeholder} required={required} value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-lg outline-none"
          style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
        />
      )}
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
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

function fmtDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

type FV = { title: string; client_uid: string; client_batch_id: string; remarks: string; description: string; batch_date: string; batch_labels: string }
const blank = (): FV => ({ title: '', client_uid: '', client_batch_id: '', remarks: '', description: '', batch_date: '', batch_labels: '' })

export default function BatchesShell({
  initialBatches, clientOptions,
}: {
  initialBatches: SenaiteBatch[]
  clientOptions: { uid: string; title: string }[]
}) {
  const router = useRouter()
  const [showDrawer, setShowDrawer] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [vals, setVals] = useState<FV>(blank)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [busyUid, setBusyUid] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [, startTransition] = useTransition()

  function setVal(k: keyof FV, v: string) {
    setVals(prev => ({ ...prev, [k]: v }))
    if (fieldErrors[k]) setFieldErrors(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const [, action, pending] = useActionState(
    async (prev: BatchFormState, fd: FormData) => {
      const result = await createBatch(prev, fd)
      if (result.success) {
        setShowDrawer(false)
        setVals(blank())
        setFieldErrors({})
        showToast(true, result.message ?? 'Batch created.')
        router.refresh()
      } else if (result.errors) {
        const fe: Record<string, string> = {}
        for (const [k, msgs] of Object.entries(result.errors)) { if (msgs?.length) fe[k] = msgs[0] }
        setFieldErrors(fe)
      }
      return result
    },
    {}
  )

  function openCreate() { setVals(blank()); setFieldErrors({}); setShowDrawer(true) }
  function closeDrawer() { setShowDrawer(false) }

  function changeState(batch: SenaiteBatch, transition: 'close' | 'open' | 'cancel') {
    setBusyUid(batch.uid)
    startTransition(async () => {
      const result = await setBatchState(batch.uid, transition)
      showToast(result.success, result.message)
      setBusyUid(null)
      if (result.success) router.refresh()
    })
  }

  const batches = useMemo(() => initialBatches.filter(b =>
    (!statusFilter || b.review_state === statusFilter) &&
    (!clientFilter || b.ClientUID === clientFilter)
  ), [initialBatches, statusFilter, clientFilter])

  const selectStyle = {
    border: '1px solid #D1D5DB', borderRadius: 8, padding: '7px 10px', fontSize: 12,
    color: '#374151', backgroundColor: '#fff', outline: 'none',
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>

      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Batches</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Group samples into batches for tracking, billing, and reporting</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} style={selectStyle}>
            <option value="">All clients</option>
            {clientOptions.map(c => <option key={c.uid} value={c.uid}>{c.title}</option>)}
          </select>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC', border: 'none', cursor: 'pointer' }}>
            <MI name="add" size={15} color="#fff" /> New Batch
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* Right Drawer */}
      <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, zIndex: 200, pointerEvents: showDrawer ? 'auto' : 'none' }}>
        <div onClick={closeDrawer} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showDrawer ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 420, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showDrawer ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>

          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
                <MI name="layers" size={16} color="#0154FC" />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>New Batch</h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>Group related samples together</p>
              </div>
            </div>
            <button onClick={closeDrawer} className="p-1.5 rounded-lg hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
              <MI name="close" size={16} color="#9CA3AF" />
            </button>
          </div>

          <form action={action} className="flex-1 overflow-y-auto flex flex-col min-h-0">
            <div className="flex-1 px-5 py-4 flex flex-col gap-3">
              <Field label="Batch Name" name="title" placeholder="e.g. Weekly Intake — Green Farms" required
                error={fieldErrors.title} value={vals.title} onChange={v => setVal('title', v)} />

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                  Client <span className="font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
                </label>
                <select
                  name="client_uid"
                  value={vals.client_uid}
                  onChange={e => setVal('client_uid', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                  style={{ border: '1px solid #D1D5DB', color: '#111827', backgroundColor: '#fff' }}
                >
                  <option value="">Select client…</option>
                  {clientOptions.map(c => <option key={c.uid} value={c.uid}>{c.title}</option>)}
                </select>
              </div>

              <Field label="Client Batch ID" name="client_batch_id" placeholder="e.g. PO-2026-0417"
                hint="(the client's own reference number)"
                error={fieldErrors.client_batch_id} value={vals.client_batch_id} onChange={v => setVal('client_batch_id', v)} />

              <Field label="Description" name="description" placeholder="Short description of this batch"
                error={fieldErrors.description} value={vals.description} onChange={v => setVal('description', v)} />

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                  Date <span className="font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
                </label>
                <input
                  type="date" name="batch_date" value={vals.batch_date}
                  onChange={e => setVal('batch_date', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                  style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                />
              </div>

              <Field label="Batch Labels" name="batch_labels" placeholder="e.g. Urgent, Retest"
                hint="(comma-separated)"
                error={fieldErrors.batch_labels} value={vals.batch_labels} onChange={v => setVal('batch_labels', v)} />

              <Field label="Remarks" name="remarks" placeholder="Optional notes about this batch" as="textarea"
                error={fieldErrors.remarks} value={vals.remarks} onChange={v => setVal('remarks', v)} />
            </div>

            <div className="px-5 py-4 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#fff' }}>
              <button type="button" onClick={closeDrawer} disabled={pending}
                style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={pending} className="flex items-center gap-1.5"
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}>
                <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
                {pending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Table / empty state */}
      {batches.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="layers" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>
            {initialBatches.length === 0 ? 'No batches yet' : 'No batches match these filters'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
            {initialBatches.length === 0 ? 'Create your first batch to group samples for tracking and reporting' : 'Try a different status or client filter'}
          </p>
          {initialBatches.length === 0 && (
            <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC', border: 'none', cursor: 'pointer' }}>
              <MI name="add" size={13} color="#fff" /> New Batch
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 1200, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Batch ID', 'Title', 'Progress', 'Batch Labels', 'Description', 'Date', 'Client', 'Client ID', 'Client Batch ID', 'Status', 'Created', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide whitespace-nowrap" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batches.map((b, i) => (
                <tr key={b.uid} style={{ borderBottom: i < batches.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <Link href={`/dashboard/batches/${b.uid}`} className="text-xs font-mono px-2 py-0.5 rounded-full hover:underline" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>
                      {b.id || '—'}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <Link href={`/dashboard/batches/${b.uid}`} className="flex items-center gap-2 hover:underline" style={{ textDecoration: 'none', width: 'fit-content' }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                        <MI name="layers" size={13} color="#0154FC" />
                      </div>
                      <span className="text-xs font-medium" style={{ color: '#111827' }}>{b.title}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5" style={{ minWidth: 110 }}>
                    <div className="flex items-center gap-2">
                      <div style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
                        <div style={{ width: `${b.getProgress}%`, height: '100%', backgroundColor: '#0154FC' }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#9CA3AF', minWidth: 28 }}>{b.getProgress}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#6B7280' }}>{b.BatchLabels.length ? b.BatchLabels.join(', ') : '—'}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280', maxWidth: 160 }}>{b.description || '—'}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#6B7280' }}>{fmtDate(b.BatchDate)}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#6B7280' }}>{b.ClientTitle || '—'}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#6B7280' }}>{b.ClientID || '—'}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#6B7280' }}>{b.ClientBatchID || '—'}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap"><StatusBadge state={b.review_state} /></td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#9CA3AF' }}>{fmtDate(b.created)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {b.review_state === 'open' && (
                        <>
                          <button
                            onClick={() => changeState(b, 'close')}
                            disabled={busyUid === b.uid}
                            className="px-2 py-1 rounded text-xs font-medium hover:bg-gray-100"
                            style={{ border: '1px solid #E5E7EB', background: '#fff', cursor: busyUid === b.uid ? 'not-allowed' : 'pointer', color: '#374151' }}
                            title="Close batch"
                          >
                            Close
                          </button>
                          <button
                            onClick={() => changeState(b, 'cancel')}
                            disabled={busyUid === b.uid}
                            className="px-2 py-1 rounded text-xs font-medium hover:bg-red-50"
                            style={{ border: '1px solid #FECACA', background: '#fff', cursor: busyUid === b.uid ? 'not-allowed' : 'pointer', color: '#DC2626' }}
                            title="Cancel batch"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {b.review_state === 'closed' && (
                        <button
                          onClick={() => changeState(b, 'open')}
                          disabled={busyUid === b.uid}
                          className="px-2 py-1 rounded text-xs font-medium hover:bg-gray-100"
                          style={{ border: '1px solid #E5E7EB', background: '#fff', cursor: busyUid === b.uid ? 'not-allowed' : 'pointer', color: '#374151' }}
                          title="Reopen batch"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{batches.length} batch{batches.length !== 1 ? 'es' : ''}{batches.length !== initialBatches.length ? ` (of ${initialBatches.length})` : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

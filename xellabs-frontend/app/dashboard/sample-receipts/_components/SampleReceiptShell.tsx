'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { receiveLabSample, type LabSample } from '@/app/actions/lab-samples'
import { assignSampleByLabel } from '@/app/actions/storage'
import StorageLocationInput, { type SelectedStorage } from '@/app/dashboard/_components/StorageLocationInput'
import LiveBarcode from '@/app/dashboard/_components/LiveBarcode'
import { sampleDisplayId } from '@/app/lib/sampleDisplay'
import { type SenaiteRefOption } from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

// Sample lifecycle stages — mirrors the process-flow cards on Samples Overview
// (Logged → Received → In Process → To Be Verified → On Hold for QA → Completed).
const STEPS = [
  { n: 1, label: 'Logged' },
  { n: 2, label: 'Received' },
  { n: 3, label: 'In Process' },
  { n: 4, label: 'To Be Verified' },
  { n: 5, label: 'On Hold for QA' },
  { n: 6, label: 'Completed' },
]

// Map a sample's raw status to its lifecycle step. `hold_for_qa` is a flag that
// overrides the linear status, matching how Samples Overview surfaces it.
function lifecycleStep(sample: LabSample | null, received: boolean): number {
  if (!sample) return 1
  if (received) return 2
  if (sample.hold_for_qa) return 5
  switch (sample.status) {
    case 'received':         return 2
    case 'in_progress':      return 3
    case 'results_pending':  return 4
    case 'published':        return 6
    default:                 return 1 // registered / anything else = Logged
  }
}

function StepBar({ active }: { active: number }) {
  return (
    <div className="flex items-center mb-6">
      {STEPS.map((s, i) => {
        const done = s.n < active
        const isActive = s.n === active
        const isLast = i === STEPS.length - 1
        return (
          <div key={s.n} className="flex items-center flex-1">
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center justify-center rounded-full text-xs font-bold"
                style={{ width: 26, height: 26, backgroundColor: done || isActive ? '#2563EB' : '#fff', border: `2px solid ${done || isActive ? '#2563EB' : '#D1D5DB'}`, color: done || isActive ? '#fff' : '#374151' }}>
                {done ? <MI name="check" size={13} color="#fff" /> : s.n}
              </div>
              <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? '#2563EB' : done ? '#2563EB' : '#374151', whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
            </div>
            {!isLast && <div className="flex-1 mx-3" style={{ height: 2, backgroundColor: s.n < active ? '#2563EB' : '#6B7280' }} />}
          </div>
        )
      })}
    </div>
  )
}

function Barcode({ label }: { label?: string }) {
  return (
    <>
      {label ? <LiveBarcode value={label} height={56} /> : <div style={{ height: 56 }} />}
      <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', textAlign: 'center', marginTop: 4 }}>{label ?? '—'}</p>
    </>
  )
}

function LabelSelect({ label, required, children, value, onChange }: {
  label: string; required?: boolean; children: React.ReactNode; value?: string; onChange?: (v: string) => void
}) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      <div className="flex items-center rounded-lg" style={{ border: '1px solid #D1D5DB', backgroundColor: '#fff', overflow: 'hidden' }}>
        <select value={value} onChange={e => onChange?.(e.target.value)}
          className="flex-1 outline-none py-2 px-3 text-xs" style={{ color: '#374151', backgroundColor: 'transparent', cursor: 'pointer' }}>
          {children}
        </select>
      </div>
    </div>
  )
}

function LabelInput({ label, required, placeholder, value, onChange, readOnly }: {
  label: string; required?: boolean; placeholder?: string; value?: string; onChange?: (v: string) => void; readOnly?: boolean
}) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      <div className="flex items-center rounded-lg" style={{ border: '1px solid #D1D5DB', backgroundColor: readOnly ? '#FAFAFA' : '#fff' }}>
        <input value={value ?? ''} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} readOnly={readOnly}
          className="flex-1 outline-none py-2 px-3 text-xs" style={{ color: readOnly ? '#374151' : '#374151', backgroundColor: 'transparent' }} />
      </div>
    </div>
  )
}

const conditionDot: Record<string, string> = { good: '#0154FC', acceptable: '#F59E0B', compromised: '#EF4444', not_acceptable: '#EF4444' }
const sealDot: Record<string, string> = { intact: '#0154FC', broken: '#EF4444', missing: '#F59E0B' }
const priorityDot: Record<string, string> = { high: '#EF4444', medium: '#F59E0B', low: '#0154FC' }

export default function SampleReceiptShell({ sample, hasId, samplingDeviations }: { sample: LabSample | null; hasId: boolean; samplingDeviations: SenaiteRefOption[] }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')

  const [condition, setCondition]   = useState('good')
  const [deviation, setDeviation]   = useState('none')
  const [sealCond, setSealCond]     = useState('intact')
  const [sealNum, setSealNum]       = useState('')
  const [qty, setQty]               = useState('')
  const [qtyUnit, setQtyUnit]       = useState('tubes')
  const [storage, setStorage]       = useState('2_8c')
  const [priority, setPriority]     = useState('medium')
  const [holdQA, setHoldQA]         = useState(false)
  const [collector, setCollector]   = useState('')
  const [notes, setNotes]           = useState('')
  const [storageSel, setStorageSel] = useState<SelectedStorage | null>(
    sample?.preferred_storage_location
      ? { labelCode: sample.preferred_storage_label_code, display: sample.preferred_storage_location }
      : null
  )

  // Reopen mode: a sample that is no longer 'registered' has already been
  // received — show its recorded receipt details read-only instead of the form.
  const alreadyReceived = !!sample && sample.status !== 'registered'

  // Step indicator reflects the sample's real lifecycle position. A successful
  // receipt (or a reopened already-received sample) advances it to "Received".
  const activeStep = lifecycleStep(sample, !!success)
  const tatDays = sample?.received_date
    ? Math.max(0, Math.round((Date.now() - new Date(sample.received_date).getTime()) / 86400000))
    : null

  async function handleReceive() {
    if (!sample || alreadyReceived) return
    setSubmitting(true)
    setError('')
    const result = await receiveLabSample(sample.id, {
      condition, seal_condition: sealCond, seal_number: sealNum,
      quantity_received: qty, quantity_unit: qtyUnit,
      sampling_deviation: deviation, storage_requirement: storage,
      priority, hold_for_qa: holdQA, collector,
      location: storageSel?.display ?? '', notes,
    })
    if (!result.success) {
      setSubmitting(false)
      setError(result.message ?? 'Failed to receive sample.')
      return
    }
    // Physical storage assignment — reuses the same audited assign flow as the
    // Storage page (scanned/selected label code → exact slot or first free slot).
    if (storageSel) {
      const stored = await assignSampleByLabel(storageSel.labelCode, sample.sample_id)
      setSubmitting(false)
      if (!stored.success) {
        setError(`Sample received, but storage assignment failed: ${stored.message}`)
        return
      }
      // The previewed slot (shown before submit) can go stale if another
      // receipt claimed it first — the backend always assigns the actual
      // first-free slot at submit time, so surface it if it differs from
      // what was previewed (e.g. previewed A1, actually assigned A2).
      const actualSlot = stored.slot?.slot_id
      const previewedSlot = storageSel.autoSlot
      const driftNote = actualSlot && previewedSlot && actualSlot !== previewedSlot
        ? ` Note: ${previewedSlot} was taken in the meantime — assigned ${actualSlot} instead.`
        : ''
      setSuccess(`${result.message ?? 'Sample received.'} ${stored.message}${driftNote}`)
    } else {
      setSubmitting(false)
      setSuccess(result.message ?? 'Sample received.')
    }
    setTimeout(() => router.push('/dashboard/samples-overview'), 1500)
  }

  const canSubmit = !!sample && !submitting && !success && !alreadyReceived

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 272px', gap: 0, minHeight: '100%', backgroundColor: '#F7F8FC' }}>

      {/* ── Left: form ── */}
      <div style={{ padding: '20px 20px 20px 24px', overflowY: 'auto' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em', margin: 0 }}>Sample Receipt</h1>
            <p style={{ fontSize: 12, color: '#374151', marginTop: 3 }}>
              {sample
                ? alreadyReceived
                  ? `Receipt record for sample ${sampleDisplayId(sample)}`
                  : `Receiving sample ${sampleDisplayId(sample)}`
                : 'Select a registered sample from Samples Overview to begin.'}
            </p>
          </div>
        </div>

        <StepBar active={activeStep} />

        {error && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
            <MI name="error_outline" size={14} color="#EF4444" /> {error}
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#DBEAFE', border: '1px solid #93C5FD', color: '#0154FC' }}>
            <MI name="check_circle" size={14} color="#0154FC" /> {success} — redirecting…
          </div>
        )}
        {!hasId && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E' }}>
            <MI name="info" size={14} color="#F59E0B" />
            No sample selected. Go to <strong style={{ margin: '0 3px' }}>Samples Overview</strong> and click the <strong style={{ margin: '0 3px' }}>Receive</strong> icon on a registered sample.
          </div>
        )}
        {hasId && !sample && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
            <MI name="error_outline" size={14} color="#EF4444" /> Sample not found.
          </div>
        )}
        {alreadyReceived && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#EFF6FF', border: '1px solid #93C5FD', color: '#1E40AF' }}>
            <MI name="info" size={14} color="#2563EB" />
            This sample has already been received{sample?.received_date ? ` on ${new Date(sample.received_date).toLocaleDateString('en-GB', { timeZone: 'UTC' })}` : ''} — the recorded details are shown read-only below.
          </div>
        )}

        <div className="bg-white rounded-xl" style={{ border: '1px solid #E5E7EB', padding: '20px 24px' }}>
          <div className="flex items-center gap-2 mb-5">
            <div className="flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, backgroundColor: '#EFF6FF' }}>
              <MI name="science" size={15} color="#3B82F6" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Sample Information</span>
          </div>

          {/* Row 1 — read-only sample details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <LabelInput label="Sample ID" readOnly value={sample ? sampleDisplayId(sample) : '—'} />
            <LabelInput label="Client" readOnly value={sample?.client_name ?? '—'} />
            <LabelInput label="Sample Type" readOnly value={sample?.sample_type_name ?? '—'} />
          </div>

          {/* Row 1b — receipt/turnaround details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <LabelInput label="Received On" readOnly value={sample?.received_date ? new Date(sample.received_date).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : '—'} />
            <LabelInput label="Due Date" readOnly value={sample?.expiry_date ? new Date(sample.expiry_date).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : '—'} />
            <LabelInput label="Received By" readOnly value={sample?.received_by_name || '—'} />
            <LabelInput label="TAT (Days)" readOnly value={tatDays !== null ? String(tatDays) : '—'} />
          </div>

          {/* Row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <LabelInput label="Collector / Source" value={collector} onChange={setCollector} placeholder="Name or courier" />
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                Sample Condition <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div className="flex items-center rounded-lg" style={{ border: '1px solid #D1D5DB', backgroundColor: '#fff' }}>
                <div className="pl-3"><span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: conditionDot[condition] ?? '#374151', display: 'inline-block' }} /></div>
                <select className="flex-1 outline-none py-2 px-2 text-xs" style={{ color: '#374151', backgroundColor: 'transparent', cursor: 'pointer' }}
                  value={condition} onChange={e => setCondition(e.target.value)}>
                  <option value="good">Good</option>
                  <option value="acceptable">Acceptable</option>
                  <option value="compromised">Compromised</option>
                  <option value="not_acceptable">Not Acceptable</option>
                </select>
              </div>
            </div>
            <LabelSelect label="Sampling Deviation" value={deviation} onChange={setDeviation}>
              <option value="none">None</option>
              {samplingDeviations.map(d => <option key={d.uid} value={d.title}>{d.title}</option>)}
            </LabelSelect>
          </div>

          {/* Row 3 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                Seal Condition <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div className="flex items-center rounded-lg" style={{ border: '1px solid #D1D5DB', backgroundColor: '#fff' }}>
                <div className="pl-3"><span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: sealDot[sealCond] ?? '#374151', display: 'inline-block' }} /></div>
                <select className="flex-1 outline-none py-2 px-2 text-xs" style={{ color: '#374151', backgroundColor: 'transparent', cursor: 'pointer' }}
                  value={sealCond} onChange={e => setSealCond(e.target.value)}>
                  <option value="intact">Intact</option>
                  <option value="broken">Broken</option>
                  <option value="missing">Missing</option>
                </select>
              </div>
            </div>
            <LabelInput label="Seal Number" value={sealNum} onChange={setSealNum} placeholder="e.g. SN-7854291" />
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Quantity Received</label>
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #D1D5DB' }}>
                <input type="number" value={qty} onChange={e => setQty(e.target.value)} min={1} placeholder="0"
                  className="outline-none py-2 px-3 text-xs" style={{ width: 70, color: '#374151', borderRight: '1px solid #D1D5DB' }} />
                <select value={qtyUnit} onChange={e => setQtyUnit(e.target.value)}
                  className="flex-1 outline-none py-2 px-3 text-xs" style={{ color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                  <option value="tubes">Tubes</option>
                  <option value="vials">Vials</option>
                  <option value="bags">Bags</option>
                  <option value="slides">Slides</option>
                </select>
              </div>
            </div>
          </div>

          {/* Row 4 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
            <LabelSelect label="Storage Requirement" required value={storage} onChange={setStorage}>
              <option value="2_8c">2–8 °C (Refrigerated)</option>
              <option value="minus_20c">-20 °C (Frozen)</option>
              <option value="minus_80c">-80 °C (Ultra-frozen)</option>
              <option value="room_temp">Room Temperature</option>
            </LabelSelect>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Priority</label>
              <div className="flex items-center rounded-lg" style={{ border: '1px solid #D1D5DB', backgroundColor: '#fff' }}>
                <div className="pl-3"><span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: priorityDot[priority] ?? '#374151', display: 'inline-block' }} /></div>
                <select className="flex-1 outline-none py-2 px-2 text-xs" style={{ color: '#374151', backgroundColor: 'transparent', cursor: 'pointer' }}
                  value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col justify-end">
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Hold for QA</label>
              <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={holdQA} onChange={e => setHoldQA(e.target.checked)} style={{ accentColor: '#2563EB', width: 14, height: 14, cursor: 'pointer' }} />
                <span style={{ fontSize: 11, color: '#374151' }}>Place on QA Hold</span>
              </label>
            </div>
          </div>

          {/* Storage Location — scan QR label or search a box; auto-assigns first free slot */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Storage Location</label>
              <StorageLocationInput value={storageSel} onChange={setStorageSel} disabled={submitting || !!success} />
              <p style={{ fontSize: 10, color: '#374151', marginTop: 4 }}>
                {sample?.preferred_storage_location
                  ? 'Pre-filled from the location chosen at registration — change it if the sample is going elsewhere.'
                  : 'Scan a location QR label or search a box — the sample is stored there on receipt.'}
              </p>
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value.slice(0, 500))}
              placeholder="Enter any additional information about the sample…"
              className="w-full outline-none resize-none rounded-xl text-xs p-3"
              style={{ border: '1px solid #D1D5DB', color: '#374151', height: 100 }} />
            <div style={{ fontSize: 10, color: '#374151', textAlign: 'right', marginTop: 2 }}>{notes.length} / 500</div>
          </div>

          <p style={{ fontSize: 10, color: '#374151', marginBottom: 16 }}><span style={{ color: '#EF4444' }}>*</span> Required fields</p>

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => router.push('/dashboard/samples-overview')}
              className="px-5 py-2 text-xs font-medium rounded-lg"
              style={{ border: '1px solid #D1D5DB', color: '#374151', cursor: 'pointer', backgroundColor: '#fff' }}>
              Cancel
            </button>
            <button type="button" onClick={handleReceive} disabled={!canSubmit}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg text-white"
              style={{ backgroundColor: canSubmit ? '#0154FC' : '#374151', cursor: canSubmit ? 'pointer' : 'not-allowed', border: 'none' }}>
              <MI name={submitting ? 'hourglass_top' : 'check_circle'} size={14} color="#fff" />
              {submitting ? 'Receiving…' : 'Receive Sample'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: summary panel ── */}
      <div style={{ padding: '70px 16px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="bg-white rounded-xl" style={{ border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <MI name="receipt_long" size={15} color="#374151" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Sample Summary</span>
          </div>
          <div className="px-4 py-4">
            <p style={{ fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Barcode Preview</p>
            <div className="rounded-lg overflow-hidden mb-1" style={{ backgroundColor: '#fff', border: '1px solid #F3F4F6', padding: '8px 4px 4px' }}>
              <Barcode label={sample ? sampleDisplayId(sample) : '—'} />
            </div>
            <p style={{ fontSize: 9, color: '#374151', textAlign: 'center', marginBottom: 16 }}>
              {sample ? `${sampleDisplayId(sample)} · ${sample.sample_type_name}` : 'No sample selected'}
            </p>
            {sample && (
              <>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#111827', marginBottom: 10 }}>Sample Details</p>
                {[
                  { icon: 'business',       label: 'Client',      value: sample.client_name },
                  { icon: 'category',       label: 'Sample Type', value: sample.sample_type_name },
                  { icon: 'calendar_today', label: 'Collection',  value: sample.collection_date ? new Date(sample.collection_date).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : '—' },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-2 mb-3">
                    <MI name={item.icon} size={14} color="#374151" />
                    <div>
                      <p style={{ fontSize: 9, color: '#374151', marginBottom: 1 }}>{item.label}</p>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#111827', margin: 0 }}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl" style={{ border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Quick Actions</span>
          </div>
          <div className="px-4 py-3">
            <button onClick={handleReceive} disabled={!canSubmit}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-xs font-semibold"
              style={{ backgroundColor: canSubmit ? '#0154FC' : '#374151', cursor: canSubmit ? 'pointer' : 'not-allowed', border: 'none' }}>
              <MI name={submitting ? 'hourglass_top' : 'check_circle'} size={16} color="#fff" />
              {submitting ? 'Receiving…' : 'Receive Sample'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

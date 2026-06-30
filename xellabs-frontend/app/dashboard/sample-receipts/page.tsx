'use client'
import { useState } from 'react'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const STEPS = [
  { n: 1, label: 'Sample Details' },
  { n: 2, label: 'Chain of Custody' },
  { n: 3, label: 'Review & Confirm' },
  { n: 4, label: 'Complete' },
]

function StepBar({ active }: { active: number }) {
  return (
    <div className="flex items-center mb-6">
      {STEPS.map((s, i) => {
        const done   = s.n < active
        const isActive = s.n === active
        const isLast = i === STEPS.length - 1
        return (
          <div key={s.n} className="flex items-center flex-1">
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center justify-center rounded-full text-xs font-bold"
                style={{
                  width: 26, height: 26,
                  backgroundColor: done ? '#2563EB' : isActive ? '#2563EB' : '#fff',
                  border: `2px solid ${done || isActive ? '#2563EB' : '#D1D5DB'}`,
                  color: done || isActive ? '#fff' : '#9CA3AF',
                }}>
                {done ? <MI name="check" size={13} color="#fff" /> : s.n}
              </div>
              <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? '#2563EB' : done ? '#2563EB' : '#9CA3AF', whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 mx-3" style={{ height: 1, backgroundColor: s.n < active ? '#2563EB' : '#E5E7EB' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Barcode SVG ── */
function Barcode() {
  const bars = [3,1,2,1,3,2,1,2,1,3,1,1,2,3,1,2,1,1,3,2,1,2,3,1,2,1,3,1,2,2,1,3,1,2,1,2,3,1,1,2,3,1,2,1,2,1,3,2,1,3,1,1,2,1,3,2,1,2,1,3]
  let x = 0
  const rects: { x: number; w: number; fill: string }[] = []
  bars.forEach((w, i) => {
    rects.push({ x, w: w * 2.2, fill: i % 2 === 0 ? '#111827' : '#fff' })
    x += w * 2.2
  })
  const total = x
  return (
    <svg width="100%" viewBox={`0 0 ${total} 60`} preserveAspectRatio="none" style={{ height: 56 }}>
      {rects.map((r, i) => <rect key={i} x={r.x} y={0} width={r.w} height={60} fill={r.fill} />)}
    </svg>
  )
}

/* ── Labelled select ── */
function LabelSelect({ label, required, children, value, onChange, prefix }: {
  label: string; required?: boolean; children: React.ReactNode
  value?: string; onChange?: (v: string) => void; prefix?: React.ReactNode
}) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      <div className="flex items-center rounded-lg" style={{ border: '1px solid #D1D5DB', backgroundColor: '#fff', overflow: 'hidden' }}>
        {prefix && <div className="flex items-center justify-center px-2.5" style={{ borderRight: '1px solid #E5E7EB' }}>{prefix}</div>}
        <select value={value} onChange={e => onChange?.(e.target.value)}
          className="flex-1 outline-none py-2 px-3 text-xs" style={{ color: '#374151', backgroundColor: 'transparent', cursor: 'pointer' }}>
          {children}
        </select>
      </div>
    </div>
  )
}

function LabelInput({ label, required, placeholder, value, onChange, suffix, prefix, readOnly }: {
  label: string; required?: boolean; placeholder?: string; value?: string
  onChange?: (v: string) => void; suffix?: React.ReactNode; prefix?: React.ReactNode; readOnly?: boolean
}) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      <div className="flex items-center rounded-lg" style={{ border: '1px solid #D1D5DB', backgroundColor: readOnly ? '#FAFAFA' : '#fff' }}>
        {prefix && <div className="px-2.5">{prefix}</div>}
        <input value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} readOnly={readOnly}
          className="flex-1 outline-none py-2 px-3 text-xs" style={{ color: readOnly ? '#9CA3AF' : '#374151', backgroundColor: 'transparent' }} />
        {suffix && <div className="px-2.5">{suffix}</div>}
      </div>
    </div>
  )
}

export default function SampleReceiptPage() {
  const [step, setStep] = useState(1)

  const [client, setClient]     = useState('BioPharma Inc. / Project Atlas')
  const [sampleType, setSampleType] = useState('Serum')
  const [datetime, setDatetime] = useState('2025-05-19T10:30')
  const [collector, setCollector] = useState('Jane Doe (Field Technician)')
  const [condition, setCondition] = useState('Good')
  const [deviation, setDeviation] = useState('None')
  const [sealCond, setSealCond]   = useState('Intact')
  const [sealNum, setSealNum]     = useState('SN-7854291')
  const [qty, setQty]             = useState('3')
  const [qtyUnit, setQtyUnit]     = useState('Tubes')
  const [storage, setStorage]     = useState('2–8 °C (Refrigerated)')
  const [profile, setProfile]     = useState('PK Panel – Standard')
  const [priority, setPriority]   = useState('Medium')
  const [holdQA, setHoldQA]       = useState(false)
  const [notes, setNotes]         = useState('')

  const conditionDot: Record<string, string> = { Good: '#22C55E', Compromised: '#EF4444', Acceptable: '#F59E0B', 'Not Acceptable': '#EF4444' }
  const sealDot: Record<string, string>      = { Intact: '#22C55E', Broken: '#EF4444', Missing: '#F59E0B' }
  const priorityDot: Record<string, string>  = { High: '#EF4444', Medium: '#F59E0B', Low: '#22C55E' }

  const now = new Date().toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 272px', gap: 0, minHeight: '100%', backgroundColor: '#F5F6FA', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Left: form ── */}
      <div style={{ padding: '20px 20px 20px 24px', overflowY: 'auto' }}>

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Sample Receipt</h1>
            <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>Register and receive incoming laboratory samples.</p>
          </div>
          <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
            <span>Last updated: {now}</span>
            <button style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, display: 'flex' }}>
              <MI name="refresh" size={15} color="#9CA3AF" />
            </button>
          </div>
        </div>

        {/* Steps */}
        <StepBar active={step} />

        {/* Form card */}
        <div className="bg-white rounded-xl" style={{ border: '1px solid #E5E7EB', padding: '20px 24px' }}>

          {/* Section title */}
          <div className="flex items-center gap-2 mb-5">
            <div className="flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, backgroundColor: '#EFF6FF' }}>
              <MI name="science" size={15} color="#3B82F6" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Sample Information</span>
          </div>

          {/* Row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <LabelInput label="Sample ID" required placeholder="Auto-generate"
              suffix={<MI name="qr_code_scanner" size={16} color="#9CA3AF" />}
              readOnly
            />
            {/* Client / Project with clear */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                Client / Project <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div className="flex items-center rounded-lg" style={{ border: '1px solid #D1D5DB', backgroundColor: '#fff' }}>
                <select className="flex-1 outline-none py-2 px-3 text-xs" style={{ color: '#374151', backgroundColor: 'transparent', cursor: 'pointer' }}
                  value={client} onChange={e => setClient(e.target.value)}>
                  <option>BioPharma Inc. / Project Atlas</option>
                  <option>Gentech Labs / Research Study</option>
                  <option>Novus LLC / Phase II</option>
                </select>
                <button onClick={() => setClient('')} style={{ padding: '0 8px', cursor: 'pointer', border: 'none', background: 'none', display: 'flex' }}>
                  <MI name="close" size={14} color="#9CA3AF" />
                </button>
              </div>
            </div>
            <LabelSelect label="Sample Type" required value={sampleType} onChange={setSampleType}>
              <option>Serum</option><option>Plasma</option><option>Urine</option><option>Tissue</option><option>Water</option>
            </LabelSelect>
          </div>

          {/* Row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <LabelInput label="Received Date & Time" required value={datetime} onChange={setDatetime}
              prefix={<MI name="calendar_today" size={14} color="#9CA3AF" />}
              suffix={<MI name="access_time" size={14} color="#9CA3AF" />}
            />
            <LabelSelect label="Collector / Source" value={collector} onChange={setCollector}>
              <option>Jane Doe (Field Technician)</option>
              <option>John Smith (Lab Tech)</option>
              <option>Emily Clark (Courier)</option>
            </LabelSelect>
            {/* Sample Condition with dot */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                Sample Condition <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div className="flex items-center rounded-lg" style={{ border: '1px solid #D1D5DB', backgroundColor: '#fff' }}>
                <div className="pl-3 flex items-center">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: conditionDot[condition] ?? '#9CA3AF', display: 'inline-block' }} />
                </div>
                <select className="flex-1 outline-none py-2 px-2 text-xs" style={{ color: '#374151', backgroundColor: 'transparent', cursor: 'pointer' }}
                  value={condition} onChange={e => setCondition(e.target.value)}>
                  <option>Good</option><option>Acceptable</option><option>Compromised</option><option>Not Acceptable</option>
                </select>
              </div>
            </div>
          </div>

          {/* Row 3 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <LabelSelect label="Sampling Deviation" value={deviation} onChange={setDeviation}>
              <option>None</option><option>Temperature excursion</option><option>Delayed transport</option><option>Haemolysis</option>
            </LabelSelect>
            {/* Seal Condition with dot */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                Seal Condition <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div className="flex items-center rounded-lg" style={{ border: '1px solid #D1D5DB', backgroundColor: '#fff' }}>
                <div className="pl-3 flex items-center">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: sealDot[sealCond] ?? '#9CA3AF', display: 'inline-block' }} />
                </div>
                <select className="flex-1 outline-none py-2 px-2 text-xs" style={{ color: '#374151', backgroundColor: 'transparent', cursor: 'pointer' }}
                  value={sealCond} onChange={e => setSealCond(e.target.value)}>
                  <option>Intact</option><option>Broken</option><option>Missing</option>
                </select>
              </div>
            </div>
            <LabelInput label="Seal Number" value={sealNum} onChange={setSealNum} />
          </div>

          {/* Row 4 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            {/* Quantity */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                Quantity Received <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #D1D5DB' }}>
                <input type="number" value={qty} onChange={e => setQty(e.target.value)} min={1}
                  className="outline-none py-2 px-3 text-xs" style={{ width: 70, color: '#374151', borderRight: '1px solid #D1D5DB' }} />
                <select value={qtyUnit} onChange={e => setQtyUnit(e.target.value)}
                  className="flex-1 outline-none py-2 px-3 text-xs" style={{ color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                  <option>Tubes</option><option>Vials</option><option>Bags</option><option>Slides</option>
                </select>
              </div>
            </div>
            <LabelSelect label="Storage Requirement" required value={storage} onChange={setStorage}>
              <option>2–8 °C (Refrigerated)</option>
              <option>-20 °C (Frozen)</option>
              <option>-80 °C (Ultra-frozen)</option>
              <option>Room Temperature</option>
            </LabelSelect>
            <LabelSelect label="Analysis Profile" required value={profile} onChange={setProfile}>
              <option>PK Panel – Standard</option>
              <option>Full Blood Panel</option>
              <option>Metabolite Screen</option>
              <option>Toxicology</option>
            </LabelSelect>
          </div>

          {/* Row 5 — Priority + Hold for QA */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
            {/* Priority with dot */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Priority</label>
              <div className="flex items-center rounded-lg" style={{ border: '1px solid #D1D5DB', backgroundColor: '#fff' }}>
                <div className="pl-3 flex items-center">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: priorityDot[priority] ?? '#9CA3AF', display: 'inline-block' }} />
                </div>
                <select className="flex-1 outline-none py-2 px-2 text-xs" style={{ color: '#374151', backgroundColor: 'transparent', cursor: 'pointer' }}
                  value={priority} onChange={e => setPriority(e.target.value)}>
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
              </div>
            </div>
            {/* Hold for QA */}
            <div className="flex flex-col justify-end">
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Hold for QA</label>
              <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={holdQA} onChange={e => setHoldQA(e.target.checked)} style={{ accentColor: '#2563EB', width: 14, height: 14, cursor: 'pointer' }} />
                <span style={{ fontSize: 11, color: '#374151' }}>Place this sample on QA Hold</span>
                <MI name="info_outline" size={14} color="#9CA3AF" />
              </label>
            </div>
          </div>

          {/* Attachments + Notes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
            {/* Attachments */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Attachments</label>
              <div className="flex flex-col items-center justify-center rounded-xl" style={{ border: '2px dashed #D1D5DB', backgroundColor: '#FAFAFA', padding: '24px 16px', textAlign: 'center' }}>
                <MI name="cloud_upload" size={28} color="#D1D5DB" />
                <p style={{ fontSize: 11, color: '#374151', marginTop: 8 }}>
                  Drag and drop files here<br />
                  <span style={{ color: '#2563EB', cursor: 'pointer' }}>or browse</span>
                </p>
                <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>Accepted files: PDF, JPG, PNG (Max 10MB each)</p>
              </div>
            </div>
            {/* Notes */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value.slice(0, 500))}
                placeholder="Enter any additional information about the sample…"
                className="w-full outline-none resize-none rounded-xl text-xs p-3"
                style={{ border: '1px solid #D1D5DB', color: '#374151', height: 120 }}
              />
              <div style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'right', marginTop: 2 }}>{notes.length} / 500</div>
            </div>
          </div>

          <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 16 }}>* Required fields</p>

          {/* Bottom buttons */}
          <div className="flex items-center justify-end gap-2">
            <button className="px-5 py-2 text-xs font-medium rounded-lg" style={{ border: '1px solid #D1D5DB', color: '#374151', cursor: 'pointer', backgroundColor: '#fff' }}>
              Clear Form
            </button>
            <button className="px-5 py-2 text-xs font-semibold rounded-lg text-white" style={{ backgroundColor: '#2563EB', cursor: 'pointer' }}>
              Save Draft
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: Sample Summary panel ── */}
      <div style={{ padding: '70px 16px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Sample Summary card */}
        <div className="bg-white rounded-xl" style={{ border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <MI name="receipt_long" size={15} color="#6B7280" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Sample Summary</span>
          </div>

          <div className="px-4 py-4">
            {/* Barcode */}
            <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', marginBottom: 6 }}>Barcode Preview</p>
            <div className="rounded-lg overflow-hidden mb-1" style={{ backgroundColor: '#fff', border: '1px solid #F3F4F6', padding: '8px 4px 4px' }}>
              <Barcode />
              <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', textAlign: 'center', marginTop: 4 }}>S-25-01984</p>
            </div>
            <p style={{ fontSize: 9, color: '#9CA3AF', textAlign: 'center', marginBottom: 16 }}>Sample ID will be generated upon receipt</p>

            {/* Chain of Custody */}
            <p style={{ fontSize: 11, fontWeight: 700, color: '#111827', marginBottom: 10 }}>Chain of Custody <span style={{ fontSize: 10, fontWeight: 400, color: '#9CA3AF' }}>(Starter)</span></p>
            {[
              { icon: 'person_outline',  label: 'Collected By',        value: 'Jane Doe' },
              { icon: 'calendar_today',  label: 'Collection Date',     value: 'May 19, 2025 08:45 AM' },
              { icon: 'location_on',     label: 'Collection Location', value: 'Site A - Building 25' },
              { icon: 'local_shipping',  label: 'Transporter',         value: 'Xella Courier Service' },
              { icon: 'person',          label: 'Received By',         value: 'Alex Smith' },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-2 mb-3">
                <MI name={item.icon} size={14} color="#9CA3AF" />
                <div>
                  <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 1 }}>{item.label}</p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#111827', margin: 0 }}>{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions card */}
        <div className="bg-white rounded-xl" style={{ border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Quick Actions</span>
          </div>

          {/* Print Label */}
          <button className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50" style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: 'none', border: 'none', borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center justify-center rounded-lg" style={{ width: 32, height: 32, backgroundColor: '#EFF6FF', flexShrink: 0 }}>
              <MI name="print" size={16} color="#3B82F6" />
            </div>
            <div className="flex-1 text-left">
              <p style={{ fontSize: 11, fontWeight: 600, color: '#111827', margin: 0 }}>Print Label</p>
              <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>Generate and print sample label</p>
            </div>
            <MI name="chevron_right" size={16} color="#9CA3AF" />
          </button>

          {/* Save Draft */}
          <button className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50" style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: 'none', border: 'none', borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center justify-center rounded-lg" style={{ width: 32, height: 32, backgroundColor: '#F0FDF4', flexShrink: 0 }}>
              <MI name="save" size={16} color="#22C55E" />
            </div>
            <div className="flex-1 text-left">
              <p style={{ fontSize: 11, fontWeight: 600, color: '#111827', margin: 0 }}>Save Draft</p>
              <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>Save and continue later</p>
            </div>
            <MI name="chevron_right" size={16} color="#9CA3AF" />
          </button>

          {/* Receive Sample — full-width teal */}
          <div className="px-4 py-3">
            <button className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-xs font-semibold" style={{ backgroundColor: '#0D9488', cursor: 'pointer', border: 'none' }}>
              <MI name="check_circle" size={16} color="#fff" />
              Receive Sample
              <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>· Confirm receipt and create record</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const SAMPLE_DATA: Record<string, any> = {
  'S-25-01987': {
    id: 'S-25-01987',
    project: 'BioPharma Inc.',
    sampleType: 'Plasma',
    priority: 'High',
    tat: 2,
    statuses: ['Received', 'To Be Verified', 'On Hold for QA'],
    client: 'BioPharma Inc.',
    projectName: 'Phase I PK Study',
    matrix: 'Human Plasma',
    collectionDate: 'May 18, 2025  8:30 AM',
    collectedBy: 'Nurse Station 3',
    collectionPoint: 'Site 101',
    containerType: 'K2 EDTA Tube (6 mL)',
    volume: '4.5 mL',
    temperature: '3.6 °C',
    receivedBy: 'System Admin',
    receiptCondition: 'Acceptable',
    barcode: 'BC123456789',
    receivedDate: 'May 19, 2025  10:15 AM',
    dueDate: 'May 26, 2025  5:00 PM',
    storage: 'Freezer 2 / Rack B / Box 05 / Slot 12',
    analyst: 'Jane Doe',
    analystInitials: 'JD',
    instrument: 'LC-MS/MS-01',
    analyses: [
      { test: 'Drug Concentration (LC-MS/MS)', status: 'In Process',    priority: 'High',   tat: 2, due: 'May 26, 2025' },
      { test: 'Metabolite ID (LC-MS/MS)',       status: 'To Be Verified',priority: 'High',   tat: 3, due: 'May 27, 2025' },
      { test: 'Protein Binding (CE)',           status: 'On Hold for QA',priority: 'Medium', tat: 5, due: 'May 29, 2025' },
      { test: 'pH (Electrode)',                 status: 'Not Started',   priority: 'Low',    tat: 2, due: 'May 26, 2025' },
    ],
    locationHistory: [
      { datetime: 'May 19, 2025  10:11', location: 'Receiving Area',              action: 'Received', by: 'System Admin' },
      { datetime: 'May 19, 2025  10:18', location: 'Temp Staging (3-4 °C)',       action: 'Logged In', by: 'System Admin' },
      { datetime: 'May 19, 2025  10:55', location: 'Freezer 2 / Rack 8 / Box 12',action: 'Stored',   by: 'System Admin' },
    ],
    notes: [
      { datetime: 'May 19, 2025  10:33 AM', by: 'Jane Doe (QA)', text: 'Sample placed on hold pending dilution integrity testing.' },
      { datetime: 'May 19, 2025  10:25 AM', by: 'System Admin',  text: 'Sample integrity acceptable upon receipt.' },
    ],
    custody: [
      { label: 'Sample Collected',  sub: 'Nurse Station 3, Site 101',          date: 'May 19, 2025', time: '8:30 AM',  done: true  },
      { label: 'Sample Received',   sub: 'Received by System Admin',            date: 'May 19, 2025', time: '10:15 AM', done: true  },
      { label: 'Logged in LIMS',    sub: 'Accessioned and barcoded',            date: 'May 19, 2025', time: '10:17 AM', done: true  },
      { label: 'To Be Verified',    sub: 'Verification pending',                date: 'May 19, 2025', time: '10:30 AM', done: false },
      { label: 'On Hold for QA',    sub: 'Lab QA review in progress',           date: 'May 19, 2025', time: '10:33 AM', done: false },
      { label: 'Analysis Completed',sub: 'Pending',                             date: '',             time: '',         done: false },
    ],
    attachments: [
      { name: 'Chain_of_Custody_S-25-01987.pdf', type: 'PDF', size: '214 KB', uploaded: 'May 19, 2025, 10:15 AM' },
      { name: 'Sample_Label_S-25-01987.png',     type: 'PNG', size: '98 KB',  uploaded: 'May 19, 2025, 10:56 AM' },
      { name: 'Receipt_Checklist_S-25-01987.pdf',type: 'PDF', size: '156 KB', uploaded: 'May 19, 2025, 10:17 AM' },
    ],
  },
}

const STATUS_BADGE: Record<string, { bg: string; color: string; border?: string }> = {
  'Received':       { bg: '#CCFBF1', color: '#0F766E' },
  'To Be Verified': { bg: '#FEF3C7', color: '#92400E' },
  'On Hold for QA': { bg: '#FEE2E2', color: '#991B1B' },
  'In Process':     { bg: '#DBEAFE', color: '#1E40AF' },
  'Not Started':    { bg: '#F3F4F6', color: '#6B7280' },
  'Completed':      { bg: '#DCFCE7', color: '#166534' },
}

const PRIORITY_BADGE: Record<string, { color: string }> = {
  'High':   { color: '#EF4444' },
  'Medium': { color: '#F59E0B' },
  'Low':    { color: '#22C55E' },
}

const TABS = ['Overview', 'Analyses', 'Chain of Custody', 'Storage', 'Documents', 'Audit Trail']
const TAB_ICONS: Record<string, string> = {
  'Overview': 'grid_view', 'Analyses': 'biotech', 'Chain of Custody': 'link',
  'Storage': 'inventory_2', 'Documents': 'description', 'Audit Trail': 'history',
}

export default function SampleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const s = SAMPLE_DATA[id] ?? SAMPLE_DATA['S-25-01987']
  const [activeTab, setActiveTab] = useState('Overview')

  const priorityColor = PRIORITY_BADGE[s.priority]?.color ?? '#374151'

  return (
    <div style={{ padding: '20px 24px', minHeight: '100%', backgroundColor: '#F9FAFB', fontFamily: 'Inter, sans-serif' }}>

      {/* Breadcrumb + header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1" style={{ fontSize: 12, color: '#9CA3AF' }}>
            <Link href="/dashboard/samples" style={{ color: '#6B7280', textDecoration: 'none' }}>Samples</Link>
            <MI name="chevron_right" size={14} color="#9CA3AF" />
            <span style={{ color: '#374151' }}>Sample Detail</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Sample Detail</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
            <MI name="print" size={14} color="#6B7280" /> Print
          </button>
          <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
            <MI name="download" size={14} color="#6B7280" /> Export
          </button>
          <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white" style={{ backgroundColor: '#2563EB', cursor: 'pointer' }}>
            Actions <MI name="keyboard_arrow_down" size={14} color="#fff" />
          </button>
        </div>
      </div>

      {/* Hero card */}
      <div className="bg-white rounded-xl mb-3" style={{ border: '1px solid #E5E7EB', padding: '14px 20px 12px' }}>
        <div className="flex items-center gap-0" style={{ minHeight: 64 }}>
          {/* Icon + ID + badges */}
          <div className="flex items-center gap-3" style={{ flex: '0 0 auto', paddingRight: 16, borderRight: '1px solid #EBEBEB' }}>
            <div className="flex items-center justify-center rounded-xl" style={{ width: 52, height: 52, backgroundColor: '#EFF6FF', flexShrink: 0 }}>
              <MI name="science" size={26} color="#3B82F6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{s.id}</span>
                <button style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0, display: 'flex' }}>
                  <MI name="content_copy" size={14} color="#9CA3AF" />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {s.statuses.map((st: string) => {
                  const sb = STATUS_BADGE[st] ?? { bg: '#F3F4F6', color: '#6B7280' }
                  const dotColors: Record<string, string> = {
                    'Received': '#0F766E', 'To Be Verified': '#F59E0B', 'On Hold for QA': '#EF4444',
                    'In Process': '#3B82F6', 'Completed': '#22C55E', 'Not Started': '#9CA3AF',
                  }
                  return (
                    <span key={st} className="flex items-center gap-1" style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999, backgroundColor: sb.bg, color: sb.color }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dotColors[st] ?? sb.color, display: 'inline-block', flexShrink: 0 }} />
                      {st}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Meta pills — with vertical dividers */}
          <div className="flex items-center flex-1">
            {[
              { label: 'Project / Client', value: s.project },
              { label: 'Sample Type',      value: s.sampleType },
              { label: 'Priority',         value: s.priority, valueColor: priorityColor },
              { label: 'Sample ID',        value: s.id },
              { label: 'TAT (Days)',        value: String(s.tat) },
            ].map((m, i, arr) => (
              <div key={m.label} style={{
                flex: 1, textAlign: 'center',
                borderRight: i < arr.length - 1 ? '1px solid #EBEBEB' : 'none',
                paddingLeft: i === 0 ? 16 : 14,
                paddingRight: 14,
              }}>
                <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 4 }}>{m.label}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: m.valueColor ?? '#111827', margin: 0 }}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Info bar */}
        <div className="flex items-center mt-3 pt-3" style={{ borderTop: '1px solid #F0F0F0' }}>
          {[
            { icon: 'person_outline',  label: 'Client',            value: s.client,       value2: '' },
            { icon: 'science',         label: 'Sample Type',       value: s.sampleType,   value2: '' },
            { icon: 'calendar_today',  label: 'Received Date',     value: 'May 19, 2025', value2: '10:15 AM' },
            { icon: 'event',           label: 'Due Date',          value: 'May 26, 2025', value2: '5:00 PM' },
            { icon: 'ac_unit',         label: 'Storage Location',  value: 'Freezer 2 / Rack B /', value2: 'Box 05 / Slot 12' },
            { icon: 'person',          label: 'Assigned Analyst',  value: s.analyst,      value2: '', avatar: s.analystInitials },
            { icon: 'build',           label: 'Linked Instrument', value: s.instrument,   value2: '' },
          ].map((item, i, arr) => (
            <div key={item.label} className="flex items-center gap-2 flex-1" style={{ borderRight: i < arr.length - 1 ? '1px solid #EBEBEB' : 'none', paddingRight: 10, paddingLeft: i > 0 ? 10 : 0 }}>
              {item.avatar ? (
                <div className="flex items-center justify-center rounded-full text-white font-bold flex-shrink-0" style={{ width: 28, height: 28, backgroundColor: '#1D4ED8', fontSize: 10 }}>
                  {item.avatar}
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-lg flex-shrink-0" style={{ width: 28, height: 28, backgroundColor: '#F3F4F6' }}>
                  <MI name={item.icon} size={15} color="#6B7280" />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 500, marginBottom: 2 }}>{item.label}</p>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.2 }}>{item.value}</p>
                {item.value2 && <p style={{ fontSize: 10, color: '#6B7280', margin: 0, lineHeight: 1.2 }}>{item.value2}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 mb-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium"
            style={{
              borderBottom: activeTab === tab ? '2px solid #2563EB' : '2px solid transparent',
              color: activeTab === tab ? '#2563EB' : '#6B7280',
              background: 'none', cursor: 'pointer',
              marginBottom: -1,
            }}>
            <MI name={TAB_ICONS[tab]} size={14} color={activeTab === tab ? '#2563EB' : '#9CA3AF'} />
            {tab}
          </button>
        ))}
      </div>

      {/* Overview tab content */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 280px', gap: 16 }}>

          {/* Column 1 — Sample Information */}
          <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #E5E7EB', alignSelf: 'start' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Sample Information</p>
            {[
              ['Sample ID',           s.id],
              ['Client',              s.client],
              ['Project',             s.projectName],
              ['Sample Type',         s.sampleType],
              ['Matrix',              s.matrix],
              ['Collection Date',     s.collectionDate],
              ['Collected By',        s.collectedBy],
              ['Collection Point',    s.collectionPoint],
              ['Container Type',      s.containerType],
              ['Volume',              s.volume],
              ['Temperature on Receipt', s.temperature],
              ['Received By',         s.receivedBy],
              ['Receipt Condition',   s.receiptCondition, 'badge'],
              ['Barcode / Accession', s.barcode],
            ].map(([label, value, type]) => (
              <div key={label as string} className="flex items-start justify-between gap-2 mb-2.5">
                <span style={{ fontSize: 10, color: '#9CA3AF', flexShrink: 0 }}>{label}</span>
                {type === 'badge' ? (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 999, backgroundColor: '#DCFCE7', color: '#166534' }}>{value}</span>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#111827', textAlign: 'right' }}>{value}</span>
                )}
              </div>
            ))}
          </div>

          {/* Column 2 — Analyses + Location + Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Requested Analyses */}
            <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #E5E7EB' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Requested Analyses</p>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                    {['Test / Method', 'Status', 'Priority', 'TAT (Days)', 'Due Date'].map(h => (
                      <th key={h} style={{ fontSize: 9, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '4px 8px 8px', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.analyses.map((a: any, i: number) => {
                    const sb = STATUS_BADGE[a.status] ?? { bg: '#F3F4F6', color: '#6B7280' }
                    const pc = PRIORITY_BADGE[a.priority]?.color ?? '#374151'
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                        <td style={{ padding: '9px 8px', fontSize: 11, color: '#374151', fontWeight: 500 }}>{a.test}</td>
                        <td style={{ padding: '9px 8px' }}>
                          <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 999, backgroundColor: sb.bg, color: sb.color, whiteSpace: 'nowrap' }}>{a.status}</span>
                        </td>
                        <td style={{ padding: '9px 8px', fontSize: 11, fontWeight: 600, color: pc }}>{a.priority}</td>
                        <td style={{ padding: '9px 8px', fontSize: 11, color: '#374151' }}>{a.tat}</td>
                        <td style={{ padding: '9px 8px', fontSize: 11, color: '#374151', whiteSpace: 'nowrap' }}>{a.due}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Location History */}
            <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #E5E7EB' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Location History</p>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                    {['Date / Time', 'Location', 'Action', 'By'].map(h => (
                      <th key={h} style={{ fontSize: 9, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '4px 8px 8px', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.locationHistory.map((l: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                      <td style={{ padding: '8px 8px', fontSize: 10, color: '#6B7280', whiteSpace: 'nowrap' }}>{l.datetime}</td>
                      <td style={{ padding: '8px 8px', fontSize: 10, color: '#374151' }}>{l.location}</td>
                      <td style={{ padding: '8px 8px', fontSize: 10, color: '#374151' }}>{l.action}</td>
                      <td style={{ padding: '8px 8px', fontSize: 10, color: '#374151' }}>{l.by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button style={{ fontSize: 11, color: '#2563EB', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                View full location history <MI name="arrow_forward" size={13} color="#2563EB" />
              </button>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #E5E7EB' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Notes</p>
              {s.notes.map((n: any, i: number) => (
                <div key={i} className="mb-3 p-3 rounded-lg" style={{ backgroundColor: i === 0 ? '#FFFBEB' : '#F9FAFB', border: `1px solid ${i === 0 ? '#FDE68A' : '#F3F4F6'}` }}>
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#6B7280' }}>{n.datetime}</span>
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>by {n.by}</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#374151', margin: 0 }}>{n.text}</p>
                </div>
              ))}
              <button style={{ fontSize: 11, color: '#2563EB', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                View all notes <MI name="arrow_forward" size={13} color="#2563EB" />
              </button>
            </div>
          </div>

          {/* Column 3 — CoC + Attachments */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Chain of Custody Timeline */}
            <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #E5E7EB' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 14 }}>Chain of Custody Timeline</p>
              <div style={{ position: 'relative' }}>
                {s.custody.map((c: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 mb-4" style={{ position: 'relative' }}>
                    {/* Line */}
                    {i < s.custody.length - 1 && (
                      <div style={{ position: 'absolute', left: 9, top: 20, width: 2, height: 'calc(100% + 8px)', backgroundColor: c.done ? '#3B82F6' : '#E5E7EB', zIndex: 0 }} />
                    )}
                    {/* Dot */}
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                      backgroundColor: c.done ? '#3B82F6' : '#fff',
                      border: `2px solid ${c.done ? '#3B82F6' : '#E5E7EB'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {c.done && <MI name="check" size={11} color="#fff" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>{c.label}</span>
                        {c.date && <span style={{ fontSize: 9, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{c.date}</span>}
                      </div>
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 10, color: '#9CA3AF' }}>{c.sub}</span>
                        {c.time && <span style={{ fontSize: 9, color: '#9CA3AF' }}>{c.time}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Attachments */}
            <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #E5E7EB' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Attachments</p>
              {s.attachments.map((att: any, i: number) => (
                <div key={i} className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center rounded-lg" style={{ width: 32, height: 32, backgroundColor: att.type === 'PDF' ? '#FEE2E2' : '#EFF6FF', flexShrink: 0 }}>
                    <MI name={att.type === 'PDF' ? 'picture_as_pdf' : 'image'} size={16} color={att.type === 'PDF' ? '#EF4444' : '#3B82F6'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#374151', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</p>
                    <p style={{ fontSize: 9, color: '#9CA3AF', margin: 0 }}>{att.type}  {att.size} · Uploaded {att.uploaded}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 2 }}><MI name="download" size={15} color="#9CA3AF" /></button>
                    <button style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 2 }}><MI name="more_vert" size={15} color="#9CA3AF" /></button>
                  </div>
                </div>
              ))}
              <button style={{ fontSize: 11, color: '#2563EB', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                View all attachments <MI name="arrow_forward" size={13} color="#2563EB" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder for other tabs */}
      {activeTab !== 'Overview' && (
        <div className="bg-white rounded-xl flex items-center justify-center" style={{ border: '1px solid #E5E7EB', height: 320 }}>
          <div style={{ textAlign: 'center' }}>
            <MI name={TAB_ICONS[activeTab]} size={36} color="#E5E7EB" />
            <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 12 }}>{activeTab} content coming soon</p>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState } from 'react'
import Link from 'next/link'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

/* ── Storage tree data ── */
const TREE = [
  {
    id: 'main-lab', label: 'Main Laboratory', status: 'Open',
    children: [
      {
        id: 'receiving-room', label: 'Receiving Room', status: 'Open',
        children: [
          { id: 'rr1', label: 'Receiving Refrigerator 1', temp: '2–6 °C', used: 12, cap: 50, selected: true },
          { id: 'rr2', label: 'Receiving Refrigerator 2', temp: '2–6 °C', used: 8,  cap: 50 },
        ],
      },
      {
        id: 'quarantine', label: 'Quarantine Refrigerator', status: 'Restricted',
        children: [
          { id: 'qr1', label: 'Quarantine Refrigerator 1', temp: '3–6 °C', used: 5,  cap: 50 },
          { id: 'qr2', label: 'Quarantine Refrigerator 2', temp: '3–6 °C', used: 3,  cap: 50 },
        ],
      },
      {
        id: 'residue', label: 'Residue Lab Refrigerator', status: 'Restricted',
        children: [
          { id: 'rl1', label: 'Residue Lab Refrigerator 1', temp: '2–6 °C', used: 18, cap: 50 },
          { id: 'rl2', label: 'Residue Lab Refrigerator 2', temp: '2–6 °C', used: 14, cap: 50 },
        ],
      },
    ],
  },
  { id: 'archive', label: 'Archive – Freezer', temp: '-20 °C', used: 22, cap: 100, isArchive: true },
]

const STATUS_COLOR: Record<string, string> = {
  Open: '#22C55E', Restricted: '#F59E0B',
}

const COC_EVENTS = [
  {
    id: 1, icon: 'check_circle', iconBg: '#22C55E',
    title: 'Received', date: 'May 18, 2025', time: '09:15 AM',
    fields: [
      { label: 'By',       value: 'Maria Rodriguez' },
      { label: 'Location', value: 'Receiving Room' },
      { label: 'Remarks',  value: 'Sample received from courier.' },
    ],
  },
  {
    id: 2, icon: 'drive_eta', iconBg: '#3B82F6',
    title: 'Moved to Receiving Refrigerator 1', date: 'May 18, 2025', time: '09:45 AM',
    fields: [
      { label: 'By',        value: 'Maria Rodriguez' },
      { label: 'Location',  value: 'Receiving Refrigerator 1' },
      { label: 'Container', value: 'CONT-RR1-000123' },
      { label: 'Remarks',   value: 'Initial storage after receipt.' },
    ],
  },
  {
    id: 3, icon: 'person', iconBg: '#8B5CF6',
    title: 'Released for Testing', date: 'May 18, 2025', time: '11:20 AM',
    fields: [
      { label: 'By',      value: 'James Patel' },
      { label: 'Remarks', value: 'QC review complete. Released for testing.' },
    ],
  },
  {
    id: 4, icon: 'inventory_2', iconBg: '#0891B2',
    title: 'Stored in Residue Lab Refrigerator 1', date: 'May 19, 2025', time: '10:10 AM',
    fields: [
      { label: 'By',        value: 'Alex Smith' },
      { label: 'Location',  value: 'Residue Lab Refrigerator 1' },
      { label: 'Container', value: 'CONT-RL-000456' },
      { label: 'Remarks',   value: 'Transferred for residue analysis.' },
    ],
  },
  {
    id: 5, icon: 'schedule', iconBg: '#F59E0B', current: true,
    title: 'Current Step: Store Sample', date: 'May 19, 2025', time: '10:29 AM',
    fields: [
      { label: 'By',        value: 'Alex Smith' },
      { label: 'Action',    value: 'Store in Receiving Refrigerator 1' },
      { label: 'Container', value: 'CONT-RR1-000123' },
      { label: 'Status',    value: 'In Progress', badge: true },
    ],
  },
]

/* ── Tree node ── */
function TreeNode({ node, depth = 0 }: { node: any; depth?: number }) {
  const [open, setOpen] = useState(true)
  const hasChildren = !!node.children?.length
  const isLeaf      = !hasChildren && !node.isArchive
  const isArchive   = node.isArchive

  return (
    <div>
      {/* Row */}
      <div
        onClick={() => hasChildren && setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: isLeaf ? 'flex-start' : 'center',
          gap: 5, cursor: 'pointer', borderRadius: 6,
          paddingLeft: 6 + depth * 16, paddingRight: 8,
          paddingTop: isLeaf ? 6 : 5, paddingBottom: isLeaf ? 6 : 5,
          backgroundColor: node.selected ? '#EFF6FF' : 'transparent',
        }}
      >
        {/* Expand arrow */}
        <span style={{ width: 14, flexShrink: 0, marginTop: isLeaf ? 2 : 0 }}>
          {hasChildren && <MI name={open ? 'remove' : 'add'} size={13} color="#9CA3AF" />}
        </span>

        {/* Icon */}
        {isArchive ? (
          <MI name="ac_unit" size={15} color="#60A5FA" />
        ) : isLeaf ? (
          /* Refrigerator: small blue square */
          <div style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: node.selected ? '#DBEAFE' : '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
            <MI name="view_agenda" size={12} color={node.selected ? '#1D4ED8' : '#60A5FA'} />
          </div>
        ) : depth === 0 ? (
          /* Building */
          <MI name={open ? 'folder_open' : 'folder'} size={15} color="#F59E0B" />
        ) : (
          /* Room */
          <MI name={open ? 'folder_open' : 'folder'} size={14} color="#F59E0B" />
        )}

        {/* Label + temp */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: 11, fontWeight: node.selected ? 600 : 400,
            color: node.selected ? '#1D4ED8' : '#374151',
            display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {node.label}
          </span>
          {(isLeaf || isArchive) && node.temp && (
            <span style={{ fontSize: 9, color: '#9CA3AF' }}>{node.temp}</span>
          )}
        </div>

        {/* Right side: status OR used/cap */}
        {node.status && (
          <span style={{ fontSize: 9, fontWeight: 600, color: STATUS_COLOR[node.status] ?? '#9CA3AF', flexShrink: 0 }}>
            {node.status}
          </span>
        )}
        {(isLeaf || isArchive) && (
          <span style={{ fontSize: 9, color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {node.used} / {node.cap}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && open && node.children.map((c: any) => (
        <TreeNode key={c.id} node={c} depth={depth + 1} />
      ))}
    </div>
  )
}

export default function ChainOfCustodyPage() {
  const [storageReason, setStorageReason] = useState('Routine Storage')
  const [storageNotes, setStorageNotes]   = useState('')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '216px 1fr 272px', height: '100%', backgroundColor: '#F5F6FA', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>

      {/* ══ LEFT: Storage Location tree ══ */}
      <div className="flex flex-col bg-white" style={{ borderRight: '1px solid #E5E7EB', overflow: 'hidden' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div className="flex items-center gap-1">
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Storage Location</span>
            <MI name="info_outline" size={13} color="#9CA3AF" />
          </div>
          <MI name="chevron_left" size={16} color="#9CA3AF" />
        </div>

        {/* Search */}
        <div className="px-2.5 py-2" style={{ flexShrink: 0 }}>
          <div className="flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ border: '1px solid #E5E7EB', backgroundColor: '#FAFAFA' }}>
            <input placeholder="Search locations..." className="outline-none text-xs flex-1" style={{ color: '#374151', backgroundColor: 'transparent' }} />
            <MI name="search" size={14} color="#9CA3AF" />
          </div>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-1">
          {TREE.map(node => <TreeNode key={node.id} node={node} />)}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-3 py-2.5" style={{ borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div className="flex items-center gap-1.5">
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22C55E', display: 'inline-block' }} />
            <span style={{ fontSize: 10, color: '#6B7280' }}>Open</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F59E0B', display: 'inline-block' }} />
            <span style={{ fontSize: 10, color: '#6B7280' }}>Restricted</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid #60A5FA', display: 'inline-block', backgroundColor: 'transparent' }} />
            <span style={{ fontSize: 10, color: '#6B7280' }}>Archive</span>
          </div>
        </div>
      </div>

      {/* ══ MIDDLE: main content ══ */}
      <div style={{ overflowY: 'auto', padding: '18px 16px 20px 20px' }}>

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-1 mb-1" style={{ fontSize: 11, color: '#9CA3AF' }}>
              <Link href="/dashboard/samples" style={{ color: '#6B7280', textDecoration: 'none' }}>Samples</Link>
              <MI name="chevron_right" size={13} color="#D1D5DB" />
              <Link href="/dashboard/samples/S-25-01987" style={{ color: '#6B7280', textDecoration: 'none' }}>S-25-01987</Link>
              <MI name="chevron_right" size={13} color="#D1D5DB" />
              <span style={{ color: '#374151' }}>Store Sample</span>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Store Sample</h1>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>Store the sample in designated storage and update chain of custody.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              <MI name="print" size={14} color="#6B7280" /> Print Label
            </button>
            <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              More Actions <MI name="keyboard_arrow_down" size={14} color="#6B7280" />
            </button>
          </div>
        </div>

        {/* Sample Information */}
        <div className="bg-white rounded-xl mb-3" style={{ border: '1px solid #E5E7EB', padding: '12px 16px' }}>
          <div className="flex items-center gap-2 mb-3">
            <div style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MI name="verified_user" size={13} color="#3B82F6" />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Sample Information</span>
          </div>
          <div className="flex items-center gap-10">
            {[
              { label: 'Sample ID',        value: 'S-25-01987', bold: true },
              { label: 'Project / Client', value: 'BioPharma Inc.' },
              { label: 'Sample Type',      value: 'Plasma' },
            ].map(f => (
              <div key={f.label}>
                <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 3 }}>{f.label}</p>
                <p style={{ fontSize: 13, fontWeight: f.bold ? 700 : 500, color: '#111827', margin: 0 }}>{f.value}</p>
              </div>
            ))}
            <div>
              <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 3 }}>Status</p>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 10px', borderRadius: 999, backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>In Process</span>
            </div>
          </div>
        </div>

        {/* Barcode Scan */}
        <div className="bg-white rounded-xl mb-3" style={{ border: '1px solid #E5E7EB', padding: '12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'center' }}>
            <div className="flex items-center gap-3">
              <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MI name="view_week" size={22} color="#6B7280" />
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: '0 0 3px' }}>Barcode Scan</p>
                <p style={{ fontSize: 11, color: '#6B7280', margin: 0, lineHeight: 1.4 }}>Scan the storage container barcode<br />Ensure the correct container is selected for storage.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl p-3" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <MI name="check_circle" size={18} color="#22C55E" />
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#166534', margin: '0 0 3px' }}>Barcode Scanned Successfully</p>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: '0 0 1px' }}>CONT-RR1-000123</p>
                <p style={{ fontSize: 10, color: '#6B7280', margin: '0 0 1px' }}>Receiving Refrigerator 1 • Slot 12</p>
                <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>May 19, 2025 10:29 AM</p>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Storage */}
        <div className="bg-white rounded-xl mb-3" style={{ border: '1px solid #E5E7EB', padding: '12px 16px' }}>
          <div className="flex items-center gap-2 mb-3">
            <div style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MI name="inventory_2" size={13} color="#6B7280" />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Selected Storage</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.8fr 1fr', gap: 16 }}>
            <div>
              <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 3 }}>Location</p>
              <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 1px' }}>Main Laboratory {'>'} Receiving Room</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: 0 }}>Receiving Refrigerator 1</p>
            </div>
            <div>
              <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 3 }}>Container / Slot</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>CONT-RR1-000123</p>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999, backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>Slot 12</span>
            </div>
            <div>
              <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 5 }}>Temperature</p>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, backgroundColor: '#CCFBF1', color: '#0F766E' }}>2–6 °C</span>
            </div>
            <div>
              <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 3 }}>Capacity</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>12 / 50 (24%)</p>
              <div style={{ height: 6, borderRadius: 999, backgroundColor: '#E5E7EB', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '24%', backgroundColor: '#3B82F6', borderRadius: 999 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Storage Details */}
        <div className="bg-white rounded-xl mb-4" style={{ border: '1px solid #E5E7EB', padding: '12px 16px' }}>
          <div className="flex items-center gap-2 mb-3">
            <div style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MI name="edit_note" size={13} color="#6B7280" />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Storage Details</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Storage Reason</label>
              <select value={storageReason} onChange={e => setStorageReason(e.target.value)}
                className="w-full outline-none text-xs px-3 py-2 rounded-lg" style={{ border: '1px solid #D1D5DB', color: '#374151', cursor: 'pointer' }}>
                <option>Routine Storage</option><option>QA Hold</option><option>Pending Analysis</option><option>Long-term Archive</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                Storage Notes <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span>
              </label>
              <input value={storageNotes} onChange={e => setStorageNotes(e.target.value)}
                placeholder="Enter notes about storage conditions, observations, etc."
                className="w-full outline-none text-xs px-3 py-2 rounded-lg" style={{ border: '1px solid #D1D5DB', color: '#374151' }} />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium" style={{ border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
            <MI name="qr_code_scanner" size={15} color="#374151" /> Scan Barcode
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium" style={{ border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
            <MI name="place" size={15} color="#374151" /> Assign Storage
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium" style={{ border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
            <MI name="swap_horiz" size={15} color="#374151" /> Transfer Custody
          </button>
          <button className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-xs font-semibold text-white ml-auto" style={{ backgroundColor: '#2563EB', cursor: 'pointer', border: 'none' }}>
            <MI name="check_circle" size={15} color="#fff" /> Confirm Storage
          </button>
        </div>
      </div>

      {/* ══ RIGHT: Chain of Custody ══ */}
      <div className="flex flex-col bg-white" style={{ borderLeft: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div className="flex items-center gap-1">
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Chain of Custody</span>
            <MI name="info_outline" size={13} color="#9CA3AF" />
          </div>
          <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 999, backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>Current Custody</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {COC_EVENTS.map((ev, i) => (
            <div key={ev.id} style={{ display: 'flex', gap: 10, marginBottom: 16, position: 'relative' }}>
              {/* Connector line */}
              {i < COC_EVENTS.length - 1 && (
                <div style={{ position: 'absolute', left: 13, top: 28, width: 2, height: 'calc(100% + 4px)', backgroundColor: '#E5E7EB', zIndex: 0 }} />
              )}
              {/* Icon circle */}
              <div style={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: ev.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                <MI name={ev.icon} size={13} color="#fff" />
              </div>
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>{ev.title}</span>
                  <span style={{ fontSize: 9, color: '#9CA3AF', whiteSpace: 'nowrap', marginLeft: 4, marginTop: 1 }}>{ev.date}</span>
                </div>
                <p style={{ fontSize: 9, color: '#9CA3AF', margin: '0 0 6px' }}>{ev.time}</p>
                {ev.fields.map(f => (
                  <div key={f.label} style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: '#9CA3AF', minWidth: 58, flexShrink: 0 }}>{f.label}</span>
                    {(f as any).badge ? (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 8px', borderRadius: 999, backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>{f.value}</span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 500, color: '#374151' }}>{f.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-3" style={{ borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
          <button className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-xs font-medium"
            style={{ border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
            <MI name="history" size={14} color="#6B7280" /> View Full History
          </button>
        </div>
      </div>
    </div>
  )
}

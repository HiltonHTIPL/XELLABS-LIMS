'use client'
import { useState } from 'react'
import Link from 'next/link'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

/* ── Storage tree data ── */
const TREE = [
  {
    id: 'main-lab', label: 'Main Laboratory', icon: 'apartment', status: 'Open',
    children: [
      {
        id: 'receiving-room', label: 'Receiving Room', icon: 'meeting_room', status: 'Open',
        children: [
          { id: 'rr1', label: 'Receiving Refrigerator 1', icon: 'kitchen', temp: '2–6 °C', used: 12, cap: 50, selected: true },
          { id: 'rr2', label: 'Receiving Refrigerator 2', icon: 'kitchen', temp: '2–6 °C', used: 8,  cap: 50 },
        ],
      },
      {
        id: 'quarantine', label: 'Quarantine Refrigerator', icon: 'meeting_room', status: 'Restricted',
        children: [
          { id: 'qr1', label: 'Quarantine Refrigerator 1', icon: 'kitchen', temp: '2–6 °C', used: 5,  cap: 50 },
          { id: 'qr2', label: 'Quarantine Refrigerator 2', icon: 'kitchen', temp: '2–6 °C', used: 3,  cap: 50 },
        ],
      },
      {
        id: 'residue', label: 'Residue Lab Refrigerator', icon: 'meeting_room', status: 'Restricted',
        children: [
          { id: 'rl1', label: 'Residue Lab Refrigerator 1', icon: 'kitchen', temp: '2–6 °C', used: 18, cap: 50 },
          { id: 'rl2', label: 'Residue Lab Refrigerator 2', icon: 'kitchen', temp: '2–6 °C', used: 14, cap: 50 },
        ],
      },
    ],
  },
  { id: 'archive', label: 'Archive – Freezer', icon: 'ac_unit', temp: '-20 °C', used: 22, cap: 100, isRoot: true },
]

const STATUS_COLOR: Record<string, string> = {
  Open: '#22C55E', Restricted: '#F59E0B', Archive: '#60A5FA',
}

/* ── Chain of custody events ── */
const COC_EVENTS = [
  {
    id: 1, type: 'received', icon: 'check_circle', iconBg: '#22C55E',
    title: 'Received', date: 'May 18, 2025', time: '09:15 AM',
    fields: [
      { label: 'By',       value: 'Maria Rodriguez' },
      { label: 'Location', value: 'Receiving Room' },
      { label: 'Remarks',  value: 'Sample received from courier.' },
    ],
  },
  {
    id: 2, type: 'moved', icon: 'move_down', iconBg: '#3B82F6',
    title: 'Moved to Receiving Refrigerator 1', date: 'May 18, 2025', time: '09:45 AM',
    fields: [
      { label: 'By',        value: 'Maria Rodriguez' },
      { label: 'Container', value: 'CONT-RR1-000123' },
      { label: 'Remarks',   value: 'Initial storage after receipt.' },
    ],
  },
  {
    id: 3, type: 'released', icon: 'person', iconBg: '#8B5CF6',
    title: 'Released for Testing', date: 'May 18, 2025', time: '11:20 AM',
    fields: [
      { label: 'By',      value: 'James Patel' },
      { label: 'Remarks', value: 'QC review complete. Released for testing.' },
    ],
  },
  {
    id: 4, type: 'stored', icon: 'inventory_2', iconBg: '#0891B2',
    title: 'Stored in Residue Lab Refrigerator 1', date: 'May 19, 2025', time: '10:10 AM',
    fields: [
      { label: 'By',        value: 'Alex Smith' },
      { label: 'Location',  value: 'Residue Lab Refrigerator 1' },
      { label: 'Container', value: 'CONT-RL-000456' },
      { label: 'Remarks',   value: 'Transferred for residue analysis.' },
    ],
  },
  {
    id: 5, type: 'current', icon: 'schedule', iconBg: '#F59E0B',
    title: 'Current Step: Store Sample', date: 'May 19, 2025', time: '10:29 AM',
    current: true,
    fields: [
      { label: 'By',        value: 'Alex Smith' },
      { label: 'Action',    value: 'Store in Receiving Refrigerator 1' },
      { label: 'Container', value: 'CONT-RR1-000123' },
      { label: 'Status',    value: 'In Progress', badge: true },
    ],
  },
]

function TreeNode({ node, depth = 0 }: { node: any; depth?: number }) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children?.length > 0
  const isLeaf = !hasChildren

  return (
    <div>
      <div
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"
        style={{
          paddingLeft: 8 + depth * 14,
          backgroundColor: node.selected ? '#EFF6FF' : 'transparent',
          cursor: 'pointer',
        }}
        onClick={() => hasChildren && setOpen(o => !o)}
      >
        {hasChildren && (
          <MI name={open ? 'expand_more' : 'chevron_right'} size={14} color="#9CA3AF" />
        )}
        {!hasChildren && <span style={{ width: 14 }} />}

        <MI
          name={isLeaf ? 'kitchen' : (open ? 'folder_open' : 'folder')}
          size={14}
          color={isLeaf ? '#60A5FA' : '#F59E0B'}
        />

        <span className="flex-1 truncate" style={{ fontSize: 11, color: node.selected ? '#1D4ED8' : '#374151', fontWeight: node.selected ? 600 : 400 }}>
          {node.label}
        </span>

        {node.status && (
          <span style={{ fontSize: 9, fontWeight: 600, color: STATUS_COLOR[node.status] ?? '#9CA3AF' }}>
            {node.status}
          </span>
        )}

        {isLeaf && (
          <span style={{ fontSize: 9, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{node.used}/{node.cap}</span>
        )}
      </div>

      {hasChildren && open && (
        <div>
          {node.children.map((child: any) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ChainOfCustodyPage() {
  const [storageReason, setStorageReason] = useState('Routine Storage')
  const [storageNotes, setStorageNotes] = useState('')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 280px', height: '100%', backgroundColor: '#F5F6FA', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>

      {/* ── Left: Storage Location tree ── */}
      <div className="flex flex-col bg-white" style={{ borderRight: '1px solid #E5E7EB', overflow: 'hidden' }}>
        {/* Tree header */}
        <div className="flex items-center justify-between px-3 py-3" style={{ borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Storage Location</span>
            <MI name="info_outline" size={13} color="#9CA3AF" />
          </div>
          <MI name="chevron_left" size={16} color="#9CA3AF" />
        </div>

        {/* Search */}
        <div className="px-3 py-2" style={{ flexShrink: 0 }}>
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ border: '1px solid #E5E7EB', backgroundColor: '#FAFAFA' }}>
            <MI name="search" size={13} color="#9CA3AF" />
            <input placeholder="Search locations…" className="outline-none text-xs flex-1" style={{ color: '#374151', backgroundColor: 'transparent' }} />
          </div>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto px-1 py-1">
          {TREE.map(node => <TreeNode key={node.id} node={node} />)}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
          {[{ color: '#22C55E', label: 'Open' }, { color: '#F59E0B', label: 'Restricted' }, { color: '#60A5FA', label: 'Archive' }].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: l.color, display: 'inline-block' }} />
              <span style={{ fontSize: 9, color: '#6B7280' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Middle: main content ── */}
      <div style={{ overflowY: 'auto', padding: '18px 16px 20px 20px' }}>

        {/* Breadcrumb + header */}
        <div className="flex items-start justify-between mb-4">
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
        <div className="bg-white rounded-xl mb-3" style={{ border: '1px solid #E5E7EB', padding: '14px 16px' }}>
          <div className="flex items-center gap-2 mb-3">
            <MI name="biotech" size={15} color="#3B82F6" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Sample Information</span>
          </div>
          <div className="flex items-center gap-8">
            {[
              { label: 'Sample ID',       value: 'S-25-01987', bold: true },
              { label: 'Project / Client', value: 'BioPharma Inc.' },
              { label: 'Sample Type',      value: 'Plasma' },
            ].map(f => (
              <div key={f.label}>
                <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 2 }}>{f.label}</p>
                <p style={{ fontSize: 12, fontWeight: f.bold ? 700 : 500, color: '#111827', margin: 0 }}>{f.value}</p>
              </div>
            ))}
            <div>
              <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 2 }}>Status</p>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 10px', borderRadius: 999, backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>In Process</span>
            </div>
          </div>
        </div>

        {/* Barcode Scan */}
        <div className="bg-white rounded-xl mb-3" style={{ border: '1px solid #E5E7EB', padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'center' }}>
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, backgroundColor: '#EFF6FF', flexShrink: 0 }}>
                <MI name="qr_code_scanner" size={20} color="#3B82F6" />
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 3 }}>Barcode Scan</p>
                <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>Scan the storage container barcode</p>
                <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>Ensure the correct container is selected for storage.</p>
              </div>
            </div>
            {/* Scanned result */}
            <div className="flex items-start gap-3 rounded-xl p-3" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <MI name="check_circle" size={18} color="#22C55E" />
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 2 }}>Barcode Scanned Successfully</p>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: 0 }}>CONT-RR1-000123</p>
                <p style={{ fontSize: 10, color: '#6B7280', margin: 0 }}>Receiving Refrigerator 1 • Slot 12</p>
                <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>May 19, 2025 10:29 AM</p>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Storage */}
        <div className="bg-white rounded-xl mb-3" style={{ border: '1px solid #E5E7EB', padding: '14px 16px' }}>
          <div className="flex items-center gap-2 mb-3">
            <MI name="inventory_2" size={15} color="#6B7280" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Selected Storage</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
            <div>
              <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 3 }}>Location</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#111827', margin: 0 }}>Main Laboratory {'>'} Receiving Room</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#111827', margin: 0 }}>Receiving Refrigerator 1</p>
            </div>
            <div>
              <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 3 }}>Container / Slot</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#111827', margin: 0 }}>CONT-RR1-000123</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#111827', margin: 0 }}>Slot 12</p>
            </div>
            <div>
              <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 3 }}>Temperature</p>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, backgroundColor: '#CCFBF1', color: '#0F766E' }}>2–6 °C</span>
            </div>
            <div>
              <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 4 }}>Capacity</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#111827', margin: '0 0 5px' }}>12 / 50 (24%)</p>
              <div style={{ height: 6, borderRadius: 999, backgroundColor: '#E5E7EB', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '24%', backgroundColor: '#3B82F6', borderRadius: 999 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Storage Details */}
        <div className="bg-white rounded-xl mb-4" style={{ border: '1px solid #E5E7EB', padding: '14px 16px' }}>
          <div className="flex items-center gap-2 mb-3">
            <MI name="description" size={15} color="#6B7280" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Storage Details</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Storage Reason</label>
              <select value={storageReason} onChange={e => setStorageReason(e.target.value)}
                className="w-full outline-none text-xs px-3 py-2 rounded-lg" style={{ border: '1px solid #D1D5DB', color: '#374151', cursor: 'pointer' }}>
                <option>Routine Storage</option>
                <option>QA Hold</option>
                <option>Pending Analysis</option>
                <option>Long-term Archive</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Storage Notes <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
              <input value={storageNotes} onChange={e => setStorageNotes(e.target.value)}
                placeholder="Enter notes about storage conditions, observations, etc."
                className="w-full outline-none text-xs px-3 py-2 rounded-lg" style={{ border: '1px solid #D1D5DB', color: '#374151' }} />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {[
            { icon: 'qr_code_scanner', label: 'Scan Barcode',      bg: '#fff',      color: '#374151', border: '#D1D5DB' },
            { icon: 'place',           label: 'Assign Storage',    bg: '#fff',      color: '#374151', border: '#D1D5DB' },
            { icon: 'swap_horiz',      label: 'Transfer Custody',  bg: '#fff',      color: '#374151', border: '#D1D5DB' },
          ].map(b => (
            <button key={b.label} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium"
              style={{ border: `1px solid ${b.border}`, color: b.color, backgroundColor: b.bg, cursor: 'pointer' }}>
              <MI name={b.icon} size={15} color={b.color} />
              {b.label}
            </button>
          ))}
          <button className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-xs font-semibold text-white ml-auto"
            style={{ backgroundColor: '#2563EB', cursor: 'pointer', border: 'none' }}>
            <MI name="check_circle" size={15} color="#fff" />
            Confirm Storage
          </button>
        </div>
      </div>

      {/* ── Right: Chain of Custody ── */}
      <div className="flex flex-col bg-white" style={{ borderLeft: '1px solid #E5E7EB', overflow: 'hidden' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Chain of Custody</span>
            <MI name="info_outline" size={13} color="#9CA3AF" />
          </div>
          <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 999, backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>Current Custody</span>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {COC_EVENTS.map((ev, i) => (
            <div key={ev.id} className="flex gap-3 mb-4" style={{ position: 'relative' }}>
              {/* Vertical line */}
              {i < COC_EVENTS.length - 1 && (
                <div style={{ position: 'absolute', left: 14, top: 26, width: 2, height: 'calc(100% + 8px)', backgroundColor: '#E5E7EB', zIndex: 0 }} />
              )}
              {/* Icon */}
              <div className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 28, height: 28, backgroundColor: ev.iconBg, zIndex: 1 }}>
                <MI name={ev.icon} size={14} color="#fff" />
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1 mb-1.5">
                  <span style={{ fontSize: 11, fontWeight: 700, color: ev.current ? '#92400E' : '#111827', lineHeight: 1.3 }}>{ev.title}</span>
                  <span style={{ fontSize: 9, color: '#9CA3AF', whiteSpace: 'nowrap', marginTop: 1 }}>{ev.date}</span>
                </div>
                <p style={{ fontSize: 9, color: '#9CA3AF', margin: '0 0 5px' }}>{ev.time}</p>
                {ev.fields.map(f => (
                  <div key={f.label} className="flex items-start gap-1 mb-1">
                    <span style={{ fontSize: 10, color: '#9CA3AF', minWidth: 60, flexShrink: 0 }}>{f.label}</span>
                    {f.badge ? (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 7px', borderRadius: 999, backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>{f.value}</span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 500, color: '#374151' }}>{f.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* View Full History */}
        <div className="px-4 py-3" style={{ borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
          <button className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-xs font-medium"
            style={{ border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
            <MI name="history" size={14} color="#6B7280" />
            View Full History
          </button>
        </div>
      </div>
    </div>
  )
}

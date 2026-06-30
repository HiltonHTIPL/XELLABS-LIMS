'use client'
import { useState } from 'react'
import Link from 'next/link'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const STATS = [
  { label: 'Received',       value: '1,248', change: '▲ 12.5%', up: true,  period: 'vs Apr 18 – Apr 24', icon: 'science',       iconBg: '#EFF6FF', iconColor: '#3B82F6' },
  { label: 'In Process',     value: '872',   change: '▲ 8.3%',  up: false, period: 'vs Apr 18 – Apr 24', icon: 'autorenew',     iconBg: '#FFF7ED', iconColor: '#F97316' },
  { label: 'To Be Verified', value: '204',   change: '▲ 4.1%',  up: false, period: 'vs Apr 18 – Apr 24', icon: 'fact_check',    iconBg: '#F0FDFA', iconColor: '#14B8A6' },
  { label: 'On Hold for QA', value: '18',    change: '▲ 5.6%',  up: false, period: 'vs Apr 18 – Apr 24', icon: 'pause_circle',  iconBg: '#FFFBEB', iconColor: '#F59E0B' },
  { label: 'Completed',      value: '892',   change: '▲ 15.2%', up: true,  period: 'vs Apr 18 – Apr 24', icon: 'check_circle',  iconBg: '#F0FDF4', iconColor: '#22C55E' },
  { label: 'Overdue',        value: '32',    change: '▲ 14.7%', up: false, period: 'vs Apr 18 – Apr 24', icon: 'alarm',         iconBg: '#FEF2F2', iconColor: '#EF4444' },
]

const SAMPLES = [
  { id: 'S-25-01987', client: 'BioPharma Inc.',  type: 'Plasma',  condition: 'Acceptable',  status: 'In Process',    priority: 'High',   received: 'May 19, 2025', due: 'May 26, 2025', analyst: 'Jane Doe',     storage: 'Rack B / Box 05'      },
  { id: 'S-25-01986', client: 'Gentech Labs',    type: 'Serum',   condition: 'Acceptable',  status: 'Received',      priority: 'Medium', received: 'May 19, 2025', due: 'May 26, 2025', analyst: 'John Smith',   storage: 'Rack A / Box 12'      },
  { id: 'S-25-01985', client: 'Novus LLC',       type: 'Water',   condition: 'Acceptable',  status: 'To Be Verified',priority: 'High',   received: 'May 18, 2025', due: 'May 25, 2025', analyst: 'Mike Johnson', storage: 'Cabinet 2 / Shelf 01' },
  { id: 'S-25-01984', client: 'BioPharma Inc.',  type: 'Tissue',  condition: 'Compromised', status: 'On Hold for QA',priority: 'High',   received: 'May 17, 2025', due: 'May 24, 2025', analyst: 'Jane Doe',     storage: 'Rack C / Box 03'      },
  { id: 'S-25-01983', client: 'Apex Biologics',  type: 'Plasma',  condition: 'Acceptable',  status: 'Completed',     priority: 'Low',    received: 'May 17, 2025', due: 'May 22, 2025', analyst: 'Emily Clark',  storage: 'Rack A / Box 01'      },
  { id: 'S-25-01982', client: 'PharmaCore',      type: 'Urine',   condition: 'Acceptable',  status: 'In Process',    priority: 'Medium', received: 'May 16, 2025', due: 'May 23, 2025', analyst: 'John Smith',   storage: 'Rack B / Box 07'      },
  { id: 'S-25-01981', client: 'Gentech Labs',    type: 'Saliva',  condition: 'Acceptable',  status: 'To Be Verified',priority: 'Low',    received: 'May 16, 2025', due: 'May 23, 2025', analyst: 'Mike Johnson', storage: 'Cabinet 1 / Shelf 02' },
  { id: 'S-25-01980', client: 'Novus LLC',       type: 'Plasma',  condition: 'Acceptable',  status: 'Received',      priority: 'Medium', received: 'May 15, 2025', due: 'May 22, 2025', analyst: 'Emily Clark',  storage: 'Rack A / Box 08'      },
]

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  'In Process':     { bg: '#DBEAFE', color: '#1E40AF' },
  'Received':       { bg: '#CCFBF1', color: '#0F766E' },
  'To Be Verified': { bg: '#FEF3C7', color: '#92400E' },
  'On Hold for QA': { bg: '#FEE2E2', color: '#991B1B' },
  'Completed':      { bg: '#DCFCE7', color: '#166534' },
}

const PRIORITY_BADGE: Record<string, { bg: string; color: string }> = {
  High:   { bg: '#FEE2E2', color: '#B91C1C' },
  Medium: { bg: '#FEF3C7', color: '#92400E' },
  Low:    { bg: '#DCFCE7', color: '#166534' },
}

const ALERTS = [
  { icon: 'alarm',        iconColor: '#EF4444', title: '32 samples are overdue',       sub: 'Require immediate attention', badge: 'High',   badgeBg: '#FEE2E2', badgeColor: '#B91C1C' },
  { icon: 'pause_circle', iconColor: '#F59E0B', title: '18 samples on hold for QA',    sub: 'Awaiting quality review',     badge: 'Medium', badgeBg: '#FEF3C7', badgeColor: '#92400E' },
  { icon: 'info',         iconColor: '#3B82F6', title: '204 samples to be verified',   sub: 'Pending verification step',   badge: 'Info',   badgeBg: '#DBEAFE', badgeColor: '#1E40AF' },
]

const SAVED_VIEWS = [
  { icon: 'person',         label: 'My Samples',            count: 156,   countColor: '#6B7280' },
  { icon: 'priority_high',  label: 'High Priority Samples', count: 312,   countColor: '#EF4444' },
  { icon: 'alarm',          label: 'Overdue Samples',        count: 32,    countColor: '#EF4444' },
  { icon: 'group',          label: 'Samples by Client',      count: 1248,  countColor: '#6B7280' },
]

const QUICK_ACTIONS = [
  { label: 'New Sample',     icon: 'add_circle',    color: '#2563EB', bg: '#EFF6FF' },
  { label: 'Receive Sample', icon: 'move_to_inbox', color: '#0D9488', bg: '#F0FDFA' },
  { label: 'Export Samples', icon: 'upload',        color: '#7C3AED', bg: '#F5F3FF' },
  { label: 'Bulk Actions',   icon: 'apps',          color: '#EA580C', bg: '#FFF7ED' },
]

export default function SamplesPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [allSelected, setAllSelected] = useState(false)

  function toggleAll() {
    if (allSelected) { setSelected(new Set()); setAllSelected(false) }
    else { setSelected(new Set(SAMPLES.map(s => s.id))); setAllSelected(true) }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div style={{ backgroundColor: '#F5F6FA', minHeight: '100%', padding: '16px 20px 0', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#111827' }}>Samples</h1>
          <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Manage and track laboratory samples throughout their lifecycle.</p>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <MI name="schedule" size={13} color="#9CA3AF" />
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>Last updated: May 19, 2025 10:30 AM</span>
          <button className="p-1 rounded hover:bg-gray-200" style={{ cursor: 'pointer' }}>
            <MI name="refresh" size={14} color="#9CA3AF" />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-6 gap-2.5 mb-4">
        {STATS.map(s => (
          <div key={s.label} className="bg-white rounded-xl p-3" style={{ border: '1px solid #E5E7EB' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.iconBg }}>
                <MI name={s.icon} size={16} color={s.iconColor} />
              </div>
              <span className="text-xs font-semibold" style={{ color: s.up ? '#16A34A' : '#D97706' }}>{s.change}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#111827', lineHeight: 1 }}>{s.value}</p>
            <p className="text-xs font-medium mt-1" style={{ color: '#374151' }}>{s.label}</p>
            <p style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>{s.period}</p>
          </div>
        ))}
      </div>

      {/* ── Main 2-column layout ── */}
      <div className="flex gap-3 pb-4">

        {/* ── LEFT: Filters + Table ── */}
        <div className="flex-1 min-w-0">

          {/* Filters */}
          <div className="bg-white rounded-xl mb-3" style={{ border: '1px solid #E5E7EB', padding: '12px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1.7fr auto auto', gap: 8, alignItems: 'end' }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Search Samples</p>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ border: '1px solid #E5E7EB', backgroundColor: '#FAFAFA' }}>
                  <MI name="search" size={14} color="#9CA3AF" />
                  <input type="text" placeholder="Search by Sample ID, Project, or Client..." className="flex-1 text-xs bg-transparent outline-none" style={{ color: '#374151', minWidth: 0 }} />
                </div>
              </div>
              {[
                { label: 'Sample Type', opts: ['All Types','Plasma','Serum','Water','Tissue','Urine','Saliva'] },
                { label: 'Client',      opts: ['All Clients','BioPharma Inc.','Gentech Labs','Novus LLC','Apex Biologics','PharmaCore'] },
                { label: 'Status',      opts: ['All Statuses','Received','In Process','To Be Verified','On Hold for QA','Completed','Overdue'] },
                { label: 'Priority',    opts: ['All Priorities','High','Medium','Low'] },
              ].map(f => (
                <div key={f.label}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{f.label}</p>
                  <select className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none" style={{ border: '1px solid #E5E7EB', backgroundColor: '#FAFAFA', color: '#374151', cursor: 'pointer' }}>
                    {f.opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Date Range</p>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ border: '1px solid #E5E7EB', backgroundColor: '#FAFAFA', cursor: 'pointer' }}>
                  <MI name="calendar_today" size={12} color="#9CA3AF" />
                  <span style={{ fontSize: 10, color: '#374151', whiteSpace: 'nowrap' }}>May 12 – May 19, 2025</span>
                </div>
              </div>
              <button className="text-xs px-3 py-1.5 rounded-lg" style={{ border: '1px solid #E5E7EB', color: '#6B7280', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Clear
              </button>
              <button className="text-xs px-3 py-1.5 rounded-lg text-white font-semibold" style={{ backgroundColor: '#2563EB', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Apply Filters
              </button>
            </div>
            <button className="flex items-center gap-1 mt-2 text-xs" style={{ color: '#6B7280', cursor: 'pointer' }}>
              <MI name="filter_list" size={13} color="#6B7280" />
              More Filters
            </button>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: '#2563EB', cursor: 'pointer' }}>
                <MI name="add" size={14} color="#fff" /> New Sample
              </button>
              <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg" style={{ border: '1px solid #E5E7EB', color: '#374151', cursor: 'pointer' }}>
                <MI name="move_to_inbox" size={14} color="#6B7280" /> Receive Sample
              </button>
              <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg" style={{ border: '1px solid #E5E7EB', color: '#374151', cursor: 'pointer' }}>
                <MI name="upload" size={14} color="#6B7280" /> Export
              </button>
              <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg" style={{ border: '1px solid #E5E7EB', color: '#374151', cursor: 'pointer' }}>
                Bulk Actions <MI name="keyboard_arrow_down" size={14} color="#6B7280" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 11, color: '#6B7280' }}>Show</span>
                <select className="text-xs rounded px-1.5 py-0.5 outline-none" style={{ border: '1px solid #E5E7EB', color: '#374151', cursor: 'pointer' }}>
                  <option>25</option><option>50</option><option>100</option>
                </select>
              </div>
              <span style={{ fontSize: 11, color: '#6B7280' }}>1–25 of 1,248</span>
              <div className="flex items-center gap-0.5">
                <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-200" style={{ cursor: 'pointer' }}>
                  <MI name="chevron_left" size={16} color="#9CA3AF" />
                </button>
                {[1,2,3,4,5].map(n => (
                  <button key={n} className="w-6 h-6 rounded flex items-center justify-center text-xs font-medium" style={{ backgroundColor: n===1?'#2563EB':'transparent', color: n===1?'#fff':'#6B7280', cursor: 'pointer' }}>{n}</button>
                ))}
                <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-200" style={{ cursor: 'pointer' }}>
                  <MI name="chevron_right" size={16} color="#9CA3AF" />
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                    <th className="px-3 py-2.5 text-left" style={{ width: 36 }}>
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: '#2563EB', cursor: 'pointer' }} />
                    </th>
                    {[
                      { label: 'Sample ID',        w: 100 },
                      { label: 'Client',            w: 120 },
                      { label: 'Sample Type',       w: 90  },
                      { label: 'Condition',         w: 100 },
                      { label: 'Status',            w: 120 },
                      { label: 'Priority',          w: 80  },
                      { label: 'Received Date ↓',   w: 110 },
                      { label: 'Due Date',          w: 100 },
                      { label: 'Assigned Analyst',  w: 110 },
                      { label: 'Storage',           w: 130 },
                      { label: 'Actions',           w: 60  },
                    ].map(h => (
                      <th key={h.label} style={{ width: h.w, padding: '10px 8px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SAMPLES.map((s, i) => {
                    const sb = STATUS_BADGE[s.status]   ?? { bg: '#F3F4F6', color: '#374151' }
                    const pb = PRIORITY_BADGE[s.priority] ?? { bg: '#F3F4F6', color: '#374151' }
                    return (
                      <tr key={s.id} style={{ borderBottom: i < SAMPLES.length-1 ? '1px solid #F9FAFB' : 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor='#FAFAFA')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor='')}>
                        <td className="px-3 py-2.5">
                          <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} style={{ accentColor: '#2563EB', cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                          <Link href={`/dashboard/samples/${s.id}`} style={{ fontSize: 12, fontWeight: 600, color: '#2563EB', textDecoration: 'none', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                            {s.id}
                          </Link>
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>{s.client}</td>
                        <td style={{ padding: '10px 8px', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>{s.type}</td>
                        <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                          <div className="flex items-center gap-1.5">
                            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: s.condition==='Acceptable'?'#22C55E':'#EF4444', flexShrink: 0, display: 'inline-block' }} />
                            <span style={{ fontSize: 12, color: '#374151' }}>{s.condition}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, backgroundColor: sb.bg, color: sb.color, whiteSpace: 'nowrap' }}>{s.status}</span>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, backgroundColor: pb.bg, color: pb.color }}>{s.priority}</span>
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>{s.received}</td>
                        <td style={{ padding: '10px 8px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>{s.due}</td>
                        <td style={{ padding: '10px 8px', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>{s.analyst}</td>
                        <td style={{ padding: '10px 8px', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>{s.storage}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <button className="p-1 rounded hover:bg-gray-100" style={{ cursor: 'pointer' }}>
                            <MI name="more_vert" size={16} color="#9CA3AF" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 11, color: '#6B7280' }}>Showing 1 to 25 of 1,248 results</span>
              <div className="flex items-center gap-0.5">
                <button className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100" style={{ cursor: 'pointer' }}>
                  <MI name="chevron_left" size={16} color="#9CA3AF" />
                </button>
                {[1,2,3,4,5].map(n => (
                  <button key={n} className="w-7 h-7 rounded flex items-center justify-center text-xs font-medium" style={{ backgroundColor: n===1?'#2563EB':'transparent', color: n===1?'#fff':'#6B7280', cursor: 'pointer' }}>{n}</button>
                ))}
                <button className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100" style={{ cursor: 'pointer' }}>
                  <MI name="chevron_right" size={16} color="#9CA3AF" />
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* ── RIGHT panel ── */}
        <div style={{ width: 256, flexShrink: 0 }}>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl mb-3" style={{ border: '1px solid #E5E7EB' }}>
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <h3 className="text-xs font-semibold" style={{ color: '#111827' }}>Quick Actions</h3>
            </div>
            <div className="grid grid-cols-4 gap-1.5 p-3">
              {QUICK_ACTIONS.map(a => (
                <button key={a.label} className="flex flex-col items-center justify-center gap-1 rounded-xl py-3 px-1 text-center" style={{ backgroundColor: a.bg, cursor: 'pointer' }}>
                  <MI name={a.icon} size={20} color={a.color} />
                  <span style={{ fontSize: 9, color: a.color, fontWeight: 600, lineHeight: 1.2 }}>{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="bg-white rounded-xl mb-3" style={{ border: '1px solid #E5E7EB' }}>
            <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <h3 className="text-xs font-semibold" style={{ color: '#111827' }}>Recent Alerts</h3>
              <a href="#" className="text-xs font-medium" style={{ color: '#2563EB' }}>View all</a>
            </div>
            <div className="px-3 py-1">
              {ALERTS.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: i < ALERTS.length-1 ? '1px solid #F9FAFB' : 'none' }}>
                  <MI name={a.icon} size={16} color={a.iconColor} />
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#111827', lineHeight: 1.3 }}>{a.title}</p>
                    <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{a.sub}</p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 999, backgroundColor: a.badgeBg, color: a.badgeColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {a.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Saved Views */}
          <div className="bg-white rounded-xl" style={{ border: '1px solid #E5E7EB' }}>
            <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <h3 className="text-xs font-semibold" style={{ color: '#111827' }}>Saved Views</h3>
              <a href="#" className="text-xs font-medium" style={{ color: '#2563EB' }}>View all</a>
            </div>
            <div className="px-3 py-1">
              {SAVED_VIEWS.map((v, i) => (
                <div key={i} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < SAVED_VIEWS.length-1 ? '1px solid #F9FAFB' : 'none', cursor: 'pointer' }}>
                  <div className="flex items-center gap-2">
                    <MI name={v.icon} size={14} color="#9CA3AF" />
                    <span style={{ fontSize: 12, color: '#374151' }}>{v.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: v.countColor }}>{v.count.toLocaleString()}</span>
                </div>
              ))}
              <button className="flex items-center justify-center gap-1.5 w-full py-2 mt-1 rounded-lg text-xs font-medium" style={{ border: '1px dashed #D1D5DB', color: '#2563EB', cursor: 'pointer' }}>
                <MI name="add" size={14} color="#2563EB" />
                Save New View
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

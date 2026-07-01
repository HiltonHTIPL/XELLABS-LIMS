import Link from 'next/link'
import { getSession } from '@/app/lib/session'
import { TrendChart, StatusDonut } from './_components/DashboardCharts'

function MI({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

/* ── KPI cards ── */
const STATS = [
  { label: 'Samples Received', value: '1,248', change: '▲ 12.5%', up: true,  period: 'vs Apr 18 – Apr 24', icon: 'science',              iconBg: '#EFF6FF', iconColor: '#3B82F6' },
  { label: 'To Be Tested',     value: '326',   change: '▲ 8.3%',  up: false, period: 'vs Apr 18 – Apr 24', icon: 'assignment',            iconBg: '#FFF7ED', iconColor: '#F97316' },
  { label: 'To Be Verified',   value: '204',   change: '▲ 4.1%',  up: false, period: 'vs Apr 18 – Apr 24', icon: 'fact_check',            iconBg: '#F0FDFA', iconColor: '#14B8A6' },
  { label: 'On Hold for QA',   value: '18',    change: '▲ 5.6%',  up: false, period: 'vs Apr 18 – Apr 24', icon: 'pause_circle',          iconBg: '#FFFBEB', iconColor: '#F59E0B' },
  { label: 'Completed',        value: '892',   change: '▲ 15.2%', up: true,  period: 'vs Apr 18 – Apr 24', icon: 'check_circle',          iconBg: '#F0FDF4', iconColor: '#22C55E' },
  { label: 'Overdue',          value: '32',    change: '▲ 14.7%', up: false, period: 'vs Apr 18 – Apr 24', icon: 'warning_amber',         iconBg: '#FEF2F2', iconColor: '#EF4444' },
]

/* ── Tasks ── */
const TASKS = [
  { text: 'Verify results for Sample S-25-01987',    priority: 'High'   },
  { text: 'Approve QA review – Batch B-25-0042',     priority: 'High'   },
  { text: 'Review COA for Sample S-25-01902',        priority: 'Medium' },
  { text: 'Calibrate LC-MS Instrument 03',           priority: 'Medium' },
  { text: 'Inventory check for −20 °C Freezers',     priority: 'Low'    },
  { text: 'Review overdue samples',                  priority: 'Low'    },
]

const PRIORITY: Record<string, { bg: string; color: string }> = {
  High:   { bg: '#FEE2E2', color: '#B91C1C' },
  Medium: { bg: '#FEF3C7', color: '#92400E' },
  Low:    { bg: '#DCFCE7', color: '#166534' },
}

/* ── Quick actions ── */
const QUICK_ACTIONS = [
  { label: 'New Sample',     icon: 'add_circle',   bg: '#EFF6FF', color: '#2563EB', href: '/dashboard/samples' },
  { label: 'Receive Sample', icon: 'move_to_inbox', bg: '#F0FDFA', color: '#0D9488', href: '/dashboard/sample-receipts' },
  { label: 'Store Sample',   icon: 'inventory_2',  bg: '#F5F3FF', color: '#7C3AED', href: '/dashboard/samples' },
  { label: 'Create Report',  icon: 'bar_chart',    bg: '#FFF7ED', color: '#EA580C', href: '/dashboard/reports' },
]

/* ── Recent samples ── */
const SAMPLES = [
  { id: 'S-25-01987', client: 'BioPharma Inc.',  type: 'Plasma',  status: 'In Process',    received: 'May 19, 2025', due: 'May 26, 2025', tat: 2 },
  { id: 'S-25-01986', client: 'Gentech Labs',    type: 'Serum',   status: 'Received',      received: 'May 19, 2025', due: 'May 27, 2025', tat: 1 },
  { id: 'S-25-01985', client: 'Novesis LLC',     type: 'Water',   status: 'To Be Verified', received: 'May 18, 2025', due: 'May 25, 2025', tat: 3 },
  { id: 'S-25-01984', client: 'BioPharma Inc.',  type: 'Tissue',  status: 'On Hold for QA', received: 'May 17, 2025', due: 'May 24, 2025', tat: 4 },
  { id: 'S-25-01983', client: 'Apex Biologics',  type: 'Plasma',  status: 'Completed',     received: 'May 17, 2025', due: 'May 22, 2025', tat: 5 },
]

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  'In Process':     { bg: '#DBEAFE', color: '#1E40AF' },
  'Received':       { bg: '#CCFBF1', color: '#0F766E' },
  'To Be Verified': { bg: '#FEF3C7', color: '#92400E' },
  'On Hold for QA': { bg: '#FEE2E2', color: '#991B1B' },
  'Completed':      { bg: '#DCFCE7', color: '#166534' },
}

/* ── Page ── */
export default async function DashboardPage() {
  await getSession()

  return (
    <div style={{ backgroundColor: '#F5F6FA', minHeight: '100%', padding: '16px 20px 0', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#111827' }}>Dashboard</h1>
          <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Overview of laboratory operations and key performance indicators.</p>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <MI name="schedule" size={13} color="#9CA3AF" />
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>Last updated: May 19, 2025 10:30 AM</span>
          <button className="p-1 rounded hover:bg-gray-200">
            <MI name="refresh" size={14} color="#9CA3AF" />
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-6 gap-2.5 mb-3">
        {STATS.map(s => (
          <div key={s.label} className="bg-white rounded-xl p-3" style={{ border: '1px solid #E5E7EB' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.iconBg }}>
                <MI name={s.icon} size={16} color={s.iconColor} />
              </div>
              <span className="text-xs font-semibold" style={{ color: s.up ? '#16A34A' : '#D97706' }}>
                {s.change}
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#111827', lineHeight: 1 }}>{s.value}</p>
            <p className="text-xs font-medium mt-1" style={{ color: '#374151' }}>{s.label}</p>
            <p style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>{s.period}</p>
          </div>
        ))}
      </div>

      {/* ── Charts + Tasks: 3 columns ── */}
      <div className="grid gap-2.5 mb-2.5" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>

        {/* TAT trend chart */}
        <TrendChart />

        {/* Status mix donut */}
        <StatusDonut />

        {/* Tasks & Announcements */}
        <div className="bg-white rounded-xl flex flex-col" style={{ border: '1px solid #E5E7EB' }}>
          {/* Tab bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <button className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#2563EB', color: '#fff' }}>
              Tasks
              <span className="w-4 h-4 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.25)', fontSize: 9 }}>6</span>
            </button>
            <button className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ color: '#6B7280' }}>
              Announcements
              <span className="w-4 h-4 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: '#F3F4F6', fontSize: 9, color: '#374151' }}>2</span>
            </button>
          </div>

          {/* Task list */}
          <div className="flex-1 px-4 py-1 overflow-y-auto">
            {TASKS.map((t, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: i < TASKS.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                <input type="checkbox" className="mt-0.5 rounded shrink-0" style={{ accentColor: '#2563EB' }} />
                <span className="flex-1 text-xs leading-snug" style={{ color: '#374151' }}>{t.text}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: PRIORITY[t.priority].bg, color: PRIORITY[t.priority].color }}>
                  {t.priority}
                </span>
              </div>
            ))}
          </div>

          {/* Footer link */}
          <div className="px-4 py-2.5 shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button className="flex items-center gap-1 text-xs font-medium" style={{ color: '#2563EB' }}>
              View all tasks <MI name="arrow_forward" size={12} color="#2563EB" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Recent Samples + Quick Actions ── */}
      <div className="grid gap-2.5 mb-4" style={{ gridTemplateColumns: '1fr 220px' }}>

        {/* Recent Samples table */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <h3 className="text-sm font-semibold" style={{ color: '#111827' }}>Recent Samples</h3>
            <a href="#" className="flex items-center gap-1 text-xs font-medium" style={{ color: '#2563EB' }}>
              View All Samples <MI name="arrow_forward" size={12} color="#2563EB" />
            </a>
          </div>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '13%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '11%' }} />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                {['Sample ID', 'Project / Client', 'Sample Type', 'Status', 'Received Date', 'Due Date', 'TAT (Days)'].map(h => (
                  <th key={h} className="px-3 py-2 text-left" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SAMPLES.map((s, i) => {
                const badge = STATUS_BADGE[s.status] ?? { bg: '#F3F4F6', color: '#374151' }
                return (
                  <tr key={s.id} className="hover:bg-gray-50" style={{ borderBottom: i < SAMPLES.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-semibold" style={{ color: '#2563EB' }}>{s.id}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#374151' }}>{s.client}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#374151' }}>{s.type}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: badge.bg, color: badge.color }}>{s.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{s.received}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{s.due}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-center" style={{ color: '#374151' }}>{s.tat}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <h3 className="text-xs font-semibold" style={{ color: '#111827' }}>Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            {QUICK_ACTIONS.map(a => (
              <Link
                key={a.label}
                href={a.href}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl py-4 px-2 text-center"
                style={{ backgroundColor: a.bg, textDecoration: 'none' }}
              >
                <MI name={a.icon} size={22} color={a.color} />
                <span style={{ fontSize: 10, color: a.color, fontWeight: 600, lineHeight: 1.2 }}>{a.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>


    </div>
  )
}

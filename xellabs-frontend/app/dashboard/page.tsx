import Link from 'next/link'
import { getSession } from '@/app/lib/session'
import { TrendChart, StatusDonut } from './_components/DashboardCharts'
import { T, MI, PageHeader, StatCard, Card, Chip, thStyle, tdStyle, linkStyle } from './_components/ui'

const STATS = [
  { label: 'Samples Received', value: '1,248', delta: '12.5%', deltaTone: 'up-good' as const, sub: 'vs Apr 18 – Apr 24', icon: 'science',        iconBg: '#EFF6FF', iconColor: T.primary },
  { label: 'To Be Tested',     value: '326',   delta: '8.3%',  deltaTone: 'up-warn' as const, sub: 'vs Apr 18 – Apr 24', icon: 'assignment',      iconBg: '#FFF7ED', iconColor: T.warning },
  { label: 'To Be Verified',   value: '204',   delta: '4.1%',  deltaTone: 'up-warn' as const, sub: 'vs Apr 18 – Apr 24', icon: 'fact_check',      iconBg: '#DBEAFE', iconColor: T.teal },
  { label: 'On Hold for QA',   value: '18',    delta: '5.6%',  deltaTone: 'up-warn' as const, sub: 'vs Apr 18 – Apr 24', icon: 'pause_circle',    iconBg: '#FFFBEB', iconColor: '#F59E0B' },
  { label: 'Completed',        value: '892',   delta: '15.2%', deltaTone: 'up-good' as const, sub: 'vs Apr 18 – Apr 24', icon: 'check_circle',    iconBg: '#DBEAFE', iconColor: T.success },
  { label: 'Overdue',          value: '32',    delta: '14.7%', deltaTone: 'up-bad'  as const, sub: 'vs Apr 18 – Apr 24', icon: 'warning_amber',   iconBg: '#FEF2F2', iconColor: T.danger },
]

const TASKS = [
  { text: 'Verify results for Sample S-25-01987',    priority: 'High'   },
  { text: 'Approve QA review – Batch B-25-0042',     priority: 'High'   },
  { text: 'Review COA for Sample S-25-01902',        priority: 'Medium' },
  { text: 'Calibrate LC-MS Instrument 03',           priority: 'Medium' },
  { text: 'Inventory check for -20 C Freezers',      priority: 'Low'    },
  { text: 'Review overdue samples',                  priority: 'Low'    },
]

const PRIORITY_TONE: Record<string, 'red' | 'orange' | 'green'> = {
  High: 'red', Medium: 'orange', Low: 'green',
}

const QUICK_ACTIONS = [
  { label: 'New Sample',     icon: 'add_circle',   bg: '#EFF6FF', color: T.primary,  href: '/dashboard/samples/new' },
  { label: 'Receive Sample', icon: 'move_to_inbox',bg: '#DBEAFE', color: T.teal,     href: '/dashboard/sample-receipts' },
  { label: 'Store Sample',   icon: 'inventory_2',  bg: '#F5F3FF', color: '#7C3AED',  href: '/dashboard/storage' },
  { label: 'Create Report',  icon: 'bar_chart',    bg: '#FFF7ED', color: T.warning,  href: '/dashboard/reports' },
]

const SAMPLES = [
  { id: 'S-25-01987', client: 'BioPharma Inc.', type: 'Plasma',  status: 'In Process',     received: 'May 19, 2025', due: 'May 26, 2025', tat: 2 },
  { id: 'S-25-01986', client: 'Gentech Labs',   type: 'Serum',   status: 'Received',       received: 'May 19, 2025', due: 'May 27, 2025', tat: 1 },
  { id: 'S-25-01985', client: 'Novesis LLC',    type: 'Water',   status: 'To Be Verified', received: 'May 18, 2025', due: 'May 25, 2025', tat: 3 },
  { id: 'S-25-01984', client: 'BioPharma Inc.', type: 'Tissue',  status: 'On Hold for QA', received: 'May 17, 2025', due: 'May 24, 2025', tat: 4 },
  { id: 'S-25-01983', client: 'Apex Biologics', type: 'Plasma',  status: 'Completed',      received: 'May 17, 2025', due: 'May 22, 2025', tat: 5 },
]

const STATUS_TONE: Record<string, 'blue'|'teal'|'orange'|'red'|'green'|'gray'> = {
  'In Process': 'blue', 'Received': 'teal', 'To Be Verified': 'orange', 'On Hold for QA': 'red', 'Completed': 'green',
}

export default async function DashboardPage() {
  await getSession()

  return (
    <div style={{ backgroundColor: T.pageBg, minHeight: '100%', padding: '20px 20px 0', boxSizing: 'border-box' }}>

      <PageHeader
        title="Dashboard"
        subtitle="Overview of laboratory operations and key performance indicators."
        right={
          <div className="flex items-center gap-1.5">
            <MI name="schedule" size={13} color={T.faint} />
            <span style={{ fontSize: 11, color: T.faint }}>Last updated: May 19, 2025 10:30 AM</span>
            <button className="p-1 rounded hover:bg-gray-200" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <MI name="refresh" size={14} color={T.faint} />
            </button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-6 gap-3 mb-4">
        {STATS.map(s => (
          <StatCard key={s.label} icon={s.icon} iconBg={s.iconBg} iconColor={s.iconColor}
            label={s.label} value={s.value} delta={s.delta} deltaTone={s.deltaTone} sub={s.sub} />
        ))}
      </div>

      {/* Charts + Tasks */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>
        <TrendChart />
        <StatusDonut />

        {/* Tasks */}
        <Card pad={false}>
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${T.rowBorder}` }}>
            <button className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: T.primary, color: '#fff', border: 'none', cursor: 'pointer' }}>
              Tasks
              <span className="w-4 h-4 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.25)', fontSize: 9 }}>6</span>
            </button>
            <button className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ color: T.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
              Announcements
              <span className="w-4 h-4 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: '#F3F4F6', fontSize: 9, color: T.text }}>2</span>
            </button>
          </div>
          <div className="flex-1 px-4 py-1 overflow-y-auto">
            {TASKS.map((t, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: i < TASKS.length - 1 ? `1px solid ${T.rowBorder}` : 'none' }}>
                <input type="checkbox" className="mt-0.5 rounded shrink-0" style={{ accentColor: T.primary }} />
                <span className="flex-1 text-xs leading-snug" style={{ color: T.text }}>{t.text}</span>
                <Chip tone={PRIORITY_TONE[t.priority]}>{t.priority}</Chip>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5" style={{ borderTop: `1px solid ${T.rowBorder}` }}>
            <button className="flex items-center gap-1 text-xs font-medium" style={{ color: T.primary, background: 'none', border: 'none', cursor: 'pointer' }}>
              View all tasks <MI name="arrow_forward" size={12} color={T.primary} />
            </button>
          </div>
        </Card>
      </div>

      {/* Recent Samples + Quick Actions */}
      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: '1fr 220px' }}>

        <Card title="Recent Samples" pad={false}
          action={<Link href="/dashboard/samples" style={{ fontSize: 12, color: T.primary, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            View All <MI name="arrow_forward" size={13} color={T.primary} />
          </Link>}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Sample ID','Project / Client','Sample Type','Status','Received Date','Due Date','TAT (Days)'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SAMPLES.map((s) => {
                  const tone = STATUS_TONE[s.status] ?? 'gray'
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td style={tdStyle}><span style={linkStyle}>{s.id}</span></td>
                      <td style={tdStyle}>{s.client}</td>
                      <td style={tdStyle}>{s.type}</td>
                      <td style={tdStyle}><Chip tone={tone}>{s.status}</Chip></td>
                      <td style={{ ...tdStyle, color: T.muted }}>{s.received}</td>
                      <td style={{ ...tdStyle, color: T.muted }}>{s.due}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{s.tat}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Quick Actions" pad={false}>
          <div className="grid grid-cols-2 gap-2 p-3">
            {QUICK_ACTIONS.map(a => (
              <Link key={a.label} href={a.href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, padding: '16px 6px', backgroundColor: a.bg }}>
                <MI name={a.icon} size={22} color={a.color} />
                <span style={{ fontSize: 10, color: a.color, fontWeight: 600, lineHeight: 1.2, textAlign: 'center' }}>{a.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

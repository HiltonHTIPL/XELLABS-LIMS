import Link from 'next/link'
import { getSession } from '@/app/lib/session'
import { getSampleStats, getLabSamples, getTatTrend } from '@/app/actions/lab-samples'
import { getOpenTasks } from '@/app/actions/tasks'
import { TrendChart, StatusDonut } from './_components/DashboardCharts'
import { T, MI, PageHeader, StatCard, Card, Chip, thStyle, tdStyle, linkStyle } from './_components/ui'
import { sampleDisplayId } from '@/app/lib/sampleDisplay'

const PRIORITY_LABEL: Record<string, 'High' | 'Medium' | 'Low'> = {
  urgent: 'High', high: 'High', normal: 'Medium', low: 'Low',
}
const PRIORITY_TONE: Record<string, 'red' | 'orange' | 'green'> = {
  High: 'red', Medium: 'orange', Low: 'green',
}

const QUICK_ACTIONS = [
  { label: 'New Sample',     icon: 'add_circle',   bg: '#EFF6FF', color: T.primary,  href: '/dashboard/samples/new' },
  { label: 'Receive Sample', icon: 'move_to_inbox',bg: '#DBEAFE', color: T.teal,     href: '/dashboard/sample-receipts' },
  { label: 'Store Sample',   icon: 'inventory_2',  bg: '#F5F3FF', color: '#7C3AED',  href: '/dashboard/storage' },
  { label: 'Create Report',  icon: 'bar_chart',    bg: '#FFF7ED', color: T.warning,  href: '/dashboard/reports' },
]

const STATUS_DISPLAY: Record<string, string> = {
  registered: 'Registered', received: 'Received', in_progress: 'In Process',
  results_pending: 'To Be Verified', reviewed: 'Reviewed', published: 'Completed',
  rejected: 'Rejected', disposed: 'Disposed',
}
const STATUS_TONE: Record<string, 'blue'|'teal'|'orange'|'red'|'green'|'gray'> = {
  'In Process': 'blue', 'Received': 'teal', 'To Be Verified': 'orange', 'On Hold for QA': 'red',
  'Completed': 'green', 'Registered': 'gray', 'Reviewed': 'teal', 'Rejected': 'red', 'Disposed': 'gray',
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function tatDays(receivedIso: string | null): number | null {
  if (!receivedIso) return null
  const ms = Date.now() - new Date(receivedIso).getTime()
  return Math.max(0, Math.round(ms / 86400000))
}

export default async function DashboardPage() {
  await getSession()

  const [stats, samples, tasks, tatTrend] = await Promise.all([
    getSampleStats(),
    getLabSamples(),
    getOpenTasks(),
    getTatTrend(),
  ])

  const STATS = [
    { label: 'Logged',          value: stats.logged,         icon: 'science',       iconBg: '#EFF6FF', iconColor: T.primary },
    { label: 'Received',        value: stats.received,       icon: 'move_to_inbox', iconBg: '#DBEAFE', iconColor: T.teal },
    { label: 'In Process',      value: stats.in_process,     icon: 'assignment',    iconBg: '#FFF7ED', iconColor: T.warning },
    { label: 'To Be Verified',  value: stats.to_be_verified, icon: 'fact_check',    iconBg: '#DBEAFE', iconColor: T.teal },
    { label: 'On Hold for QA',  value: stats.on_hold_for_qa, icon: 'pause_circle',  iconBg: '#FFFBEB', iconColor: '#F59E0B' },
    { label: 'Completed',       value: stats.completed,      icon: 'check_circle',  iconBg: '#DBEAFE', iconColor: T.success },
    { label: 'Overdue',         value: stats.overdue,        icon: 'warning_amber', iconBg: '#FEF2F2', iconColor: T.danger },
  ]

  const recentSamples = samples.slice(0, 5)

  return (
    <div style={{ backgroundColor: T.pageBg, minHeight: '100%', padding: '20px 20px 0', boxSizing: 'border-box' }}>

      <PageHeader
        title="Dashboard"
        subtitle="Overview of laboratory operations and key performance indicators."
        right={
          <div className="flex items-center gap-1.5">
            <MI name="schedule" size={13} color={T.faint} />
            <span style={{ fontSize: 11, color: T.faint }}>
              Last updated: {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-7 gap-3 mb-4">
        {STATS.map(s => (
          <StatCard key={s.label} icon={s.icon} iconBg={s.iconBg} iconColor={s.iconColor}
            label={s.label} value={s.value} />
        ))}
      </div>

      {/* Charts + Tasks */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>
        <TrendChart data={tatTrend} />
        <StatusDonut stats={stats} />

        {/* Tasks */}
        <Card pad={false}>
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${T.rowBorder}` }}>
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: T.primary, color: '#fff' }}>
              Tasks
              <span className="w-4 h-4 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.25)', fontSize: 9 }}>{tasks.length}</span>
            </span>
          </div>
          <div className="flex-1 px-4 py-1 overflow-y-auto">
            {tasks.length === 0 && (
              <p className="py-4 text-center" style={{ fontSize: 12, color: T.faint }}>No open tasks.</p>
            )}
            {tasks.slice(0, 6).map((t) => {
              const priority = PRIORITY_LABEL[t.priority] ?? 'Medium'
              return (
                <div key={t.id} className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: `1px solid ${T.rowBorder}` }}>
                  <input type="checkbox" className="mt-0.5 rounded shrink-0" style={{ accentColor: T.primary }} />
                  <span className="flex-1 text-xs leading-snug" style={{ color: T.text }}>{t.title}</span>
                  <Chip tone={PRIORITY_TONE[priority]}>{priority}</Chip>
                </div>
              )
            })}
          </div>
          <div className="px-4 py-2.5" style={{ borderTop: `1px solid ${T.rowBorder}` }}>
            <Link href="/dashboard/worksheets" className="flex items-center gap-1 text-xs font-medium" style={{ color: T.primary, textDecoration: 'none' }}>
              View all tasks <MI name="arrow_forward" size={12} color={T.primary} />
            </Link>
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
                  {['Sample ID','Client','Sample Type','Status','Received Date','Expiry Date','TAT (Days)'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentSamples.length === 0 && (
                  <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: T.faint }}>No samples yet.</td></tr>
                )}
                {recentSamples.map((s) => {
                  const statusLabel = STATUS_DISPLAY[s.status] ?? s.status
                  const tone = STATUS_TONE[statusLabel] ?? 'gray'
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td style={tdStyle}><Link href={`/dashboard/samples/${s.id}`} style={linkStyle}>{sampleDisplayId(s)}</Link></td>
                      <td style={tdStyle}>{s.client_name || '—'}</td>
                      <td style={tdStyle}>{s.sample_type_name || '—'}</td>
                      <td style={tdStyle}><Chip tone={tone}>{statusLabel}</Chip></td>
                      <td style={{ ...tdStyle, color: T.muted }}>{fmtDate(s.received_date)}</td>
                      <td style={{ ...tdStyle, color: T.muted }}>{fmtDate(s.expiry_date)}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{tatDays(s.received_date) ?? '—'}</td>
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

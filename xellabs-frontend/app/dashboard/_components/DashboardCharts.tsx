'use client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import type { TatTrendPoint } from '@/app/actions/lab-samples'
import type { SampleStats } from '@/app/actions/lab-samples'

function fmtWeek(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TrendChart({ data }: { data: TatTrendPoint[] }) {
  const chartData = data.map(d => ({ date: fmtWeek(d.week_start), tat: d.avg_tat_days ?? 0 }))
  const hasData = data.some(d => d.avg_tat_days !== null)

  return (
    <div className="bg-white rounded-xl" style={{ border: '1px solid #E5E7EB', padding: '14px 16px 10px' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: '#111827' }}>Turnaround Time Trend (days)</h3>
        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>Last 5 Weeks</span>
      </div>
      {!hasData ? (
        <div className="flex items-center justify-center" style={{ height: 160 }}>
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>No completed samples yet to compute turnaround time.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 11, border: '1px solid #E5E7EB', borderRadius: 6 }}
              labelStyle={{ color: '#374151', fontWeight: 600 }}
              formatter={(v) => [`${v ?? 0} days`, 'Avg TAT']}
            />
            <Line
              type="monotone" dataKey="tat"
              stroke="#3B82F6" strokeWidth={2}
              dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 5, fill: '#1D4ED8' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  logged: '#9CA3AF', received: '#3B82F6', in_process: '#0154FC',
  to_be_verified: '#F59E0B', on_hold_for_qa: '#F97316', completed: '#22C55E', overdue: '#EF4444',
}
const STATUS_LABELS: Record<string, string> = {
  logged: 'Logged', received: 'Received', in_process: 'In Process',
  to_be_verified: 'To Be Verified', on_hold_for_qa: 'On Hold for QA', completed: 'Completed', overdue: 'Overdue',
}

export function StatusDonut({ stats }: { stats: SampleStats }) {
  const entries = (Object.keys(stats) as Array<keyof SampleStats>)
    .map(key => ({ key, value: stats[key], color: STATUS_COLORS[key], label: STATUS_LABELS[key] }))
  const total = entries.filter(e => e.key !== 'overdue' && e.key !== 'on_hold_for_qa').reduce((a, e) => a + e.value, 0)
  const nonZero = entries.filter(e => e.value > 0)

  return (
    <div className="bg-white rounded-xl flex flex-col" style={{ border: '1px solid #E5E7EB', padding: '14px 16px 12px' }}>
      <h3 className="text-sm font-semibold mb-2" style={{ color: '#111827' }}>Sample Status Mix</h3>

      <div style={{ position: 'relative', alignSelf: 'center', flexShrink: 0 }}>
        <ResponsiveContainer width={130} height={130}>
          <PieChart>
            <Pie data={nonZero.length > 0 ? nonZero : [{ key: 'empty', value: 1, color: '#F3F4F6', label: '' }]}
              cx="50%" cy="50%" innerRadius={38} outerRadius={58}
              paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
              {(nonZero.length > 0 ? nonZero : [{ color: '#F3F4F6' }]).map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{total.toLocaleString()}</p>
          <p style={{ fontSize: 8, color: '#9CA3AF', marginTop: 2 }}>Total<br/>Samples</p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {entries.map(e => (
          <div key={e.key} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: e.color }} />
              <span style={{ fontSize: 10, color: '#374151' }}>{e.label}</span>
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
              {e.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 9, color: '#9CA3AF', marginTop: 8 }}>As of {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
    </div>
  )
}

'use client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

const tatData = [
  { date: 'Apr 20', tat: 5.2 },
  { date: 'Apr 27', tat: 4.8 },
  { date: 'May 4',  tat: 6.1 },
  { date: 'May 11', tat: 3.9 },
  { date: 'May 18', tat: 4.5 },
]

const statusData = [
  { name: 'Received',       value: 1248, pct: '49.0%', color: '#3B82F6' },
  { name: 'In Process',     value: 326,  pct: '12.8%', color: '#14B8A6' },
  { name: 'To Be Verified', value: 204,  pct: '8.0%',  color: '#F59E0B' },
  { name: 'On Hold for QA', value: 18,   pct: '0.7%',  color: '#F97316' },
  { name: 'Completed',      value: 892,  pct: '35.0%', color: '#10B981' },
  { name: 'Overdue',        value: 32,   pct: '1.3%',  color: '#EF4444' },
]
const TOTAL = 2548

export function TrendChart() {
  return (
    <div className="bg-white rounded-xl" style={{ border: '1px solid #E5E7EB', padding: '14px 16px 10px' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: '#111827' }}>Turnaround Time Trend (days)</h3>
        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>Last 30 Days ▾</span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={tatData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} domain={[0, 8]} ticks={[0,2,4,6,8]} />
          <Tooltip
            contentStyle={{ fontSize: 11, border: '1px solid #E5E7EB', borderRadius: 6 }}
            labelStyle={{ color: '#374151', fontWeight: 600 }}
            formatter={(v: number) => [`${v} days`, 'Avg TAT']}
          />
          <Line
            type="monotone" dataKey="tat"
            stroke="#3B82F6" strokeWidth={2}
            dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 5, fill: '#1D4ED8' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function StatusDonut() {
  return (
    <div className="bg-white rounded-xl flex flex-col" style={{ border: '1px solid #E5E7EB', padding: '14px 16px 12px' }}>
      <h3 className="text-sm font-semibold mb-2" style={{ color: '#111827' }}>Sample Status Mix</h3>

      {/* Donut centered */}
      <div style={{ position: 'relative', alignSelf: 'center', flexShrink: 0 }}>
        <ResponsiveContainer width={130} height={130}>
          <PieChart>
            <Pie data={statusData} cx="50%" cy="50%" innerRadius={38} outerRadius={58}
              paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
              {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{TOTAL.toLocaleString()}</p>
          <p style={{ fontSize: 8, color: '#9CA3AF', marginTop: 2 }}>Total<br/>Samples</p>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 space-y-1.5">
        {statusData.map(d => (
          <div key={d.name} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
              <span style={{ fontSize: 10, color: '#374151' }}>{d.name}</span>
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
              {d.value.toLocaleString()} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>({d.pct})</span>
            </span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 9, color: '#9CA3AF', marginTop: 8 }}>As of May 19, 2025</p>
    </div>
  )
}

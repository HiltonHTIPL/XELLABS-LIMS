'use client'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, LabelList,
} from 'recharts'
import type { TatTrendPoint } from '@/app/actions/lab-samples'
import type { SampleStats } from '@/app/actions/lab-samples'

function fmtWeek(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CARD = 'bg-white rounded-xl flex flex-col'
const CARD_STYLE: React.CSSProperties = { border: '1px solid #E5E7EB', padding: '14px 16px 12px' }
const TOOLTIP_STYLE: React.CSSProperties = { fontSize: 11, border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '6px 10px' }

export type IntakeVolumePoint = { week_start: string; count: number }

// ── Trend (Area + line, single series) ──────────────────────────────────────
export function TrendChart({ data, volume = [] }: { data: TatTrendPoint[]; volume?: IntakeVolumePoint[] }) {
  const hasTat = data.some(d => d.avg_tat_days !== null)

  // TAT is only computable once samples are completed. Until then, fall back to
  // a weekly sample-intake-volume trend so the box always shows real data.
  const title = hasTat ? 'Turnaround Time Trend (days)' : 'Samples Logged (Last 5 Weeks)'
  const chartData = hasTat
    ? data.map(d => ({ date: fmtWeek(d.week_start), value: d.avg_tat_days ?? 0 }))
    : volume.map(d => ({ date: fmtWeek(d.week_start), value: d.count }))
  const unit = hasTat ? 'days' : 'samples'
  const seriesLabel = hasTat ? 'Avg TAT' : 'Logged'

  return (
    <div className={CARD} style={CARD_STYLE}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold" style={{ color: '#111827' }}>{title}</h3>
        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#F3F4F6', color: '#374151' }}>Last 5 Weeks</span>
      </div>
      <div style={{ flex: 1, minHeight: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="tatGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={false} dy={4} />
            <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={false} allowDecimals={false} width={34} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: '#111827', fontWeight: 600, marginBottom: 2 }}
              cursor={{ stroke: '#C7D2FE', strokeWidth: 1 }}
              formatter={(v) => [`${v ?? 0} ${unit}`, seriesLabel]}
            />
            <Area
              type="monotone" dataKey="value"
              stroke="#2563EB" strokeWidth={2.5} fill="url(#tatGrad)"
              dot={{ r: 3.5, fill: '#2563EB', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 5.5, fill: '#1D4ED8', strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Status donut (reserved status palette) ──────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  logged: '#64748B', received: '#3B82F6', in_process: '#2563EB',
  to_be_verified: '#F59E0B', on_hold_for_qa: '#F97316', completed: '#22C55E', overdue: '#EF4444',
}
const STATUS_LABELS: Record<string, string> = {
  logged: 'Logged', received: 'Received', in_process: 'In Process',
  to_be_verified: 'To Be Verified', on_hold_for_qa: 'On Hold for QA', completed: 'Completed', overdue: 'Overdue',
}

export function StatusDonut({ stats, highlightKey, onSelectKey }: {
  stats: SampleStats
  /** When set, dims every slice except this one and swaps the center label to
   *  that status's own name + count (reflects the selected KPI card). */
  highlightKey?: keyof SampleStats | null
  /** Clicking a legend row / slice re-fires the same selection the KPI card uses. */
  onSelectKey?: (key: keyof SampleStats) => void
}) {
  const entries = (Object.keys(stats) as Array<keyof SampleStats>)
    .map(key => ({ key, value: stats[key], color: STATUS_COLORS[key], label: STATUS_LABELS[key] }))
  const total = entries.filter(e => e.key !== 'overdue' && e.key !== 'on_hold_for_qa').reduce((a, e) => a + e.value, 0)
  const nonZero = entries.filter(e => e.value > 0)
  const highlighted = highlightKey ? entries.find(e => e.key === highlightKey) : null

  return (
    <div className={CARD} style={CARD_STYLE}>
      <h3 className="text-sm font-semibold mb-2" style={{ color: '#111827' }}>Sample Status Mix</h3>

      <div style={{ position: 'relative', alignSelf: 'center', flexShrink: 0 }}>
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie data={nonZero.length > 0 ? nonZero : [{ key: 'empty', value: 1, color: '#F3F4F6', label: '' }]}
              cx="50%" cy="50%" innerRadius={42} outerRadius={62}
              paddingAngle={nonZero.length > 1 ? 3 : 0} cornerRadius={4}
              dataKey="value" startAngle={90} endAngle={-270} stroke="none">
              {(nonZero.length > 0 ? nonZero : [{ key: 'empty', color: '#F3F4F6' }]).map((e, i) => (
                <Cell key={i} fill={e.color} opacity={highlightKey && e.key !== highlightKey ? 0.25 : 1}
                  style={{ cursor: onSelectKey && 'key' in e ? 'pointer' : 'default' }}
                  onClick={() => onSelectKey && 'key' in e && e.key !== 'empty' && onSelectKey(e.key as keyof SampleStats)} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, _n, p) => [`${v}`, (p?.payload as { label?: string })?.label ?? '']} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#111827', lineHeight: 1 }}>
            {(highlighted ? highlighted.value : total).toLocaleString()}
          </p>
          <p style={{ fontSize: 9, fontWeight: 600, color: '#6B7280', marginTop: 2, letterSpacing: '0.02em' }}>
            {highlighted ? highlighted.label : <>Total<br/>Samples</>}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {entries.map(e => (
          <div key={e.key} onClick={() => onSelectKey?.(e.key)}
            className="flex items-center justify-between gap-1.5 min-w-0 rounded"
            style={{
              cursor: onSelectKey ? 'pointer' : 'default', padding: '1px 3px', marginLeft: -3,
              opacity: highlightKey && e.key !== highlightKey ? 0.45 : 1,
              backgroundColor: e.key === highlightKey ? '#EFF6FF' : 'transparent',
            }}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: e.color }} />
              <span className="truncate" style={{ fontSize: 10, color: '#374151' }}>{e.label}</span>
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
              {e.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 9, color: '#6B7280', marginTop: 8 }}>As of {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
    </div>
  )
}

// ── Samples by Type (magnitude → single-hue horizontal bars) ────────────────
export type SamplesByTypePoint = { type: string; count: number }

export function SamplesByTypeChart({ data }: { data: SamplesByTypePoint[] }) {
  return (
    <div className={CARD} style={CARD_STYLE}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold" style={{ color: '#111827' }}>Samples by Type</h3>
        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#F3F4F6', color: '#374151' }}>{data.reduce((a, d) => a + d.count, 0)} total</span>
      </div>
      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center" style={{ minHeight: 160, fontSize: 12, color: '#6B7280' }}>No samples yet.</div>
      ) : (
        <div style={{ flex: 1, minHeight: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 30, left: 2, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid horizontal={false} stroke="#EEF1F6" />
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="type" width={96}
                tick={{ fontSize: 10, fill: '#374151' }} tickLine={false} axisLine={false} interval={0} />
              <Tooltip
                cursor={{ fill: '#F3F4F6' }}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: '#111827', fontWeight: 600, marginBottom: 2 }}
                formatter={(v) => [`${v} samples`, 'Count']}
              />
              <Bar dataKey="count" fill="#2563EB" radius={[0, 4, 4, 0]} maxBarSize={16}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 10, fill: '#374151', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

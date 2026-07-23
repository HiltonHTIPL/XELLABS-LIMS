'use client'

/**
 * DashboardOverview — client boundary owning the KPI-card ↔ donut ↔ Recent
 * Samples filter interaction. `page.tsx` (server component) only fetches data;
 * this component holds the single `selectedStatus` piece of state all three
 * pieces of UI read from (Separation of Concerns).
 */

import Link from 'next/link'
import { useState } from 'react'
import { TrendChart, StatusDonut, SamplesByTypeChart, type IntakeVolumePoint } from './DashboardCharts'
import { T, MI, Card } from './ui'
import RecentSamplesTable from './RecentSamplesTable'
import type { LabSample, SampleStats, TatTrendPoint } from '@/app/actions/lab-samples'

type StatKey = keyof SampleStats

// Mirrors the exact predicates Django's SampleViewSet.stats() aggregates with
// (lims/views.py) so a card's count always matches what clicking it filters to.
const STATUS_MATCHERS: Record<StatKey, (s: LabSample, nowMs: number) => boolean> = {
  logged: s => s.status === 'registered',
  received: s => s.status === 'received',
  in_process: s => s.status === 'in_progress',
  to_be_verified: s => s.status === 'results_pending',
  on_hold_for_qa: s => s.hold_for_qa === true,
  completed: s => s.status === 'published',
  overdue: (s, nowMs) => !!s.expiry_date && new Date(s.expiry_date).getTime() < nowMs
    && !['registered', 'disposed', 'rejected'].includes(s.status),
}

const STAT_META: Record<StatKey, { label: string; icon: string; iconBg: string; iconColor: string }> = {
  logged:         { label: 'Logged',         icon: 'science',       iconBg: '#EFF6FF', iconColor: T.primary },
  received:       { label: 'Received',       icon: 'move_to_inbox', iconBg: '#DBEAFE', iconColor: T.teal },
  in_process:     { label: 'In Process',     icon: 'assignment',    iconBg: '#FFF7ED', iconColor: T.warning },
  to_be_verified: { label: 'To Be Verified', icon: 'fact_check',    iconBg: '#DBEAFE', iconColor: T.teal },
  on_hold_for_qa: { label: 'On Hold for QA', icon: 'pause_circle',  iconBg: '#FFFBEB', iconColor: '#F59E0B' },
  completed:      { label: 'Completed',      icon: 'check_circle',  iconBg: '#DBEAFE', iconColor: T.success },
  overdue:        { label: 'Overdue',        icon: 'warning_amber', iconBg: '#FEF2F2', iconColor: T.danger },
}
const STAT_ORDER: StatKey[] = ['logged', 'received', 'in_process', 'to_be_verified', 'on_hold_for_qa', 'completed', 'overdue']

type Props = {
  stats: SampleStats
  samples: LabSample[]
  tatTrend: TatTrendPoint[]
  intakeVolume: IntakeVolumePoint[]
  samplesByType: { type: string; count: number }[]
}

export default function DashboardOverview({ stats, samples, tatTrend, intakeVolume, samplesByType }: Props) {
  const [selected, setSelected] = useState<StatKey | null>(null)

  function toggle(key: StatKey) {
    setSelected(prev => (prev === key ? null : key))
  }

  const nowMs = Date.now()
  const filteredSamples = selected ? samples.filter(s => STATUS_MATCHERS[selected](s, nowMs)) : null
  const visibleSamples = filteredSamples ?? samples.slice(0, 5)

  return (
    <>
      {/* KPI cards — click to filter the donut + Recent Samples below; click again to clear. */}
      <div className="grid grid-cols-7 gap-3 mb-4">
        {STAT_ORDER.map(key => {
          const meta = STAT_META[key]
          const active = selected === key
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className="bg-white p-4 text-left"
              style={{
                border: `1px solid ${active ? T.primary : T.cardBorder}`,
                borderRadius: T.cardRadius, boxShadow: active ? '0 0 0 3px rgba(37,99,235,0.12)' : T.cardShadow,
                cursor: 'pointer',
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center shrink-0"
                  style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: meta.iconBg }}>
                  <MI name={meta.icon} size={20} color={meta.iconColor} />
                </div>
                <div className="min-w-0">
                  <p className="truncate" style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>{meta.label}</p>
                  <span style={{ fontSize: 22, fontWeight: 800, color: T.heading }}>{stats[key]}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Charts + Tasks */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr)' }}>
        <TrendChart data={tatTrend} volume={intakeVolume} />
        <StatusDonut stats={stats} highlightKey={selected} onSelectKey={toggle} />
        <SamplesByTypeChart data={samplesByType} />
      </div>

      {/* Recent Samples + Quick Actions */}
      <div className="dash-recent-grid mb-5">
        <Card
          title={selected ? `Samples — ${STAT_META[selected].label}` : 'Recent Samples'}
          pad={false} className="min-w-0"
          action={selected ? (
            <button onClick={() => setSelected(null)}
              className="flex items-center gap-1"
              style={{ fontSize: 12, color: T.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <MI name="close" size={13} color={T.muted} /> Clear filter
            </button>
          ) : (
            <Link href="/dashboard/samples-overview" style={{ fontSize: 12, color: T.primary, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              View All <MI name="arrow_forward" size={13} color={T.primary} />
            </Link>
          )}
        >
          <div style={{ padding: '0 4px 8px', minWidth: 0, width: '100%' }}>
            <RecentSamplesTable samples={visibleSamples} />
          </div>
        </Card>

        <Card title="Quick Actions" pad={false} className="min-w-0">
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
    </>
  )
}

const QUICK_ACTIONS = [
  { label: 'New Sample',     icon: 'add_circle',   bg: '#EFF6FF', color: T.primary,  href: '/dashboard/samples-overview/new' },
  { label: 'Receive Sample', icon: 'move_to_inbox',bg: '#DBEAFE', color: T.teal,     href: '/dashboard/sample-receipts' },
  { label: 'Store Sample',   icon: 'inventory_2',  bg: '#F5F3FF', color: '#7C3AED',  href: '/dashboard/storage' },
  { label: 'Create Report',  icon: 'bar_chart',    bg: '#FFF7ED', color: T.warning,  href: '/dashboard/reports' },
]

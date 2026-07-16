'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  PageHeader, Card, StatCard, Chip, StatusChip, EmptyState,
  MI, T, thStyle, tdStyle, type ChipTone,
} from '@/app/dashboard/_components/ui'
import type { ScheduleRow } from '@/app/actions/schedule'
import type { InventorySummary } from '@/app/actions/inventory-dashboard'

const ACTIVE_STATUSES = ['pending', 'in_progress']

function priorityTone(priority: string): ChipTone {
  const p = priority.toLowerCase()
  if (p === 'urgent' || p === 'high') return 'red'
  if (p === 'normal' || p === 'medium') return 'blue'
  return 'gray'
}

function dayKey(due: string | null): string {
  return due ? due.slice(0, 10) : ''
}

function formatDay(key: string): string {
  const d = new Date(`${key}T00:00:00`)
  if (Number.isNaN(d.getTime())) return key
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function isOverdue(row: ScheduleRow): boolean {
  if (!row.due_date) return false
  if (!ACTIVE_STATUSES.includes(row.status)) return false
  return new Date(row.due_date).getTime() < Date.now()
}

type Group = { key: string; label: string; rows: ScheduleRow[] }

function groupByDay(rows: ScheduleRow[]): Group[] {
  const buckets = new Map<string, ScheduleRow[]>()
  for (const r of rows) {
    const k = dayKey(r.due_date)
    const arr = buckets.get(k) ?? []
    arr.push(r)
    buckets.set(k, arr)
  }
  const scheduled = [...buckets.keys()].filter(Boolean).sort()
  const groups: Group[] = scheduled.map((k) => ({ key: k, label: formatDay(k), rows: buckets.get(k)! }))
  if (buckets.has('')) groups.push({ key: '', label: 'Unscheduled', rows: buckets.get('')! })
  return groups
}

function ReadinessStrip({ readiness }: { readiness: InventorySummary }) {
  const { low_stock, expiring_soon, expired } = readiness
  const clear = low_stock === 0 && expiring_soon === 0 && expired === 0
  return (
    <Card className="mb-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <MI name="inventory_2" size={18} color={T.primary} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.heading }}>Inventory readiness</span>
          </div>
          {clear ? (
            <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12.5, color: T.text }}>
              <MI name="check_circle" size={15} color={T.success} />
              Reagents, solvents and standards are in stock for ongoing analyses.
            </span>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <Chip tone={low_stock ? 'red' : 'gray'} dot>{low_stock} low on stock</Chip>
              <Chip tone={expiring_soon ? 'orange' : 'gray'} dot>{expiring_soon} lots expiring soon</Chip>
              <Chip tone={expired ? 'red' : 'gray'} dot>{expired} lots expired</Chip>
            </div>
          )}
        </div>
        <Link href="/dashboard/inventory-dashboard" style={{ fontSize: 12.5, fontWeight: 600, color: T.primary, textDecoration: 'none' }}>
          View inventory tracking
        </Link>
      </div>
    </Card>
  )
}

function ScheduleTable({ rows }: { rows: ScheduleRow[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Analysis', 'Sample', 'Client', 'Tests', 'Priority', 'Status', 'Assigned to'].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ar_pk}>
              <td style={{ ...tdStyle, fontWeight: 600, color: T.heading }}>{r.ar_id}</td>
              <td style={tdStyle}>
                <div style={{ fontWeight: 600, color: T.text }}>{r.sample_id || '—'}</div>
                {r.sample_type && <div style={{ fontSize: 11, color: T.faint }}>{r.sample_type}</div>}
              </td>
              <td style={tdStyle}>{r.client || '—'}</td>
              <td style={tdStyle}>
                <div className="flex items-center gap-1 flex-wrap">
                  {r.test_names.length === 0 && <span style={{ color: T.faint }}>—</span>}
                  {r.test_names.slice(0, 3).map((name, i) => (
                    <Chip key={i} tone="gray">{name}</Chip>
                  ))}
                  {r.test_names.length > 3 && (
                    <span style={{ fontSize: 11, color: T.faint }}>+{r.test_names.length - 3} more</span>
                  )}
                </div>
              </td>
              <td style={tdStyle}><Chip tone={priorityTone(r.priority)}>{r.priority}</Chip></td>
              <td style={tdStyle}>
                <div className="flex items-center gap-1.5">
                  <StatusChip status={r.status.replace(/_/g, ' ')} />
                  {isOverdue(r) && <Chip tone="red" dot>overdue</Chip>}
                </div>
              </td>
              <td style={tdStyle}>
                {r.analyst ? (
                  <div>
                    <div style={{ fontWeight: 600, color: T.text }}>{r.analyst}</div>
                    {r.worksheet_id && <div style={{ fontSize: 11, color: T.faint }}>{r.worksheet_id}</div>}
                  </div>
                ) : (
                  <Chip tone="gray">Unassigned</Chip>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ScheduleShell({
  schedule, readiness,
}: { schedule: ScheduleRow[]; readiness: InventorySummary }) {
  const [scope, setScope] = useState<'active' | 'all'>('active')

  const visible = useMemo(
    () => (scope === 'active' ? schedule.filter((r) => ACTIVE_STATUSES.includes(r.status)) : schedule),
    [schedule, scope],
  )
  const groups = useMemo(() => groupByDay(visible), [visible])

  const ongoing = schedule.filter((r) => r.status === 'in_progress').length
  const unassigned = schedule.filter((r) => ACTIVE_STATUSES.includes(r.status) && !r.analyst).length
  const overdue = schedule.filter(isOverdue).length

  return (
    <div style={{ padding: 20, backgroundColor: T.pageBg, minHeight: '100%' }}>
      <PageHeader
        title="Test Schedule"
        subtitle="Upcoming and ongoing analyses, grouped by their target date"
        right={
          <Link href="/dashboard/inventory-dashboard"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10, fontSize: 13, fontWeight: 600, padding: '8px 16px', backgroundColor: '#fff', color: T.primary, border: `1px solid ${T.inputBorder}`, textDecoration: 'none' }}>
            <MI name="inventory_2" size={16} />
            Inventory Tracking
          </Link>
        }
      />

      <ReadinessStrip readiness={readiness} />

      <div className="grid grid-cols-4 gap-4 mb-5">
        <StatCard icon="event_note" label="Scheduled Analyses" value={schedule.length} />
        <StatCard icon="pending_actions" iconColor={T.primary} iconBg="#EFF6FF" label="Ongoing" value={ongoing} />
        <StatCard icon="person_off" iconColor={T.warning} iconBg="#FFF7ED" label="Unassigned" value={unassigned} />
        <StatCard icon="schedule" iconColor={T.danger} iconBg="#FEF2F2" label="Overdue" value={overdue} />
      </div>

      <div className="flex items-center gap-1 p-1 rounded-xl mb-4" style={{ backgroundColor: '#EEF0F6', width: 'fit-content' }}>
        {([
          { key: 'active', label: 'Upcoming and Ongoing' },
          { key: 'all', label: 'All' },
        ] as { key: 'active' | 'all'; label: string }[]).map((t) => (
          <button key={t.key} onClick={() => setScope(t.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: scope === t.key ? '#fff' : 'transparent', color: scope === t.key ? T.heading : T.muted, border: 'none', cursor: 'pointer', boxShadow: scope === t.key ? '0 1px 2px rgba(16,24,40,0.08)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <Card>
          <EmptyState icon="event_busy" title="No analyses scheduled"
            sub={scope === 'active' ? 'No upcoming or ongoing analyses. Switch to All to see completed work.' : 'Create analysis requests to build the schedule.'} />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <Card key={g.key || 'unscheduled'} pad={false}
              title={
                <span className="flex items-center gap-2">
                  {g.label}
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.faint }}>
                    {g.rows.length} analysis{g.rows.length !== 1 ? 'es' : ''}
                  </span>
                </span>
              }
              icon={g.key ? 'calendar_today' : 'help_outline'}
            >
              <ScheduleTable rows={g.rows} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

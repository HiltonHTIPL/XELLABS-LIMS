import { getSession } from '@/app/lib/session'
import { getSampleStats, getLabSamples, getTatTrend } from '@/app/actions/lab-samples'
import { T, MI, PageHeader } from './_components/ui'
import DashboardOverview from './_components/DashboardOverview'

export default async function DashboardPage() {
  await getSession()

  const [stats, samples, tatTrend] = await Promise.all([
    getSampleStats(),
    getLabSamples(),
    getTatTrend(),
  ])

  // Weekly intake volume — same 5 weekly windows the TAT endpoint uses
  // (week i spans [now-(i+1)w, now-i w)), bucketed by created_at. Feeds the
  // TrendChart as a fallback so the box shows real data before any sample is
  // completed (TAT only exists for completed samples).
  const now = Date.now()
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000
  const intakeVolume = Array.from({ length: 5 }, (_, idx) => {
    const i = 4 - idx
    const start = now - (i + 1) * WEEK_MS
    const end = now - i * WEEK_MS
    const count = samples.filter(s => {
      const t = new Date(s.created_at).getTime()
      return t >= start && t < end
    }).length
    return { week_start: new Date(start).toISOString(), count }
  })

  // Samples-by-type breakdown for the third dashboard chart. Top 6 types by
  // count; everything else folds into "Other" so the bar list never overflows.
  const typeCounts = new Map<string, number>()
  for (const s of samples) {
    const t = s.sample_type_name || 'Unknown'
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
  }
  const sortedTypes = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])
  const TOP_TYPES = 6
  const samplesByType = sortedTypes.slice(0, TOP_TYPES).map(([type, count]) => ({ type, count }))
  if (sortedTypes.length > TOP_TYPES) {
    samplesByType.push({ type: 'Other', count: sortedTypes.slice(TOP_TYPES).reduce((a, [, c]) => a + c, 0) })
  }

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

      {/* KPI cards, charts, and Recent Samples/Quick Actions — one client
          boundary owning the click-to-filter interaction (Section of Concerns:
          this page only fetches data, DashboardOverview owns the state). */}
      <DashboardOverview
        stats={stats}
        samples={samples}
        tatTrend={tatTrend}
        intakeVolume={intakeVolume}
        samplesByType={samplesByType}
      />
    </div>
  )
}

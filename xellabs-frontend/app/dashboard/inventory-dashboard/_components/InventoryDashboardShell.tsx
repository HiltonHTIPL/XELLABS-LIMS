'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader, Card, StatCard, Btn, MI, T } from '@/app/dashboard/_components/ui'
import type { InventoryDashboardData, StockItem } from '@/app/actions/inventory-dashboard'
import StockTable from './StockTable'
import ConsumptionLog from './ConsumptionLog'
import RecordUsageModal, { type LotOption } from './RecordUsageModal'

type Kind = 'reagents' | 'solvents' | 'standards'

const KIND_META: Record<Kind, { label: string; icon: string }> = {
  reagents: { label: 'Reagents', icon: 'science' },
  solvents: { label: 'Solvents', icon: 'opacity' },
  standards: { label: 'Standards', icon: 'straighten' },
}

function AlertBanner({ summary }: { summary: InventoryDashboardData['summary'] }) {
  const alerts: { icon: string; color: string; bg: string; border: string; text: string }[] = []
  if (summary.expired > 0) {
    alerts.push({ icon: 'error', color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', text: `${summary.expired} lot${summary.expired !== 1 ? 's' : ''} expired and should be quarantined.` })
  }
  if (summary.low_stock > 0) {
    alerts.push({ icon: 'trending_down', color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', text: `${summary.low_stock} item${summary.low_stock !== 1 ? 's' : ''} below minimum stock level.` })
  }
  if (summary.expiring_soon > 0) {
    alerts.push({ icon: 'schedule', color: '#9A3412', bg: '#FFF7ED', border: '#FED7AA', text: `${summary.expiring_soon} lot${summary.expiring_soon !== 1 ? 's' : ''} expiring within 30 days.` })
  }
  if (alerts.length === 0) return null
  return (
    <div className="flex flex-col gap-2 mb-5">
      {alerts.map((a, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ backgroundColor: a.bg, border: `1px solid ${a.border}`, color: a.color, fontSize: 12.5, fontWeight: 600 }}>
          <MI name={a.icon} size={15} color={a.color} />
          {a.text}
        </div>
      ))}
    </div>
  )
}

export default function InventoryDashboardShell({ data }: { data: InventoryDashboardData }) {
  const router = useRouter()
  const [tab, setTab] = useState<Kind>('reagents')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  const itemsByKind: Record<Kind, StockItem[]> = {
    reagents: data.reagents, solvents: data.solvents, standards: data.standards,
  }
  const totalItems = data.reagents.length + data.solvents.length + data.standards.length

  const lotOptions: LotOption[] = useMemo(() => {
    const out: LotOption[] = []
    for (const it of [...data.reagents, ...data.solvents, ...data.standards]) {
      for (const l of it.lots) out.push({ id: l.id, label: `${l.lot_number} · ${it.name}` })
    }
    return out
  }, [data])

  function flashToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4000)
  }
  function handleDone() { flashToast(true, 'Usage recorded.'); router.refresh() }
  function toggleExpand(id: number) { setExpandedId((prev) => (prev === id ? null : id)) }

  return (
    <div style={{ padding: 20, backgroundColor: T.pageBg, minHeight: '100%' }}>
      <PageHeader
        title="Inventory Tracking"
        subtitle="Current stock, lot expiry and consumption for reagents, solvents and standards"
        right={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/schedule"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10, fontSize: 13, fontWeight: 600, padding: '8px 16px', backgroundColor: '#fff', color: T.primary, border: `1px solid ${T.inputBorder}`, textDecoration: 'none' }}>
              <MI name="event_note" size={16} />
              Test Schedule
            </Link>
            <Btn variant="primary" icon="playlist_add_check" onClick={() => setShowModal(true)}>Record Usage</Btn>
          </div>
        }
      />

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? T.primary : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? T.primary : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      <AlertBanner summary={data.summary} />

      <div className="grid grid-cols-4 gap-4 mb-5">
        <StatCard icon="inventory_2" label="Tracked Items" value={totalItems} />
        <StatCard icon="trending_down" iconColor={T.danger} iconBg="#FEF2F2" label="Low Stock" value={data.summary.low_stock} />
        <StatCard icon="schedule" iconColor={T.warning} iconBg="#FFF7ED" label="Expiring Soon" value={data.summary.expiring_soon} />
        <StatCard icon="error" iconColor={T.danger} iconBg="#FEF2F2" label="Expired Lots" value={data.summary.expired} />
      </div>

      {showModal && <RecordUsageModal lots={lotOptions} onClose={() => setShowModal(false)} onDone={handleDone} />}

      <Card
        title="Current Stock"
        icon="inventory"
        pad={false}
        action={
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: '#EEF0F6' }}>
            {(Object.keys(KIND_META) as Kind[]).map((k) => (
              <button key={k} onClick={() => { setTab(k); setExpandedId(null) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: tab === k ? '#fff' : 'transparent', color: tab === k ? T.heading : T.muted, border: 'none', cursor: 'pointer', boxShadow: tab === k ? '0 1px 2px rgba(16,24,40,0.08)' : 'none' }}>
                <MI name={KIND_META[k].icon} size={14} color={tab === k ? T.primary : T.faint} />
                {KIND_META[k].label}
                <span style={{ fontSize: 10, color: T.faint, fontWeight: 700 }}>{itemsByKind[k].length}</span>
              </button>
            ))}
          </div>
        }
      >
        <StockTable items={itemsByKind[tab]} expandedId={expandedId} onToggle={toggleExpand} />
      </Card>

      <div className="mt-5">
        <Card title="Consumption Log" icon="swap_horiz" pad={false}>
          <ConsumptionLog rows={data.consumption} />
        </Card>
      </div>
    </div>
  )
}

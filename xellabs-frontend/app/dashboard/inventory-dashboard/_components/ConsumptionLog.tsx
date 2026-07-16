'use client'
import { Chip, EmptyState, T, thStyle, tdStyle, type ChipTone } from '@/app/dashboard/_components/ui'
import type { ConsumptionRow } from '@/app/actions/inventory-dashboard'

const TYPE_META: Record<string, { tone: ChipTone; label: string }> = {
  in: { tone: 'green', label: 'Received' },
  out: { tone: 'blue', label: 'Consumed' },
  dispose: { tone: 'red', label: 'Disposed' },
  adjust: { tone: 'gray', label: 'Adjustment' },
}

export default function ConsumptionLog({ rows }: { rows: ConsumptionRow[] }) {
  if (rows.length === 0) {
    return <EmptyState icon="swap_horiz" title="No usage recorded yet" sub="Record usage against a lot to build the consumption log." />
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Item', 'Lot #', 'Movement', 'Quantity', 'Linked analysis', 'Date'].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const meta = TYPE_META[r.transaction_type] ?? { tone: 'gray' as ChipTone, label: r.transaction_type }
            return (
              <tr key={r.id}>
                <td style={{ ...tdStyle, fontWeight: 600, color: T.heading }}>{r.item_name || '—'}</td>
                <td style={tdStyle}>{r.lot_number}</td>
                <td style={tdStyle}><Chip tone={meta.tone} dot>{meta.label}</Chip></td>
                <td style={tdStyle}>{r.quantity}</td>
                <td style={tdStyle}>{r.reference || '—'}</td>
                <td style={tdStyle}>{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

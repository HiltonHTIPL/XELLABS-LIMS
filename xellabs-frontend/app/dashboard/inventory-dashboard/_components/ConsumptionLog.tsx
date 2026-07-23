'use client'
import { EmptyState, T, type ChipTone, Chip } from '@/app/dashboard/_components/ui'
import type { ConsumptionRow } from '@/app/actions/inventory-dashboard'
import DataTable, { type DataTableColumn } from '@/app/dashboard/_components/DataTable'

const TYPE_META: Record<string, { tone: ChipTone; label: string }> = {
  in: { tone: 'green', label: 'Received' },
  out: { tone: 'blue', label: 'Consumed' },
  dispose: { tone: 'red', label: 'Disposed' },
  adjust: { tone: 'gray', label: 'Adjustment' },
}

const columns: DataTableColumn<ConsumptionRow>[] = [
  { id: 'item_name', label: 'Item', sortable: true, render: r => <span style={{ fontWeight: 600, color: T.heading }}>{r.item_name || '—'}</span> },
  { id: 'lot_number', label: 'Lot #', sortable: true },
  {
    id: 'transaction_type', label: 'Movement', sortable: true,
    render: r => {
      const meta = TYPE_META[r.transaction_type] ?? { tone: 'gray' as ChipTone, label: r.transaction_type }
      return <Chip tone={meta.tone} dot>{meta.label}</Chip>
    },
  },
  { id: 'quantity', label: 'Quantity', sortable: true },
  { id: 'reference', label: 'Linked analysis', render: r => <>{r.reference || '—'}</> },
  { id: 'created_at', label: 'Date', sortable: true, render: r => <>{new Date(r.created_at).toLocaleString()}</> },
]

export default function ConsumptionLog({ rows }: { rows: ConsumptionRow[] }) {
  if (rows.length === 0) {
    return <EmptyState icon="swap_horiz" title="No usage recorded yet" sub="Record usage against a lot to build the consumption log." />
  }
  return <DataTable<ConsumptionRow> data={rows} columns={columns} searchable persistKey="inventory-consumption-log" emptyMessage="No usage recorded yet." />
}

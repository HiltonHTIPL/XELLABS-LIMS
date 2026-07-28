'use client'
import type { InstrumentOption, InstrumentResultImport } from '@/app/actions/instrument-maintenance'
import { EmptyState, StatusChip, MI, T } from '@/app/dashboard/_components/ui'
import DataTable, { type DataTableColumn } from '@/app/dashboard/_components/DataTable'

function instrumentLabel(instruments: InstrumentOption[], id: number) {
  const inst = instruments.find(i => i.id === id)
  return inst ? `${inst.name} (${inst.instrument_id})` : `#${id}`
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '-'
  return new Date(d).toLocaleString()
}

export default function ImportHistory({ imports, instruments }: {
  imports: InstrumentResultImport[]; instruments: InstrumentOption[]
}) {
  if (imports.length === 0) {
    return <EmptyState icon="inventory_2" title="No imports yet" sub="Uploaded result files and their backups appear here" />
  }
  const columns: DataTableColumn<InstrumentResultImport>[] = [
    { id: 'instrument', label: 'Instrument', sortable: true, render: i => <>{instrumentLabel(instruments, i.instrument)}</> },
    { id: 'file_format', label: 'Format', sortable: true, render: i => <>{i.file_format.toUpperCase()}</> },
    { id: 'status', label: 'Status', sortable: true, render: i => <StatusChip status={i.status} /> },
    { id: 'created_at', label: 'Imported', sortable: true, render: i => <>{fmtDate(i.created_at)}</> },
    {
      id: 'file', label: 'Original file',
      render: i => i.file ? (
        <a
          href={`/api/instrument-import-download/${i.id}`}
          className="inline-flex items-center gap-1.5 hover:underline"
          style={{ color: T.primary, fontSize: 12.5, fontWeight: 600 }}
        >
          <MI name="download" size={15} color={T.primary} /> Download backup
        </a>
      ) : (
        <span style={{ color: T.faint, fontSize: 12.5 }}>-</span>
      ),
    },
  ]
  return <DataTable<InstrumentResultImport> data={imports} columns={columns} searchable persistKey="instrument-import-history" emptyMessage="No imports yet." />
}

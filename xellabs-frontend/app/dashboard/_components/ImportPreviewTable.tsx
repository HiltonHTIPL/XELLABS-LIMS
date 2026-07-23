'use client'
import type { PreviewRow, PreviewSummary } from '@/app/actions/instrument-import'
import { Chip, MI, T } from '@/app/dashboard/_components/ui'
import DataTable, { type DataTableColumn } from '@/app/dashboard/_components/DataTable'

function SummaryBar({ summary }: { summary: PreviewSummary }) {
  const skipped = summary.skipped ?? 0
  return (
    <div className="flex items-center gap-2 flex-wrap mb-3">
      <Chip tone="gray">{summary.total} rows</Chip>
      <Chip tone="green" dot>{summary.valid} will import</Chip>
      {skipped > 0 && <Chip tone="orange" dot>{skipped} protected (no overwrite)</Chip>}
      <Chip tone={summary.invalid > 0 ? 'red' : 'gray'} dot>{summary.invalid} errors</Chip>
    </div>
  )
}

function RowStatus({ status, detail }: { status: PreviewRow['status']; detail: string }) {
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1" style={{ color: T.danger, fontSize: 12, fontWeight: 600 }}>
        <MI name="cancel" size={14} color={T.danger} /> Skip
      </span>
    )
  }
  if (status === 'skip') {
    return (
      <span className="inline-flex items-center gap-1" style={{ color: '#D97706', fontSize: 12, fontWeight: 600 }} title={detail}>
        <MI name="lock" size={14} color="#D97706" /> Protected
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1" style={{ color: T.success, fontSize: 12, fontWeight: 600 }}>
      <MI name="check_circle" size={14} color={T.success} /> Ready
    </span>
  )
}

type Row = PreviewRow & { id: number }

const columns: DataTableColumn<Row>[] = [
  { id: 'row', label: 'Row', sortable: true, width: 70, render: r => <>{r.row || '-'}</> },
  { id: 'sample_id', label: 'Sample', sortable: true, render: r => <>{r.sample_id || '-'}</> },
  { id: 'test_code', label: 'Test', sortable: true, render: r => <>{r.test_code || '-'}</> },
  { id: 'value', label: 'Value', render: r => <>{r.value || '-'}</> },
  { id: 'unit', label: 'Unit', render: r => <>{r.unit || '-'}</> },
  { id: 'flags', label: 'Flags', render: r => <>{r.flags || '-'}</> },
  {
    id: 'detail', label: 'Maps to', minWidth: 220,
    render: r => {
      const isError = r.status === 'error'
      const isSkip = r.status === 'skip'
      return isError || isSkip ? (
        <span style={{ color: isError ? T.danger : '#D97706', fontSize: 12 }}>{r.detail}</span>
      ) : (
        <span style={{ color: T.text, fontSize: 12 }}>
          {r.test_name}
          {r.sample_status ? ` · sample ${r.sample_status}` : ''}
        </span>
      )
    },
  },
  { id: 'status', label: '', width: 100, render: r => <RowStatus status={r.status} detail={r.detail} /> },
]

/** Shared preview table for bulk result imports (Instrument Result Import,
 * Quality Result Import) — one definition (DRY) since both produce the same
 * row/summary shape. */
export default function ImportPreviewTable({ rows, summary }: { rows: PreviewRow[]; summary: PreviewSummary }) {
  return (
    <div>
      <SummaryBar summary={summary} />
      <DataTable<Row>
        data={rows.map((r, i) => ({ ...r, id: i }))}
        columns={columns}
        searchable
        emptyMessage="No rows to preview."
      />
    </div>
  )
}

'use client'

/**
 * RecentSamplesTable — client boundary that maps the dashboard's "Recent
 * Samples" data onto the reusable <DataTable>. The dashboard page is a server
 * component (data fetching); this wrapper owns the data→columns adaptation and
 * presentation, keeping DataTable generic (Adapter + Separation of Concerns).
 */

import Link from 'next/link'
import DataTable, { type DataTableColumn } from './DataTable'
import { Chip, linkStyle, type ChipTone } from './ui'
import { sampleDisplayId } from '@/app/lib/sampleDisplay'
import type { LabSample } from '@/app/actions/lab-samples'

const STATUS_DISPLAY: Record<string, string> = {
  registered: 'Registered', received: 'Received', in_progress: 'In Process',
  results_pending: 'To Be Verified', reviewed: 'Reviewed', published: 'Completed',
  rejected: 'Rejected', disposed: 'Disposed',
}
const STATUS_TONE: Record<string, ChipTone> = {
  'In Process': 'blue', 'Received': 'teal', 'To Be Verified': 'orange', 'On Hold for QA': 'red',
  'Completed': 'green', 'Registered': 'gray', 'Reviewed': 'teal', 'Rejected': 'red', 'Disposed': 'gray',
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function tatDays(iso: string | null): number | null {
  if (!iso) return null
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000))
}

export default function RecentSamplesTable({ samples }: { samples: LabSample[] }) {
  const columns: DataTableColumn<LabSample>[] = [
    {
      id: 'sample_id', label: 'Sample ID', sortable: true, minWidth: 110,
      render: s => <Link href={`/dashboard/samples/${s.id}`} style={linkStyle}>{sampleDisplayId(s)}</Link>,
    },
    { id: 'client_name', label: 'Client', sortable: true, minWidth: 140, render: s => s.client_name || '—' },
    { id: 'sample_type_name', label: 'Sample Type', sortable: true, minWidth: 120, render: s => s.sample_type_name || '—' },
    {
      id: 'status', label: 'Status', sortable: true, minWidth: 120,
      render: s => {
        const label = STATUS_DISPLAY[s.status] ?? s.status
        return <Chip tone={STATUS_TONE[label] ?? 'gray'}>{label}</Chip>
      },
    },
    { id: 'received_date', label: 'Received Date', sortable: true, minWidth: 120, render: s => fmtDate(s.received_date) },
    { id: 'expiry_date', label: 'Expiry Date', sortable: true, minWidth: 120, render: s => fmtDate(s.expiry_date) },
    { id: 'tat', label: 'TAT (Days)', sortable: true, align: 'center', minWidth: 90, render: s => tatDays(s.received_date) ?? '—' },
  ]

  return (
    <DataTable<LabSample>
      data={samples}
      columns={columns}
      paginated={false}
      bare
      dense
      emptyMessage="No samples yet."
    />
  )
}

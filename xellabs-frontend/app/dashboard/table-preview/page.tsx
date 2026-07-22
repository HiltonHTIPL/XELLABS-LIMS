'use client'

/**
 * THROWAWAY preview route for the reusable <DataTable> (built on @liji-table).
 * Not linked in the sidebar — reach it directly at /dashboard/table-preview.
 * Delete once the real Samples Overview is mapped through DataTable.
 */

import DataTable, { type DataTableColumn } from '../_components/DataTable'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

type MockSample = {
  id: number
  sample_id: string
  client: string
  sample_type: string
  status: string
  priority: string
  received_date: string
  due_date: string
  tat: number
  analyst: string
  storage: string
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  registered:      { bg: '#EFF6FF', color: '#1D4ED8', label: 'Logged' },
  received:        { bg: '#DBEAFE', color: '#0154FC', label: 'Received' },
  in_progress:     { bg: '#DBEAFE', color: '#1E40AF', label: 'In Process' },
  results_pending: { bg: '#FEF3C7', color: '#92400E', label: 'To Be Verified' },
  published:       { bg: '#DBEAFE', color: '#0154FC', label: 'Completed' },
  rejected:        { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
}
const PRIORITY_BADGE: Record<string, { bg: string; color: string }> = {
  high:   { bg: '#FEE2E2', color: '#991B1B' },
  medium: { bg: '#FEF3C7', color: '#92400E' },
  low:    { bg: '#DBEAFE', color: '#0154FC' },
}

const CLIENTS = ['Acme Diagnostics', 'BioNova Labs', 'Ceres Foods', 'Delta Pharma', 'Everest Water Co']
const TYPES = ['Blood', 'Urine', 'Water', 'Soil', 'Tissue']
const ANALYSTS = ['J. Okoro', 'M. Adeyemi', 'R. Singh', 'L. Chen', 'P. Mensah']
const STORAGE = ['Fridge A / Shelf 2 / Box 4', 'Freezer B / Rack 1', 'Cabinet 3 / Slot A1', 'Fridge A / Shelf 1', 'Room Temp / Bay 7']
const STATUSES = Object.keys(STATUS_BADGE)
const PRIORITIES = ['high', 'medium', 'low']

// Deterministic mock rows (no Math.random — keeps SSR/CSR markup identical).
const MOCK: MockSample[] = Array.from({ length: 47 }, (_, i) => {
  const day = String((i % 27) + 1).padStart(2, '0')
  return {
    id: i + 1,
    sample_id: `SMP-2026-${String(i + 1).padStart(4, '0')}`,
    client: CLIENTS[i % CLIENTS.length],
    sample_type: TYPES[i % TYPES.length],
    status: STATUSES[i % STATUSES.length],
    priority: PRIORITIES[i % PRIORITIES.length],
    received_date: `2026-07-${day}`,
    due_date: `2026-08-${day}`,
    tat: (i * 3) % 14,
    analyst: ANALYSTS[i % ANALYSTS.length],
    storage: STORAGE[i % STORAGE.length],
  }
})

const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function TablePreviewPage() {
  const columns: DataTableColumn<MockSample>[] = [
    {
      id: 'sample_id', label: 'Sample ID', sortable: true, minWidth: 130,
      render: r => <span style={{ color: '#2563EB', fontWeight: 600, textDecoration: 'underline' }}>{r.sample_id}</span>,
    },
    { id: 'client', label: 'Client', sortable: true, minWidth: 160 },
    { id: 'sample_type', label: 'Sample Type', sortable: true },
    {
      id: 'status', label: 'Status', sortable: true,
      render: r => {
        const b = STATUS_BADGE[r.status] ?? { bg: '#F3F4F6', color: '#374151', label: r.status }
        return <span style={{ background: b.bg, color: b.color, borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{b.label}</span>
      },
    },
    {
      id: 'priority', label: 'Priority', sortable: true,
      render: r => {
        const b = PRIORITY_BADGE[r.priority]
        return <span style={{ background: b.bg, color: b.color, borderRadius: 20, padding: '3px 9px', fontWeight: 600, fontSize: 11, textTransform: 'capitalize' }}>{r.priority}</span>
      },
    },
    { id: 'received_date', label: 'Received', sortable: true, render: r => fmt(r.received_date) },
    { id: 'due_date', label: 'Due Date', sortable: true, render: r => fmt(r.due_date) },
    {
      id: 'tat', label: 'TAT (Days)', sortable: true, align: 'left',
      render: r => <span style={{ fontWeight: 600, color: r.tat > 7 ? '#EF4444' : '#374151' }}>{r.tat}</span>,
    },
    { id: 'analyst', label: 'Assigned Analyst', sortable: true, minWidth: 160 },
    { id: 'storage', label: 'Storage', sortable: true, minWidth: 200 },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F9FAFB', padding: '24px 24px 0', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Table Preview <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>(mock — @liji-table DataTable)</span></h1>
        <p style={{ fontSize: 13, color: '#374151', margin: '4px 0 0' }}>Try: click a header to sort · <strong>right-click a header</strong> for Sort / Autosize this / Autosize all / Pin left-right / Reset · <strong>drag a header</strong> onto another to reorder (swap) · <strong>drag a header&rsquo;s right edge</strong> to resize · search · select · paginate. Layout persists (Reset layout button). 47 mock rows.</p>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingBottom: 24 }}>
        <DataTable<MockSample>
          data={MOCK}
          columns={columns}
          selectable
          searchable
          pageSize={10}
          persistKey="preview_samples_table"
          onRowClick={r => alert(`Clicked ${r.sample_id}`)}
          rowActions={r => (
            <button
              onClick={() => alert(`Receive ${r.sample_id}`)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid #0154FC', background: '#DBEAFE', color: '#0154FC', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              <MI name="move_to_inbox" size={13} color="#0154FC" /> Receive
            </button>
          )}
        />
      </div>
    </div>
  )
}

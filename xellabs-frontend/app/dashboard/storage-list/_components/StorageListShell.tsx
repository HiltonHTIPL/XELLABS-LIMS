'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader, StatCard, StatusChip, Btn, MI, ConfirmModal, EmptyState, T } from '../../_components/ui'
import DataTable, { type DataTableColumn } from '../../_components/DataTable'
import { deleteMasterDataRecords } from '@/app/actions/senaite-import'
import type { SenaiteStorageLocation } from '@/app/lib/senaite'

type Row = SenaiteStorageLocation & { id: string }

export default function StorageListShell({ initialStorageLocations }: { initialStorageLocations: SenaiteStorageLocation[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const activeCount = initialStorageLocations.filter(s => s.review_state === 'active').length

  // Row id: SenaiteStorageLocation has no `id`, so map it from `uid`.
  const rows: Row[] = initialStorageLocations.map(s => ({ ...s, id: s.uid }))

  function confirmDelete() {
    setConfirmOpen(false)
    startTransition(async () => {
      const result = await deleteMasterDataRecords(Array.from(selected))
      setToast({ ok: result.success, msg: result.message })
      setTimeout(() => setToast(null), 4000)
      setSelected(new Set())
      router.refresh()
    })
  }

  // Columns reproduce the previous hand-rolled cells exactly (same formatting /
  // `|| '—'` fallback / StatusChip) so the migration to the shared <DataTable>
  // is visually neutral while adding sort / search / pagination / pin / resize.
  const columns: DataTableColumn<Row>[] = [
    { id: 'title', label: 'Title', sortable: true, minWidth: 200, render: r => <span style={{ fontWeight: 600 }}>{r.title}</span> },
    { id: 'description', label: 'Description', sortable: true, minWidth: 260, render: r => <>{r.description || '—'}</> },
    { id: 'review_state', label: 'Status', sortable: true, minWidth: 110, render: r => <StatusChip status={r.review_state || 'active'} /> },
  ]

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0 }}>
      <PageHeader
        title="Storage List"
        subtitle="Storage locations — imported or managed via Master Data Import"
        backHref="/dashboard/admin"
        right={
          <Link
            href="/dashboard/master-data-import"
            style={{
              fontSize: 13, fontWeight: 600, color: T.primary, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            Import Storage Locations
          </Link>
        }
      />

      {toast && (
        <div
          className="mb-4 flex items-center gap-2"
          style={{
            fontSize: 13, padding: '8px 12px', borderRadius: 8,
            color: toast.ok ? T.success : T.danger,
            backgroundColor: toast.ok ? '#ECFDF5' : '#FEF2F2',
            flexShrink: 0,
          }}
        >
          <MI name={toast.ok ? 'check_circle' : 'error'} size={16} color={toast.ok ? T.success : T.danger} />
          {toast.msg}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4" style={{ maxWidth: 480, flexShrink: 0 }}>
        <StatCard icon="inventory_2" label="Total Storage Locations" value={initialStorageLocations.length} />
        <StatCard icon="check_circle" iconColor={T.success} iconBg="#ECFDF5" label="Active" value={activeCount} />
      </div>

      <div className="mb-3 flex items-center justify-end gap-3 flex-wrap">
        <Btn
          variant="outline"
          icon="delete"
          style={{ color: T.danger, borderColor: T.danger }}
          disabled={selected.size === 0 || isPending}
          onClick={() => setConfirmOpen(true)}
        >
          {isPending ? 'Deleting…' : `Delete Selected${selected.size > 0 ? ` (${selected.size})` : ''}`}
        </Btn>
      </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {initialStorageLocations.length === 0 ? (
        <EmptyState icon="inventory_2" title="No storage locations found" sub="Import storage locations from Master Data Import to see them here." />
      ) : (
        <DataTable<Row>
          data={rows}
          columns={columns}
          selectable
          onSelectionChange={ids => setSelected(new Set(ids.map(String)))}
          searchable
          persistKey="storage-list"
          emptyMessage="No storage locations found."
        />
      )}
      </div>

      {confirmOpen && (
        <ConfirmModal
          title="Delete storage locations?"
          message={`Delete ${selected.size} storage location${selected.size === 1 ? '' : 's'}? This cannot be undone from this screen.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}

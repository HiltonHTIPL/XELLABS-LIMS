'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { PageHeader, Card, Btn, MI, StatCard, T } from '../../_components/ui'
import { useStreamingImport } from './useStreamingImport'
import DataTable, { type DataTableColumn } from '@/app/dashboard/_components/DataTable'
import type { ImportRowResult } from './useStreamingImport'

const importRowColumns: DataTableColumn<ImportRowResult & { id: number }>[] = [
  { id: 'row', label: 'Row', sortable: true, width: 70 },
  { id: 'title', label: 'Title', sortable: true, render: r => <>{r.title ?? '—'}</> },
  {
    id: 'ok', label: 'Status', sortable: true, minWidth: 100,
    render: r => r.ok === true
      ? <span style={{ color: T.success, fontWeight: 600 }}>Created</span>
      : r.ok === false
        ? <span style={{ color: T.danger, fontWeight: 600 }}>Failed</span>
        : <span style={{ color: T.muted, fontWeight: 600 }}>Skipped</span>,
  },
  { id: 'detail', label: 'Detail', minWidth: 160, render: r => <>{r.uid ?? r.error ?? '—'}</> },
]

function ImportPanel({
  title, icon, description, columns, endpoint, viewListHref, viewListLabel,
}: {
  title: string
  icon: string
  description: string
  columns: { name: string; required: boolean }[]
  endpoint: string
  viewListHref: string
  viewListLabel: string
}) {
  const { state, run, reset } = useStreamingImport(endpoint)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pending = state.status === 'uploading' || state.status === 'processing'

  function pickFile() {
    inputRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setFileName(file?.name ?? null)
    reset()
  }

  function submit() {
    const file = inputRef.current?.files?.[0]
    if (file) run(file)
  }

  return (
    <Card title={title} icon={icon}>
      <p className="mb-3" style={{ fontSize: 13, color: T.muted }}>{description}</p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {columns.map(col => (
          <span
            key={col.name}
            style={{
              fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
              backgroundColor: col.required ? '#EFF6FF' : '#F3F4F6',
              color: col.required ? T.primary : T.muted,
              border: `1px solid ${col.required ? T.primary : T.cardBorder}`,
            }}
          >
            {col.name}{col.required && <span style={{ color: '#EF4444' }}> *</span>}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          onChange={onFileChange}
          style={{ display: 'none' }}
        />
        <Btn type="button" variant="outline" icon="attach_file" onClick={pickFile} disabled={pending}>
          {fileName ?? 'Choose .xlsx or .csv file'}
        </Btn>
        <Btn type="button" variant="primary" icon="upload_file" disabled={pending || !fileName} onClick={submit}>
          {state.status === 'uploading' ? 'Uploading…'
            : state.status === 'processing' ? `Processing ${state.processed ?? 0}/${state.total ?? '?'}…`
            : 'Import'}
        </Btn>
      </div>

      {state.status === 'processing' && state.total ? (
        <div className="mt-3" style={{ height: 6, borderRadius: 999, backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', borderRadius: 999, backgroundColor: T.primary,
              width: `${Math.round(((state.processed ?? 0) / state.total) * 100)}%`,
              transition: 'width .2s',
            }}
          />
        </div>
      ) : null}

      {state.status === 'error' && (
        <div
          className="mt-3 flex items-center gap-2"
          style={{ fontSize: 13, color: T.danger, padding: '8px 12px', borderRadius: 8, backgroundColor: '#FEF2F2' }}
        >
          <MI name="error" size={16} color={T.danger} />
          {state.message}
        </div>
      )}

      {state.status === 'done' && state.result && (
        <div className="mt-4">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <StatCard icon="check_circle" iconColor={T.success} iconBg="#ECFDF5" label="Created" value={state.result.created} />
            <StatCard icon="cancel" iconColor={T.danger} iconBg="#FEF2F2" label="Failed" value={state.result.failed} />
            <StatCard icon="remove_circle_outline" iconColor={T.muted} iconBg="#F3F4F6" label="Skipped" value={state.result.skipped} />
          </div>

          {state.result.created > 0 && (
            <Link
              href={viewListHref}
              className="mb-3"
              style={{
                fontSize: 13, fontWeight: 600, color: T.primary, textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <MI name="arrow_forward" size={16} color={T.primary} />
              {state.result.created} created — View {viewListLabel}
            </Link>
          )}

          {state.result.rows.length > 0 && (
            <div className="mt-2">
              <DataTable<ImportRowResult & { id: number }>
                data={state.result.rows.map(r => ({ ...r, id: r.row }))}
                columns={importRowColumns}
                searchable
                maxHeight={320}
                emptyMessage="No rows processed."
              />
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export default function MasterDataImportShell() {
  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <PageHeader
        title="Master Data Import"
        subtitle="Bulk-import Instruments and Storage Locations from an Excel (.xlsx) or CSV file"
        backHref="/dashboard/admin"
      />
      <div className="flex flex-col gap-4">
        <ImportPanel
          title="Instruments"
          icon="precision_manufacturing"
          description="Instrument Type, Manufacturer, and Supplier are auto-created if they don't already exist by name."
          columns={[
            { name: 'Title', required: true },
            { name: 'InstrumentType', required: true },
            { name: 'Manufacturer', required: true },
            { name: 'Supplier', required: true },
            { name: 'Model', required: false },
            { name: 'SerialNo', required: false },
            { name: 'AssetNumber', required: false },
          ]}
          endpoint="/api/senaite-import/instruments"
          viewListHref="/dashboard/instrument-list"
          viewListLabel="Instrument List"
        />
        <ImportPanel
          title="Storage Locations"
          icon="inventory_2"
          description="Creates Storage Locations directly under Setup."
          columns={[
            { name: 'Title', required: true },
            { name: 'Description', required: false },
          ]}
          endpoint="/api/senaite-import/storage-locations"
          viewListHref="/dashboard/storage-list"
          viewListLabel="Storage List"
        />
      </div>
    </div>
  )
}

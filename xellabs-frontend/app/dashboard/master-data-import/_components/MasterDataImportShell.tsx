'use client'
import { useActionState, useRef, useState } from 'react'
import { PageHeader, Card, Btn, MI, StatCard, thStyle, tdStyle, T } from '../../_components/ui'
import { importInstruments, importStorageLocations, type ImportState } from '@/app/actions/senaite-import'

const initialState: ImportState = {}

function ImportPanel({
  title, icon, description, columns, action,
}: {
  title: string
  icon: string
  description: string
  columns: { name: string; required: boolean }[]
  action: (state: ImportState, formData: FormData) => Promise<ImportState>
}) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
            {col.name}{col.required ? ' *' : ''}
          </span>
        ))}
      </div>

      <form action={formAction} className="flex items-center gap-2 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept=".xlsx"
          onChange={e => setFileName(e.target.files?.[0]?.name ?? null)}
          style={{ display: 'none' }}
        />
        <Btn type="button" variant="outline" icon="attach_file" onClick={() => inputRef.current?.click()}>
          {fileName ?? 'Choose .xlsx file'}
        </Btn>
        <Btn type="submit" variant="primary" icon="upload_file" disabled={pending || !fileName}>
          {pending ? 'Importing…' : 'Import'}
        </Btn>
      </form>

      {state.message && (
        <div
          className="mt-3 flex items-center gap-2"
          style={{ fontSize: 13, color: T.danger, padding: '8px 12px', borderRadius: 8, backgroundColor: '#FEF2F2' }}
        >
          <MI name="error" size={16} color={T.danger} />
          {state.message}
        </div>
      )}

      {state.result && (
        <div className="mt-4">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <StatCard icon="check_circle" iconColor={T.success} iconBg="#ECFDF5" label="Created" value={state.result.created} />
            <StatCard icon="cancel" iconColor={T.danger} iconBg="#FEF2F2" label="Failed" value={state.result.failed} />
            <StatCard icon="remove_circle_outline" iconColor={T.muted} iconBg="#F3F4F6" label="Skipped" value={state.result.skipped} />
          </div>

          {state.result.rows.length > 0 && (
            <div style={{ maxHeight: 320, overflowY: 'auto', border: `1px solid ${T.cardBorder}`, borderRadius: 10 }}>
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Row</th>
                    <th style={thStyle}>Title</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {state.result.rows.map(r => (
                    <tr key={r.row}>
                      <td style={tdStyle}>{r.row}</td>
                      <td style={tdStyle}>{r.title ?? '—'}</td>
                      <td style={tdStyle}>
                        {r.ok === true && <span style={{ color: T.success, fontWeight: 600 }}>Created</span>}
                        {r.ok === false && <span style={{ color: T.danger, fontWeight: 600 }}>Failed</span>}
                        {r.ok === null && <span style={{ color: T.muted, fontWeight: 600 }}>Skipped</span>}
                      </td>
                      <td style={tdStyle}>{r.uid ?? r.error ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        subtitle="Bulk-import Instruments and Storage Locations from an Excel (.xlsx) file"
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
          action={importInstruments}
        />
        <ImportPanel
          title="Storage Locations"
          icon="inventory_2"
          description="Creates Storage Locations directly under Setup."
          columns={[
            { name: 'Title', required: true },
            { name: 'Description', required: false },
          ]}
          action={importStorageLocations}
        />
      </div>
    </div>
  )
}

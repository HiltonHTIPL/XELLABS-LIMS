'use client'
import type { InstrumentOption, InstrumentResultImport } from '@/app/actions/instrument-maintenance'
import { EmptyState, StatusChip, MI, T, thStyle, tdStyle } from '@/app/dashboard/_components/ui'

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
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Instrument', 'Format', 'Status', 'Imported', 'Original file'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {imports.map(i => (
            <tr key={i.id}>
              <td style={tdStyle}>{instrumentLabel(instruments, i.instrument)}</td>
              <td style={tdStyle}>{i.file_format.toUpperCase()}</td>
              <td style={tdStyle}><StatusChip status={i.status} /></td>
              <td style={tdStyle}>{fmtDate(i.created_at)}</td>
              <td style={tdStyle}>
                {i.file ? (
                  <a
                    href={`/api/instrument-import-download/${i.id}`}
                    className="inline-flex items-center gap-1.5 hover:underline"
                    style={{ color: T.primary, fontSize: 12.5, fontWeight: 600 }}
                  >
                    <MI name="download" size={15} color={T.primary} /> Download backup
                  </a>
                ) : (
                  <span style={{ color: T.faint, fontSize: 12.5 }}>-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

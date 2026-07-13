'use client'
import type { PreviewRow, PreviewSummary } from '@/app/actions/instrument-import'
import { Chip, MI, T, thStyle, tdStyle } from '@/app/dashboard/_components/ui'

function SummaryBar({ summary }: { summary: PreviewSummary }) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-3">
      <Chip tone="gray">{summary.total} rows</Chip>
      <Chip tone="green" dot>{summary.valid} will import</Chip>
      <Chip tone={summary.invalid > 0 ? 'red' : 'gray'} dot>{summary.invalid} skipped</Chip>
    </div>
  )
}

export default function ImportPreviewTable({ rows, summary }: { rows: PreviewRow[]; summary: PreviewSummary }) {
  return (
    <div>
      <SummaryBar summary={summary} />
      <div style={{ overflowX: 'auto', border: `1px solid ${T.cardBorder}`, borderRadius: 12 }}>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Row', 'Sample', 'Test', 'Value', 'Unit', 'Flags', 'Maps to', ''].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isError = r.status === 'error'
              return (
                <tr key={`${r.row}-${i}`} style={{ backgroundColor: isError ? '#FEF7F7' : undefined }}>
                  <td style={tdStyle}>{r.row || '-'}</td>
                  <td style={tdStyle}>{r.sample_id || '-'}</td>
                  <td style={tdStyle}>{r.test_code || '-'}</td>
                  <td style={tdStyle}>{r.value || '-'}</td>
                  <td style={tdStyle}>{r.unit || '-'}</td>
                  <td style={tdStyle}>{r.flags || '-'}</td>
                  <td style={{ ...tdStyle, maxWidth: 260 }}>
                    {isError ? (
                      <span style={{ color: T.danger, fontSize: 12 }}>{r.detail}</span>
                    ) : (
                      <span style={{ color: T.text, fontSize: 12 }}>
                        {r.test_name}
                        {r.sample_status ? ` · sample ${r.sample_status}` : ''}
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {isError ? (
                      <span className="inline-flex items-center gap-1" style={{ color: T.danger, fontSize: 12, fontWeight: 600 }}>
                        <MI name="cancel" size={14} color={T.danger} /> Skip
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1" style={{ color: T.success, fontSize: 12, fontWeight: 600 }}>
                        <MI name="check_circle" size={14} color={T.success} /> Ready
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

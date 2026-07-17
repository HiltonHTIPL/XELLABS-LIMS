'use client'
import type { PreviewRow, PreviewSummary } from '@/app/actions/instrument-import'
import { Chip, MI, T, thStyle, tdStyle } from '@/app/dashboard/_components/ui'

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

/** Shared preview table for bulk result imports (Instrument Result Import,
 * Quality Result Import) — one definition (DRY) since both produce the same
 * row/summary shape. */
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
              const isSkip = r.status === 'skip'
              return (
                <tr
                  key={`${r.row}-${i}`}
                  style={{
                    backgroundColor: isError ? '#FEF7F7' : isSkip ? '#FFFBEB' : undefined,
                  }}
                >
                  <td style={tdStyle}>{r.row || '-'}</td>
                  <td style={tdStyle}>{r.sample_id || '-'}</td>
                  <td style={tdStyle}>{r.test_code || '-'}</td>
                  <td style={tdStyle}>{r.value || '-'}</td>
                  <td style={tdStyle}>{r.unit || '-'}</td>
                  <td style={tdStyle}>{r.flags || '-'}</td>
                  <td style={{ ...tdStyle, maxWidth: 280 }}>
                    {isError || isSkip ? (
                      <span style={{ color: isError ? T.danger : '#D97706', fontSize: 12 }}>{r.detail}</span>
                    ) : (
                      <span style={{ color: T.text, fontSize: 12 }}>
                        {r.test_name}
                        {r.sample_status ? ` · sample ${r.sample_status}` : ''}
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <RowStatus status={r.status} detail={r.detail} />
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

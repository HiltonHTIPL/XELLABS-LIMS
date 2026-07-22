// Shared client-side CSV export. Serializes a list (using its column config) to a
// CSV file and triggers a browser download. Mirrors the existing inline pattern in
// ClientsShell so every admin list page gets a consistent Export with no new
// dependency. An empty list exports just the header row — a blank import template.

export type CsvColumn<TRow> = {
  key: string
  label: string
  render?: (row: TRow) => string
}

function esc(value: unknown): string {
  const s = value == null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportRowsToCsv<TRow>(
  columns: CsvColumn<TRow>[],
  rows: TRow[],
  filenamePrefix: string,
): void {
  const header = columns.map(c => esc(c.label)).join(',')
  const body = rows.map(row =>
    columns
      .map(c => esc(c.render ? c.render(row) : (row as Record<string, unknown>)[c.key]))
      .join(','),
  )
  const csv = [header, ...body].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Minimal RFC4180-ish CSV parser — no dependency needed for this app's simple
 * lab-data exports (quoted fields with embedded commas/quotes only). Mirrors
 * Python's csv.DictReader behavior used by instruments/importers.py: header
 * names are trimmed + lowercased, one dict per data row keyed by header. */

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = false }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

export type CsvParseResult = {
  header: string[]                    // lowercased, trimmed
  rows: Record<string, string>[]      // keyed by lowercased header
}

export function parseDictCsv(text: string): CsvParseResult {
  const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text // strip BOM
  const lines = clean.split(/\r\n|\r|\n/).filter(l => l.length > 0)
  if (lines.length === 0) return { header: [], rows: [] }

  const header = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    const row: Record<string, string> = {}
    header.forEach((h, idx) => { row[h] = (cells[idx] ?? '').trim() })
    rows.push(row)
  }
  return { header, rows }
}

'use client'
import { useState, useRef, useEffect } from 'react'
import { exportRowsToCsv } from '@/app/lib/exportCsv'
import { logImportBatch, getImportHistory } from '@/app/actions/import-logs'
import DataTable, { type DataTableColumn } from '@/app/dashboard/_components/DataTable'

export type ImportColumn = { key: string; label: string }

export type ImportResult = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export type ParsedRow = Record<string, string>

type RowStatus = {
  status: 'pending' | 'success' | 'error' | 'skipped'
  message?: string
}

type Props = {
  columns: ImportColumn[]
  existingTitles?: string[]
  templateFilename?: string
  entityName?: string
  onImportRow: (row: ParsedRow) => Promise<ImportResult>
  onRefresh?: () => void
}

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

type ImportPreviewRow = { id: number; title: string; res: RowStatus }

const importPreviewColumns: DataTableColumn<ImportPreviewRow>[] = [
  { id: 'id', label: '#', width: 50, render: r => <>{r.id + 1}</> },
  { id: 'title', label: 'Row Identifier', minWidth: 160 },
  {
    id: 'status', label: 'Status', minWidth: 180,
    render: r => {
      const { res } = r
      const isErr = res.status === 'error'
      const isSkip = res.status === 'skipped'
      const isOk = res.status === 'success'
      return (
        <div className="inline-flex flex-col">
          <span className={`font-medium ${isOk ? 'text-green-600' : isErr ? 'text-red-600' : isSkip ? 'text-orange-500' : 'text-gray-500'}`}>
            {isOk ? 'Created' : isErr ? 'Error' : isSkip ? 'Skipped' : res.message || 'Pending'}
          </span>
          {(isErr || isSkip) && res.message && (
            <span className="text-[10px] text-gray-500 mt-0.5 leading-tight">{res.message}</span>
          )}
        </div>
      )
    },
  },
]

function parseCSV(text: string): string[][] {
  const lines: string[][] = []
  let currentLine: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"'
        i++ // skip escaped quote
      } else if (char === '"') {
        inQuotes = false
      } else {
        currentField += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        currentLine.push(currentField)
        currentField = ''
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        if (char === '\r') i++
        currentLine.push(currentField)
        lines.push(currentLine)
        currentLine = []
        currentField = ''
      } else {
        currentField += char
      }
    }
  }
  if (currentField !== '' || currentLine.length > 0) {
    currentLine.push(currentField)
    lines.push(currentLine)
  }
  return lines
}

export default function ImportButton({ columns, existingTitles = [], templateFilename, entityName, onImportRow, onRefresh }: Props) {
  const [open, setOpen] = useState(false)
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null)
  const [results, setResults] = useState<RowStatus[]>([])
  const [importing, setImporting] = useState(false)
  const [filename, setFilename] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload')
  const [history, setHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function fetchHistory() {
    if (!entityName) return
    setLoadingHistory(true)
    try {
      const data = await getImportHistory(entityName)
      setHistory(data)
    } catch (e) {
      console.error("Failed to fetch import history", e)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    if (open && activeTab === 'history' && entityName) {
      fetchHistory()
    }
  }, [open, activeTab, entityName])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      if (text) processCSV(text)
    }
    reader.readAsText(file)
    e.target.value = '' // reset
  }

  function processCSV(text: string) {
    const rows = parseCSV(text)
    if (rows.length < 2) {
      alert('File must contain a header row and at least one data row.')
      return
    }

    const headers = rows[0].map(h => h.trim())
    // Create a mapping from CSV header index to our column key
    const headerToKey = new Map<number, string>()
    for (let i = 0; i < headers.length; i++) {
      const col = columns.find(c => c.label.toLowerCase() === headers[i].toLowerCase())
      if (col) headerToKey.set(i, col.key)
    }

    const data: ParsedRow[] = []
    const initResults: RowStatus[] = []

    for (let i = 1; i < rows.length; i++) {
      const rowArr = rows[i]
      if (rowArr.length === 1 && !rowArr[0].trim()) continue // skip empty rows

      const rowObj: ParsedRow = {}
      headerToKey.forEach((key, index) => {
        rowObj[key] = rowArr[index]?.trim() || ''
      })
      data.push(rowObj)

      // Initial validation (Duplicate Check)
      const title = rowObj['title'] || rowObj['Title'] || rowObj['Name'] || rowObj['name']
      if (title && existingTitles.some(t => t.toLowerCase() === title.toLowerCase())) {
        initResults.push({ status: 'skipped', message: 'Duplicate name exists' })
      } else {
        initResults.push({ status: 'pending' })
      }
    }

    setParsedRows(data)
    setResults(initResults)
  }

  async function confirmImport() {
    if (!parsedRows) return
    setImporting(true)
    const newResults = [...results]
    
    let createdCount = 0

    for (let i = 0; i < parsedRows.length; i++) {
      if (newResults[i].status === 'skipped') continue

      newResults[i] = { status: 'pending', message: 'Importing...' }
      setResults([...newResults])

      try {
        const res = await onImportRow(parsedRows[i])
        if (res.success) {
          newResults[i] = { status: 'success', message: 'Created successfully' }
          createdCount++
        } else {
          const errs = res.errors ? Object.entries(res.errors).map(([k, v]) => `${k}: ${v.join(', ')}`).join(' | ') : ''
          newResults[i] = { status: 'error', message: res.message || errs || 'Failed' }
        }
      } catch (err: any) {
        newResults[i] = { status: 'error', message: err.message || 'Unknown error' }
      }
      setResults([...newResults])
    }

    setImporting(false)

    if (entityName && filename) {
      const rowErrors: any[] = []
      let skippedCount = 0
      let failedCount = 0
      
      newResults.forEach((res, idx) => {
        if (res.status === 'skipped') {
          skippedCount++
          const rowTitle = parsedRows[idx]['title'] || parsedRows[idx]['Title'] || parsedRows[idx]['Name'] || parsedRows[idx]['name'] || `Row ${idx + 1}`
          rowErrors.push({ row: idx + 1, name: rowTitle, status: 'skipped', reason: res.message })
        } else if (res.status === 'error') {
          failedCount++
          const rowTitle = parsedRows[idx]['title'] || parsedRows[idx]['Title'] || parsedRows[idx]['Name'] || parsedRows[idx]['name'] || `Row ${idx + 1}`
          rowErrors.push({ row: idx + 1, name: rowTitle, status: 'error', reason: res.message })
        }
      })

      await logImportBatch({
        entity_name: entityName,
        filename,
        total_rows: parsedRows.length,
        created_count: createdCount,
        skipped_count: skippedCount,
        failed_count: failedCount,
        row_errors: rowErrors.length > 0 ? rowErrors : null
      })
    }

    if (createdCount > 0 && onRefresh) {
      onRefresh()
    }
  }

  function closeDrawer() {
    if (importing) return
    setOpen(false)
    setTimeout(() => {
      setParsedRows(null)
      setResults([])
      setFilename('')
      setActiveTab('upload')
    }, 300)
  }

  const pendingCount = results.filter(r => r.status === 'pending').length
  const successCount = results.filter(r => r.status === 'success').length
  const errorCount = results.filter(r => r.status === 'error').length
  const skippedCount = results.filter(r => r.status === 'skipped').length
  const isDone = parsedRows && !importing && pendingCount === 0
  const canImport = parsedRows && !importing && pendingCount > 0

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ border: '1px solid #0154FC', color: '#0154FC', backgroundColor: '#fff' }}>
        <MI name="upload_file" size={15} color="#0154FC" /> Import
      </button>

      {/* Drawer */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: open ? 'auto' : 'none' }}>
        <div onClick={closeDrawer} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: open ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 500, maxWidth: '92vw', backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>
          
          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
                <MI name="upload_file" size={16} color="#0154FC" />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Import Data</h2>
            </div>
            {!importing && <button onClick={closeDrawer} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#374151" /></button>}
          </div>

          {/* Tabs */}
          {entityName && (
            <div className="flex border-b border-gray-200 px-6 mt-2">
              <button
                onClick={() => setActiveTab('upload')}
                className={`py-2 px-4 text-sm font-medium border-b-2 ${activeTab === 'upload' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Upload
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-2 px-4 text-sm font-medium border-b-2 ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                History
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {activeTab === 'history' ? (
              <div className="space-y-3">
                {loadingHistory ? (
                  <p className="text-sm text-gray-500">Loading history...</p>
                ) : history.length === 0 ? (
                  <p className="text-sm text-gray-500">No import history found for {entityName}.</p>
                ) : (
                  history.map((log) => (
                    <div key={log.id} className="p-3 border border-gray-200 rounded-lg shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{log.filename}</p>
                          <p className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()} • {log.user_display || 'Unknown user'}</p>
                        </div>
                        <div className="flex gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
                          <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">{log.created_count} Created</span>
                          {log.skipped_count > 0 && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">{log.skipped_count} Skipped</span>}
                          {log.failed_count > 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">{log.failed_count} Failed</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : !parsedRows ? (
              <div className="flex flex-col items-center justify-center py-12 rounded-xl" style={{ border: '1px dashed #D1D5DB', backgroundColor: '#F9FAFB' }}>
                <MI name="file_upload" size={32} color="#374151" />
                <p className="mt-2 text-sm font-medium text-gray-700">Upload CSV file</p>
                <p className="mt-1 text-xs text-gray-500 text-center px-4">The CSV headers must match the exported file exactly.</p>
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium border border-blue-200 hover:bg-blue-100">
                  Select File
                </button>
                {templateFilename && (
                  <button onClick={() => exportRowsToCsv(columns, [], templateFilename)} className="mt-2 text-xs text-blue-600 hover:underline">
                    Download Template
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-gray-50 border border-gray-200 flex flex-col items-center">
                    <span className="text-lg font-semibold text-gray-700">{parsedRows.length}</span>
                    <span className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Total</span>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-50 border border-blue-100 flex flex-col items-center">
                    <span className="text-lg font-semibold text-blue-700">{pendingCount}</span>
                    <span className="text-[10px] uppercase tracking-wide text-blue-500 font-medium">Pending</span>
                  </div>
                  <div className="p-2 rounded-lg bg-green-50 border border-green-100 flex flex-col items-center">
                    <span className="text-lg font-semibold text-green-700">{successCount}</span>
                    <span className="text-[10px] uppercase tracking-wide text-green-600 font-medium">Created</span>
                  </div>
                  <div className="p-2 rounded-lg bg-red-50 border border-red-100 flex flex-col items-center">
                    <span className="text-lg font-semibold text-red-700">{errorCount + skippedCount}</span>
                    <span className="text-[10px] uppercase tracking-wide text-red-600 font-medium">Failed/Skip</span>
                  </div>
                </div>

                <DataTable<ImportPreviewRow>
                  data={parsedRows.map((row, i) => ({
                    id: i,
                    title: row['title'] || row['Title'] || row['Name'] || row['name'] || `Row ${i + 1}`,
                    res: results[i],
                  }))}
                  columns={importPreviewColumns}
                  searchable
                  emptyMessage="No rows parsed."
                />
              </>
            )}
          </div>

          <div className="px-6 py-4 flex gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button type="button" onClick={closeDrawer} disabled={importing} className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium" style={{ border: '1px solid #D1D5DB', color: '#374151', opacity: importing ? 0.5 : 1 }}>
              {isDone ? 'Close' : 'Cancel'}
            </button>
            <div className="flex-1" />
            {activeTab === 'upload' && parsedRows && !isDone && (
              <button onClick={confirmImport} disabled={importing || !canImport}
                className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium text-white"
                style={{ backgroundColor: importing || !canImport ? '#93C5FD' : '#0154FC', cursor: importing || !canImport ? 'not-allowed' : 'pointer' }}>
                <MI name={importing ? 'hourglass_top' : 'play_arrow'} size={13} color="#fff" />
                {importing ? 'Importing...' : 'Confirm Import'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

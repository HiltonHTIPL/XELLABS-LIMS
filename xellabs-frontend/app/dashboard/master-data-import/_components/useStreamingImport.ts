'use client'
import { useCallback, useState } from 'react'

export type ImportRowResult = {
  row: number
  ok: boolean | null
  title: string | null
  uid?: string
  error?: string
}

export type ImportDoneResult = {
  created: number
  failed: number
  skipped: number
  rows: ImportRowResult[]
}

export type StreamingImportState = {
  status: 'idle' | 'uploading' | 'processing' | 'done' | 'error'
  message?: string
  processed?: number
  total?: number
  result?: ImportDoneResult
}

const ALLOWED_EXTENSIONS = ['.xlsx', '.csv']

export function validateImportFile(file: File | null): string | null {
  if (!file) return 'Please select a file to import.'
  if (file.size === 0) return 'That file is empty.'
  const lower = file.name.toLowerCase()
  if (!ALLOWED_EXTENSIONS.some(ext => lower.endsWith(ext))) {
    return 'Only .xlsx or .csv files are supported.'
  }
  return null
}

export function useStreamingImport(endpoint: string) {
  const [state, setState] = useState<StreamingImportState>({ status: 'idle' })

  const run = useCallback(async (file: File) => {
    const validationError = validateImportFile(file)
    if (validationError) {
      setState({ status: 'error', message: validationError })
      return
    }

    setState({ status: 'uploading' })

    const formData = new FormData()
    formData.append('file', file, file.name)

    let res: Response
    try {
      res = await fetch(endpoint, { method: 'POST', body: formData })
    } catch (e) {
      setState({ status: 'error', message: String(e) })
      return
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setState({ status: 'error', message: data.detail ?? 'Import failed.' })
      return
    }

    if (!res.body) {
      setState({ status: 'error', message: 'No response body from server.' })
      return
    }

    setState({ status: 'processing', processed: 0 })

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          const event = JSON.parse(line)
          if (event.type === 'progress') {
            setState({ status: 'processing', processed: event.processed, total: event.total })
          } else if (event.type === 'done') {
            setState({
              status: 'done',
              result: { created: event.created, failed: event.failed, skipped: event.skipped, rows: event.rows },
            })
          }
        }
      }
    } catch (e) {
      setState({ status: 'error', message: String(e) })
    }
  }, [endpoint])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, run, reset }
}

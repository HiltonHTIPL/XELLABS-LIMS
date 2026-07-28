'use client'
import { useState, useMemo, useTransition, useRef } from 'react'
import Link from 'next/link'
import { getResults, type EnrichedResult, type ResultFilters } from '@/app/actions/results'
import {
  PageHeader, Card, StatCard, Btn, Field, StatusChip, EmptyState,
  inputCls, inputStyle, selectStyle, T,
} from '@/app/dashboard/_components/ui'
import DataTable, { type DataTableColumn } from '../../_components/DataTable'

function fmtDate(v: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ResultsShell({ initialResults }: { initialResults: EnrichedResult[] }) {
  const [results, setResults] = useState<EnrichedResult[]>(initialResults)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [outOfRange, setOutOfRange] = useState<'' | 'true' | 'false'>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [pending, startTransition] = useTransition()

  // SENAITE review_states actually present in the data — no fixed Django
  // status enum anymore, so the dropdown reflects whatever's really there.
  const statuses = useMemo(() => Array.from(new Set(initialResults.map(r => r.status))).sort(), [initialResults])

  function runSearch() {
    const filters: ResultFilters = {
      search: search || undefined,
      status: status || undefined,
      is_out_of_range: outOfRange || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }
    startTransition(async () => {
      const r = await getResults(filters)
      setResults(r)
    })
  }

  function resetFilters() {
    setSearch(''); setStatus(''); setOutOfRange(''); setDateFrom(''); setDateTo('')
    startTransition(async () => {
      const r = await getResults({})
      setResults(r)
    })
  }

  const stats = useMemo(() => {
    const total = results.length
    const awaitingResult = results.filter(r => r.status === 'assigned').length
    const verified = results.filter(r => r.status === 'verified' || r.status === 'published').length
    const outRange = results.filter(r => r.is_out_of_range).length
    return { total, awaitingResult, verified, outRange }
  }, [results])

  // Submitted is a nullable date — expose an epoch sort field; render keeps
  // reading the original ISO value (and its by-name sub-line) unchanged.
  type Row = EnrichedResult & { submitted_sort: number }
  const rows: Row[] = results.map(r => ({
    ...r,
    submitted_sort: r.submitted_at ? new Date(r.submitted_at).getTime() : 0,
  }))

  const columns: DataTableColumn<Row>[] = [
    { id: 'test_name', label: 'Test', sortable: true, minWidth: 140, render: r => r.test_name || '—' },
    { id: 'sample_id', label: 'Sample', sortable: true, minWidth: 140, render: r => r.sample_id || '—' },
    {
      id: 'ws_id', label: 'Worksheet', sortable: true, minWidth: 120,
      // The worksheet detail route resolves its `[id]` param as the
      // worksheet's own id (e.g. "WS-011"), not its SENAITE uid — confirmed
      // in senaite-worksheets.ts's getSenaiteWorksheetDetailById, which builds
      // the SENAITE path directly from it. Linking by uid 404s.
      render: r => (
        r.ws_id ? (
          <Link href={`/dashboard/worksheets/${r.ws_id}`} style={{ color: T.primary, fontWeight: 600, textDecoration: 'none' }}>
            {r.ws_id}
          </Link>
        ) : '—'
      ),
    },
    { id: 'value', label: 'Value', sortable: true, minWidth: 90, render: r => r.value || '—' },
    { id: 'unit', label: 'Unit', sortable: true, minWidth: 80, render: r => r.unit || '—' },
    { id: 'status', label: 'Status', sortable: true, minWidth: 110, render: r => <StatusChip status={r.status} /> },
    {
      id: 'is_out_of_range', label: 'Range', sortable: true, minWidth: 110,
      render: r => r.is_out_of_range
        ? <span style={{ color: T.danger, fontWeight: 600, fontSize: 12 }}>Out of range</span>
        : <span style={{ color: T.muted, fontSize: 12 }}>In range</span>,
    },
    {
      id: 'submitted_sort', label: 'Submitted', sortable: true, minWidth: 150,
      render: r => (
        <div>
          <div>{fmtDate(r.submitted_at)}</div>
          {r.submitted_by_name && <div style={{ fontSize: 11, color: T.faint }}>{r.submitted_by_name}</div>}
        </div>
      ),
    },
    {
      // SENAITE exposes no "date verified" field anywhere on Analysis (only
      // who — getLastVerificator) — see app/actions/results.ts docstring.
      // Showing an exact-looking date we don't actually have would be worse
      // than showing none, so this column is name-only, not a fabricated date.
      id: 'verified_by_name', label: 'Verified By', sortable: true, minWidth: 130, render: r => r.verified_by_name || '—',
    },
  ]

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0 }}>
      <PageHeader
        title="Results"
        subtitle="Search and review test results across all samples and worksheets"
        backHref="/dashboard/admin"
      />

      <div className="grid grid-cols-4 gap-4 mb-5">
        <StatCard icon="fact_check" label="Total Results" value={stats.total} />
        <StatCard icon="hourglass_top" iconColor={T.warning} iconBg="#FFF7ED" label="Awaiting Result" value={stats.awaitingResult} />
        <StatCard icon="verified" iconColor={T.success} iconBg="#DBEAFE" label="Verified" value={stats.verified} />
        <StatCard icon="warning" iconColor={T.danger} iconBg="#FEF2F2" label="Out of Range" value={stats.outRange} />
      </div>

      <Card className="mb-5">
        <div className="flex items-end gap-3 flex-wrap">
          <Field label="Search" className="flex-1" style={{ maxWidth: 320, minWidth: 220 }}>
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="Sample ID, worksheet, or test name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') runSearch() }}
            />
          </Field>
          <Field label="Status">
            <select className={inputCls} style={selectStyle} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          <Field label="Range">
            <select className={inputCls} style={selectStyle} value={outOfRange} onChange={e => setOutOfRange(e.target.value as '' | 'true' | 'false')}>
              <option value="">All results</option>
              <option value="true">Out of range only</option>
              <option value="false">In range only</option>
            </select>
          </Field>
          <Field label="Submitted from">
            <input type="date" className={inputCls} style={inputStyle} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </Field>
          <Field label="Submitted to">
            <input type="date" className={inputCls} style={inputStyle} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </Field>
          <div className="flex items-center gap-2">
            <Btn variant="primary" icon="search" onClick={runSearch} disabled={pending}>
              {pending ? 'Searching…' : 'Search'}
            </Btn>
            <Btn variant="outline" icon="refresh" onClick={resetFilters} disabled={pending}>Reset</Btn>
          </div>
        </div>
      </Card>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <Card title="Results" icon="science" pad={false}>
        {results.length === 0 ? (
          <div className="p-4">
            <EmptyState icon="fact_check" title="No results found" sub="Try adjusting your search or filters." />
          </div>
        ) : (
          <div className="p-4" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <DataTable<Row>
              data={rows}
              columns={columns}
              persistKey="results"
              bare
              emptyMessage="No results found."
            />
          </div>
        )}
      </Card>
      </div>
    </div>
  )
}

'use client'
import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { getResults, type EnrichedResult, type ResultFilters, type ResultStatus } from '@/app/actions/results'
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
  const [status, setStatus] = useState<ResultStatus | ''>('')
  const [outOfRange, setOutOfRange] = useState<'' | 'true' | 'false'>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [pending, startTransition] = useTransition()

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
    const pendingCount = results.filter(r => r.status === 'pending').length
    const verified = results.filter(r => r.status === 'verified').length
    const outRange = results.filter(r => r.is_out_of_range).length
    return { total, pendingCount, verified, outRange }
  }, [results])

  // Submitted/Verified are nullable dates — expose epoch sort fields; renders keep
  // reading the original ISO values (and their by-name sub-lines) unchanged.
  type Row = EnrichedResult & { submitted_sort: number; verified_sort: number }
  const rows: Row[] = results.map(r => ({
    ...r,
    submitted_sort: r.submitted_at ? new Date(r.submitted_at).getTime() : 0,
    verified_sort: r.verified_at ? new Date(r.verified_at).getTime() : 0,
  }))

  const columns: DataTableColumn<Row>[] = [
    { id: 'test_name', label: 'Test', sortable: true, minWidth: 140, render: r => r.test_name || '—' },
    {
      id: 'sample_id', label: 'Sample', sortable: true, minWidth: 140,
      render: r => (
        <div>
          <div>{r.sample_id || '—'}</div>
          {r.sample_barcode && <div style={{ fontSize: 11, color: T.faint }}>{r.sample_barcode}</div>}
        </div>
      ),
    },
    { id: 'ar_id', label: 'AR ID', sortable: true, minWidth: 110, render: r => r.ar_id || '—' },
    {
      id: 'ws_id', label: 'Worksheet', sortable: true, minWidth: 120,
      render: r => (
        r.ws_id ? (
          r.worksheet_id ? (
            <Link href={`/dashboard/worksheets/${r.worksheet_id}`} style={{ color: T.primary, fontWeight: 600, textDecoration: 'none' }}>
              {r.ws_id}
            </Link>
          ) : r.ws_id
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
      id: 'verified_sort', label: 'Verified', sortable: true, minWidth: 150,
      render: r => (
        <div>
          <div>{fmtDate(r.verified_at)}</div>
          {r.verified_by_name && <div style={{ fontSize: 11, color: T.faint }}>{r.verified_by_name}</div>}
        </div>
      ),
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
        <StatCard icon="hourglass_top" iconColor={T.warning} iconBg="#FFF7ED" label="Pending" value={stats.pendingCount} />
        <StatCard icon="verified" iconColor={T.success} iconBg="#DBEAFE" label="Verified" value={stats.verified} />
        <StatCard icon="warning" iconColor={T.danger} iconBg="#FEF2F2" label="Out of Range" value={stats.outRange} />
      </div>

      <Card className="mb-5">
        <div className="grid grid-cols-5 gap-3 items-end">
          <Field label="Search" className="col-span-2">
            <input
              className={inputCls}
              style={inputStyle}
              placeholder="Sample ID, barcode, AR ID, worksheet, or test name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') runSearch() }}
            />
          </Field>
          <Field label="Status">
            <select className={inputCls} style={selectStyle} value={status} onChange={e => setStatus(e.target.value as ResultStatus | '')}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </Field>
          <Field label="Range">
            <select className={inputCls} style={selectStyle} value={outOfRange} onChange={e => setOutOfRange(e.target.value as '' | 'true' | 'false')}>
              <option value="">All results</option>
              <option value="true">Out of range only</option>
              <option value="false">In range only</option>
            </select>
          </Field>
          <div className="flex items-center gap-2">
            <Btn variant="primary" icon="search" onClick={runSearch} disabled={pending}>
              {pending ? 'Searching…' : 'Search'}
            </Btn>
            <Btn variant="outline" icon="refresh" onClick={resetFilters} disabled={pending}>Reset</Btn>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3 items-end mt-3">
          <Field label="Submitted from">
            <input type="date" className={inputCls} style={inputStyle} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </Field>
          <Field label="Submitted to">
            <input type="date" className={inputCls} style={inputStyle} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </Field>
        </div>
      </Card>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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

'use client'
import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { getResults, type EnrichedResult, type ResultFilters, type ResultStatus } from '@/app/actions/results'
import {
  PageHeader, Card, StatCard, Btn, Field, StatusChip, Pagination, EmptyState, MI,
  thStyle, tdStyle, inputCls, inputStyle, selectStyle, T,
} from '@/app/dashboard/_components/ui'

const PAGE_SIZE = 20

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
  const [page, setPage] = useState(1)
  const [pending, startTransition] = useTransition()

  function runSearch() {
    setPage(1)
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
    setSearch(''); setStatus(''); setOutOfRange(''); setDateFrom(''); setDateTo(''); setPage(1)
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

  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const pageResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <PageHeader
        title="Results"
        subtitle="Search and review test results across all samples and worksheets"
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

      <Card title="Results" icon="science" pad={false}>
        {pageResults.length === 0 ? (
          <div className="p-4">
            <EmptyState icon="fact_check" title="No results found" sub="Try adjusting your search or filters." />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Test</th>
                  <th style={thStyle}>Sample</th>
                  <th style={thStyle}>AR ID</th>
                  <th style={thStyle}>Worksheet</th>
                  <th style={thStyle}>Value</th>
                  <th style={thStyle}>Unit</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Range</th>
                  <th style={thStyle}>Submitted</th>
                  <th style={thStyle}>Verified</th>
                </tr>
              </thead>
              <tbody>
                {pageResults.map(r => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.test_name || '—'}</td>
                    <td style={tdStyle}>
                      <div>{r.sample_id || '—'}</div>
                      {r.sample_barcode && <div style={{ fontSize: 11, color: T.faint }}>{r.sample_barcode}</div>}
                    </td>
                    <td style={tdStyle}>{r.ar_id || '—'}</td>
                    <td style={tdStyle}>
                      {r.ws_id ? (
                        r.worksheet_id ? (
                          <Link href={`/dashboard/lab-worksheets/${r.worksheet_id}`} style={{ color: T.primary, fontWeight: 600, textDecoration: 'none' }}>
                            {r.ws_id}
                          </Link>
                        ) : r.ws_id
                      ) : '—'}
                    </td>
                    <td style={tdStyle}>{r.value || '—'}</td>
                    <td style={tdStyle}>{r.unit || '—'}</td>
                    <td style={tdStyle}><StatusChip status={r.status} /></td>
                    <td style={tdStyle}>
                      {r.is_out_of_range
                        ? <span style={{ color: T.danger, fontWeight: 600, fontSize: 12 }}>Out of range</span>
                        : <span style={{ color: T.muted, fontSize: 12 }}>In range</span>}
                    </td>
                    <td style={tdStyle}>
                      <div>{fmtDate(r.submitted_at)}</div>
                      {r.submitted_by_name && <div style={{ fontSize: 11, color: T.faint }}>{r.submitted_by_name}</div>}
                    </td>
                    <td style={tdStyle}>
                      <div>{fmtDate(r.verified_at)}</div>
                      {r.verified_by_name && <div style={{ fontSize: 11, color: T.faint }}>{r.verified_by_name}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex justify-end p-3">
            <Pagination page={page} pages={pages} onPage={setPage} showTotal totalItems={results.length} />
          </div>
        )}
      </Card>
    </div>
  )
}

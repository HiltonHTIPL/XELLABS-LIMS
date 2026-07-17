'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader, StatCard, Card, StatusChip, Btn, MI, ConfirmModal, thStyle, tdStyle, Pagination, EmptyState, T } from '../../_components/ui'
import { deleteMasterDataRecords } from '@/app/actions/senaite-import'
import type { SenaiteInstrument } from '@/app/lib/senaite'

const PAGE_SIZE = 25

export default function InstrumentListShell({ initialInstruments }: { initialInstruments: SenaiteInstrument[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const filtered = initialInstruments.filter(i => {
    if (!search) return true
    const needle = search.toLowerCase()
    return (
      i.title.toLowerCase().includes(needle) ||
      i.Manufacturer.toLowerCase().includes(needle) ||
      i.Supplier.toLowerCase().includes(needle) ||
      i.SerialNo.toLowerCase().includes(needle) ||
      i.AssetNumber.toLowerCase().includes(needle)
    )
  })

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const activeCount = initialInstruments.filter(i => i.review_state === 'active').length

  const allOnPageSelected = pageRows.length > 0 && pageRows.every(r => selected.has(r.uid))

  function toggleOne(uid: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  function toggleAllOnPage() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allOnPageSelected) {
        pageRows.forEach(r => next.delete(r.uid))
      } else {
        pageRows.forEach(r => next.add(r.uid))
      }
      return next
    })
  }

  function confirmDelete() {
    setConfirmOpen(false)
    startTransition(async () => {
      const result = await deleteMasterDataRecords(Array.from(selected))
      setToast({ ok: result.success, msg: result.message })
      setTimeout(() => setToast(null), 4000)
      setSelected(new Set())
      router.refresh()
    })
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0 }}>
      <PageHeader
        title="Instrument List"
        subtitle="Lab instruments — imported or managed via Master Data Import"
        backHref="/dashboard/admin"
        right={
          <Link
            href="/dashboard/master-data-import"
            style={{
              fontSize: 13, fontWeight: 600, color: T.primary, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            Import Instruments
          </Link>
        }
      />

      {toast && (
        <div
          className="mb-4 flex items-center gap-2"
          style={{
            fontSize: 13, padding: '8px 12px', borderRadius: 8,
            color: toast.ok ? T.success : T.danger,
            backgroundColor: toast.ok ? '#ECFDF5' : '#FEF2F2',
          }}
        >
          <MI name={toast.ok ? 'check_circle' : 'error'} size={16} color={toast.ok ? T.success : T.danger} />
          {toast.msg}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4" style={{ maxWidth: 480 }}>
        <StatCard icon="precision_manufacturing" label="Total Instruments" value={initialInstruments.length} />
        <StatCard icon="check_circle" iconColor={T.success} iconBg="#ECFDF5" label="Active" value={activeCount} />
      </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by title, manufacturer, supplier, serial or asset number…"
            style={{
              height: 36, flex: 1, minWidth: 260, maxWidth: 420, borderRadius: 10, border: `1px solid ${T.inputBorder}`,
              fontSize: 13, padding: '0 12px', outline: 'none',
            }}
          />
          <Btn
            variant="outline"
            icon="delete"
            style={{ color: T.danger, borderColor: T.danger }}
            disabled={selected.size === 0 || isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {isPending ? 'Deleting…' : `Delete Selected${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </Btn>
        </div>

        {pageRows.length === 0 ? (
          <EmptyState icon="precision_manufacturing" title="No instruments found" sub={search ? 'Try a different search.' : 'Import instruments from Master Data Import to see them here.'} />
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>
                      <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} />
                    </th>
                    <th style={thStyle}>Title</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Manufacturer</th>
                    <th style={thStyle}>Supplier</th>
                    <th style={thStyle}>Model</th>
                    <th style={thStyle}>Serial No</th>
                    <th style={thStyle}>Asset No</th>
                    <th style={thStyle}>Location</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(r => (
                    <tr key={r.uid} style={{ backgroundColor: selected.has(r.uid) ? '#EFF6FF' : undefined }}>
                      <td style={tdStyle}>
                        <input type="checkbox" checked={selected.has(r.uid)} onChange={() => toggleOne(r.uid)} />
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{r.title}</td>
                      <td style={tdStyle}>{r.InstrumentType || '—'}</td>
                      <td style={tdStyle}>{r.Manufacturer || '—'}</td>
                      <td style={tdStyle}>{r.Supplier || '—'}</td>
                      <td style={tdStyle}>{r.Model || '—'}</td>
                      <td style={tdStyle}>{r.SerialNo || '—'}</td>
                      <td style={tdStyle}>{r.AssetNumber || '—'}</td>
                      <td style={tdStyle}>{r.Location || '—'}</td>
                      <td style={tdStyle}><StatusChip status={r.review_state || 'active'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3">
              <Pagination page={page} pages={pages} onPage={setPage} />
            </div>
          </>
        )}
      </Card>

      {confirmOpen && (
        <ConfirmModal
          title="Delete instruments?"
          message={`Delete ${selected.size} instrument${selected.size === 1 ? '' : 's'}? This cannot be undone from this screen.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
      </div>
    </div>
  )
}

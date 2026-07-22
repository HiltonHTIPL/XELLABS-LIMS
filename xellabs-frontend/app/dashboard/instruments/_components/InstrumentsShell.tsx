'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { deleteInstrument, type Instrument } from '@/app/actions/instruments'
import { type NamedItem } from '@/app/actions/instrument-workflows'
import InstrumentFormDrawer, { STATUS_OPTIONS } from './InstrumentFormDrawer'
import DataTable, { type DataTableColumn } from '../../_components/DataTable'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  active: { bg: '#ECFDF5', fg: '#059669' },
  inactive: { bg: '#F3F4F6', fg: '#374151' },
  under_maintenance: { bg: '#FFFBEB', fg: '#D97706' },
  maintenance: { bg: '#FFFBEB', fg: '#D97706' },
  out_of_service: { bg: '#FEF2F2', fg: '#B91C1C' },
  retired: { bg: '#FEF2F2', fg: '#991B1B' },
}

const USABILITY_COLORS: Record<string, { bg: string; fg: string }> = {
  valid: { bg: '#ECFDF5', fg: '#059669' },
  expired: { bg: '#FFFBEB', fg: '#D97706' },
  out_of_service: { bg: '#FEF2F2', fg: '#B91C1C' },
}

type MethodOption = { id: number; name: string; code?: string }

export default function InstrumentsShell(
  { initialInstruments, types, locations, manufacturers, suppliers, methods = [] }:
  {
    initialInstruments: Instrument[]
    types: NamedItem[]
    locations: NamedItem[]
    manufacturers: NamedItem[]
    suppliers: NamedItem[]
    methods?: MethodOption[]
  }
) {
  const router = useRouter()
  const [showDrawer, setShowDrawer] = useState(false)
  const [editing, setEditing] = useState<Instrument | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Instrument | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function openCreate() { setEditing(null); setShowDrawer(true) }
  function openEdit(i: Instrument) { setEditing(i); setShowDrawer(true) }
  function closeDrawer() { setShowDrawer(false) }
  function handleSaved(_saved: Instrument | null, message: string) {
    setShowDrawer(false)
    setEditing(null)
    showToast(true, message)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirmDelete) return
    const res = await deleteInstrument(confirmDelete.id)
    showToast(res.success, res.message)
    setConfirmDelete(null)
    if (res.success) router.refresh()
  }

  const filtered = statusFilter === 'all'
    ? initialInstruments
    : initialInstruments.filter(i => i.status === statusFilter)

  // Derived primitive sort keys for columns whose displayed value comes from a
  // fallback chain / label lookup, so the table can order by what's shown.
  type Row = Instrument & {
    manufacturerDisplay: string
    locationDisplay: string
    statusLabel: string
    usabilityLabel: string
  }
  const rows: Row[] = filtered.map(i => ({
    ...i,
    manufacturerDisplay: i.manufacturer_org_name || i.manufacturer || '',
    locationDisplay: i.instrument_location_name || i.location || '',
    statusLabel: STATUS_OPTIONS.find(s => s.value === i.status)?.label ?? i.status,
    usabilityLabel: i.usability === 'out_of_service' ? 'Out of service' : i.usability === 'expired' ? 'Expired' : 'Valid',
  }))

  const columns: DataTableColumn<Row>[] = [
    {
      id: 'name', label: 'Name', sortable: true, minWidth: 200,
      render: i => <Link href={`/dashboard/instruments/${i.id}`} className="text-xs font-medium" style={{ color: '#0154FC', fontWeight: 600 }}>{i.name}</Link>,
    },
    {
      id: 'instrument_id', label: 'Instrument ID', sortable: true, minWidth: 130,
      render: i => <span className="font-mono text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>{i.instrument_id}</span>,
    },
    {
      id: 'manufacturerDisplay', label: 'Manufacturer', sortable: true, minWidth: 140,
      render: i => <span className="text-xs" style={{ color: '#374151' }}>{i.manufacturer_org_name || i.manufacturer || '—'}</span>,
    },
    {
      id: 'model', label: 'Model', sortable: true, minWidth: 120,
      render: i => <span className="text-xs" style={{ color: '#374151' }}>{i.model || '—'}</span>,
    },
    {
      id: 'locationDisplay', label: 'Location', sortable: true, minWidth: 130,
      render: i => <span className="text-xs" style={{ color: '#374151' }}>{i.instrument_location_name || i.location || '—'}</span>,
    },
    {
      id: 'statusLabel', label: 'Status', sortable: true, minWidth: 120,
      render: i => {
        const colors = STATUS_COLORS[i.status] ?? STATUS_COLORS.active
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: colors.bg, color: colors.fg }}>
            {STATUS_OPTIONS.find(s => s.value === i.status)?.label ?? i.status}
          </span>
        )
      },
    },
    {
      id: 'usabilityLabel', label: 'Usability', sortable: true, minWidth: 110,
      render: i => {
        const uColors = USABILITY_COLORS[i.usability] ?? USABILITY_COLORS.valid
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: uColors.bg, color: uColors.fg }}>
            {i.usability === 'out_of_service' ? 'Out of service' : i.usability === 'expired' ? 'Expired' : 'Valid'}
          </span>
        )
      },
    },
    {
      id: 'next_calibration', label: 'Next Calibration', sortable: true, minWidth: 130,
      render: i => <span className="text-xs" style={{ color: '#374151' }}>{i.next_calibration || '—'}</span>,
    },
  ]

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-3" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="arrow_back" size={16} color="#374151" />
          </Link>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Instrument Register</h1>
            <p className="text-sm mt-0.5" style={{ color: '#374151' }}>Manage lab instruments used for calibration, maintenance, and result imports</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/master-data-import" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ backgroundColor: '#fff', color: '#0154FC', border: '1px solid #0154FC' }}>
            <MI name="upload_file" size={15} color="#0154FC" /> Import
          </Link>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={15} color="#fff" /> New Instrument
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {[
          { value: 'all', label: 'All' },
          ...STATUS_OPTIONS,
        ].map(s => (
          <button key={s.value} type="button" onClick={() => setStatusFilter(s.value)}
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: statusFilter === s.value ? '#EFF6FF' : '#fff',
              color: statusFilter === s.value ? '#0154FC' : '#374151',
              border: `1px solid ${statusFilter === s.value ? '#BFDBFE' : '#E5E7EB'}`,
            }}>
            {s.label}
          </button>
        ))}
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ flexShrink: 0,
          backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      <InstrumentFormDrawer
        open={showDrawer}
        onClose={closeDrawer}
        editing={editing}
        types={types}
        locations={locations}
        manufacturers={manufacturers}
        suppliers={suppliers}
        methods={methods}
        onSaved={handleSaved}
      />

      {confirmDelete && (
        <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', bottom: 'var(--dashboard-footer-h)', left: 0, right: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, width: 360 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Delete instrument?</h3>
            <p style={{ fontSize: 12, color: '#374151', marginTop: 6 }}>
              Delete &quot;{confirmDelete.name}&quot;? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => setConfirmDelete(null)}
                style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleDelete}
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, backgroundColor: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="precision_manufacturing" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#374151' }}>
            {statusFilter === 'all' ? 'No instruments registered yet' : 'No instruments in this status'}
          </p>
          {statusFilter === 'all' && (
            <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
              <MI name="add" size={13} color="#fff" /> New Instrument
            </button>
          )}
        </div>
      ) : (
        <DataTable<Row>
          data={rows}
          columns={columns}
          searchable
          persistKey="instruments"
          emptyMessage="No instruments found."
          rowActions={i => (
            <div className="flex items-center gap-1">
              <button onClick={() => openEdit(i)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <MI name="edit" size={14} color="#6B7280" />
              </button>
              <button onClick={() => setConfirmDelete(i)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <MI name="delete" size={14} color="#EF4444" />
              </button>
            </div>
          )}
        />
      )}
      </div>
    </div>
  )
}

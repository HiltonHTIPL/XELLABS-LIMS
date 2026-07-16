'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createInstrument, updateInstrument, deleteInstrument,
  type Instrument, type InstrumentFormState,
} from '@/app/actions/instruments'
import {
  type NamedItem,
  createInstrumentType,
  createInstrumentLocation,
  createManufacturer,
  createSupplier,
} from '@/app/actions/instrument-workflows'
import { createMethodQuick } from '@/app/actions/methods'
import SelectOrAddField, { type SelectOrAddItem } from './SelectOrAddField'
import MethodsSelectOrAdd from './MethodsSelectOrAdd'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({ label, name, tip, placeholder, required, error, value, onChange, type = 'text' }: {
  label: string; name: string; tip?: string; placeholder?: string; required?: boolean
  error?: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      {tip && <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>{tip}</p>}
      <input name={name} type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
        style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }} />
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

function TextAreaField({ label, name, tip, placeholder, error, value, onChange, rows = 3 }: {
  label: string; name: string; tip?: string; placeholder?: string
  error?: string; value: string; onChange: (v: string) => void; rows?: number
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>{label}</label>
      {tip && <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>{tip}</p>}
      <textarea name={name} rows={rows} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none"
        style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }} />
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

/** Custom file picker — blue gradient button matching Create. */
function FilePickField({ label, tip, name, accept }: {
  label: string; tip: string; name: string; accept?: string
}) {
  const [fileName, setFileName] = useState('')
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>{label}</label>
      <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 6 }}>{tip}</p>
      <label
        className="inline-flex items-center gap-1.5 cursor-pointer"
        style={{
          fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, color: '#fff',
          background: 'linear-gradient(135deg, #0154FC 0%, #2563EB 55%, #1D4ED8 100%)',
          boxShadow: '0 1px 2px rgba(1, 84, 252, 0.25)',
        }}
      >
        <MI name="upload_file" size={14} color="#fff" />
        Choose file
        <input
          name={name}
          type="file"
          accept={accept}
          style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}
          onChange={e => setFileName(e.target.files?.[0]?.name ?? '')}
        />
      </label>
      <p style={{ fontSize: 11, color: fileName ? '#374151' : '#9CA3AF', marginTop: 6 }}>
        {fileName || 'No file chosen'}
      </p>
    </div>
  )
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
  { value: 'out_of_service', label: 'Out of Service' },
  { value: 'retired', label: 'Retired' },
]

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  active: { bg: '#ECFDF5', fg: '#059669' },
  inactive: { bg: '#F3F4F6', fg: '#6B7280' },
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

type DrawerTab = 'description' | 'additional' | 'procedures'

type FV = {
  name: string; instrument_id: string; model: string
  manufacturer_org: string; supplier_org: string
  serial_number: string; instrument_type: string; instrument_location: string
  asset_number: string
  location: string; status: string; purchase_date: string
  installation_date: string
  data_interface: string; import_data_interface: string; result_files_folder: string
  data_interface_options: string
  dispose_until_next_calibration: boolean
  inlab_calibration_procedure: string; preventive_maintenance_procedure: string
  notes: string
  method_ids: number[]
}
const blank = (): FV => ({
  name: '', instrument_id: '', model: '',
  manufacturer_org: '', supplier_org: '',
  serial_number: '', instrument_type: '', instrument_location: '', asset_number: '',
  location: '', status: 'active', purchase_date: '', installation_date: '',
  data_interface: '', import_data_interface: '', result_files_folder: '',
  data_interface_options: '',
  dispose_until_next_calibration: false,
  inlab_calibration_procedure: '', preventive_maintenance_procedure: '',
  notes: '',
  method_ids: [],
})

type MethodOption = { id: number; name: string; code?: string }

function toItems(list: NamedItem[]): SelectOrAddItem[] {
  return list.map(i => ({ id: i.id, name: i.name, description: i.description }))
}

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
  const [vals, setVals] = useState<FV>(blank)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState<Instrument | null>(null)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('description')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const [typeList, setTypeList] = useState<SelectOrAddItem[]>(() => toItems(types))
  const [manufacturerList, setManufacturerList] = useState<SelectOrAddItem[]>(() => toItems(manufacturers))
  const [supplierList, setSupplierList] = useState<SelectOrAddItem[]>(() => toItems(suppliers))
  const [locationList, setLocationList] = useState<SelectOrAddItem[]>(() => toItems(locations))
  const [methodList, setMethodList] = useState<SelectOrAddItem[]>(() =>
    methods.map(m => ({ id: m.id, name: m.name, code: m.code }))
  )

  const isEdit = editing !== null

  function setVal(k: keyof FV, v: string | boolean | number[]) {
    setVals(prev => ({ ...prev, [k]: v }))
    if (typeof k === 'string' && fieldErrors[k]) setFieldErrors(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  function toggleMethod(id: number) {
    setVals(prev => ({
      ...prev,
      method_ids: prev.method_ids.includes(id)
        ? prev.method_ids.filter(x => x !== id)
        : [...prev.method_ids, id],
    }))
  }

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const [, action, pending] = useActionState(
    async (prev: InstrumentFormState, fd: FormData) => {
      const id = fd.get('_editingId')
      const result = id ? await updateInstrument(Number(id), prev, fd) : await createInstrument(prev, fd)
      if (result.success) {
        setShowDrawer(false)
        setEditing(null)
        setVals(blank())
        setFieldErrors({})
        setDrawerTab('description')
        showToast(true, result.message ?? (editing ? 'Instrument updated.' : 'Instrument created.'))
        router.refresh()
      } else if (result.errors) {
        const fe: Record<string, string> = {}
        for (const [k, msgs] of Object.entries(result.errors)) { if (msgs?.length) fe[k] = msgs[0] }
        setFieldErrors(fe)
        if (fe.name || fe.instrument_id || fe.instrument_type || fe.manufacturer_org || fe.supplier_org) {
          setDrawerTab('description')
        }
      } else if (result.message) {
        showToast(false, result.message)
      }
      return result
    },
    {}
  )

  function openCreate() {
    setEditing(null); setVals(blank()); setFieldErrors({}); setDrawerTab('description'); setShowDrawer(true)
  }
  function openEdit(i: Instrument) {
    setEditing(i)
    setVals({
      name: i.name, instrument_id: i.instrument_id, model: i.model,
      manufacturer_org: i.manufacturer_org != null ? String(i.manufacturer_org) : '',
      supplier_org: i.supplier_org != null ? String(i.supplier_org) : '',
      serial_number: i.serial_number,
      instrument_type: i.instrument_type != null ? String(i.instrument_type) : '',
      instrument_location: i.instrument_location != null ? String(i.instrument_location) : '',
      asset_number: i.asset_number ?? '',
      location: i.location, status: i.status,
      purchase_date: i.purchase_date ?? '',
      installation_date: i.installation_date ?? '',
      data_interface: i.data_interface ?? '',
      import_data_interface: i.import_data_interface ?? '',
      result_files_folder: i.result_files_folder ?? '',
      data_interface_options: i.data_interface_options ?? '',
      dispose_until_next_calibration: Boolean(i.dispose_until_next_calibration),
      inlab_calibration_procedure: i.inlab_calibration_procedure ?? '',
      preventive_maintenance_procedure: i.preventive_maintenance_procedure ?? '',
      notes: i.notes,
      method_ids: i.method_ids ?? [],
    })
    setFieldErrors({})
    setDrawerTab('description')
    setShowDrawer(true)
  }
  function closeDrawer() { setShowDrawer(false) }

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

  const tabs: { key: DrawerTab; label: string }[] = [
    { key: 'description', label: 'Description' },
    { key: 'additional', label: 'Additional Information' },
    { key: 'procedures', label: 'Procedures' },
  ]

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Instrument Register</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage lab instruments used for calibration, maintenance, and result imports</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New Instrument
        </button>
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
              color: statusFilter === s.value ? '#0154FC' : '#6B7280',
              border: `1px solid ${statusFilter === s.value ? '#BFDBFE' : '#E5E7EB'}`,
            }}>
            {s.label}
          </button>
        ))}
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* ── Right Drawer ── */}
      <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, zIndex: 200, pointerEvents: showDrawer ? 'auto' : 'none' }}>
        <div onClick={closeDrawer} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showDrawer ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 520, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showDrawer ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>

          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEdit ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEdit ? 'edit' : 'add'} size={16} color={isEdit ? '#2563EB' : '#0154FC'} />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEdit ? `Edit — ${editing!.name}` : 'New Instrument'}</h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>{isEdit ? 'Update instrument details' : 'Register a new lab instrument'}</p>
              </div>
            </div>
            <button onClick={closeDrawer} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
          </div>

          <div className="flex px-5 pt-3 gap-1 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            {tabs.map(t => (
              <button key={t.key} type="button" onClick={() => setDrawerTab(t.key)}
                className="px-3 py-2 text-xs font-semibold"
                style={{
                  color: drawerTab === t.key ? '#0154FC' : '#6B7280',
                  borderBottom: drawerTab === t.key ? '2px solid #0154FC' : '2px solid transparent',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}>
                {t.label}
              </button>
            ))}
          </div>

          <form action={action} className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {isEdit && <input type="hidden" name="_editingId" value={editing!.id} />}
            <input type="hidden" name="method_ids" value={vals.method_ids.join(',')} />
            {/* Keep non-active tab fields in the form for submit */}
            {drawerTab !== 'description' && (
              <>
                <input type="hidden" name="name" value={vals.name} />
                <input type="hidden" name="instrument_id" value={vals.instrument_id} />
                <input type="hidden" name="manufacturer_org" value={vals.manufacturer_org} />
                <input type="hidden" name="model" value={vals.model} />
                <input type="hidden" name="instrument_type" value={vals.instrument_type} />
                <input type="hidden" name="supplier_org" value={vals.supplier_org} />
                <input type="hidden" name="serial_number" value={vals.serial_number} />
                <input type="hidden" name="asset_number" value={vals.asset_number} />
                <input type="hidden" name="status" value={vals.status} />
                <input type="hidden" name="purchase_date" value={vals.purchase_date} />
                <input type="hidden" name="notes" value={vals.notes} />
              </>
            )}
            {drawerTab !== 'additional' && (
              <>
                <input type="hidden" name="instrument_location" value={vals.instrument_location} />
                <input type="hidden" name="installation_date" value={vals.installation_date} />
                <input type="hidden" name="data_interface" value={vals.data_interface} />
                <input type="hidden" name="import_data_interface" value={vals.import_data_interface} />
                <input type="hidden" name="result_files_folder" value={vals.result_files_folder} />
                <input type="hidden" name="data_interface_options" value={vals.data_interface_options} />
                {vals.dispose_until_next_calibration && (
                  <input type="hidden" name="dispose_until_next_calibration" value="true" />
                )}
              </>
            )}
            {drawerTab !== 'procedures' && (
              <>
                <input type="hidden" name="inlab_calibration_procedure" value={vals.inlab_calibration_procedure} />
                <input type="hidden" name="preventive_maintenance_procedure" value={vals.preventive_maintenance_procedure} />
              </>
            )}

            <div className="flex-1 px-5 py-4 flex flex-col gap-3">
              {drawerTab === 'description' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Name" name="name" tip="Display name for this instrument" placeholder="e.g. HPLC System 1" required
                      error={fieldErrors.name} value={vals.name} onChange={v => setVal('name', v)} />
                    <Field label="Instrument ID" name="instrument_id" tip="Lab-unique identifier used in worksheets and imports" placeholder="e.g. HPLC-001" required
                      error={fieldErrors.instrument_id} value={vals.instrument_id} onChange={v => setVal('instrument_id', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectOrAddField
                      label="Instrument type"
                      tip="Select the type of this instrument"
                      name="instrument_type"
                      entityLabel="Instrument Type"
                      value={vals.instrument_type}
                      items={typeList}
                      onChange={id => setVal('instrument_type', id)}
                      onItemsChange={setTypeList}
                      createAction={(n, d) => createInstrumentType(n, d)}
                      error={fieldErrors.instrument_type}
                    />
                    <SelectOrAddField
                      label="Manufacturer"
                      tip="Select the manufacturer of this instrument"
                      name="manufacturer_org"
                      entityLabel="Manufacturer"
                      value={vals.manufacturer_org}
                      items={manufacturerList}
                      onChange={id => setVal('manufacturer_org', id)}
                      onItemsChange={setManufacturerList}
                      createAction={(n, d) => createManufacturer(n, d)}
                      error={fieldErrors.manufacturer_org}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectOrAddField
                      label="Supplier"
                      tip="Select the supplier of this instrument"
                      name="supplier_org"
                      entityLabel="Supplier"
                      value={vals.supplier_org}
                      items={supplierList}
                      onChange={id => setVal('supplier_org', id)}
                      onItemsChange={setSupplierList}
                      createAction={(n, d) => createSupplier(n, d)}
                      error={fieldErrors.supplier_org}
                    />
                    <Field label="Model" name="model" tip="The instrument's model number" placeholder="e.g. 1260 Infinity II"
                      error={fieldErrors.model} value={vals.model} onChange={v => setVal('model', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Serial No" name="serial_number" tip="Serial number that uniquely identifies the instrument" placeholder="e.g. SN-48213"
                      error={fieldErrors.serial_number} value={vals.serial_number} onChange={v => setVal('serial_number', v)} />
                    <Field label="Asset Number" name="asset_number" tip="The instrument's ID in the lab's asset register" placeholder="e.g. AST-00142"
                      error={fieldErrors.asset_number} value={vals.asset_number} onChange={v => setVal('asset_number', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Status</label>
                      <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>Operational status of this instrument</p>
                      <select name="status" value={vals.status} onChange={e => setVal('status', e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                        style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <Field label="Purchase Date" name="purchase_date" tip="Date the instrument was purchased" type="date"
                      error={fieldErrors.purchase_date} value={vals.purchase_date} onChange={v => setVal('purchase_date', v)} />
                  </div>
                  <TextAreaField
                    label="Description"
                    name="notes"
                    tip="Short description of the instrument"
                    placeholder="Instrument description…"
                    value={vals.notes}
                    onChange={v => setVal('notes', v)}
                  />
                </>
              )}

              {drawerTab === 'additional' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectOrAddField
                      label="Location"
                      tip="Location where the instrument is installed"
                      name="instrument_location"
                      entityLabel="Instrument Location"
                      value={vals.instrument_location}
                      items={locationList}
                      onChange={id => setVal('instrument_location', id)}
                      onItemsChange={setLocationList}
                      createAction={(n, d) => createInstrumentLocation(n, d)}
                      error={fieldErrors.instrument_location}
                    />
                    <Field label="Installation Date" name="installation_date" tip="The date the instrument was installed" type="date"
                      error={fieldErrors.installation_date} value={vals.installation_date} onChange={v => setVal('installation_date', v)} />
                  </div>
                  <MethodsSelectOrAdd
                    tip="Methods that are supported by this analytical instrument"
                    items={methodList}
                    selectedIds={vals.method_ids}
                    onToggle={toggleMethod}
                    onItemsChange={setMethodList}
                    createAction={createMethodQuick}
                    error={fieldErrors.method_ids}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Data Interface" name="data_interface" tip="Select an export interface for this instrument" placeholder="Export interface code"
                      error={fieldErrors.data_interface} value={vals.data_interface} onChange={v => setVal('data_interface', v)} />
                    <Field label="Import Data Interface(s)" name="import_data_interface" tip="Select an import interface for this instrument" placeholder="code1, code2"
                      error={fieldErrors.import_data_interface} value={vals.import_data_interface} onChange={v => setVal('import_data_interface', v)} />
                  </div>
                  <TextAreaField
                    label="Result files folders"
                    name="result_files_folder"
                    tip="Per interface: InterfaceCode|/folder — where the system looks for result files"
                    placeholder={"InterfaceCode|/path/to/folder"}
                    value={vals.result_files_folder}
                    onChange={v => setVal('result_files_folder', v)}
                    rows={2}
                  />
                  <TextAreaField
                    label="Data Interface Options"
                    name="data_interface_options"
                    tip="Pass arbitrary Key=Value parameters to export/import modules"
                    placeholder={"Key=Value"}
                    value={vals.data_interface_options}
                    onChange={v => setVal('data_interface_options', v)}
                    rows={2}
                  />
                  <label className="flex items-start gap-2 text-xs" style={{ color: '#374151' }}>
                    <input type="checkbox" name="dispose_until_next_calibration" value="true"
                      checked={vals.dispose_until_next_calibration}
                      onChange={e => setVal('dispose_until_next_calibration', e.target.checked)}
                      className="mt-0.5" />
                    <span>
                      <span className="font-medium">De-activate until next calibration test</span>
                      <span style={{ display: 'block', fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
                        If checked, the instrument is unavailable until the next valid calibration. Cleared automatically after calibration.
                      </span>
                    </span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <FilePickField
                      label="Photo"
                      tip="Photo of the instrument"
                      name="photo"
                      accept="image/*"
                    />
                    <FilePickField
                      label="Installation Certificate"
                      tip="Installation certificate upload"
                      name="installation_certificate"
                    />
                  </div>
                </>
              )}

              {drawerTab === 'procedures' && (
                <>
                  <TextAreaField
                    label="In-lab calibration procedure"
                    name="inlab_calibration_procedure"
                    tip="Instructions for in-lab regular calibration routines intended for analysts"
                    placeholder="Instructions for in-lab regular calibration routines"
                    value={vals.inlab_calibration_procedure}
                    onChange={v => setVal('inlab_calibration_procedure', v)}
                    rows={5}
                  />
                  <TextAreaField
                    label="Preventive maintenance procedure"
                    name="preventive_maintenance_procedure"
                    tip="Instructions for regular preventive and maintenance routines intended for analysts"
                    placeholder="Instructions for regular preventive and maintenance routines"
                    value={vals.preventive_maintenance_procedure}
                    onChange={v => setVal('preventive_maintenance_procedure', v)}
                    rows={5}
                  />
                  {isEdit && (
                    <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                      Cert/calibration/validation history and status transitions are on the instrument detail page.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="px-5 py-4 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#fff' }}>
              <button type="button" onClick={closeDrawer} disabled={pending}
                style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={pending} className="flex items-center gap-1.5"
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: isEdit ? '#2563EB' : '#0154FC', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}>
                <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
                {pending ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, width: 360 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Delete instrument?</h3>
            <p style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>
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

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="precision_manufacturing" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>
            {statusFilter === 'all' ? 'No instruments registered yet' : 'No instruments in this status'}
          </p>
          {statusFilter === 'all' && (
            <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
              <MI name="add" size={13} color="#fff" /> New Instrument
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '16%' }} /><col style={{ width: '11%' }} /><col style={{ width: '12%' }} /><col style={{ width: '10%' }} />
              <col style={{ width: '11%' }} /><col style={{ width: '12%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} /><col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Instrument ID', 'Manufacturer', 'Model', 'Location', 'Status', 'Usability', 'Next Calibration', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((i, idx) => {
                const colors = STATUS_COLORS[i.status] ?? STATUS_COLORS.active
                const uColors = USABILITY_COLORS[i.usability] ?? USABILITY_COLORS.valid
                return (
                  <tr key={i.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-xs font-medium">
                      <Link href={`/dashboard/instruments/${i.id}`} style={{ color: '#0154FC', fontWeight: 600 }}>{i.name}</Link>
                    </td>
                    <td className="px-3 py-2.5"><span className="font-mono text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>{i.instrument_id}</span></td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#374151' }}>{i.manufacturer_org_name || i.manufacturer || '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#374151' }}>{i.model || '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{i.instrument_location_name || i.location || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: colors.bg, color: colors.fg }}>
                        {STATUS_OPTIONS.find(s => s.value === i.status)?.label ?? i.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: uColors.bg, color: uColors.fg }}>
                        {i.usability === 'out_of_service' ? 'Out of service' : i.usability === 'expired' ? 'Expired' : 'Valid'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{i.next_calibration || '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(i)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                          <MI name="edit" size={14} color="#9CA3AF" />
                        </button>
                        <button onClick={() => setConfirmDelete(i)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                          <MI name="delete" size={14} color="#EF4444" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{filtered.length} instrument{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createInstrument, updateInstrument, deleteInstrument,
  type Instrument, type InstrumentFormState,
} from '@/app/actions/instruments'
import { type NamedItem, createInstrumentType } from '@/app/actions/instrument-workflows'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({ label, name, placeholder, required, error, value, onChange, type = 'text' }: {
  label: string; name: string; placeholder?: string; required?: boolean
  error?: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      <input name={name} type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
        style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }} />
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'maintenance', label: 'Under Maintenance' },
  { value: 'retired', label: 'Retired' },
]

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  active: { bg: '#ECFDF5', fg: '#059669' },
  inactive: { bg: '#F3F4F6', fg: '#6B7280' },
  maintenance: { bg: '#FFFBEB', fg: '#D97706' },
  retired: { bg: '#FEF2F2', fg: '#991B1B' },
}

type FV = {
  name: string; instrument_id: string; model: string
  manufacturer_org: string; supplier_org: string
  serial_number: string; instrument_type: string; instrument_location: string
  asset_number: string
  location: string; status: string; purchase_date: string
  installation_date: string
  data_interface: string; import_data_interface: string; result_files_folder: string
  dispose_until_next_calibration: boolean
  inlab_calibration_procedure: string; preventive_maintenance_procedure: string
  notes: string
}
const blank = (): FV => ({
  name: '', instrument_id: '', model: '',
  manufacturer_org: '', supplier_org: '',
  serial_number: '', instrument_type: '', instrument_location: '', asset_number: '',
  location: '', status: 'active', purchase_date: '', installation_date: '',
  data_interface: '', import_data_interface: '', result_files_folder: '',
  dispose_until_next_calibration: false,
  inlab_calibration_procedure: '', preventive_maintenance_procedure: '',
  notes: '',
})

export default function InstrumentsShell(
  { initialInstruments, types, locations, manufacturers, suppliers }:
  {
    initialInstruments: Instrument[]
    types: NamedItem[]
    locations: NamedItem[]
    manufacturers: NamedItem[]
    suppliers: NamedItem[]
  }
) {
  const router = useRouter()
  const [showDrawer, setShowDrawer] = useState(false)
  const [editing, setEditing] = useState<Instrument | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [vals, setVals] = useState<FV>(blank)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState<Instrument | null>(null)
  // Quick-create Instrument Type via a modal (Frappe-style "+ Add new") — the
  // dropdown option opens a popup, no navigation away from the instrument form.
  const [typeList, setTypeList] = useState<NamedItem[]>(types)
  const [addingType, setAddingType] = useState(false)
  const [newType, setNewType] = useState('')
  const [newTypeDesc, setNewTypeDesc] = useState('')
  const [addingTypeSaving, setAddingTypeSaving] = useState(false)

  function openAddType() { setNewType(''); setNewTypeDesc(''); setAddingType(true) }
  async function handleAddType() {
    if (!newType.trim()) return
    setAddingTypeSaving(true)
    const res = await createInstrumentType(newType, newTypeDesc)
    if (res.ok && res.item) {
      setTypeList(prev => [...prev, res.item!].sort((a, b) => a.name.localeCompare(b.name)))
      setVal('instrument_type', String(res.item.id))
      setAddingType(false); setNewType(''); setNewTypeDesc('')
    } else {
      showToast(false, res.message)
    }
    setAddingTypeSaving(false)
  }

  const isEdit = editing !== null

  function setVal(k: keyof FV, v: string | boolean) {
    setVals(prev => ({ ...prev, [k]: v }))
    if (typeof k === 'string' && fieldErrors[k]) setFieldErrors(prev => { const n = { ...prev }; delete n[k]; return n })
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
        showToast(true, result.message ?? (editing ? 'Instrument updated.' : 'Instrument created.'))
        router.refresh()
      } else if (result.errors) {
        const fe: Record<string, string> = {}
        for (const [k, msgs] of Object.entries(result.errors)) { if (msgs?.length) fe[k] = msgs[0] }
        setFieldErrors(fe)
      } else if (result.message) {
        showToast(false, result.message)
      }
      return result
    },
    {}
  )

  function openCreate() { setEditing(null); setVals(blank()); setFieldErrors({}); setShowDrawer(true) }
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
      dispose_until_next_calibration: Boolean(i.dispose_until_next_calibration),
      inlab_calibration_procedure: i.inlab_calibration_procedure ?? '',
      preventive_maintenance_procedure: i.preventive_maintenance_procedure ?? '',
      notes: i.notes,
    })
    setFieldErrors({})
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
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 460, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showDrawer ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>

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

          <form action={action} className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {isEdit && <input type="hidden" name="_editingId" value={editing!.id} />}
            <div className="flex-1 px-5 py-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" name="name" placeholder="e.g. HPLC System 1" required
                  error={fieldErrors.name} value={vals.name} onChange={v => setVal('name', v)} />
                <Field label="Instrument ID" name="instrument_id" placeholder="e.g. HPLC-001" required
                  error={fieldErrors.instrument_id} value={vals.instrument_id} onChange={v => setVal('instrument_id', v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Manufacturer</label>
                  <select name="manufacturer_org" value={vals.manufacturer_org} onChange={e => setVal('manufacturer_org', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                    <option value="">Select manufacturer…</option>
                    {manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <Field label="Model" name="model" placeholder="e.g. 1260 Infinity II"
                  error={fieldErrors.model} value={vals.model} onChange={v => setVal('model', v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Instrument Type</label>
                  <select name="instrument_type" value={vals.instrument_type}
                    onChange={e => { if (e.target.value === '__add__') openAddType(); else setVal('instrument_type', e.target.value) }}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                    <option value="">Select type…</option>
                    {typeList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    <option value="__add__">+ Add new type…</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Supplier</label>
                  <select name="supplier_org" value={vals.supplier_org} onChange={e => setVal('supplier_org', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                    <option value="">Select supplier…</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Serial Number" name="serial_number" placeholder="e.g. SN-48213"
                  error={fieldErrors.serial_number} value={vals.serial_number} onChange={v => setVal('serial_number', v)} />
                <Field label="Asset Number" name="asset_number" placeholder="e.g. AST-00142"
                  error={fieldErrors.asset_number} value={vals.asset_number} onChange={v => setVal('asset_number', v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Location</label>
                  <select name="instrument_location" value={vals.instrument_location} onChange={e => setVal('instrument_location', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                    <option value="">Select location…</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Status</label>
                  <select name="status" value={vals.status} onChange={e => setVal('status', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                    style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <Field label="Purchase Date" name="purchase_date" type="date"
                  error={fieldErrors.purchase_date} value={vals.purchase_date} onChange={v => setVal('purchase_date', v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Installation Date" name="installation_date" type="date"
                  error={fieldErrors.installation_date} value={vals.installation_date} onChange={v => setVal('installation_date', v)} />
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-xs" style={{ color: '#374151' }}>
                    <input type="checkbox" name="dispose_until_next_calibration" value="true"
                      checked={vals.dispose_until_next_calibration}
                      onChange={e => setVal('dispose_until_next_calibration', e.target.checked)} />
                    Deactivate until next calibration
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Export Data Interface" name="data_interface" placeholder="Interface code"
                  error={fieldErrors.data_interface} value={vals.data_interface} onChange={v => setVal('data_interface', v)} />
                <Field label="Import Data Interface(s)" name="import_data_interface" placeholder="code1, code2"
                  error={fieldErrors.import_data_interface} value={vals.import_data_interface} onChange={v => setVal('import_data_interface', v)} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Result files folders</label>
                <textarea name="result_files_folder" rows={2}
                  placeholder={"InterfaceCode|/path/to/folder"}
                  value={vals.result_files_folder}
                  onChange={e => setVal('result_files_folder', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none"
                  style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
                <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>One line per path: InterfaceCode|/folder</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>In-lab calibration procedure</label>
                <textarea name="inlab_calibration_procedure" rows={2} value={vals.inlab_calibration_procedure}
                  onChange={e => setVal('inlab_calibration_procedure', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none"
                  style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Preventive maintenance procedure</label>
                <textarea name="preventive_maintenance_procedure" rows={2} value={vals.preventive_maintenance_procedure}
                  onChange={e => setVal('preventive_maintenance_procedure', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none"
                  style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Photo</label>
                  <input name="photo" type="file" accept="image/*" className="w-full text-xs" style={{ fontSize: 12 }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Installation certificate</label>
                  <input name="installation_certificate" type="file" className="w-full text-xs" style={{ fontSize: 12 }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Notes</label>
                <textarea name="notes" rows={3} placeholder="Additional notes…" value={vals.notes}
                  onChange={e => setVal('notes', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none"
                  style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
              </div>
              {isEdit && (
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                  Cert/calibration/validation history is on the instrument detail page.
                </p>
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

      {/* ── Instrument Type: right slide-in to choose existing OR add new ── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 400, pointerEvents: addingType ? 'auto' : 'none' }}>
        <div onClick={() => setAddingType(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: addingType ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 380, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: addingType ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Instrument Type</h2>
            <button onClick={() => setAddingType(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', letterSpacing: '0.03em', marginBottom: 6 }}>CHOOSE EXISTING</p>
            <div className="mb-5" style={{ border: '1px solid #F3F4F6', borderRadius: 8, maxHeight: 200, overflowY: 'auto' }}>
              {typeList.length === 0 && <div style={{ fontSize: 12, color: '#9CA3AF', padding: 12 }}>No types yet. Add one below.</div>}
              {typeList.map(t => {
                const sel = vals.instrument_type === String(t.id)
                return (
                  <button key={t.id} type="button" onClick={() => { setVal('instrument_type', String(t.id)); setAddingType(false) }}
                    className="w-full text-left flex items-center justify-between hover:bg-gray-50"
                    style={{ fontSize: 12, padding: '9px 12px', borderBottom: '1px solid #F9FAFB', color: sel ? '#0154FC' : '#111827', fontWeight: sel ? 600 : 400 }}>
                    {t.name}{sel && <MI name="check" size={14} color="#0154FC" />}
                  </button>
                )
              })}
            </div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', letterSpacing: '0.03em', marginBottom: 6 }}>ADD NEW</p>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Name *</label>
            <input value={newType} onChange={e => setNewType(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddType() } }}
              placeholder="e.g. GC-MS" className="w-full px-3 py-2 rounded-lg mb-3" style={{ fontSize: 12, border: '1px solid #D1D5DB' }} />
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Description</label>
            <textarea value={newTypeDesc} onChange={e => setNewTypeDesc(e.target.value)} rows={2}
              placeholder="Optional" className="w-full px-3 py-2 rounded-lg" style={{ fontSize: 12, border: '1px solid #D1D5DB', resize: 'none' }} />
          </div>
          <div className="px-5 py-4 flex justify-end gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button type="button" onClick={() => setAddingType(false)}
              style={{ fontSize: 12, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', background: '#fff' }}>Cancel</button>
            <button type="button" disabled={addingTypeSaving || !newType.trim()} onClick={handleAddType}
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', opacity: addingTypeSaving || !newType.trim() ? 0.6 : 1 }}>
              {addingTypeSaving ? 'Creating…' : 'Create & Select'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Delete confirm ── */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, width: 360 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Delete instrument?</h3>
            <p style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>
              Delete &quot;{confirmDelete.name}&quot;? This cannot be undone. Calibration/maintenance history tied to it will remain but can no longer be linked to it.
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
      {initialInstruments.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="precision_manufacturing" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No instruments registered yet</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Instrument
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '18%' }} /><col style={{ width: '12%' }} /><col style={{ width: '13%' }} /><col style={{ width: '11%' }} />
              <col style={{ width: '13%' }} /><col style={{ width: '11%' }} /><col style={{ width: '11%' }} /><col style={{ width: '11%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Instrument ID', 'Manufacturer', 'Model', 'Location', 'Status', 'Next Calibration', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialInstruments.map((i, idx) => {
                const colors = STATUS_COLORS[i.status] ?? STATUS_COLORS.active
                return (
                  <tr key={i.id} style={{ borderBottom: idx < initialInstruments.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
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
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialInstruments.length} instrument{initialInstruments.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

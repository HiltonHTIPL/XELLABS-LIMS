'use client'
import { useMemo, useState, useActionState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  createInventoryItem, updateInventoryItem, toggleInventoryItemActive, deleteInventoryItem,
  type Reagent, type Standard, type Solvent, type InventoryItemKind, type InventoryFormState,
} from '@/app/actions/inventory'
import { ConfirmModal } from '@/app/dashboard/_components/ui'

type AnyItem = Reagent | Standard | Solvent

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({ label, name, placeholder, required, error, defaultValue, onClearError }: {
  label: string; name: string; placeholder?: string; required?: boolean
  error?: string; defaultValue?: string; onClearError?: () => void
}) {
  const base = 'w-full px-3 py-2 text-xs rounded-lg outline-none'
  const border = { border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      <input name={name} placeholder={placeholder} required={required} defaultValue={defaultValue} onChange={onClearError} className={base} style={border} />
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

const KIND_LABEL: Record<InventoryItemKind, string> = { reagents: 'Reagent', standards: 'Standard', solvents: 'Solvent' }
const KIND_ICON: Record<InventoryItemKind, string> = { reagents: 'science', standards: 'straighten', solvents: 'opacity' }

/** Kind-specific extra fields rendered below the shared fields. */
const EXTRA_FIELDS: Record<InventoryItemKind, { name: string; label: string; placeholder?: string }[]> = {
  reagents: [
    { name: 'grade', label: 'Grade', placeholder: 'e.g. ACS' },
    { name: 'concentration', label: 'Concentration', placeholder: 'e.g. 37%' },
    { name: 'hazard_class', label: 'Hazard Class', placeholder: 'e.g. Corrosive' },
  ],
  standards: [
    { name: 'certified_value', label: 'Certified Value' },
    { name: 'certified_uncertainty', label: 'Certified Uncertainty' },
    { name: 'reference_material', label: 'Reference Material' },
  ],
  solvents: [
    { name: 'grade', label: 'Grade', placeholder: 'e.g. HPLC' },
    { name: 'purity', label: 'Purity', placeholder: 'e.g. 99.9%' },
    { name: 'flash_point', label: 'Flash Point', placeholder: 'e.g. 12°C' },
  ],
}

function ItemModal({ kind, editing, onClose, onDone }: {
  kind: InventoryItemKind; editing: AnyItem | null; onClose: () => void; onDone: () => void
}) {
  const isEdit = editing !== null
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const createAction = async (prev: InventoryFormState, fd: FormData) => {
    const result = await createInventoryItem(kind, prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const editAction = async (prev: InventoryFormState, fd: FormData) => {
    const result = await updateInventoryItem(kind, editing!.id, prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const [state, action, pending] = useActionState(isEdit ? editAction : createAction, {})
  useEffect(() => {
    if (state.errors) {
      const fe: Record<string, string> = {}
      for (const [k, msgs] of Object.entries(state.errors)) { if (msgs?.length) fe[k] = msgs[0] }
      setFieldErrors(fe)
    }
  }, [state])

  const extra = EXTRA_FIELDS[kind]
  const editingAny = editing as Record<string, string> | null

  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1000 }}>
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEdit ? '#EFF6FF' : '#DBEAFE' }}>
              <MI name={isEdit ? 'edit' : 'add'} size={16} color={isEdit ? '#2563EB' : '#0154FC'} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                {isEdit ? `Edit — ${editing!.name}` : `New ${KIND_LABEL[kind]}`}
              </h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>{isEdit ? 'Update item details' : `Add a new ${KIND_LABEL[kind].toLowerCase()} to inventory`}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
        </div>
        <form action={action} className="px-5 py-4 flex flex-col gap-3">
          <Field label="Name" name="name" required error={fieldErrors.name} defaultValue={editing?.name}
            onClearError={() => setFieldErrors(p => { const n = { ...p }; delete n.name; return n })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="CAS Number" name="cas_number" defaultValue={editingAny?.cas_number} />
            <Field label="Manufacturer" name="manufacturer" defaultValue={editingAny?.manufacturer} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Catalog Number" name="catalog_number" defaultValue={editingAny?.catalog_number} />
            <Field label="Unit" name="unit" placeholder="e.g. pcs, mL, g" defaultValue={editingAny?.unit ?? 'pcs'} />
          </div>
          <Field label="Minimum Stock Level" name="min_stock_level" defaultValue={editingAny?.min_stock_level ?? '0'} />
          <div className="grid grid-cols-2 gap-3">
            {extra.map(f => (
              <Field key={f.name} label={f.label} name={f.name} placeholder={f.placeholder} defaultValue={editingAny?.[f.name]} />
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button type="button" onClick={onClose} disabled={pending}
              style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
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
  )
}

export default function InventoryItemsShell({ initialReagents, initialStandards, initialSolvents }: {
  initialReagents: Reagent[]; initialStandards: Standard[]; initialSolvents: Solvent[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<InventoryItemKind>('reagents')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AnyItem | null>(null)
  const [toDelete, setToDelete] = useState<AnyItem | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [busy, startTransition] = useTransition()

  const dataByKind: Record<InventoryItemKind, AnyItem[]> = {
    reagents: initialReagents, standards: initialStandards, solvents: initialSolvents,
  }
  const rows = dataByKind[tab]
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.catalog_number?.toLowerCase().includes(q) ||
      r.cas_number?.toLowerCase().includes(q) ||
      r.manufacturer?.toLowerCase().includes(q)
    )
  }, [rows, search])

  function openCreate() { setEditing(null); setShowModal(true) }
  function openEdit(item: AnyItem) { setEditing(item); setShowModal(true) }
  function closeModal() { setShowModal(false); setEditing(null) }
  function flashToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4000)
  }
  function handleDone() { flashToast(true, editing ? 'Item updated.' : 'Item created.'); router.refresh() }

  function toggle(item: AnyItem) {
    startTransition(async () => {
      const r = await toggleInventoryItemActive(tab, item.id, !item.is_active)
      flashToast(r.success, r.message)
      if (r.success) router.refresh()
    })
  }

  function confirmDelete() {
    if (!toDelete) return
    const item = toDelete
    startTransition(async () => {
      const r = await deleteInventoryItem(tab, item.id)
      flashToast(r.success, r.message)
      setToDelete(null)
      if (r.success) router.refresh()
    })
  }

  const extraCols: Record<InventoryItemKind, { key: string; label: string }[]> = {
    reagents: [{ key: 'grade', label: 'Grade' }, { key: 'hazard_class', label: 'Hazard Class' }],
    standards: [{ key: 'reference_material', label: 'Reference Material' }, { key: 'certified_value', label: 'Certified Value' }],
    solvents: [{ key: 'grade', label: 'Grade' }, { key: 'purity', label: 'Purity' }],
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Inventory Items</h1>
          <p className="mt-1" style={{ fontSize: 13, color: '#6B7280' }}>Manage reagents, standards, and solvents used in testing</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#2563EB', border: 'none', cursor: 'pointer' }}>
          <MI name="add" size={15} color="#fff" /> New {KIND_LABEL[tab]}
        </button>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: '#EEF0F6', width: 'fit-content' }}>
          {(['reagents', 'standards', 'solvents'] as InventoryItemKind[]).map(k => (
            <button key={k} onClick={() => setTab(k)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: tab === k ? '#fff' : 'transparent', color: tab === k ? '#14265E' : '#6B7280', border: 'none', cursor: 'pointer', boxShadow: tab === k ? '0 1px 2px rgba(16,24,40,0.08)' : 'none' }}>
              <MI name={KIND_ICON[k]} size={14} color={tab === k ? '#2563EB' : '#9CA3AF'} />
              {KIND_LABEL[k]}s
              <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700 }}>{dataByKind[k].length}</span>
            </button>
          ))}
        </div>
        <div className="relative" style={{ width: 260 }}>
          <span className="absolute" style={{ left: 8, top: 8 }}><MI name="search" size={15} color="#9CA3AF" /></span>
          <input
            value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, catalog #, CAS…"
            className="w-full pl-7 pr-3 py-2 text-xs rounded-lg outline-none"
            style={{ border: '1px solid #D1D5DB', color: '#111827' }}
          />
        </div>
      </div>

      {showModal && <ItemModal kind={tab} editing={editing} onClose={closeModal} onDone={handleDone} />}
      {toDelete && (
        <ConfirmModal
          title={`Delete "${toDelete.name}"?`}
          message="This cannot be undone. If lots reference this item, deletion will fail."
          confirmLabel="Delete" danger
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2', borderRadius: 14 }}>
          <MI name={KIND_ICON[tab]} size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No {KIND_LABEL[tab].toLowerCase()}s found</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New {KIND_LABEL[tab]}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Catalog #', extraCols[tab][0].label, extraCols[tab][1].label, 'Min Stock', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => {
                const rec = item as unknown as Record<string, string>
                return (
                  <tr key={item.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-xs font-medium" style={{ color: '#111827' }}>{item.name}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{item.catalog_number || '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{rec[extraCols[tab][0].key] || '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{rec[extraCols[tab][1].key] || '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{item.min_stock_level} {item.unit}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => toggle(item)} disabled={busy}
                        className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, color: item.is_active ? '#0154FC' : '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: item.is_active ? '#0154FC' : '#9CA3AF', display: 'inline-block' }} />
                        {item.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                          <MI name="edit" size={14} color="#9CA3AF" />
                        </button>
                        <button onClick={() => setToDelete(item)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
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
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{filtered.length} {KIND_LABEL[tab].toLowerCase()}{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

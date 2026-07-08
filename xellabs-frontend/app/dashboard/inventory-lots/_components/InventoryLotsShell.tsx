'use client'
import { useMemo, useState, useActionState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  createLot, updateLot, deleteLot,
  createTransaction, createExpiryAlert, acknowledgeExpiryAlert,
  type Lot, type InventoryTransaction, type ExpiryAlert,
  type Reagent, type Standard, type Solvent, type InventoryItemKind, type ContentTypeMap,
  type InventoryFormState,
} from '@/app/actions/inventory'
import { ConfirmModal } from '@/app/dashboard/_components/ui'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({ label, name, placeholder, required, error, defaultValue, type = 'text', onClearError }: {
  label: string; name: string; placeholder?: string; required?: boolean
  error?: string; defaultValue?: string; type?: string; onClearError?: () => void
}) {
  const base = 'w-full px-3 py-2 text-xs rounded-lg outline-none'
  const border = { border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      <input type={type} name={name} placeholder={placeholder} required={required} defaultValue={defaultValue} onChange={onClearError} className={base} style={border} />
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

function Select({ label, name, required, error, defaultValue, options, onChange }: {
  label: string; name: string; required?: boolean; error?: string; defaultValue?: string
  options: { value: string; label: string }[]; onChange?: (v: string) => void
}) {
  const border = { border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      <select name={name} required={required} defaultValue={defaultValue} onChange={e => onChange?.(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none bg-white" style={border}>
        <option value="">Select…</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

type ItemsByKind = Record<InventoryItemKind, (Reagent | Standard | Solvent)[]>

function LotModal({ editing, itemsByKind, contentTypes, onClose, onDone }: {
  editing: Lot | null; itemsByKind: ItemsByKind; contentTypes: ContentTypeMap
  onClose: () => void; onDone: () => void
}) {
  const isEdit = editing !== null
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const initialKind = useMemo<InventoryItemKind | ''>(() => {
    if (!editing) return ''
    const found = (Object.keys(contentTypes) as InventoryItemKind[]).find(k => contentTypes[k] === editing.content_type)
    return found ?? ''
  }, [editing, contentTypes])
  const [kind, setKind] = useState<InventoryItemKind | ''>(initialKind)

  const createAction = async (prev: InventoryFormState, fd: FormData) => {
    const result = await createLot(prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const editAction = async (prev: InventoryFormState, fd: FormData) => {
    const result = await updateLot(editing!.id, prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const [state, action, pending] = useActionState(isEdit ? editAction : createAction, {})
  useEffect(() => {
    if (state.errors) {
      const fe: Record<string, string> = {}
      for (const [k, msgs] of Object.entries(state.errors)) { if (msgs?.length) fe[k] = msgs[0] }
      // fieldErrors is independently cleared per-field via onClearError below, so it
      // can't be a plain derived value — it needs its own lifecycle synced from state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFieldErrors(fe)
    }
  }, [state])

  const kindOptions = (Object.keys(contentTypes) as InventoryItemKind[]).map(k => ({ value: k, label: k[0].toUpperCase() + k.slice(1) }))
  const itemOptions = kind ? itemsByKind[kind].map(i => ({ value: String(i.id), label: i.name })) : []

  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: 460, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEdit ? '#EFF6FF' : '#DBEAFE' }}>
              <MI name={isEdit ? 'edit' : 'add'} size={16} color={isEdit ? '#2563EB' : '#0154FC'} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEdit ? `Edit Lot — ${editing!.lot_number}` : 'New Lot'}</h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>{isEdit ? 'Update lot details' : 'Receive a new lot into inventory'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
        </div>
        <form action={action} className="px-5 py-4 flex flex-col gap-3">
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <Select label="Item Type" name="_kind" required options={kindOptions} onChange={v => setKind(v as InventoryItemKind)} />
              <Select label="Item" name="object_id" required error={fieldErrors.object_id} options={itemOptions} />
            </div>
          )}
          {!isEdit && <input type="hidden" name="content_type" value={kind ? contentTypes[kind] ?? '' : ''} />}
          {isEdit && (
            <div className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#F7F8FC', color: '#6B7280' }}>
              Item type/link cannot be changed after creation.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lot Number" name="lot_number" required error={fieldErrors.lot_number} defaultValue={editing?.lot_number}
              onClearError={() => setFieldErrors(p => { const n = { ...p }; delete n.lot_number; return n })} />
            <Field label="Quantity" name="quantity" required error={fieldErrors.quantity} defaultValue={editing?.quantity}
              onClearError={() => setFieldErrors(p => { const n = { ...p }; delete n.quantity; return n })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expiry Date" name="expiry_date" type="date" defaultValue={editing?.expiry_date ?? undefined} />
            <Field label="Storage Location ID" name="storage_location" placeholder="optional" defaultValue={editing?.storage_location ? String(editing.storage_location) : undefined} />
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

function TransactionModal({ lots, onClose, onDone }: { lots: Lot[]; onClose: () => void; onDone: () => void }) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const wrapped = async (prev: InventoryFormState, fd: FormData) => {
    const result = await createTransaction(prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const [state, action, pending] = useActionState(wrapped, {})
  useEffect(() => {
    if (state.errors) {
      const fe: Record<string, string> = {}
      for (const [k, msgs] of Object.entries(state.errors)) { if (msgs?.length) fe[k] = msgs[0] }
      // fieldErrors is independently cleared per-field via onClearError below, so it
      // can't be a plain derived value — it needs its own lifecycle synced from state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFieldErrors(fe)
    }
  }, [state])
  const lotOptions = lots.map(l => ({ value: String(l.id), label: l.lot_number }))
  const typeOptions = [
    { value: 'in', label: 'Received' }, { value: 'out', label: 'Consumed' },
    { value: 'adjust', label: 'Adjustment' }, { value: 'dispose', label: 'Disposed' },
  ]
  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Record Transaction</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
        </div>
        <form action={action} className="px-5 py-4 flex flex-col gap-3">
          <Select label="Lot" name="lot" required error={fieldErrors.lot} options={lotOptions} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" name="transaction_type" required error={fieldErrors.transaction_type} options={typeOptions} />
            <Field label="Quantity" name="quantity" required error={fieldErrors.quantity}
              onClearError={() => setFieldErrors(p => { const n = { ...p }; delete n.quantity; return n })} />
          </div>
          <Field label="Reference" name="reference" placeholder="optional" />
          <Field label="Notes" name="notes" placeholder="optional" />
          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button type="button" onClick={onClose} disabled={pending}
              style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className="flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}>
              <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
              {pending ? 'Recording…' : 'Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AlertModal({ lots, onClose, onDone }: { lots: Lot[]; onClose: () => void; onDone: () => void }) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const wrapped = async (prev: InventoryFormState, fd: FormData) => {
    const result = await createExpiryAlert(prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const [state, action, pending] = useActionState(wrapped, {})
  useEffect(() => {
    if (state.errors) {
      const fe: Record<string, string> = {}
      for (const [k, msgs] of Object.entries(state.errors)) { if (msgs?.length) fe[k] = msgs[0] }
      // fieldErrors is independently cleared per-field via onClearError below, so it
      // can't be a plain derived value — it needs its own lifecycle synced from state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFieldErrors(fe)
    }
  }, [state])
  const lotOptions = lots.map(l => ({ value: String(l.id), label: l.lot_number }))
  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>New Expiry Alert</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
        </div>
        <form action={action} className="px-5 py-4 flex flex-col gap-3">
          <Select label="Lot" name="lot" required error={fieldErrors.lot} options={lotOptions} />
          <Field label="Alert Date" name="alert_date" type="date" required error={fieldErrors.alert_date} />
          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button type="button" onClick={onClose} disabled={pending}
              style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className="flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}>
              <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
              {pending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

type Tab = 'lots' | 'transactions' | 'alerts'

export default function InventoryLotsShell({
  initialLots, initialTransactions, initialAlerts, reagents, standards, solvents, contentTypes,
}: {
  initialLots: Lot[]; initialTransactions: InventoryTransaction[]; initialAlerts: ExpiryAlert[]
  reagents: Reagent[]; standards: Standard[]; solvents: Solvent[]; contentTypes: ContentTypeMap
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('lots')
  const [showLotModal, setShowLotModal] = useState(false)
  const [showTxnModal, setShowTxnModal] = useState(false)
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [editingLot, setEditingLot] = useState<Lot | null>(null)
  const [toDelete, setToDelete] = useState<Lot | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [, startTransition] = useTransition()

  const itemsByKind: ItemsByKind = { reagents, standards, solvents }
  const itemLookup = useMemo(() => {
    const map = new Map<string, string>() // `${content_type}:${object_id}` -> name
    for (const kind of Object.keys(itemsByKind) as InventoryItemKind[]) {
      const ct = contentTypes[kind]
      if (ct == null) continue
      for (const item of itemsByKind[kind]) map.set(`${ct}:${item.id}`, item.name)
    }
    return map
  }, [itemsByKind, contentTypes])

  function flashToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function openCreateLot() { setEditingLot(null); setShowLotModal(true) }
  function openEditLot(lot: Lot) { setEditingLot(lot); setShowLotModal(true) }
  function handleLotDone() { flashToast(true, editingLot ? 'Lot updated.' : 'Lot created.'); router.refresh() }

  function confirmDeleteLot() {
    if (!toDelete) return
    const lot = toDelete
    startTransition(async () => {
      const r = await deleteLot(lot.id)
      flashToast(r.success, r.message)
      setToDelete(null)
      if (r.success) router.refresh()
    })
  }

  function acknowledge(alert: ExpiryAlert) {
    startTransition(async () => {
      const r = await acknowledgeExpiryAlert(alert.id)
      flashToast(r.success, r.message)
      if (r.success) router.refresh()
    })
  }

  const TX_LABEL: Record<string, string> = { in: 'Received', out: 'Consumed', adjust: 'Adjustment', dispose: 'Disposed' }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Lots &amp; Stock</h1>
          <p className="mt-1" style={{ fontSize: 13, color: '#6B7280' }}>Track received lots, stock movements, and expiry alerts</p>
        </div>
        {tab === 'lots' && (
          <button onClick={openCreateLot} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#2563EB', border: 'none', cursor: 'pointer' }}>
            <MI name="add" size={15} color="#fff" /> New Lot
          </button>
        )}
        {tab === 'transactions' && (
          <button onClick={() => setShowTxnModal(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#2563EB', border: 'none', cursor: 'pointer' }}>
            <MI name="add" size={15} color="#fff" /> Record Transaction
          </button>
        )}
        {tab === 'alerts' && (
          <button onClick={() => setShowAlertModal(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#2563EB', border: 'none', cursor: 'pointer' }}>
            <MI name="add" size={15} color="#fff" /> New Alert
          </button>
        )}
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      <div className="flex items-center gap-1 p-1 rounded-xl mb-3" style={{ backgroundColor: '#EEF0F6', width: 'fit-content' }}>
        {([
          { key: 'lots', label: 'Lots', icon: 'inventory_2', count: initialLots.length },
          { key: 'transactions', label: 'Transactions', icon: 'swap_horiz', count: initialTransactions.length },
          { key: 'alerts', label: 'Expiry Alerts', icon: 'notifications_active', count: initialAlerts.filter(a => !a.is_acknowledged).length },
        ] as { key: Tab; label: string; icon: string; count: number }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: tab === t.key ? '#fff' : 'transparent', color: tab === t.key ? '#14265E' : '#6B7280', border: 'none', cursor: 'pointer', boxShadow: tab === t.key ? '0 1px 2px rgba(16,24,40,0.08)' : 'none' }}>
            <MI name={t.icon} size={14} color={tab === t.key ? '#2563EB' : '#9CA3AF'} />
            {t.label}
            <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {showLotModal && (
        <LotModal editing={editingLot} itemsByKind={itemsByKind} contentTypes={contentTypes} onClose={() => setShowLotModal(false)} onDone={handleLotDone} />
      )}
      {showTxnModal && <TransactionModal lots={initialLots} onClose={() => setShowTxnModal(false)} onDone={() => { flashToast(true, 'Transaction recorded.'); router.refresh() }} />}
      {showAlertModal && <AlertModal lots={initialLots} onClose={() => setShowAlertModal(false)} onDone={() => { flashToast(true, 'Alert created.'); router.refresh() }} />}
      {toDelete && (
        <ConfirmModal
          title={`Delete lot "${toDelete.lot_number}"?`}
          message="This cannot be undone."
          confirmLabel="Delete" danger
          onConfirm={confirmDeleteLot}
          onCancel={() => setToDelete(null)}
        />
      )}

      {tab === 'lots' && (
        initialLots.length === 0 ? (
          <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2', borderRadius: 14 }}>
            <MI name="inventory_2" size={36} color="#D1D5DB" />
            <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No lots yet</p>
            <button onClick={openCreateLot} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
              <MI name="add" size={13} color="#fff" /> New Lot
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
            <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                  {['Item', 'Lot #', 'Quantity', 'Received', 'Expiry', 'Storage', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {initialLots.map((lot, i) => (
                  <tr key={lot.id} style={{ borderBottom: i < initialLots.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-xs font-medium" style={{ color: '#111827' }}>
                      {itemLookup.get(`${lot.content_type}:${lot.object_id}`) ?? `#${lot.object_id}`}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{lot.lot_number}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{lot.quantity}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{lot.received_date}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{lot.expiry_date || '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{lot.storage_location ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditLot(lot)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                          <MI name="edit" size={14} color="#9CA3AF" />
                        </button>
                        <button onClick={() => setToDelete(lot)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                          <MI name="delete" size={14} color="#EF4444" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'transactions' && (
        initialTransactions.length === 0 ? (
          <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2', borderRadius: 14 }}>
            <MI name="swap_horiz" size={36} color="#D1D5DB" />
            <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No transactions yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
            <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                  {['Lot', 'Type', 'Quantity', 'Reference', 'Notes', 'Date'].map(h => (
                    <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {initialTransactions.map((t, i) => {
                  const lot = initialLots.find(l => l.id === t.lot)
                  return (
                    <tr key={t.id} style={{ borderBottom: i < initialTransactions.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-xs font-medium" style={{ color: '#111827' }}>{lot?.lot_number ?? `#${t.lot}`}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{TX_LABEL[t.transaction_type] ?? t.transaction_type}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{t.quantity}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{t.reference || '—'}</td>
                      <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#6B7280' }}>{t.notes || '—'}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{new Date(t.created_at).toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'alerts' && (
        initialAlerts.length === 0 ? (
          <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2', borderRadius: 14 }}>
            <MI name="notifications_active" size={36} color="#D1D5DB" />
            <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No expiry alerts</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
            <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                  {['Lot', 'Alert Date', 'Status', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {initialAlerts.map((a, i) => {
                  const lot = initialLots.find(l => l.id === a.lot)
                  return (
                    <tr key={a.id} style={{ borderBottom: i < initialAlerts.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-xs font-medium" style={{ color: '#111827' }}>{lot?.lot_number ?? `#${a.lot}`}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{a.alert_date}</td>
                      <td className="px-3 py-2.5">
                        <span style={{ fontSize: 11, fontWeight: 600, color: a.is_acknowledged ? '#0154FC' : '#DC2626' }}>
                          {a.is_acknowledged ? 'Acknowledged' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {!a.is_acknowledged && (
                          <button onClick={() => acknowledge(a)} className="px-2 py-1 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: '#0154FC', border: 'none', cursor: 'pointer' }}>
                            Acknowledge
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

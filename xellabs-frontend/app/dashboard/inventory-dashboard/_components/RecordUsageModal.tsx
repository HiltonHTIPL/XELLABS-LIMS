'use client'
import { useActionState } from 'react'
import { recordConsumption } from '@/app/actions/inventory-dashboard'
import type { InventoryFormState } from '@/app/actions/inventory'
import { Btn, Field, MI, T, inputStyle, selectStyle } from '@/app/dashboard/_components/ui'

export type LotOption = { id: number; label: string }

const TYPE_OPTIONS = [
  { value: 'out', label: 'Consumed' },
  { value: 'dispose', label: 'Disposed' },
  { value: 'in', label: 'Received' },
  { value: 'adjust', label: 'Adjustment' },
]

export default function RecordUsageModal({
  lots, onClose, onDone,
}: { lots: LotOption[]; onClose: () => void; onDone: () => void }) {
  const wrapped = async (prev: InventoryFormState, fd: FormData) => {
    const result = await recordConsumption(prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const [state, action, pending] = useActionState(wrapped, {})

  const fieldErrors: Record<string, string> = {}
  if (state.errors) {
    for (const [k, msgs] of Object.entries(state.errors)) if (msgs?.length) fieldErrors[k] = msgs[0]
  }

  return (
    <div onClick={(e) => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1000 }}>
      <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', right: 0, bottom: 'var(--dashboard-footer-h)', width: 440, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
              <MI name="playlist_add_check" size={16} color={T.primary} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: T.heading }}>Record Usage</h2>
              <p style={{ fontSize: 10, color: T.faint }}>Log consumption of a lot against an analysis</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
            <MI name="close" size={16} color={T.faint} />
          </button>
        </div>
        <form action={action} className="px-5 py-4 flex flex-col gap-3">
          <Field label="Lot" required>
            <select name="lot" defaultValue="" className="w-full outline-none bg-white"
              style={{ ...selectStyle, borderColor: fieldErrors.lot ? T.danger : T.inputBorder }}>
              <option value="" disabled>Select lot…</option>
              {lots.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            {fieldErrors.lot && <p className="mt-0.5" style={{ fontSize: 11, color: T.danger }}>{fieldErrors.lot}</p>}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Movement" required>
              <select name="transaction_type" defaultValue="out" className="w-full outline-none bg-white" style={selectStyle}>
                {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Quantity" required>
              <input name="quantity" placeholder="e.g. 5" className="w-full outline-none bg-white"
                style={{ ...inputStyle, borderColor: fieldErrors.quantity ? T.danger : T.inputBorder }} />
              {fieldErrors.quantity && <p className="mt-0.5" style={{ fontSize: 11, color: T.danger }}>{fieldErrors.quantity}</p>}
            </Field>
          </div>

          <Field label="Linked analysis" hint="Worksheet or analysis request reference, e.g. WS-0001">
            <input name="reference" placeholder="e.g. WS-0001" className="w-full outline-none bg-white" style={inputStyle} />
          </Field>

          <Field label="Notes">
            <input name="notes" placeholder="Optional" className="w-full outline-none bg-white" style={inputStyle} />
          </Field>

          {state.message && !state.success && (
            <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 12 }}>
              {state.message}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
            <Btn type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Btn>
            <Btn type="submit" variant="primary" icon={pending ? 'hourglass_top' : 'check'} disabled={pending}>
              {pending ? 'Recording…' : 'Record Usage'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

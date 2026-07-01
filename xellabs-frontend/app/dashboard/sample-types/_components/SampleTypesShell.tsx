'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createSampleType, updateSampleType, type SampleTypeFormState } from '@/app/actions/sample-types'
import { type SenaiteSampleType } from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({
  label, name, placeholder, required, error, defaultValue, hint,
}: {
  label: string; name: string; placeholder?: string; required?: boolean
  error?: string; defaultValue?: string; hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
        {hint && <span className="ml-1 font-normal" style={{ color: '#9CA3AF' }}>{hint}</span>}
      </label>
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
        style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
      />
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function SampleTypeModal({
  editing,
  onClose,
  onDone,
}: {
  editing: SenaiteSampleType | null
  onClose: () => void
  onDone: () => void
}) {
  const isEdit = editing !== null

  const createAction = async (prev: SampleTypeFormState, fd: FormData) => {
    const result = await createSampleType(prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }

  const editAction = async (prev: SampleTypeFormState, fd: FormData) => {
    const result = await updateSampleType(editing!.uid, prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }

  const [state, action, pending] = useActionState(
    isEdit ? editAction : createAction,
    {}
  )

  return (
    <div
      onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEdit ? '#EFF6FF' : '#F0FDFA' }}>
              <MI name={isEdit ? 'edit' : 'add'} size={16} color={isEdit ? '#2563EB' : '#14B8A6'} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                {isEdit ? `Edit — ${editing!.title}` : 'New Sample Type'}
              </h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                {isEdit ? 'Update sample type details in SENAITE' : 'Create a new sample type in SENAITE'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <MI name="close" size={16} color="#9CA3AF" />
          </button>
        </div>

        {/* Error banner */}
        {state.message && !state.success && (
          <div className="mx-5 mt-4 px-3 py-2 rounded-lg flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <MI name="error_outline" size={14} color="#EF4444" />
            <span style={{ fontSize: 12, color: '#B91C1C' }}>{state.message}</span>
          </div>
        )}

        <form action={action} className="px-5 py-4 flex flex-col gap-3">
          <Field
            label="Sample Type Name"
            name="title"
            placeholder="e.g. Blood Plasma"
            required
            error={state.errors?.title?.[0]}
            defaultValue={editing?.title}
          />
          <Field
            label="Prefix"
            name="Prefix"
            placeholder="e.g. BP"
            required
            hint="(used in sample ID generation)"
            error={state.errors?.Prefix?.[0]}
            defaultValue={editing?.Prefix}
          />
          <Field
            label="Minimum Volume"
            name="MinimumVolume"
            placeholder="e.g. 5 mL"
            hint="(optional)"
            defaultValue={editing?.MinimumVolume}
          />

          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: isEdit ? '#2563EB' : '#14B8A6', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}
            >
              <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
              {pending ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main shell ────────────────────────────────────────────────────────────────
export default function SampleTypesShell({ initialSampleTypes }: { initialSampleTypes: SenaiteSampleType[] }) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<SenaiteSampleType | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  function openCreate() { setEditing(null); setShowModal(true) }
  function openEdit(st: SenaiteSampleType) { setEditing(st); setShowModal(true) }
  function closeModal() { setShowModal(false); setEditing(null) }
  function handleDone() {
    setToast({ ok: true, msg: editing ? `Sample type updated.` : `Sample type created.` })
    setTimeout(() => setToast(null), 4000)
    router.refresh()
  }

  return (
    <div style={{ padding: '12px 20px 0', backgroundColor: '#F5F6FA', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#111827' }}>Sample Types</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage sample types used across the laboratory</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#14B8A6' }}
        >
          <MI name="add" size={15} color="#fff" />
          New Sample Type
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{
            backgroundColor: toast.ok ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${toast.ok ? '#A7F3D0' : '#FECACA'}`,
            color: toast.ok ? '#065F46' : '#991B1B',
          }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#10B981' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <SampleTypeModal editing={editing} onClose={closeModal} onDone={handleDone} />
      )}

      {/* Table / empty state */}
      {initialSampleTypes.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E5E7EB' }}>
          <MI name="science" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No sample types yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create your first sample type to get started</p>
          <button
            onClick={openCreate}
            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ backgroundColor: '#14B8A6' }}
          >
            <MI name="add" size={13} color="#fff" />
            New Sample Type
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '35%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Prefix', 'Min. Volume', 'UID', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide"
                    style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialSampleTypes.map((st, i) => (
                <tr key={st.uid}
                  style={{ borderBottom: i < initialSampleTypes.length - 1 ? '1px solid #F9FAFB' : 'none' }}
                  className="hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: '#F0FDFA' }}>
                        <MI name="science" size={13} color="#14B8A6" />
                      </div>
                      <span className="text-xs font-medium" style={{ color: '#111827' }}>{st.title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>
                      {st.Prefix || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>
                    {st.MinimumVolume || '—'}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs truncate" style={{ color: '#9CA3AF' }}>
                    {st.uid}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => openEdit(st)}
                      className="p-1 rounded hover:bg-gray-100"
                      style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                      title="Edit"
                    >
                      <MI name="edit" size={14} color="#9CA3AF" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialSampleTypes.length} sample type{initialSampleTypes.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

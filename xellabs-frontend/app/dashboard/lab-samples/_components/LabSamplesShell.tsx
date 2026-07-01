'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createLabSample, updateLabSample, type LabSample, type LabSampleFormState } from '@/app/actions/lab-samples'
import { type DjangoClient } from '@/app/actions/clients'
import { type SenaiteSampleType } from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const STATUS_OPTIONS = [
  { value: 'registered',       label: 'Registered' },
  { value: 'received',         label: 'Received' },
  { value: 'in_progress',      label: 'In Progress' },
  { value: 'results_pending',  label: 'Results Pending' },
  { value: 'reviewed',         label: 'Reviewed' },
  { value: 'published',        label: 'Published' },
  { value: 'rejected',         label: 'Rejected' },
  { value: 'disposed',         label: 'Disposed' },
]

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  registered:      { bg: '#F3F4F6', color: '#374151' },
  received:        { bg: '#CCFBF1', color: '#0F766E' },
  in_progress:     { bg: '#DBEAFE', color: '#1E40AF' },
  results_pending: { bg: '#FEF3C7', color: '#92400E' },
  reviewed:        { bg: '#E0E7FF', color: '#3730A3' },
  published:       { bg: '#DCFCE7', color: '#166534' },
  rejected:        { bg: '#FEE2E2', color: '#991B1B' },
  disposed:        { bg: '#F3F4F6', color: '#6B7280' },
}

type Props = {
  initialSamples: LabSample[]
  clients: DjangoClient[]
  sampleTypes: SenaiteSampleType[]
}

function SampleModal({ editing, clients, sampleTypes, onClose, onDone }: {
  editing: LabSample | null; clients: DjangoClient[]; sampleTypes: SenaiteSampleType[]
  onClose: () => void; onDone: () => void
}) {
  const isEdit = editing !== null
  const createAction = async (prev: LabSampleFormState, fd: FormData) => {
    const result = await createLabSample(prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const editAction = async (prev: LabSampleFormState, fd: FormData) => {
    const result = await updateLabSample(editing!.id, prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const [state, action, pending] = useActionState(isEdit ? editAction : createAction, {})
  const inputStyle = (err?: string) => ({ border: `1px solid ${err ? '#EF4444' : '#D1D5DB'}`, color: '#111827' })
  const labelStyle = { color: '#374151' }

  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEdit ? '#EFF6FF' : '#F0FDFA' }}>
              <MI name={isEdit ? 'edit' : 'science'} size={16} color={isEdit ? '#2563EB' : '#14B8A6'} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEdit ? `Edit — ${editing!.sample_id}` : 'Register Sample'}</h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>{isEdit ? 'Update sample details' : 'Register a new laboratory sample'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
        </div>
        {state.message && !state.success && (
          <div className="mx-5 mt-4 px-3 py-2 rounded-lg flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <MI name="error_outline" size={14} color="#EF4444" />
            <span style={{ fontSize: 12, color: '#B91C1C' }}>{state.message}</span>
          </div>
        )}
        <form action={action} className="px-5 py-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>Sample ID <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(auto if blank)</span></label>
              <input name="sample_id" placeholder="e.g. BL-2026-001" defaultValue={editing?.sample_id} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle()} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>Status</label>
              <select name="status" defaultValue={editing?.status ?? 'registered'} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle()}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>Client <span style={{ color: '#EF4444' }}>*</span></label>
              <select name="client" required defaultValue={editing?.client ?? ''} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle(state.errors?.client?.[0])}>
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.client_id})</option>)}
              </select>
              {state.errors?.client && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.client[0]}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>Sample Type <span style={{ color: '#EF4444' }}>*</span></label>
              <select name="sample_type" required defaultValue={editing?.sample_type ?? ''} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle(state.errors?.sample_type?.[0])}>
                <option value="">Select sample type…</option>
                {sampleTypes.map(st => <option key={st.uid} value={st.uid}>{st.title}</option>)}
              </select>
              {state.errors?.sample_type && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.sample_type[0]}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>Collection Date</label>
              <input type="datetime-local" name="collection_date" defaultValue={editing?.collection_date?.slice(0,16) ?? ''} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle()} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>Received Date</label>
              <input type="datetime-local" name="received_date" defaultValue={editing?.received_date?.slice(0,16) ?? ''} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle()} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>Storage Location</label>
              <input name="storage_location" placeholder="e.g. Freezer A, Shelf 2" defaultValue={editing?.storage_location} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle()} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>Barcode</label>
              <input name="barcode" placeholder="e.g. BC-0001234" defaultValue={editing?.barcode} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle()} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button type="button" onClick={onClose} disabled={pending}
              style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className="flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: isEdit ? '#2563EB' : '#14B8A6', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}>
              <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
              {pending ? (isEdit ? 'Saving…' : 'Registering…') : isEdit ? 'Save Changes' : 'Register Sample'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LabSamplesShell({ initialSamples, clients, sampleTypes }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<LabSample | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  function openCreate() { setEditing(null); setShowModal(true) }
  function openEdit(s: LabSample) { setEditing(s); setShowModal(true) }
  function closeModal() { setShowModal(false); setEditing(null) }
  function handleDone() {
    setToast({ ok: true, msg: editing ? 'Sample updated.' : 'Sample registered.' })
    setTimeout(() => setToast(null), 4000)
    router.refresh()
  }

  return (
    <div style={{ padding: '12px 20px 0', backgroundColor: '#F5F6FA', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#111827' }}>Sample Registration</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Register and track laboratory samples</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#14B8A6' }}>
          <MI name="add" size={15} color="#fff" /> Register Sample
        </button>
      </div>
      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${toast.ok ? '#A7F3D0' : '#FECACA'}`, color: toast.ok ? '#065F46' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#10B981' : '#DC2626'} />
          {toast.msg}
        </div>
      )}
      {showModal && <SampleModal editing={editing} clients={clients} sampleTypes={sampleTypes} onClose={closeModal} onDone={handleDone} />}
      {initialSamples.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E5E7EB' }}>
          <MI name="science" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No samples registered yet</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#14B8A6' }}>
            <MI name="add" size={13} color="#fff" /> Register Sample
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '14%' }} /><col style={{ width: '18%' }} /><col style={{ width: '15%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} /><col style={{ width: '13%' }} /><col style={{ width: '8%' }} /><col style={{ width: '4%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Sample ID', 'Client', 'Sample Type', 'Collection', 'Received', 'Status', 'Barcode', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialSamples.map((s, i) => {
                const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.registered
                return (
                  <tr key={s.id} style={{ borderBottom: i < initialSamples.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: '#2563EB' }}>{s.sample_id}</td>
                    <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#374151' }}>{s.client_name || '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#374151' }}>{s.sample_type_name || '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{s.collection_date ? new Date(s.collection_date).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{s.received_date ? new Date(s.received_date).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: badge.bg, color: badge.color }}>
                        {STATUS_OPTIONS.find(o => o.value === s.status)?.label ?? s.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono truncate" style={{ color: '#9CA3AF' }}>{s.barcode || '—'}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => openEdit(s)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                        <MI name="edit" size={14} color="#9CA3AF" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialSamples.length} sample{initialSamples.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

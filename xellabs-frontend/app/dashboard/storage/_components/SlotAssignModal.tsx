'use client'
import { useState } from 'react'
import { assignSampleToSlot } from '@/app/actions/storage'
import type { StorageLocation } from '@/app/actions/storage'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export default function SlotAssignModal({
  slot,
  storagePath,
  onClose,
  onDone,
}: {
  slot: StorageLocation
  storagePath: string
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const [sampleId, setSampleId] = useState('')
  const [error, setError]       = useState('')
  const [pending, setPending]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const id = sampleId.trim()
    if (!id) { setError('Sample ID is required'); return }
    setPending(true)
    setError('')
    const result = await assignSampleToSlot(slot.id, id)
    setPending(false)
    if (result.success) {
      onDone(result.message)
      onClose()
    } else {
      setError(result.message)
    }
  }

  return (
    <div
      onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
        zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
              <MI name="science" size={16} color="#0154FC" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                Assign Sample to Slot {slot.slot_id}
              </h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>Enter the sample ID to log it into this storage slot</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <MI name="close" size={16} color="#9CA3AF" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
              Sample ID <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              value={sampleId}
              onChange={e => setSampleId(e.target.value)}
              placeholder="e.g. S-25-01987"
              autoFocus
              className="w-full px-3 py-2 text-xs rounded-lg outline-none"
              style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
            />
            {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
          </div>

          <div className="px-3 py-2.5 rounded-lg" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
            <div className="flex items-start gap-2 mb-1.5">
              <MI name="location_on" size={13} color="#6B7280" />
              <div>
                <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 2 }}>Storage Location</p>
                <p style={{ fontSize: 11, color: '#111827', fontWeight: 500, wordBreak: 'break-word' }}>{storagePath}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1.5" style={{ borderTop: '1px solid #E5E7EB' }}>
              <MI name="grid_on" size={12} color="#0154FC" />
              <span style={{ fontSize: 11, color: '#374151' }}>
                Slot <strong style={{ color: '#0154FC' }}>{slot.slot_id}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button
              type="button" onClick={onClose} disabled={pending}
              style={{
                fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8,
                border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit" disabled={pending}
              className="flex items-center gap-1.5"
              style={{
                fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8,
                backgroundColor: '#0154FC', color: '#fff', border: 'none',
                cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1,
              }}
            >
              <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
              {pending ? 'Assigning…' : 'Assign Sample'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

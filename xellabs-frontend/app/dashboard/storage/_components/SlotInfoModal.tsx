'use client'
import { useState } from 'react'
import { releaseSampleFromSlot } from '@/app/actions/storage'
import type { StorageLocation } from '@/app/actions/storage'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export default function SlotInfoModal({
  slot,
  storagePath,
  onClose,
  onReleased,
}: {
  slot: StorageLocation
  storagePath: string
  onClose: () => void
  onReleased: (msg: string) => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError]     = useState('')

  async function handleRelease() {
    setPending(true)
    setError('')
    const result = await releaseSampleFromSlot(slot.id)
    setPending(false)
    if (result.success) {
      onReleased(result.message)
      onClose()
    } else {
      setError(result.message)
    }
  }

  return (
    <div
      onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{
        position: 'fixed', top: 'var(--dashboard-header-h)', bottom: 'var(--dashboard-footer-h)', left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)',
        zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FEF2F2' }}>
              <MI name="grid_on" size={16} color="#EF4444" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Slot {slot.slot_id} — Occupied</h2>
              <p style={{ fontSize: 12, color: '#1F2937', fontWeight: 500 }}>This slot has a sample assigned</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <MI name="close" size={16} color="#374151" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {/* Sample info */}
          <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <p style={{ fontSize: 10, color: '#374151', marginBottom: 4 }}>Assigned Sample</p>
            {slot.assigned_sample_id ? (
              <div className="flex items-center gap-2">
                <MI name="science" size={16} color="#EF4444" />
                <span className="text-sm font-bold" style={{ color: '#111827' }}>{slot.assigned_sample_id}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <MI name="help_outline" size={15} color="#F59E0B" />
                <span className="text-xs" style={{ color: '#92400E' }}>
                  Sample ID not recorded — assigned before tracking was enabled.<br />
                  Release and re-assign to record the sample ID.
                </span>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="px-3 py-2.5 rounded-lg" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
            <div className="flex items-start gap-2 mb-1.5">
              <MI name="location_on" size={13} color="#374151" />
              <div>
                <p style={{ fontSize: 10, color: '#374151', marginBottom: 2 }}>Storage Location</p>
                <p style={{ fontSize: 11, color: '#111827', fontWeight: 500, wordBreak: 'break-word' }}>{storagePath}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1.5" style={{ borderTop: '1px solid #E5E7EB' }}>
              <MI name="grid_on" size={12} color="#EF4444" />
              <span style={{ fontSize: 11, color: '#374151' }}>
                Slot <strong style={{ color: '#EF4444' }}>{slot.slot_id}</strong>
              </span>
            </div>
          </div>

          {error && <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button
              type="button" onClick={onClose} disabled={pending}
              style={{
                fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8,
                border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer',
              }}
            >
              Close
            </button>
            <button
              onClick={handleRelease} disabled={pending}
              className="flex items-center gap-1.5"
              style={{
                fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8,
                backgroundColor: '#DC2626', color: '#fff', border: 'none',
                cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1,
              }}
            >
              <MI name={pending ? 'hourglass_top' : 'link_off'} size={13} color="#fff" />
              {pending ? 'Releasing…' : 'Release Slot'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState, useMemo } from 'react'
import type { StorageLocation } from '@/app/actions/storage'
import { regenerateBoxSlots } from '@/app/actions/storage'
import SlotAssignModal from './SlotAssignModal'
import SlotInfoModal from './SlotInfoModal'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function buildStoragePath(location: StorageLocation, all: StorageLocation[]): string {
  const map = new Map(all.map(l => [l.id, l]))
  const parts: string[] = [location.name]
  let current = location
  while (current.parent !== null) {
    const parent = map.get(current.parent)
    if (!parent) break
    parts.unshift(parent.name)
    current = parent
  }
  return parts.join(' / ')
}

export default function SlotGrid({
  box,
  allLocations,
  selectedSlotId,
  onAssigned,
  onSlotClick,
  onSlotSelect,
}: {
  box: StorageLocation
  allLocations: StorageLocation[]
  selectedSlotId?: number | null
  onAssigned: (msg: string) => void
  onSlotClick?: (slot: StorageLocation) => void
  onSlotSelect?: (id: number | null) => void
}) {
  const [assigningSlot, setAssigningSlot] = useState<StorageLocation | null>(null)
  const [inspectingSlot, setInspectingSlot] = useState<StorageLocation | null>(null)
  const [optimisticOccupied, setOptimisticOccupied] = useState<Set<number>>(new Set())
  const [optimisticFree, setOptimisticFree] = useState<Set<number>>(new Set())
  const [fixingSlots, setFixingSlots] = useState(false)

  const slots = useMemo(() =>
    allLocations
      .filter(l => l.parent === box.id && l.location_type === 'box_location')
      .sort((a, b) => a.slot_id.localeCompare(b.slot_id, undefined, { numeric: true })),
    [allLocations, box.id]
  )

  const rows = box.rows ?? 1
  const cols = box.columns ?? 1
  const totalSlots   = rows * cols
  const usedSlots    = slots.filter(s =>
    (s.is_occupied || optimisticOccupied.has(s.id)) && !optimisticFree.has(s.id)
  ).length
  const missingSlots = totalSlots - slots.length

  if (slots.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <MI name="grid_view" size={32} color="#D1D5DB" />
        <p style={{ marginTop: 8, fontSize: 12, color: '#9CA3AF' }}>No slots found for this box</p>
        <p style={{ fontSize: 11, color: '#9CA3AF' }}>Slots are auto-generated when a box is created</p>
      </div>
    )
  }

  const slotMap = new Map(slots.map(s => [s.slot_id, s]))
  const CELL = cols > 12 ? 28 : cols > 8 ? 32 : 38
  const LABEL_W = 22
  const GAP = 4

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: 11 }}>
          <MI name="check_circle" size={12} color="#10B981" />
          <strong style={{ color: '#065F46' }}>{totalSlots - usedSlots}</strong>
          <span style={{ color: '#6B7280' }}>empty</span>
        </div>
        {usedSlots > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, backgroundColor: '#FEF2F2', border: '1px solid #FECACA', fontSize: 11 }}>
            <MI name="cancel" size={12} color="#EF4444" />
            <strong style={{ color: '#991B1B' }}>{usedSlots}</strong>
            <span style={{ color: '#6B7280' }}>occupied</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB', fontSize: 11 }}>
          <MI name="grid_view" size={12} color="#6B7280" />
          <strong style={{ color: '#374151' }}>{totalSlots}</strong>
          <span style={{ color: '#6B7280' }}>total</span>
        </div>
        {missingSlots > 0 && (
          <button
            disabled={fixingSlots}
            onClick={async () => {
              setFixingSlots(true)
              const result = await regenerateBoxSlots(box.id)
              setFixingSlots(false)
              onAssigned(result.message)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', color: '#92400E', cursor: fixingSlots ? 'not-allowed' : 'pointer', fontSize: 11, opacity: fixingSlots ? 0.7 : 1 }}
          >
            <MI name={fixingSlots ? 'hourglass_top' : 'build'} size={12} color="#D97706" />
            {fixingSlots ? 'Fixing…' : `Fix ${missingSlots} missing`}
          </button>
        )}
      </div>

      {/* Grid */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `${LABEL_W}px repeat(${cols}, ${CELL}px)`,
          gap: GAP,
          width: 'fit-content',
        }}>
          <div />
          {Array.from({ length: cols }, (_, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, color: '#9CA3AF', paddingBottom: 2, width: CELL }}>
              {String(i + 1).padStart(2, '0')}
            </div>
          ))}

          {Array.from({ length: rows }, (_, r) => {
            const rowLetter = String.fromCharCode(65 + r)
            return [
              <div key={`label-${r}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#9CA3AF', width: LABEL_W, height: CELL }}>
                {rowLetter}
              </div>,
              ...Array.from({ length: cols }, (_, c) => {
                const slotId   = `${rowLetter}${c + 1}`
                const slot     = slotMap.get(slotId)
                const occupied = ((slot?.is_occupied ?? false) || (slot ? optimisticOccupied.has(slot.id) : false))
                               && !(slot ? optimisticFree.has(slot.id) : false)
                const missing  = !slot
                const isSelected = slot?.id === selectedSlotId

                let bg = '#FAFAFA'
                let border = '1px solid #E5E7EB'

                if (missing)      { bg = '#F9FAFB'; border = '1px dashed #E5E7EB' }
                else if (isSelected) { bg = '#EFF6FF'; border = '2px solid #0154FC' }
                else if (occupied)   { bg = '#FEF9F9'; border = '1px solid #FECACA' }

                return (
                  <button
                    key={slotId}
                    onClick={() => {
                      if (missing) return
                      const newSelected = slot!.id === selectedSlotId ? null : slot!.id
                      onSlotSelect?.(newSelected)
                      onSlotClick?.(slot!)
                      if (!onSlotClick) {
                        if (occupied) setInspectingSlot(slot!)
                        else setAssigningSlot(slot!)
                      }
                    }}
                    disabled={missing}
                    title={occupied ? `${slotId} — ${slot?.assigned_sample_id ?? 'Occupied'}` : missing ? `${slotId} — Not registered` : `${slotId} — Empty`}
                    style={{
                      width: CELL, height: CELL, borderRadius: 5,
                      border, backgroundColor: bg,
                      cursor: missing ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    {occupied && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#9CA3AF' }} />}
                    {isSelected && !occupied && <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#0154FC', opacity: 0.6 }} />}
                  </button>
                )
              }),
            ]
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        {[
          { bg: '#FAFAFA',  border: '1px solid #E5E7EB',  label: 'Empty' },
          { bg: '#FEF9F9',  border: '1px solid #FECACA',  label: 'Occupied', dot: '#9CA3AF' },
          { bg: '#EFF6FF',  border: '2px solid #0154FC',  label: 'Selected' },
          { bg: '#FFFBEB',  border: '1px solid #FCD34D',  label: 'Warning' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6B7280' }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: item.bg, border: item.border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {item.dot && <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: item.dot }} />}
            </div>
            {item.label}
          </div>
        ))}
      </div>

      {assigningSlot && (
        <SlotAssignModal
          slot={assigningSlot}
          storagePath={buildStoragePath(assigningSlot, allLocations)}
          onClose={() => setAssigningSlot(null)}
          onDone={msg => {
            setOptimisticOccupied(prev => new Set(prev).add(assigningSlot.id))
            onAssigned(msg)
            setAssigningSlot(null)
          }}
        />
      )}
      {inspectingSlot && (
        <SlotInfoModal
          slot={inspectingSlot}
          storagePath={buildStoragePath(inspectingSlot, allLocations)}
          onClose={() => setInspectingSlot(null)}
          onReleased={msg => {
            setOptimisticFree(prev => new Set(prev).add(inspectingSlot.id))
            onAssigned(msg)
            setInspectingSlot(null)
          }}
        />
      )}
    </div>
  )
}

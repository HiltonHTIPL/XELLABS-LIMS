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
  onAssigned,
}: {
  box: StorageLocation
  allLocations: StorageLocation[]
  onAssigned: (msg: string) => void
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
  const freeSlots    = totalSlots - usedSlots
  const missingSlots = totalSlots - slots.length

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <MI name="grid_view" size={32} color="#D1D5DB" />
        <p className="mt-2 text-sm" style={{ color: '#9CA3AF' }}>No slots found for this box</p>
        <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Slots are auto-generated when a box is created</p>
      </div>
    )
  }
  const slotMap = new Map(slots.map(s => [s.slot_id, s]))

  // Cell size: compact enough to show a 10×10 grid comfortably
  const CELL = 28
  const LABEL_W = 22
  const GAP = 3

  return (
    <div>
      {/* Stats */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs"
          style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <MI name="check_circle" size={12} color="#10B981" />
          <span style={{ color: '#065F46', fontWeight: 600 }}>{freeSlots}</span>
          <span style={{ color: '#6B7280' }}>free</span>
        </div>
        {usedSlots > 0 && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs"
            style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <MI name="cancel" size={12} color="#EF4444" />
            <span style={{ color: '#991B1B', fontWeight: 600 }}>{usedSlots}</span>
            <span style={{ color: '#6B7280' }}>occupied</span>
          </div>
        )}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs"
          style={{ backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB' }}>
          <MI name="grid_view" size={12} color="#6B7280" />
          <span style={{ color: '#374151', fontWeight: 600 }}>{totalSlots}</span>
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
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs"
            style={{
              backgroundColor: '#FFFBEB', border: '1px solid #FCD34D',
              color: '#92400E', cursor: fixingSlots ? 'not-allowed' : 'pointer',
              opacity: fixingSlots ? 0.7 : 1,
            }}
          >
            <MI name={fixingSlots ? 'hourglass_top' : 'build'} size={12} color="#D97706" />
            {fixingSlots ? 'Fixing…' : `Fix ${missingSlots} missing slot${missingSlots !== 1 ? 's' : ''}`}
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
          {/* Top-left corner */}
          <div />
          {/* Column headers */}
          {Array.from({ length: cols }, (_, i) => (
            <div key={i} style={{
              textAlign: 'center', fontSize: 9, fontWeight: 600,
              color: '#9CA3AF', paddingBottom: 2, width: CELL,
            }}>
              {i + 1}
            </div>
          ))}

          {/* Rows */}
          {Array.from({ length: rows }, (_, r) => {
            const rowLetter = String.fromCharCode(65 + r)
            return [
              <div key={`label-${r}`} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 600, color: '#9CA3AF', width: LABEL_W, height: CELL,
              }}>
                {rowLetter}
              </div>,
              ...Array.from({ length: cols }, (_, c) => {
                const slotId   = `${rowLetter}${c + 1}`
                const slot     = slotMap.get(slotId)
                const occupied = ((slot?.is_occupied ?? false) || (slot ? optimisticOccupied.has(slot.id) : false))
                               && !(slot ? optimisticFree.has(slot.id) : false)

                const missing = !slot
                return (
                  <button
                    key={slotId}
                    onClick={() => {
                      if (missing) return
                      if (occupied) setInspectingSlot(slot!)
                      else setAssigningSlot(slot!)
                    }}
                    disabled={missing}
                    title={
                      occupied ? `${slotId} — Occupied (click to view)`
                      : missing ? `${slotId} — Not registered (click Fix to repair)`
                      : `${slotId} — Click to assign`
                    }
                    style={{
                      width: CELL, height: CELL, borderRadius: 4,
                      border: `1px solid ${occupied ? '#FECACA' : missing ? '#E5E7EB' : '#BBF7D0'}`,
                      backgroundColor: occupied ? '#FEF2F2' : missing ? '#F9FAFB' : '#F0FDF4',
                      color: occupied ? '#EF4444' : missing ? '#D1D5DB' : '#10B981',
                      fontSize: 8, fontWeight: 700,
                      cursor: missing ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    {slotId}
                  </button>
                )
              }),
            ]
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }} />
          Free
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }} />
          Occupied
        </div>
        {missingSlots > 0 && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }} />
            Not registered
          </div>
        )}
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

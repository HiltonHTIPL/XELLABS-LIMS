'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
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

// A1/B10-style slot ids encode row (letter) + column (number) — used to compute
// rectangular ranges for shift-click and click-drag multi-select.
function slotRowCol(slotId: string): { row: number; col: number } {
  return { row: slotId.charCodeAt(0) - 65, col: parseInt(slotId.slice(1), 10) - 1 }
}

export default function SlotGrid({
  box,
  allLocations,
  selectedSlotId,
  onAssigned,
  onSlotClick,
  onSlotSelect,
  multiSelectEnabled,
  selectedSlotIds,
  onMultiSelectChange,
}: {
  box: StorageLocation
  allLocations: StorageLocation[]
  selectedSlotId?: number | null
  onAssigned: (msg: string) => void
  onSlotClick?: (slot: StorageLocation) => void
  onSlotSelect?: (id: number | null) => void
  multiSelectEnabled?: boolean
  selectedSlotIds?: Set<number>
  onMultiSelectChange?: (ids: Set<number>) => void
}) {
  const [assigningSlot, setAssigningSlot] = useState<StorageLocation | null>(null)
  const [inspectingSlot, setInspectingSlot] = useState<StorageLocation | null>(null)
  const [optimisticOccupied, setOptimisticOccupied] = useState<Set<number>>(new Set())
  const [optimisticFree, setOptimisticFree] = useState<Set<number>>(new Set())
  const [fixingSlots, setFixingSlots] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragAnchorRef = useRef<StorageLocation | null>(null)
  const lastClickedRef = useRef<StorageLocation | null>(null)

  useEffect(() => {
    if (!isDragging) return
    const stop = () => setIsDragging(false)
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [isDragging])

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
        <p style={{ marginTop: 8, fontSize: 12, color: '#374151' }}>No slots found for this box</p>
        <p style={{ fontSize: 11, color: '#374151' }}>Slots are auto-generated when a box is created</p>
      </div>
    )
  }

  const slotMap = new Map(slots.map(s => [s.slot_id, s]))
  const CELL = cols > 12 ? 28 : cols > 8 ? 32 : 38
  const LABEL_W = 22
  const GAP = 4

  // Rectangle between two corner slots, restricted to selectable (empty, registered) cells.
  function rectSelectionIds(a: StorageLocation, b: StorageLocation): Set<number> {
    const ra = slotRowCol(a.slot_id), rb = slotRowCol(b.slot_id)
    const rMin = Math.min(ra.row, rb.row), rMax = Math.max(ra.row, rb.row)
    const cMin = Math.min(ra.col, rb.col), cMax = Math.max(ra.col, rb.col)
    const ids = new Set<number>()
    for (const s of slots) {
      const { row, col } = slotRowCol(s.slot_id)
      if (row >= rMin && row <= rMax && col >= cMin && col <= cMax && !s.is_occupied) ids.add(s.id)
    }
    return ids
  }

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: 11 }}>
          <MI name="check_circle" size={12} color="#10B981" />
          <strong style={{ color: '#065F46' }}>{totalSlots - usedSlots}</strong>
          <span style={{ color: '#374151' }}>empty</span>
        </div>
        {usedSlots > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, backgroundColor: '#FEF2F2', border: '1px solid #FECACA', fontSize: 11 }}>
            <MI name="cancel" size={12} color="#EF4444" />
            <strong style={{ color: '#991B1B' }}>{usedSlots}</strong>
            <span style={{ color: '#374151' }}>occupied</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB', fontSize: 11 }}>
          <MI name="grid_view" size={12} color="#374151" />
          <strong style={{ color: '#374151' }}>{totalSlots}</strong>
          <span style={{ color: '#374151' }}>total</span>
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
        {multiSelectEnabled && (
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={() => setShowShortcuts(v => !v)}
              onBlur={() => setShowShortcuts(false)}
              title="Multi-select shortcuts"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              ?
            </button>
            {showShortcuts && (
              <div style={{ position: 'absolute', right: 0, top: 28, zIndex: 20, width: 240, background: '#111827', color: '#F9FAFB', borderRadius: 8, padding: '10px 12px', fontSize: 11, lineHeight: 1.7, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                <strong style={{ display: 'block', marginBottom: 4 }}>Multi-select shortcuts</strong>
                <div><strong>Click</strong> — select one slot</div>
                <div><strong>Ctrl/⌘ + Click</strong> — add or remove a slot</div>
                <div><strong>Shift + Click</strong> — select a range</div>
                <div><strong>Click + drag</strong> — paint-select a range</div>
                <div><strong>Esc</strong> — clear selection</div>
              </div>
            )}
          </div>
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
            <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, color: '#374151', paddingBottom: 2, width: CELL }}>
              {String(i + 1).padStart(2, '0')}
            </div>
          ))}

          {Array.from({ length: rows }, (_, r) => {
            const rowLetter = String.fromCharCode(65 + r)
            return [
              <div key={`label-${r}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#374151', width: LABEL_W, height: CELL }}>
                {rowLetter}
              </div>,
              ...Array.from({ length: cols }, (_, c) => {
                const slotId   = `${rowLetter}${c + 1}`
                const slot     = slotMap.get(slotId)
                const occupied = ((slot?.is_occupied ?? false) || (slot ? optimisticOccupied.has(slot.id) : false))
                               && !(slot ? optimisticFree.has(slot.id) : false)
                const missing  = !slot
                const isMultiSelected = multiSelectEnabled && !!slot && !!selectedSlotIds?.has(slot.id)
                const isSelected = slot?.id === selectedSlotId || isMultiSelected

                let bg = '#FAFAFA'
                let border = '1px solid #E5E7EB'

                if (missing)      { bg = '#F9FAFB'; border = '1px dashed #E5E7EB' }
                else if (isSelected) { bg = '#EFF6FF'; border = '2px solid #0154FC' }
                else if (occupied)   { bg = '#FEF9F9'; border = '1px solid #FECACA' }

                return (
                  <button
                    key={slotId}
                    onMouseDown={e => {
                      if (missing || !multiSelectEnabled || occupied) return
                      e.preventDefault()
                      if (e.shiftKey && lastClickedRef.current) {
                        onMultiSelectChange?.(rectSelectionIds(lastClickedRef.current, slot!))
                        return
                      }
                      if (e.ctrlKey || e.metaKey) {
                        const next = new Set(selectedSlotIds)
                        if (next.has(slot!.id)) next.delete(slot!.id)
                        else next.add(slot!.id)
                        onMultiSelectChange?.(next)
                        lastClickedRef.current = slot!
                        return
                      }
                      lastClickedRef.current = slot!
                      dragAnchorRef.current = slot!
                      setIsDragging(true)
                      onMultiSelectChange?.(new Set([slot!.id]))
                    }}
                    onMouseEnter={() => {
                      if (!multiSelectEnabled || !isDragging || missing || !dragAnchorRef.current) return
                      onMultiSelectChange?.(rectSelectionIds(dragAnchorRef.current, slot!))
                    }}
                    onClick={() => {
                      // Multi-select only governs empty slots — an occupied slot always
                      // falls through to the normal single-select/inspect behavior below,
                      // regardless of mode, so clicking a stored sample still shows its info.
                      if (missing || (multiSelectEnabled && !occupied)) return
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
                    {occupied && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#374151' }} />}
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
          { bg: '#FEF9F9',  border: '1px solid #FECACA',  label: 'Occupied', dot: '#374151' },
          { bg: '#EFF6FF',  border: '2px solid #0154FC',  label: 'Selected' },
          { bg: '#FFFBEB',  border: '1px solid #FCD34D',  label: 'Warning' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#374151' }}>
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

'use client'
import { useState, useCallback, useMemo } from 'react'
import {
  deleteStorageLocation, getStorageLocations, lookupChainOfCustody, assignSampleToSlot,
  type StorageLocation, type ChainOfCustodyResult,
} from '@/app/actions/storage'
import StorageTree from './StorageTree'
import SlotGrid from './SlotGrid'
import StorageModal from './StorageModal'
import SampleInfoPanel from './SampleInfoPanel'
import SlotAssignModal from './SlotAssignModal'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const TYPE_ICONS: Record<string, string> = {
  room: 'meeting_room', fridge: 'thermostat', freezer: 'ac_unit',
  cabinet: 'inventory_2', shelf: 'view_agenda', box: 'grid_view',
}

export default function StorageShell({ initialLocations }: { initialLocations: StorageLocation[] }) {
  const [locations, setLocations]           = useState<StorageLocation[]>(initialLocations)
  const [selectedId, setSelectedId]         = useState<number | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null)
  const [modal, setModal]                   = useState<{ editing: StorageLocation | null; defaultParentId?: number | null } | null>(null)
  const [toast, setToast]                   = useState<{ ok: boolean; msg: string } | null>(null)
  const [barcodeInput, setBarcodeInput]     = useState('')
  const [mode, setMode]                     = useState<'store' | 'move' | 'retrieve'>('store')
  const [scannedResult, setScannedResult]   = useState<ChainOfCustodyResult | null>(null)
  const [scanLoading, setScanLoading]       = useState(false)
  const [assigningSlot, setAssigningSlot]   = useState<StorageLocation | null>(null)

  const selected    = locations.find(l => l.id === selectedId) ?? null
  const selectedBox = selected?.location_type === 'box' ? selected : null

  const breadcrumb = useMemo(() => {
    if (!selected) return []
    const map = new Map(locations.map(l => [l.id, l]))
    const parts: string[] = [selected.name]
    let cur: StorageLocation = selected
    while (cur.parent !== null) {
      const p = map.get(cur.parent)
      if (!p) break
      parts.unshift(p.name)
      cur = p
    }
    return parts
  }, [selected, locations])

  const boxSlots      = useMemo(() =>
    locations.filter(l => l.parent === selectedBox?.id && l.location_type === 'box_location'),
    [locations, selectedBox?.id]
  )
  const totalSlots    = (selectedBox?.rows ?? 0) * (selectedBox?.columns ?? 0)
  const occupiedSlots = boxSlots.filter(s => s.is_occupied).length
  const capacity      = selectedBox
    ? { total: totalSlots, occupied: occupiedSlots, free: totalSlots - occupiedSlots }
    : null

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const refreshLocations = useCallback(async () => {
    const fresh = await getStorageLocations()
    setLocations(fresh)
  }, [])

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    const val = barcodeInput.trim()
    if (!val) return
    setScanLoading(true)
    const res = await lookupChainOfCustody(val)
    setScanLoading(false)
    if (res.success && res.data) {
      setScannedResult(res.data)
      setBarcodeInput('')
      // Navigate to the box holding this sample
      const matchSlot = locations.find(l =>
        l.location_type === 'box_location' && l.assigned_sample_id === res.data!.sample_id
      )
      if (matchSlot?.parent) setSelectedId(matchSlot.parent)
    } else {
      showToast(false, res.message ?? 'Sample not found')
      setScannedResult(null)
    }
  }

  async function handleSlotClick(slot: StorageLocation) {
    if (slot.is_occupied && slot.assigned_sample_id) {
      const res = await lookupChainOfCustody(slot.assigned_sample_id)
      if (res.success && res.data) setScannedResult(res.data)
    }
  }

  async function handleStoreSample() {
    const targetSlot = locations.find(l => l.id === selectedSlotId)
    if (!targetSlot || targetSlot.is_occupied) return
    if (scannedResult?.sample?.sample_id) {
      const res = await assignSampleToSlot(targetSlot.id, scannedResult.sample.sample_id)
      showToast(res.success, res.message)
      if (res.success) {
        await refreshLocations()
        setSelectedSlotId(null)
        const fresh = await lookupChainOfCustody(scannedResult.sample.sample_id)
        if (fresh.success && fresh.data) setScannedResult(fresh.data)
      }
    } else {
      setAssigningSlot(targetSlot)
    }
  }

  const selectedSlot = locations.find(l => l.id === selectedSlotId) ?? null
  const canStore     = !!(selectedSlot && !selectedSlot.is_occupied)
  const children     = locations.filter(l => l.parent === selectedId && l.location_type !== 'box_location')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F5F6FA', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Top scan bar ── */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #E5E7EB', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <form onSubmit={handleScan} style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '7px 12px', border: '1px solid #D1D5DB', backgroundColor: '#FAFAFA' }}>
            <MI name="qr_code_scanner" size={16} color="#9CA3AF" />
            <input
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              placeholder="Scan Sample / Container / Location Barcode"
              style={{ flex: 1, outline: 'none', fontSize: 13, color: '#111827', backgroundColor: 'transparent', border: 'none' }}
            />
            {scanLoading && <MI name="hourglass_top" size={14} color="#9CA3AF" />}
            <MI name="crop_free" size={16} color="#9CA3AF" />
          </div>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>Mode</span>
          <select
            value={mode}
            onChange={e => setMode(e.target.value as 'store' | 'move' | 'retrieve')}
            style={{ fontSize: 12, fontWeight: 600, color: '#111827', border: '1px solid #D1D5DB', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', backgroundColor: '#fff' }}
          >
            <option value="store">Store Sample</option>
            <option value="move">Move Sample</option>
            <option value="retrieve">Retrieve</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {[
            { icon: 'swap_horiz', label: 'Move Sample' },
            { icon: 'inventory',  label: 'Bulk Store' },
            { icon: 'upload',     label: 'Retrieve' },
          ].map(btn => (
            <button key={btn.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              <MI name={btn.icon} size={13} color="#374151" />
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ margin: '8px 16px 0', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, fontSize: 12,
          backgroundColor: toast.ok ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${toast.ok ? '#A7F3D0' : '#FECACA'}`,
          color: toast.ok ? '#065F46' : '#991B1B',
        }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#10B981' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* ── 3-panel body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '12px 16px 16px', gap: 12 }}>

        {/* Left: Navigator */}
        <div style={{ width: 256, flexShrink: 0, backgroundColor: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Sample Storage Navigator</span>
              <MI name="keyboard_arrow_up" size={16} color="#9CA3AF" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8, padding: '6px 10px', border: '1px solid #E5E7EB', backgroundColor: '#FAFAFA' }}>
              <MI name="search" size={13} color="#9CA3AF" />
              <input placeholder="Search locations..." style={{ flex: 1, outline: 'none', fontSize: 11, color: '#374151', backgroundColor: 'transparent', border: 'none' }} />
              <MI name="filter_list" size={13} color="#9CA3AF" />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <StorageTree
              locations={locations}
              selectedId={selectedId}
              onSelect={id => { setSelectedId(id); setSelectedSlotId(null) }}
              onAddChild={(parentId) => setModal({ editing: null, defaultParentId: parentId })}
              onAddRoot={() => setModal({ editing: null, defaultParentId: null })}
            />
          </div>

          {/* Bottom selected-location stats */}
          {selected && (
            <div style={{ borderTop: '1px solid #F3F4F6', padding: '10px 12px', fontSize: 11 }}>
              <p style={{ fontWeight: 600, color: '#374151', marginBottom: 5 }}>Selected Location</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 6px' }}>
                <span style={{ color: '#9CA3AF' }}>Location Type</span>
                <span style={{ color: '#374151', fontWeight: 500, textTransform: 'capitalize' }}>{selected.location_type.replace('_', ' ')}</span>
                {selected.temperature && (
                  <>
                    <span style={{ color: '#9CA3AF' }}>Storage Cond.</span>
                    <span style={{ color: '#374151', fontWeight: 500 }}>{selected.temperature}</span>
                  </>
                )}
                {capacity && (
                  <>
                    <span style={{ color: '#9CA3AF' }}>Capacity</span>
                    <span style={{ color: '#374151', fontWeight: 500 }}>{capacity.total} positions</span>
                    <span style={{ color: '#9CA3AF' }}>Occupied</span>
                    <span style={{ color: '#374151', fontWeight: 500 }}>{capacity.occupied} ({capacity.total > 0 ? Math.round(capacity.occupied / capacity.total * 100) : 0}%)</span>
                    <span style={{ color: '#9CA3AF' }}>Available</span>
                    <span style={{ color: '#10B981', fontWeight: 600 }}>{capacity.free} ({capacity.total > 0 ? Math.round(capacity.free / capacity.total * 100) : 0}%)</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Center: Visual Box View */}
        <div style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <MI name="info_outline" size={13} color="#9CA3AF" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Visual Box View</span>
              </div>
              {breadcrumb.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                  {breadcrumb.map((part, i) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      {i > 0 && <MI name="chevron_right" size={12} color="#D1D5DB" />}
                      <span style={{ fontSize: 11, color: i === breadcrumb.length - 1 ? '#111827' : '#0154FC', fontWeight: i === breadcrumb.length - 1 ? 600 : 400 }}>
                        {part}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {[
                { icon: 'grid_view',   label: 'Grid View',  active: true },
                { icon: 'view_agenda', label: 'Shelf View', active: false },
                { icon: 'view_week',   label: 'Rack View',  active: false },
              ].map(v => (
                <button key={v.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500, padding: '5px 10px', borderRadius: 7, border: `1px solid ${v.active ? '#0154FC' : '#E5E7EB'}`, backgroundColor: v.active ? '#EFF6FF' : '#fff', color: v.active ? '#0154FC' : '#6B7280', cursor: 'pointer' }}>
                  <MI name={v.icon} size={13} color={v.active ? '#0154FC' : '#6B7280'} />
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {selectedBox ? (
              <SlotGrid
                box={selectedBox}
                allLocations={locations}
                selectedSlotId={selectedSlotId}
                onAssigned={async (msg) => { showToast(true, msg); await refreshLocations() }}
                onSlotClick={handleSlotClick}
                onSlotSelect={setSelectedSlotId}
              />
            ) : selected ? (
              children.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                  {children.map(child => (
                    <button key={child.id} onClick={() => setSelectedId(child.id)}
                      style={{ textAlign: 'left', padding: '12px', borderRadius: 10, border: '1px solid #E5E7EB', backgroundColor: '#FAFAFA', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <MI name={TYPE_ICONS[child.location_type] ?? 'place'} size={14} color="#0154FC" />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{child.name}</span>
                      </div>
                      <p style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'capitalize' }}>{child.location_type.replace('_', ' ')}</p>
                      {child.temperature && <p style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{child.temperature}</p>}
                      {child.location_type === 'box' && child.rows && child.columns && (
                        <p style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{child.rows}×{child.columns} slots</p>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                  <MI name="inbox" size={32} color="#D1D5DB" />
                  <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>No sub-locations</p>
                  <button onClick={() => setModal({ editing: null, defaultParentId: selectedId })}
                    style={{ marginTop: 8, fontSize: 11, color: '#0154FC', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                    + Add location inside {selected.name}
                  </button>
                </div>
              )
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <MI name="grid_view" size={40} color="#D1D5DB" />
                <p style={{ fontSize: 13, fontWeight: 500, color: '#6B7280', marginTop: 12 }}>Select a storage location</p>
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Choose a location from the navigator on the left</p>
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          {selectedBox && (
            <div style={{ borderTop: '1px solid #F3F4F6', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9CA3AF' }}>
                <MI name="drag_indicator" size={14} color="#9CA3AF" />
                <span>Drag sample to a target slot</span>
                <span style={{ fontWeight: 700 }}>OR</span>
                <span>Scan a destination barcode</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={handleStoreSample}
                  disabled={!canStore}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, backgroundColor: canStore ? '#0154FC' : '#9CA3AF', color: '#fff', border: 'none', cursor: canStore ? 'pointer' : 'not-allowed' }}>
                  <MI name="inventory_2" size={13} color="#fff" />
                  Store Sample
                </button>
                <button style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, padding: '7px 12px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                  <MI name="swap_horiz" size={13} color="#374151" />
                  Move Sample
                </button>
                <button style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, padding: '7px 12px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                  <MI name="print" size={13} color="#374151" />
                  Print Location Label
                </button>
                <button style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, padding: '7px 12px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                  <MI name="history" size={13} color="#374151" />
                  View History
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Sample Info */}
        <SampleInfoPanel
          result={scannedResult}
          capacity={capacity}
          onClose={() => setScannedResult(null)}
        />
      </div>

      {modal && (
        <StorageModal
          editing={modal.editing}
          defaultParentId={modal.defaultParentId}
          allLocations={locations}
          onClose={() => setModal(null)}
          onDone={async (msg) => { showToast(true, msg); await refreshLocations(); setModal(null) }}
        />
      )}
      {assigningSlot && (
        <SlotAssignModal
          slot={assigningSlot}
          storagePath={assigningSlot.name}
          onClose={() => setAssigningSlot(null)}
          onDone={async (msg) => { showToast(true, msg); await refreshLocations(); setAssigningSlot(null) }}
        />
      )}
    </div>
  )
}

'use client'
import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import {
  getStorageLocations, lookupChainOfCustody, assignSampleToSlot,
  releaseSampleFromSlot, resolveStorageLabel,
  type StorageLocation, type ChainOfCustodyResult,
} from '@/app/actions/storage'
import { getClients, type DjangoClient } from '@/app/actions/clients'
import { getLabSamples, type LabSample } from '@/app/actions/lab-samples'
import StorageTree from './StorageTree'
import SlotGrid from './SlotGrid'
import StorageModal from './StorageModal'
import SampleInfoPanel from './SampleInfoPanel'
import SlotAssignModal from './SlotAssignModal'
import HistoryModal from './HistoryModal'
import BulkStoreModal from './BulkStoreModal'
import { sampleDisplayId } from '@/app/lib/sampleDisplay'
import QrScanModal from '@/app/dashboard/_components/QrScanModal'

type Mode = 'store' | 'move' | 'retrieve'

// Strategy map: per-mode copy + button label, so the scan bar / action bar
// read behavior from one place instead of branching with if/else everywhere.
const MODE_STRATEGY: Record<Mode, { helper: string; actionLabel: string; actionIcon: string }> = {
  store:    { helper: 'Select an empty slot, then scan or confirm the sample', actionLabel: 'Store Sample', actionIcon: 'inventory_2' },
  move:     { helper: 'Scan a stored sample, select its new slot',              actionLabel: 'Move Sample',  actionIcon: 'swap_horiz' },
  retrieve: { helper: 'Scan a stored sample to release it from its slot',       actionLabel: 'Retrieve Sample', actionIcon: 'upload' },
}

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const TYPE_ICONS: Record<string, string> = {
  building: 'apartment', room: 'meeting_room', fridge: 'thermostat', freezer: 'ac_unit',
  cabinet: 'inventory_2', shelf: 'view_agenda', box: 'grid_view',
}

export default function StorageShell({ initialLocations }: { initialLocations: StorageLocation[] }) {
  const [locations, setLocations]           = useState<StorageLocation[]>(initialLocations)
  const [selectedId, setSelectedId]         = useState<number | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null)
  const [modal, setModal]                   = useState<{ editing: StorageLocation | null; defaultParentId?: number | null } | null>(null)
  const [toast, setToast]                   = useState<{ ok: boolean; msg: string } | null>(null)
  const [barcodeInput, setBarcodeInput]     = useState('')
  const [mode, setMode]                     = useState<Mode>('store')
  const [scannedResult, setScannedResult]   = useState<ChainOfCustodyResult | null>(null)
  const [scanLoading, setScanLoading]       = useState(false)
  const [assigningSlot, setAssigningSlot]   = useState<StorageLocation | null>(null)
  const [cameraScanOpen, setCameraScanOpen] = useState(false)
  const [showHistory, setShowHistory]       = useState(false)
  const [showBulkStore, setShowBulkStore]   = useState(false)
  const [clients, setClients]               = useState<DjangoClient[]>([])
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<number>>(new Set())
  const [targetSlotIds, setTargetSlotIds]   = useState<number[] | null>(null)
  const targetQueueRef = useRef<number[]>([])
  const multiSelectEnabled = mode === 'store'

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

  function findSlotForSample(sampleId: string) {
    return locations.find(l => l.location_type === 'box_location' && l.assigned_sample_id === sampleId) ?? null
  }

  // Single entry point for a scanned/typed value, regardless of source
  // (keyboard-wedge scanner, typed + Enter, or the camera QR scanner).
  // Tries a sample/container lookup first, then falls back to a location label.
  async function handleScanValue(raw: string): Promise<boolean> {
    const val = raw.trim()
    if (!val) return false
    setScanLoading(true)
    const res = await lookupChainOfCustody(val)
    setScanLoading(false)
    if (res.success && res.data) {
      setScannedResult(res.data)
      const matchSlot = findSlotForSample(res.data.sample_id)
      if (matchSlot?.parent) setSelectedId(matchSlot.parent)
      return true
    }
    // Not a known sample — try it as a location label (BX-0001 / BX-0001-A1)
    const loc = await resolveStorageLabel(val)
    if (loc.success && loc.data && !loc.data.error) {
      const target = locations.find(l => l.label_code === loc.data!.label_code)
      if (target) {
        const boxId = target.location_type === 'box' ? target.id : target.parent
        if (boxId) setSelectedId(boxId)
        if (target.location_type === 'box_location') setSelectedSlotId(target.id)
        return true
      }
    }
    showToast(false, res.message ?? 'Sample or location not found')
    setScannedResult(null)
    return false
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    const val = barcodeInput.trim()
    if (!val) return
    const ok = await handleScanValue(val)
    if (ok) setBarcodeInput('')
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

  async function handleMoveSample() {
    const targetSlot = locations.find(l => l.id === selectedSlotId)
    if (!targetSlot || targetSlot.is_occupied) return
    const sample = scannedResult?.sample
    const sampleId = sample?.sample_id
    if (!sample || !sampleId) { showToast(false, 'Scan a stored sample first.'); return }
    const currentSlot = findSlotForSample(sampleId)
    if (!currentSlot) { showToast(false, 'That sample is not currently stored — use Store instead.'); return }
    if (currentSlot.id === targetSlot.id) { showToast(false, 'Sample is already in that slot.'); return }
    const res = await assignSampleToSlot(targetSlot.id, sampleId)
    showToast(res.success, res.success ? `Moved ${sampleDisplayId(sample)} to slot ${targetSlot.slot_id}.` : res.message)
    if (res.success) {
      await refreshLocations()
      setSelectedSlotId(null)
      const fresh = await lookupChainOfCustody(sampleId)
      if (fresh.success && fresh.data) setScannedResult(fresh.data)
    }
  }

  async function handleRetrieveSample() {
    const sample = scannedResult?.sample
    const sampleId = sample?.sample_id
    if (!sample || !sampleId) { showToast(false, 'Scan a stored sample first.'); return }
    const currentSlot = findSlotForSample(sampleId)
    if (!currentSlot) { showToast(false, 'That sample is not currently stored.'); return }
    const res = await releaseSampleFromSlot(currentSlot.id)
    showToast(res.success, res.success ? `Retrieved ${sampleDisplayId(sample)} from slot ${currentSlot.slot_id}.` : res.message)
    if (res.success) {
      await refreshLocations()
      const fresh = await lookupChainOfCustody(sampleId)
      if (fresh.success && fresh.data) setScannedResult(fresh.data)
    }
  }

  async function handlePrimaryAction() {
    if (mode === 'retrieve') return handleRetrieveSample()
    if (mode === 'move') return handleMoveSample()
    return handleStoreSample()
  }

  async function handleBulkAssign(sampleId: string): Promise<{ success: boolean; message: string }> {
    if (!selectedBox) return { success: false, message: 'No box selected.' }
    const freeSlot = boxSlots.find(s => !s.is_occupied)
    if (!freeSlot) return { success: false, message: 'Box is full.' }
    const res = await assignSampleToSlot(freeSlot.id, sampleId)
    if (res.success) await refreshLocations()
    return { success: res.success, message: res.success ? `Stored in slot ${freeSlot.slot_id}` : res.message }
  }

  // Eligible = belongs to the chosen client AND isn't already occupying a slot
  // anywhere — checked against live StorageLocation rows (findSlotForSample),
  // never the denormalized Sample.storage_location text field (CLAUDE.md).
  async function getEligibleSamplesForClient(clientId: number): Promise<LabSample[]> {
    const all = await getLabSamples()
    return all.filter(s => s.client === clientId && !findSlotForSample(s.sample_id))
  }

  // Fills the grid-multi-selected slots in order (rather than "next free slot
  // in the whole box") — used when Bulk Store is launched from the "N slots
  // selected" action bar instead of the toolbar button.
  async function handleBulkAssignTargeted(sampleId: string): Promise<{ success: boolean; message: string }> {
    const nextId = targetQueueRef.current[0]
    if (nextId === undefined) return { success: false, message: 'All selected slots are filled.' }
    const slot = locations.find(l => l.id === nextId)
    if (!slot || slot.is_occupied) {
      targetQueueRef.current = targetQueueRef.current.slice(1)
      return handleBulkAssignTargeted(sampleId)
    }
    const res = await assignSampleToSlot(slot.id, sampleId)
    if (res.success) {
      targetQueueRef.current = targetQueueRef.current.slice(1)
      await refreshLocations()
    }
    return { success: res.success, message: res.success ? `Stored in slot ${slot.slot_id}` : res.message }
  }

  function openBulkStoreForSelection() {
    const sorted = boxSlots
      .filter(s => selectedSlotIds.has(s.id))
      .sort((a, b) => a.slot_id.localeCompare(b.slot_id, undefined, { numeric: true }))
      .map(s => s.id)
    targetQueueRef.current = sorted
    setTargetSlotIds(sorted)
    setShowBulkStore(true)
  }

  // Multi-select only applies in Store mode — clear it whenever the mode or
  // the selected box changes so a stale selection can't linger into Move/Retrieve.
  useEffect(() => {
    setSelectedSlotIds(new Set())
  }, [mode, selectedBox?.id])

  // In Store mode, a plain click on an empty slot now goes through the
  // multi-select set (SlotGrid's onMouseDown), not the legacy single-slot
  // onSlotSelect callback — so the single-slot "Store Sample" action bar
  // (which reads selectedSlotId) needs it mirrored back whenever exactly one
  // slot ends up selected. 2+ selected clears it — that case uses "Bulk Store
  // Here" instead, not the single-slot primary action.
  useEffect(() => {
    if (!multiSelectEnabled) return
    setSelectedSlotId(selectedSlotIds.size === 1 ? Array.from(selectedSlotIds)[0] : null)
  }, [selectedSlotIds, multiSelectEnabled])

  useEffect(() => {
    if (!multiSelectEnabled) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedSlotIds(new Set())
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [multiSelectEnabled])

  async function handlePrintLabel() {
    // Slot selected → slot label; otherwise the selected box. The QR encodes the
    // hidden system label_code (BX-0001 / BX-0001-A1) — never the user-editable name.
    const slot = locations.find(l => l.id === selectedSlotId) ?? null
    const target = slot ?? selectedBox
    if (!target?.label_code) {
      showToast(false, 'Select a box (or slot) to print its location label.')
      return
    }
    const qr = await QRCode.toDataURL(target.label_code, { width: 260, margin: 1 })
    const pathText = [...breadcrumb, ...(slot ? [slot.slot_id] : [])].join(' › ')
    const title = slot ? `${selectedBox?.name ?? ''} · ${slot.slot_id}` : target.name
    const w = window.open('', '_blank', 'width=420,height=520')
    if (!w) { showToast(false, 'Pop-up blocked — allow pop-ups to print labels.'); return }
    w.document.write(`<!doctype html><html><head><title>Location Label</title>
      <style>body{font-family:Arial,sans-serif;text-align:center;padding:24px}img{width:220px;height:220px}
      h2{margin:8px 0 2px;font-size:18px}p{margin:2px 0;color:#444;font-size:12px}.code{font-size:14px;font-weight:700;letter-spacing:1px;margin-top:6px}</style>
      </head><body>
      <img src="${qr}" alt="QR" />
      <h2>${title}</h2>
      <p>${pathText}</p>
      <div class="code">${target.label_code}</div>
      <script>window.onload=function(){window.print()}</script>
      </body></html>`)
    w.document.close()
  }

  const selectedSlot   = locations.find(l => l.id === selectedSlotId) ?? null
  const canStore       = !!(selectedSlot && !selectedSlot.is_occupied)
  const scannedSlot    = scannedResult?.sample?.sample_id ? findSlotForSample(scannedResult.sample.sample_id) : null
  const canMove        = canStore && !!scannedSlot && scannedSlot.id !== selectedSlotId
  const canRetrieve    = !!scannedSlot
  const canDoPrimary   = mode === 'retrieve' ? canRetrieve : mode === 'move' ? canMove : canStore
  const children       = locations.filter(l => l.parent === selectedId && l.location_type !== 'box_location')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F5F6FA', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Top scan bar ── */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #E5E7EB', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <form onSubmit={handleScan} style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '7px 12px', border: '1px solid #D1D5DB', backgroundColor: '#FAFAFA' }}>
            <MI name="qr_code_scanner" size={16} color="#374151" />
            <input
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              placeholder="Scan Sample / Container / Location Barcode"
              style={{ flex: 1, outline: 'none', fontSize: 13, color: '#111827', backgroundColor: 'transparent', border: 'none' }}
            />
            {scanLoading && <MI name="hourglass_top" size={14} color="#374151" />}
            <button type="button" onClick={() => setCameraScanOpen(true)} title="Scan with camera"
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <MI name="crop_free" size={16} color="#374151" />
            </button>
          </div>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>Mode</span>
          <select
            value={mode}
            onChange={e => setMode(e.target.value as Mode)}
            style={{ fontSize: 12, fontWeight: 600, color: '#111827', border: '1px solid #D1D5DB', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', backgroundColor: '#fff' }}
          >
            <option value="store">Store Sample</option>
            <option value="move">Move Sample</option>
            <option value="retrieve">Retrieve</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {([
            { icon: 'swap_horiz', label: 'Move Sample', onClick: () => setMode('move'), active: mode === 'move' },
            { icon: 'inventory',  label: 'Bulk Store',  onClick: () => {
                if (!selectedBox) { showToast(false, 'Select a box first.'); return }
                setShowBulkStore(true)
                if (clients.length === 0) getClients().then(setClients)
              }, active: showBulkStore },
            { icon: 'upload',     label: 'Retrieve', onClick: () => setMode('retrieve'), active: mode === 'retrieve' },
          ] as const).map(btn => (
            <button key={btn.label} onClick={btn.onClick}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, padding: '6px 12px', borderRadius: 8,
                border: `1px solid ${btn.active ? '#0154FC' : '#E5E7EB'}`, color: btn.active ? '#0154FC' : '#374151',
                backgroundColor: btn.active ? '#EFF6FF' : '#fff', cursor: 'pointer' }}>
              <MI name={btn.icon} size={13} color={btn.active ? '#0154FC' : '#374151'} />
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
              <MI name="keyboard_arrow_up" size={16} color="#374151" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8, padding: '6px 10px', border: '1px solid #E5E7EB', backgroundColor: '#FAFAFA' }}>
              <MI name="search" size={13} color="#374151" />
              <input placeholder="Search locations..." style={{ flex: 1, outline: 'none', fontSize: 11, color: '#374151', backgroundColor: 'transparent', border: 'none' }} />
              <MI name="filter_list" size={13} color="#374151" />
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
                <span style={{ color: '#374151' }}>Location Type</span>
                <span style={{ color: '#374151', fontWeight: 500, textTransform: 'capitalize' }}>{selected.location_type.replace('_', ' ')}</span>
                {selected.temperature && (
                  <>
                    <span style={{ color: '#374151' }}>Storage Cond.</span>
                    <span style={{ color: '#374151', fontWeight: 500 }}>{selected.temperature}</span>
                  </>
                )}
                {capacity && (
                  <>
                    <span style={{ color: '#374151' }}>Capacity</span>
                    <span style={{ color: '#374151', fontWeight: 500 }}>{capacity.total} positions</span>
                    <span style={{ color: '#374151' }}>Occupied</span>
                    <span style={{ color: '#374151', fontWeight: 500 }}>{capacity.occupied} ({capacity.total > 0 ? Math.round(capacity.occupied / capacity.total * 100) : 0}%)</span>
                    <span style={{ color: '#374151' }}>Available</span>
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
                <MI name="info_outline" size={13} color="#374151" />
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
                { icon: 'grid_view',   label: 'Grid View',  active: true,  disabled: false },
                { icon: 'view_agenda', label: 'Shelf View', active: false, disabled: true },
                { icon: 'view_week',   label: 'Rack View',  active: false, disabled: true },
              ].map(v => (
                <button key={v.label} disabled={v.disabled} title={v.disabled ? 'Coming soon' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500, padding: '5px 10px', borderRadius: 7,
                    border: `1px solid ${v.active ? '#0154FC' : '#E5E7EB'}`, backgroundColor: v.active ? '#EFF6FF' : '#fff',
                    color: v.active ? '#0154FC' : '#374151', cursor: v.disabled ? 'not-allowed' : 'pointer', opacity: v.disabled ? 0.5 : 1 }}>
                  <MI name={v.icon} size={13} color={v.active ? '#0154FC' : '#374151'} />
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {selectedBox ? (
              <>
                {multiSelectEnabled && selectedSlotIds.size >= 2 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1D4ED8' }}>{selectedSlotIds.size} slots selected</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" onClick={() => setSelectedSlotIds(new Set())}
                        style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 7, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', cursor: 'pointer' }}>
                        Clear
                      </button>
                      <button type="button" onClick={openBulkStoreForSelection}
                        style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 7, border: 'none', background: '#0154FC', color: '#fff', cursor: 'pointer' }}>
                        Bulk Store Here
                      </button>
                    </div>
                  </div>
                )}
                <SlotGrid
                  box={selectedBox}
                  allLocations={locations}
                  selectedSlotId={selectedSlotId}
                  onAssigned={async (msg) => { showToast(true, msg); await refreshLocations() }}
                  onSlotClick={handleSlotClick}
                  onSlotSelect={setSelectedSlotId}
                  multiSelectEnabled={multiSelectEnabled}
                  selectedSlotIds={selectedSlotIds}
                  onMultiSelectChange={setSelectedSlotIds}
                />
              </>
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
                      <p style={{ fontSize: 10, color: '#374151', textTransform: 'capitalize' }}>{child.location_type.replace('_', ' ')}</p>
                      {child.temperature && <p style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>{child.temperature}</p>}
                      {child.location_type === 'box' && child.rows && child.columns && (
                        <p style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>{child.rows}×{child.columns} slots</p>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                  <MI name="inbox" size={32} color="#D1D5DB" />
                  <p style={{ fontSize: 12, color: '#374151', marginTop: 8 }}>No sub-locations</p>
                  <button onClick={() => setModal({ editing: null, defaultParentId: selectedId })}
                    style={{ marginTop: 8, fontSize: 11, color: '#0154FC', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                    + Add location inside {selected.name}
                  </button>
                </div>
              )
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <MI name="grid_view" size={40} color="#D1D5DB" />
                <p style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginTop: 12 }}>Select a storage location</p>
                <p style={{ fontSize: 11, color: '#374151', marginTop: 4 }}>Choose a location from the navigator on the left</p>
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          {(selectedBox || mode === 'retrieve') && (
            <div style={{ borderTop: '1px solid #F3F4F6', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#374151' }}>
                <MI name="drag_indicator" size={14} color="#374151" />
                <span>{MODE_STRATEGY[mode].helper}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={handlePrimaryAction}
                  disabled={!canDoPrimary}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, backgroundColor: canDoPrimary ? '#0154FC' : '#374151', color: '#fff', border: 'none', cursor: canDoPrimary ? 'pointer' : 'not-allowed' }}>
                  <MI name={MODE_STRATEGY[mode].actionIcon} size={13} color="#fff" />
                  {MODE_STRATEGY[mode].actionLabel}
                </button>
                {selectedBox && (
                  <button onClick={handlePrintLabel} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, padding: '7px 12px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                    <MI name="print" size={13} color="#374151" />
                    Print Location Label
                  </button>
                )}
                <button
                  onClick={() => setShowHistory(true)}
                  disabled={!scannedResult}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, padding: '7px 12px', borderRadius: 8, border: '1px solid #E5E7EB', color: scannedResult ? '#374151' : '#D1D5DB', backgroundColor: '#fff', cursor: scannedResult ? 'pointer' : 'not-allowed' }}>
                  <MI name="history" size={13} color={scannedResult ? '#374151' : '#D1D5DB'} />
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
          onViewAll={() => setShowHistory(true)}
        />
      </div>

      <StorageModal
        open={!!modal}
        editing={modal?.editing ?? null}
        defaultParentId={modal?.defaultParentId}
        allLocations={locations}
        onClose={() => setModal(null)}
        onDone={async (msg) => { showToast(true, msg); await refreshLocations(); setModal(null) }}
      />
      {assigningSlot && (
        <SlotAssignModal
          slot={assigningSlot}
          storagePath={assigningSlot.name}
          onClose={() => setAssigningSlot(null)}
          onDone={async (msg) => { showToast(true, msg); await refreshLocations(); setAssigningSlot(null) }}
        />
      )}
      {showHistory && scannedResult && (
        <HistoryModal
          sampleId={scannedResult.sample ? sampleDisplayId(scannedResult.sample) : scannedResult.sample_id}
          events={scannedResult.history}
          onClose={() => setShowHistory(false)}
        />
      )}
      {showBulkStore && selectedBox && (
        <BulkStoreModal
          box={selectedBox}
          clients={clients}
          onAssign={targetSlotIds ? handleBulkAssignTargeted : handleBulkAssign}
          onFetchClientSamples={getEligibleSamplesForClient}
          targetSlotCount={targetSlotIds?.length}
          onClose={() => {
            setShowBulkStore(false)
            setTargetSlotIds(null)
            setSelectedSlotIds(new Set())
          }}
        />
      )}
      {cameraScanOpen && (
        <QrScanModal
          title="Scan Sample / Container / Location Barcode"
          hint="Point the camera at a sample, container, or location label."
          onClose={() => setCameraScanOpen(false)}
          onDecode={async code => {
            const ok = await handleScanValue(code)
            if (ok) setCameraScanOpen(false)
            return ok
          }}
        />
      )}
    </div>
  )
}

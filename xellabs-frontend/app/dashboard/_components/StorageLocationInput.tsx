'use client'
/**
 * Shared storage-location picker used by New Sample and Sample Receipt.
 * Two entry paths, one resolution flow:
 *   1. Search boxes by name (debounced, server-side filtered — never loads the full tree)
 *   2. Scan a printed QR location label (hidden system code BX-0001 / BX-0001-A1) via device camera
 * Either path resolves through /resolve-label and surfaces the readable path
 * (e.g. "Mari Shelf › Collection Box 1 › A1") plus availability ("Box is full").
 */
import { useEffect, useRef, useState } from 'react'
import {
  resolveStorageLabel, searchStorageBoxes,
  type ResolvedLabel, type StorageLocation,
} from '@/app/actions/storage'
import QrScanModal from './QrScanModal'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export type SelectedStorage = {
  labelCode: string          // hidden system code sent to the backend
  display: string            // readable path shown to the user / saved on the sample
  autoSlot?: string          // slot auto-picked when a box code was chosen
}

function boxPath(b: StorageLocation): string {
  // Denormalized tier titles — no extra queries needed to show a readable path
  return [b.site_title, b.location_title, b.shelf_title, b.name].filter(Boolean).join(' › ')
}

function resolvedDisplay(r: ResolvedLabel): { display: string; autoSlot?: string } {
  const path = r.path.join(' › ')
  if (r.location_type === 'box' && r.next_free_slot) {
    return { display: `${path} › ${r.next_free_slot.slot_id}`, autoSlot: r.next_free_slot.slot_id }
  }
  return { display: path }
}

export default function StorageLocationInput({ value, onChange, disabled }: {
  value: SelectedStorage | null
  onChange: (sel: SelectedStorage | null) => void
  disabled?: boolean
}) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<StorageLocation[]>([])
  const [open, setOpen]         = useState(false)
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState('')
  const [scanning, setScanning] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Debounced server-side box search (max 20 rows per request)
  useEffect(() => {
    if (!query.trim() || value) {
      // Clear immediately rather than leaving stale results while nothing is being searched.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      setBusy(true)
      const list = await searchStorageBoxes(query)
      setBusy(false)
      setResults(list)
      setOpen(true)
    }, 300)
    return () => clearTimeout(t)
  }, [query, value])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  async function resolveCode(code: string) {
    setError('')
    setBusy(true)
    const res = await resolveStorageLabel(code)
    setBusy(false)
    if (!res.success || !res.data) { setError(res.message ?? 'Location not found.'); return false }
    if (res.data.error) { setError(res.data.error); return false }
    const { display, autoSlot } = resolvedDisplay(res.data)
    onChange({ labelCode: res.data.label_code, display, autoSlot })
    setQuery('')
    setResults([])
    setOpen(false)
    return true
  }

  async function pickBox(b: StorageLocation) {
    if (b.label_code) await resolveCode(b.label_code)
  }

  function clear() {
    onChange(null)
    setQuery('')
    setError('')
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {value ? (
        <div className="flex items-center rounded-lg" style={{ border: '1px solid #93C5FD', backgroundColor: '#EFF6FF', padding: '6px 8px', gap: 6 }}>
          <MI name="inventory_2" size={14} color="#2563EB" />
          <span title={value.display} style={{ fontSize: 11, fontWeight: 600, color: '#1E40AF', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value.display}
          </span>
          {!disabled && (
            <button type="button" onClick={clear} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
              <MI name="close" size={14} color="#6B7280" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center rounded-lg" style={{ border: '1px solid #D1D5DB', backgroundColor: '#fff', overflow: 'hidden' }}>
          <input
            value={query}
            disabled={disabled}
            onChange={e => { setQuery(e.target.value); setError('') }}
            onKeyDown={e => {
              // A scanned code typed/wedged in + Enter resolves directly
              if (e.key === 'Enter' && /^bx-\d+/i.test(query.trim())) {
                e.preventDefault()
                resolveCode(query.trim().toUpperCase())
              }
            }}
            placeholder="Search box or scan label…"
            className="flex-1 outline-none py-2 px-3 text-xs"
            style={{ color: '#374151', backgroundColor: 'transparent', minWidth: 0 }}
          />
          {busy && <MI name="hourglass_top" size={13} color="#9CA3AF" />}
          <button type="button" onClick={() => setScanning(true)} disabled={disabled} title="Scan location QR"
            style={{ border: 'none', borderLeft: '1px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer', padding: '7px 9px', display: 'flex' }}>
            <MI name="qr_code_scanner" size={16} color="#2563EB" />
          </button>
        </div>
      )}

      {error && <p style={{ fontSize: 10, color: '#DC2626', marginTop: 3 }}>{error}</p>}

      {open && results.length > 0 && !value && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 4, boxShadow: '0 8px 20px rgba(0,0,0,0.08)', maxHeight: 220, overflowY: 'auto' }}>
          {results.map(b => (
            <button key={b.id} type="button" onClick={() => pickBox(b)}
              className="w-full text-left"
              style={{ display: 'block', padding: '8px 10px', border: 'none', borderBottom: '1px solid #F3F4F6', background: 'none', cursor: 'pointer' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#111827', display: 'block' }}>{b.name}</span>
              <span style={{ fontSize: 10, color: '#6B7280' }}>{boxPath(b)}</span>
            </button>
          ))}
        </div>
      )}
      {open && !busy && results.length === 0 && query.trim() && !value && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 4, padding: '8px 10px' }}>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>No matching boxes.</span>
        </div>
      )}

      {scanning && (
        <QrScanModal
          title="Scan Location Label"
          hint="Point the camera at a box or slot QR label."
          onClose={() => setScanning(false)}
          onDecode={async code => {
            const ok = await resolveCode(code)
            if (ok) setScanning(false)
            return ok
          }}
        />
      )}
    </div>
  )
}

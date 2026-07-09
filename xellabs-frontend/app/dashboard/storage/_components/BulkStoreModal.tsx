'use client'
import { useState } from 'react'
import QrScanModal from '@/app/dashboard/_components/QrScanModal'
import type { StorageLocation } from '@/app/actions/storage'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

type LogEntry = { sampleId: string; ok: boolean; message: string }

export default function BulkStoreModal({
  box,
  onAssign,
  onClose,
}: {
  box: StorageLocation
  onAssign: (sampleId: string) => Promise<{ success: boolean; message: string }>
  onClose: () => void
}) {
  const [input, setInput]     = useState('')
  const [pending, setPending] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [log, setLog]         = useState<LogEntry[]>([])

  async function submit(sampleId: string) {
    const id = sampleId.trim()
    if (!id || pending) return
    setPending(true)
    const res = await onAssign(id)
    setPending(false)
    setLog(prev => [{ sampleId: id, ok: res.success, message: res.message }, ...prev])
    setInput('')
  }

  const storedCount = log.filter(l => l.ok).length

  return (
    <div
      onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1100 }}
    >
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 440, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
              <MI name="inventory" size={16} color="#0154FC" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Bulk Store — {box.name}</h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>Each sample auto-fills the next free slot</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <MI name="close" size={16} color="#9CA3AF" />
          </button>
        </div>

        <div className="px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <form onSubmit={e => { e.preventDefault(); submit(input) }} style={{ display: 'flex', gap: 6 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Scan or type sample ID, press Enter"
              autoFocus
              disabled={pending}
              className="flex-1 px-3 py-2 text-xs rounded-lg outline-none"
              style={{ border: '1px solid #D1D5DB', color: '#111827' }}
            />
            <button type="button" onClick={() => setScanning(true)} disabled={pending}
              style={{ border: '1px solid #D1D5DB', borderRadius: 8, background: '#F9FAFB', cursor: 'pointer', padding: '0 12px', display: 'flex', alignItems: 'center' }}>
              <MI name="qr_code_scanner" size={16} color="#2563EB" />
            </button>
          </form>
          <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 6 }}>{storedCount} stored this session</p>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {log.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <MI name="inventory" size={28} color="#D1D5DB" />
              <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>Scan samples one after another to store them here</p>
            </div>
          ) : (
            log.map((entry, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: '1px solid #F9FAFB' }}>
                <MI name={entry.ok ? 'check_circle' : 'error'} size={15} color={entry.ok ? '#10B981' : '#DC2626'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{entry.sampleId}</p>
                  <p style={{ fontSize: 10, color: entry.ok ? '#6B7280' : '#DC2626' }}>{entry.message}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-end px-5 py-3" style={{ borderTop: '1px solid #F3F4F6' }}>
          <button
            type="button" onClick={onClose}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            Done
          </button>
        </div>
      </div>

      {scanning && (
        <QrScanModal
          title="Scan Sample Barcode"
          hint="Point the camera at the sample's barcode/QR."
          onClose={() => setScanning(false)}
          onDecode={async code => { await submit(code); return true }}
        />
      )}
    </div>
  )
}

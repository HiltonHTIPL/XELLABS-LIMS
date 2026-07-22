'use client'
import { useState } from 'react'
import QrScanModal from '@/app/dashboard/_components/QrScanModal'
import type { StorageLocation } from '@/app/actions/storage'
import type { DjangoClient } from '@/app/actions/clients'
import type { LabSample } from '@/app/actions/lab-samples'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

type LogEntry = { sampleId: string; ok: boolean; message: string }

export default function BulkStoreModal({
  box,
  clients,
  onAssign,
  onFetchClientSamples,
  targetSlotCount,
  onClose,
}: {
  box: StorageLocation
  clients: DjangoClient[]
  onAssign: (sampleId: string) => Promise<{ success: boolean; message: string }>
  onFetchClientSamples: (clientId: number) => Promise<LabSample[]>
  targetSlotCount?: number
  onClose: () => void
}) {
  const [input, setInput]     = useState('')
  const [pending, setPending] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [log, setLog]         = useState<LogEntry[]>([])

  const [clientSearch, setClientSearch]     = useState('')
  const [selectedClient, setSelectedClient] = useState<DjangoClient | null>(null)
  const [clientSamples, setClientSamples]   = useState<LabSample[]>([])
  const [samplesLoading, setSamplesLoading] = useState(false)
  const [selectedSamples, setSelectedSamples] = useState<Set<string>>(new Set())

  const matchingClients = clientSearch.trim() && !selectedClient
    ? clients.filter(c => c.name.toLowerCase().includes(clientSearch.trim().toLowerCase())).slice(0, 8)
    : []

  async function pickClient(client: DjangoClient) {
    setSelectedClient(client)
    setClientSearch(client.name)
    setSelectedSamples(new Set())
    setSamplesLoading(true)
    const samples = await onFetchClientSamples(client.id)
    setClientSamples(samples)
    setSamplesLoading(false)
  }

  function clearClient() {
    setSelectedClient(null)
    setClientSearch('')
    setClientSamples([])
    setSelectedSamples(new Set())
  }

  function toggleSample(sampleId: string) {
    setSelectedSamples(prev => {
      const next = new Set(prev)
      if (next.has(sampleId)) next.delete(sampleId)
      else next.add(sampleId)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedSamples(prev =>
      prev.size === clientSamples.length ? new Set() : new Set(clientSamples.map(s => s.sample_id))
    )
  }

  async function submit(sampleId: string) {
    const id = sampleId.trim()
    if (!id || pending) return
    setPending(true)
    const res = await onAssign(id)
    setPending(false)
    setLog(prev => [{ sampleId: id, ok: res.success, message: res.message }, ...prev])
    setInput('')
  }

  async function addSelectedSamples() {
    if (pending || selectedSamples.size === 0) return
    const ids = Array.from(selectedSamples)
    for (const id of ids) {
      await submit(id)
    }
    setClientSamples(prev => prev.filter(s => !selectedSamples.has(s.sample_id)))
    setSelectedSamples(new Set())
  }

  const storedCount = log.filter(l => l.ok).length

  return (
    <div
      onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1100 }}
    >
      <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', right: 0, bottom: 'var(--dashboard-footer-h)', width: 440, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
              <MI name="inventory" size={16} color="#0154FC" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Bulk Store — {box.name}</h2>
              <p style={{ fontSize: 12, color: '#1F2937', fontWeight: 500 }}>
                {targetSlotCount ? `Filling ${targetSlotCount} selected slots, in order` : 'Each sample auto-fills the next free slot'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <MI name="close" size={16} color="#374151" />
          </button>
        </div>

        <div className="px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6', position: 'relative' }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.4 }}>Client</label>
          <div style={{ position: 'relative', marginTop: 6 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
              <MI name="search" size={16} color="#374151" />
            </span>
            <input
              value={clientSearch}
              onChange={e => { setClientSearch(e.target.value); if (selectedClient) setSelectedClient(null) }}
              placeholder="Search client by name…"
              className="w-full text-xs outline-none"
              style={{ border: '1px solid #D1D5DB', borderRadius: 999, padding: '10px 14px 10px 38px', color: '#111827', backgroundColor: '#fff' }}
            />
            {selectedClient && (
              <button type="button" onClick={clearClient}
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 'none', borderRadius: '50%', background: '#F3F4F6', cursor: 'pointer', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MI name="close" size={13} color="#374151" />
              </button>
            )}
          </div>
          {matchingClients.length > 0 && (
            <div style={{ position: 'absolute', left: 20, right: 20, top: 68, zIndex: 10 }}>
              {/* Caret pointing back up at the search input */}
              <div style={{ width: 12, height: 12, background: '#fff', border: '1px solid #E5E7EB', borderRight: 'none', borderBottom: 'none', transform: 'rotate(45deg)', marginLeft: 24, marginBottom: -7, borderRadius: '2px 0 0 0' }} />
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, boxShadow: '0 12px 28px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto', padding: 6 }}>
                {matchingClients.map(c => (
                  <button key={c.id} type="button" onClick={() => pickClient(c)}
                    className="flex items-center justify-between"
                    style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 10, background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{c.name}</p>
                      <p style={{ fontSize: 11, color: '#374151', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.client_id || 'Client'}</p>
                    </div>
                    <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 10 }}>
                      <MI name="arrow_forward" size={14} color="#374151" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedClient && (
            <div style={{ marginTop: 10 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#374151' }}>
                  <input
                    type="checkbox"
                    checked={clientSamples.length > 0 && selectedSamples.size === clientSamples.length}
                    onChange={toggleSelectAll}
                    disabled={clientSamples.length === 0}
                  />
                  Select all ({clientSamples.length} eligible)
                </label>
                <button
                  type="button"
                  onClick={addSelectedSamples}
                  disabled={selectedSamples.size === 0 || pending}
                  style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 8, backgroundColor: selectedSamples.size === 0 || pending ? '#E5E7EB' : '#0154FC', color: selectedSamples.size === 0 || pending ? '#374151' : '#fff', border: 'none', cursor: selectedSamples.size === 0 || pending ? 'default' : 'pointer' }}
                >
                  Add Selected ({selectedSamples.size})
                </button>
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #F3F4F6', borderRadius: 8 }}>
                {samplesLoading ? (
                  <p style={{ fontSize: 11, color: '#374151', padding: 10 }}>Loading samples…</p>
                ) : clientSamples.length === 0 ? (
                  <p style={{ fontSize: 11, color: '#374151', padding: 10 }}>No unstored samples for this client.</p>
                ) : (
                  clientSamples.map(s => (
                    <label key={s.sample_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid #F9FAFB', fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" checked={selectedSamples.has(s.sample_id)} onChange={() => toggleSample(s.sample_id)} />
                      <span style={{ fontWeight: 600, color: '#111827' }}>{s.sample_id}</span>
                      <span style={{ color: '#374151' }}>{s.sample_type_name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
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
          <p style={{ fontSize: 10, color: '#374151', marginTop: 6 }}>{storedCount} stored this session</p>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {log.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <MI name="inventory" size={28} color="#D1D5DB" />
              <p style={{ fontSize: 11, color: '#374151', marginTop: 8 }}>Scan samples one after another to store them here</p>
            </div>
          ) : (
            log.map((entry, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: '1px solid #F9FAFB' }}>
                <MI name={entry.ok ? 'check_circle' : 'error'} size={15} color={entry.ok ? '#10B981' : '#DC2626'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{entry.sampleId}</p>
                  <p style={{ fontSize: 10, color: entry.ok ? '#374151' : '#DC2626' }}>{entry.message}</p>
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

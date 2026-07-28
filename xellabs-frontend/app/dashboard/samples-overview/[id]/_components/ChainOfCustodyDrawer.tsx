'use client'
import { useEffect, useState } from 'react'
import { lookupChainOfCustody, type ChainOfCustodyResult } from '@/app/actions/storage'
import { sampleDisplayId } from '@/app/lib/sampleDisplay'
import { MI, CustodyTimelineList, FullHistoryModal } from '@/app/dashboard/chain-of-custody/_components/CustodyTimeline'

export default function ChainOfCustodyDrawer({ sampleId, open, onClose }: { sampleId: string; open: boolean; onClose: () => void }) {
  const [result, setResult] = useState<ChainOfCustodyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setLoading(true)
      lookupChainOfCustody(sampleId).then(res => {
        setResult(res.success ? (res.data ?? null) : null)
        setLoading(false)
      }).catch(() => setLoading(false))
    }
  }, [open, sampleId])

  const sample = result?.sample ?? null
  const loc = result?.current_location ?? null
  const events = result?.history ?? []

  return (
    <div style={{ position: 'fixed', top: 56, bottom: 0, left: 0, right: 0, zIndex: 300, pointerEvents: open ? 'auto' : 'none' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: open ? 1 : 0, transition: 'opacity 0.25s ease' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(480px, 92%)', backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
        {open && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <div className="flex items-center gap-2">
                <MI name="link" size={20} color="#0154FC" />
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Chain of Custody</h2>
                {loc && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 999, backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                    Current Custody
                  </span>
                )}
              </div>
              <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', color: '#6B7280' }}>
                <MI name="close" size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto" style={{ padding: '16px 16px 8px' }}>
              {loading ? (
                <div className="flex items-center justify-center p-8 text-sm" style={{ color: '#6B7280' }}>
                  Loading custody history...
                </div>
              ) : (
                <CustodyTimelineList events={events} sample={sample} />
              )}
            </div>

            <div className="px-4 py-3 shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
              <button onClick={() => setHistoryOpen(true)} disabled={events.length === 0}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-medium"
                style={{ border: '1px solid #E5E7EB', color: events.length ? '#374151' : '#9CA3AF', backgroundColor: '#fff', cursor: events.length ? 'pointer' : 'not-allowed', opacity: events.length ? 1 : 0.6 }}>
                <MI name="history" size={14} color="#6B7280" /> View Full History
              </button>
            </div>
          </div>
        )}
      </div>

      {historyOpen && (
        <FullHistoryModal
          events={events}
          sample={sample}
          sampleLabel={sample ? sampleDisplayId(sample) : undefined}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  )
}

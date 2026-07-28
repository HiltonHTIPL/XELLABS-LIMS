'use client'
import type { CocEvent } from '@/app/actions/storage'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const EVENT_ICON: Record<string, { icon: string; color: string; bg: string }> = {
  sample_registered: { icon: 'add_circle',    color: '#0154FC', bg: '#EFF6FF' },
  sample_received:   { icon: 'download_done', color: '#10B981', bg: '#ECFDF5' },
  stored:            { icon: 'inventory_2',   color: '#0154FC', bg: '#EFF6FF' },
  released:          { icon: 'output',        color: '#F59E0B', bg: '#FFFBEB' },
  status_change:     { icon: 'sync',          color: '#8B5CF6', bg: '#EDE9FE' },
  update:            { icon: 'edit',          color: '#374151', bg: '#F3F4F6' },
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function HistoryModal({ sampleId, events, onClose }: {
  sampleId: string
  events: CocEvent[]
  onClose: () => void
}) {
  return (
    <div
      onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1100 }}
    >
      <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', right: 0, bottom: 'var(--dashboard-footer-h)', width: 440, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
              <MI name="timeline" size={16} color="#0154FC" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Activity / Audit Trail</h2>
              <p style={{ fontSize: 12, color: '#1F2937', fontWeight: 500 }}>{sampleId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <MI name="close" size={16} color="#374151" />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {events.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: '#374151' }}>No activity recorded</p>
            </div>
          ) : (
            [...events].reverse().map((ev, i) => {
              const style = EVENT_ICON[ev.event_type] ?? EVENT_ICON.update
              return (
                <div key={ev.id || i} style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: '1px solid #F9FAFB', alignItems: 'flex-start' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 999, backgroundColor: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <MI name={style.icon} size={13} color={style.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{ev.label}</p>
                    <p style={{ fontSize: 10, color: '#374151', marginTop: 1 }}>{ev.user}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 10, color: '#374151', fontWeight: 500 }}>{fmtTime(ev.timestamp)}</p>
                    <p style={{ fontSize: 12, color: '#1F2937', fontWeight: 500 }}>{fmtDate(ev.timestamp)}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

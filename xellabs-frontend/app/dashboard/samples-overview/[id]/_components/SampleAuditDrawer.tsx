'use client'
import { useEffect, useState } from 'react'
import { getSampleAuditEvents } from '@/app/actions/sample-audit'
import type { AuditEvent } from '@/app/actions/audit-trail'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function fmt(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) }
  catch { return d }
}

export default function SampleAuditDrawer({ sampleId, open, onClose }: { sampleId: string; open: boolean; onClose: () => void }) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setLoading(true)
      getSampleAuditEvents(sampleId).then(evs => {
        setEvents(evs)
        setLoading(false)
      }).catch(() => setLoading(false))
    }
  }, [open, sampleId])

  return (
    <div style={{ position: 'fixed', top: 56, bottom: 0, left: 0, right: 0, zIndex: 300, pointerEvents: open ? 'auto' : 'none' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: open ? 1 : 0, transition: 'opacity 0.25s ease' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(720px, 92%)', backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', overflowY: 'auto' }}>
        {open && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 shrink-0 sticky top-0 z-10" style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#fff' }}>
              <div className="flex items-center gap-2">
                <MI name="history" size={20} color="#0154FC" />
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Audit Trail</h2>
              </div>
              <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', color: '#6B7280' }}>
                <MI name="close" size={20} />
              </button>
            </div>
            
            <div className="flex-1 p-5 overflow-y-auto bg-gray-50">
              {loading ? (
                <div className="flex items-center justify-center p-8 text-gray-500 text-sm">
                  Loading history...
                </div>
              ) : events.length === 0 ? (
                <div className="text-center p-8 bg-white border border-gray-200 rounded-xl">
                  <MI name="history" size={32} color="#D1D5DB" />
                  <p className="text-sm font-semibold text-gray-900 mt-3">No history found</p>
                  <p className="text-xs text-gray-500 mt-1">There are no audit events recorded for this sample.</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {events.map((entry, idx) => (
                    <div key={idx} className="flex gap-4 group">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full border-2 border-white box-content z-10 mt-1" style={{ backgroundColor: '#0154FC' }} />
                        {idx < events.length - 1 && (
                          <div className="w-[2px] flex-1 bg-gray-200 my-1" />
                        )}
                      </div>
                      <div className="pb-6 flex-1">
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2, textTransform: 'capitalize' }}>
                          {entry.action.replace('_', ' ')}
                        </div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
                          {fmt(entry.timestamp)} by <span style={{ fontWeight: 500 }}>{entry.user_display ?? 'System'}</span>
                        </div>
                        
                        {entry.changes && entry.changes.length > 0 && (
                          <div style={{ marginTop: 8, fontSize: 12, color: '#374151', backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 6, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                <tr>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#6B7280' }}>Field</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#6B7280' }}>Old Value</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#6B7280' }}>New Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entry.changes.map((c, i) => (
                                  <tr key={i} style={{ borderBottom: i < entry.changes.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                                    <td style={{ padding: '6px 10px', fontWeight: 500, whiteSpace: 'nowrap' }}>{c.field_name}</td>
                                    <td style={{ padding: '6px 10px', color: '#EF4444', textDecoration: 'line-through', overflowWrap: 'anywhere' }}>{c.old_value || '—'}</td>
                                    <td style={{ padding: '6px 10px', color: '#10B981', overflowWrap: 'anywhere' }}>{c.new_value || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {entry.changes.some(c => c.reason) && (
                              <div style={{ padding: '8px 10px', backgroundColor: '#FEF2F2', borderTop: '1px solid #FECACA', color: '#991B1B', fontSize: 11.5 }}>
                                <strong>Reason:</strong> {entry.changes.find(c => c.reason)?.reason}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

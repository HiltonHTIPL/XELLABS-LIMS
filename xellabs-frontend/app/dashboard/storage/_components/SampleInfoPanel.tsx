'use client'
import type { ChainOfCustodyResult, CocEvent } from '@/app/actions/storage'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  registered:      { bg: '#EFF6FF', color: '#1D4ED8', label: 'Registered' },
  received:        { bg: '#DCFCE7', color: '#15803D', label: 'Logged / Received' },
  in_progress:     { bg: '#FEF9C3', color: '#92400E', label: 'In Progress' },
  results_pending: { bg: '#FEF3C7', color: '#B45309', label: 'Results Pending' },
  reviewed:        { bg: '#EDE9FE', color: '#6D28D9', label: 'Reviewed' },
  published:       { bg: '#ECFDF5', color: '#065F46', label: 'Published' },
  rejected:        { bg: '#FEF2F2', color: '#DC2626', label: 'Rejected' },
  disposed:        { bg: '#F3F4F6', color: '#6B7280', label: 'Disposed' },
}

const EVENT_ICON: Record<string, { icon: string; color: string; bg: string }> = {
  sample_registered: { icon: 'add_circle',       color: '#0154FC', bg: '#EFF6FF' },
  sample_received:   { icon: 'download_done',     color: '#10B981', bg: '#ECFDF5' },
  stored:            { icon: 'inventory_2',        color: '#0154FC', bg: '#EFF6FF' },
  released:          { icon: 'output',             color: '#F59E0B', bg: '#FFFBEB' },
  status_change:     { icon: 'sync',               color: '#8B5CF6', bg: '#EDE9FE' },
  update:            { icon: 'edit',               color: '#6B7280', bg: '#F3F4F6' },
}

function DonutChart({ occupied, total }: { occupied: number; total: number }) {
  if (total === 0) return null
  const r = 36
  const circ = 2 * Math.PI * r
  const pct = Math.round((occupied / total) * 100)
  const fill = (occupied / total) * circ

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width="80" height="80" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#F3F4F6" strokeWidth="12" />
          <circle
            cx="50" cy="50" r={r} fill="none"
            stroke="#0154FC" strokeWidth="12"
            strokeDasharray={`${fill} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
          <text x="50" y="46" textAnchor="middle" fontSize="16" fontWeight="700" fill="#111827">{pct}%</text>
          <text x="50" y="58" textAnchor="middle" fontSize="8" fill="#9CA3AF">Occupied</text>
        </svg>
      </div>
      <div style={{ flex: 1, fontSize: 11 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ color: '#6B7280' }}>Occupied</span>
          <span style={{ fontWeight: 600, color: '#111827' }}>{occupied} ({pct}%)</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ color: '#6B7280' }}>Empty</span>
          <span style={{ fontWeight: 600, color: '#10B981' }}>{total - occupied} ({100 - pct}%)</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6B7280' }}>Total Positions</span>
          <span style={{ fontWeight: 600, color: '#374151' }}>{total}</span>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F9FAFB' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <MI name={icon} size={13} color="#9CA3AF" />
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</span>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: valueColor ?? '#111827' }}>{value || '—'}</span>
    </div>
  )
}

export default function SampleInfoPanel({
  result,
  capacity,
  onClose,
}: {
  result: ChainOfCustodyResult | null
  capacity: { total: number; occupied: number; free: number } | null
  onClose: () => void
}) {
  const sample = result?.sample ?? null
  const loc    = result?.current_location ?? null
  const events: CocEvent[] = result?.history ?? []
  const capData = loc?.capacity ?? capacity

  const status = sample?.status ? STATUS_STYLE[sample.status] ?? { bg: '#F3F4F6', color: '#374151', label: sample.status } : null

  return (
    <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>

      {/* Sample Information card */}
      <div style={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MI name="info_outline" size={14} color="#6B7280" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Sample Information</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {result && (
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <MI name="close" size={14} color="#9CA3AF" />
              </button>
            )}
            <MI name="keyboard_arrow_up" size={16} color="#9CA3AF" />
          </div>
        </div>

        <div style={{ padding: '10px 14px' }}>
          {!sample ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <MI name="qr_code_scanner" size={28} color="#D1D5DB" />
              <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>Scan or enter a sample ID<br />to view information</p>
            </div>
          ) : (
            <>
              <InfoRow icon="science" label="Sample ID" value={sample.sample_id} valueColor="#0154FC" />
              <InfoRow icon="business" label="Client" value={sample.client} valueColor="#0154FC" />
              <InfoRow icon="category" label="Sample Type" value={sample.sample_type} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F9FAFB' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MI name="flag" size={13} color="#9CA3AF" />
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>Status</span>
                </div>
                {status && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, backgroundColor: status.bg, color: status.color }}>
                    {status.label}
                  </span>
                )}
              </div>
              <InfoRow icon="thermostat" label="Storage Condition" value={sample.storage_requirement.replace(/_/g, ' ')} />
              {sample.condition && <InfoRow icon="inventory" label="Container Condition" value={sample.condition} />}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MI name="location_on" size={13} color="#9CA3AF" />
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>Current Location</span>
                </div>
                {loc ? (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, backgroundColor: '#EFF6FF', color: '#0154FC' }}>
                    {loc.slot_id}
                  </span>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                    Not Stored
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Activity / Audit Trail */}
      <div style={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MI name="timeline" size={14} color="#6B7280" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Activity / Audit Trail</span>
          </div>
          <span style={{ fontSize: 11, color: '#0154FC', cursor: 'pointer', fontWeight: 500 }}>View All</span>
        </div>

        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          {events.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: '#9CA3AF' }}>No activity recorded</p>
            </div>
          ) : (
            [...events].reverse().slice(0, 6).map((ev, i) => {
              const style = EVENT_ICON[ev.event_type] ?? EVENT_ICON.update
              return (
                <div key={ev.id || i} style={{ display: 'flex', gap: 10, padding: '8px 14px', borderBottom: '1px solid #F9FAFB', alignItems: 'flex-start' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <MI name={style.icon} size={12} color={style.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.label}</p>
                    <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{ev.user}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 10, color: '#374151', fontWeight: 500 }}>{fmtTime(ev.timestamp)}</p>
                    <p style={{ fontSize: 10, color: '#9CA3AF' }}>{fmtDate(ev.timestamp)}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Capacity */}
      {capData && (
        <div style={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MI name="pie_chart" size={14} color="#6B7280" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Capacity</span>
            </div>
            {loc && <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>{loc.slot_name?.split('—')[0]?.trim() || loc.slot_id}</span>}
          </div>
          <div style={{ padding: '14px' }}>
            <DonutChart occupied={capData.occupied} total={capData.total} />
          </div>
        </div>
      )}

      {/* Capacity from selected box (no sample) */}
      {!capData && capacity && (
        <div style={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
            <MI name="pie_chart" size={14} color="#6B7280" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Capacity</span>
          </div>
          <div style={{ padding: '14px' }}>
            <DonutChart occupied={capacity.occupied} total={capacity.total} />
          </div>
        </div>
      )}
    </div>
  )
}

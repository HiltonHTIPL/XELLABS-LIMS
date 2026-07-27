// Shared between the full Chain of Custody page (store/assign/transfer flow)
// and the read-only ChainOfCustodyDrawer opened from a Sample Detail view —
// one place owns "how a custody event renders", not two copies drifting apart.
import { type CocEvent, type CocSample } from '@/app/actions/storage'

export function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
export function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function eventMeta(ev: CocEvent): { label: string; icon: string; color: string } {
  switch (ev.event_type) {
    case 'sample_registered': return { label: 'Registered',           icon: 'assignment_add', color: '#22C55E' }
    case 'sample_received':   return { label: 'Received',             icon: 'check_circle',   color: '#22C55E' }
    case 'stored':            return { label: `Stored in ${(ev.details?.storage_path as string) ?? 'Storage'}`, icon: 'inventory_2', color: '#0154FC' }
    case 'released':          return { label: 'Released from Storage', icon: 'link_off',      color: '#EF4444' }
    case 'status_change': {
      const nc = (ev.details?.new_status as string) ?? ''
      if (nc === 'in_progress')      return { label: 'Released for Testing', icon: 'person',    color: '#8B5CF6' }
      if (nc === 'results_pending')  return { label: 'Results Pending',      icon: 'hourglass_top', color: '#F59E0B' }
      if (nc === 'reviewed')         return { label: 'Results Reviewed',     icon: 'verified',  color: '#0891B2' }
      if (nc === 'published')        return { label: 'Results Published',    icon: 'publish',   color: '#22C55E' }
      if (nc === 'rejected')         return { label: 'Sample Rejected',      icon: 'cancel',    color: '#EF4444' }
      return { label: ev.label, icon: 'swap_horiz', color: '#8B5CF6' }
    }
    case 'result_submitted': return { label: ev.label, icon: 'science',      color: '#8B5CF6' }
    case 'result_verified':  return { label: ev.label, icon: 'verified',     color: '#0891B2' }
    case 'result_rejected':  return { label: ev.label, icon: 'cancel',       color: '#EF4444' }
    case 'ar_completed':     return { label: ev.label, icon: 'task_alt',     color: '#22C55E' }
    default:
      // lims.ChainOfCustody-sourced rows (event_type "custody_<action>") —
      // give the one action actually written in production (disposal) its
      // own distinct look instead of falling into the generic pencil icon;
      // any other custody action still renders (via ev.label), just without
      // a bespoke icon/color until it's actually used.
      if (ev.event_type === 'custody_disposed') return { label: ev.label, icon: 'delete_forever', color: '#991B1B' }
      if (ev.event_type === 'custody_completed') return { label: ev.label, icon: 'task_alt', color: '#22C55E' }
      if (ev.event_type === 'custody_batched') return { label: ev.label, icon: 'layers', color: '#0154FC' }
      return { label: ev.label, icon: 'edit', color: '#F59E0B' }
  }
}

export function eventRows(ev: CocEvent, sample: CocSample | null): Array<{ key: string; value: string }> {
  const rows: Array<{ key: string; value: string }> = [{ key: 'By', value: ev.user }]
  if (ev.event_type === 'sample_registered' || ev.event_type === 'sample_received') {
    if (sample?.barcode) rows.push({ key: 'Barcode', value: sample.barcode })
  }
  if (ev.event_type === 'stored') {
    if (ev.details?.storage_path) rows.push({ key: 'Location',  value: ev.details.storage_path as string })
    if (ev.details?.slot_id)      rows.push({ key: 'Container', value: `Slot ${ev.details.slot_id as string}` })
    if (sample?.barcode)          rows.push({ key: 'Barcode',   value: sample.barcode })
  }
  if (ev.event_type === 'released') {
    if (ev.details?.slot_id)      rows.push({ key: 'Container', value: `Slot ${ev.details.slot_id as string}` })
    if (sample?.barcode)          rows.push({ key: 'Barcode',   value: sample.barcode })
  }
  if (ev.event_type === 'result_submitted' || ev.event_type === 'result_verified') {
    if (ev.details?.test)  rows.push({ key: 'Test',  value: ev.details.test as string })
    if (ev.details?.value) rows.push({ key: 'Value', value: `${ev.details.value as string}${ev.details.unit ? ' ' + ev.details.unit : ''}` })
  }
  if (ev.event_type === 'result_rejected') {
    if (ev.details?.test)    rows.push({ key: 'Test',    value: ev.details.test as string })
    if (ev.details?.remarks) rows.push({ key: 'Remarks', value: ev.details.remarks as string })
  }
  if (ev.event_type === 'ar_completed' && ev.details?.ar_id) {
    rows.push({ key: 'Analysis Request', value: ev.details.ar_id as string })
  }
  if (ev.event_type.startsWith('custody_')) {
    if (ev.details?.from_location) rows.push({ key: 'From', value: ev.details.from_location as string })
    if (ev.details?.to_location)   rows.push({ key: 'To', value: ev.details.to_location as string })
    if (ev.details?.received_by)   rows.push({ key: 'Received by', value: ev.details.received_by as string })
    if (ev.details?.purpose)       rows.push({ key: 'Purpose', value: ev.details.purpose as string })
    if (ev.details?.condition)     rows.push({ key: 'Condition', value: ev.details.condition as string })
    if (ev.details?.seal_status)   rows.push({ key: 'Seal', value: ev.details.seal_status as string })
    if (ev.details?.temperature_c) rows.push({ key: 'Temp', value: `${ev.details.temperature_c as string}°C` })
    if (ev.details?.notes)         rows.push({ key: 'Notes', value: ev.details.notes as string })
  }
  return rows
}

type FieldChange = { field: string; old: string | null; new: string | null }

// Compact vertical timeline — the RIGHT-column panel on the full page, and
// the entire content of the read-only drawer opened from Sample Detail.
export function CustodyTimelineList({ events, sample }: { events: CocEvent[]; sample: CocSample | null }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-10">
        <MI name="history" size={30} color="#D1D5DB" />
        <p className="mt-3 text-xs text-center" style={{ color: '#9CA3AF', lineHeight: 1.6, maxWidth: 160 }}>
          No custody events recorded yet.
        </p>
      </div>
    )
  }

  return (
    <>
      {events.map((ev, i) => {
        const isLast = i === events.length - 1
        const meta = eventMeta(ev)
        const rows = eventRows(ev, sample)
        const changes = (ev.details?.changes as FieldChange[]) ?? []
        return (
          <div key={ev.id} style={{ display: 'flex', gap: 12, marginBottom: 20, position: 'relative' }}>
            {!isLast && (
              <div style={{ position: 'absolute', left: 14, top: 30, width: 2, height: 'calc(100% + 4px)', backgroundColor: '#E5E7EB', zIndex: 0 }} />
            )}
            <div style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: meta.color + '1A', border: `2px solid ${meta.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
              <MI name={meta.icon} size={14} color={meta.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-start justify-between gap-2 mb-0.5">
                <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', lineHeight: 1.35 }}>{meta.label}</span>
                <span style={{ fontSize: 10, color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDateShort(ev.timestamp)}</span>
              </div>
              <p style={{ fontSize: 10, color: '#9CA3AF', margin: '0 0 5px' }}>{fmtTime(ev.timestamp)}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {rows.map(row => (
                  <div key={row.key} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#9CA3AF', minWidth: 64, flexShrink: 0 }}>{row.key}</span>
                    <span style={{ fontSize: 10, fontWeight: 500, color: '#111827', wordBreak: 'break-word', fontFamily: row.key === 'Barcode' ? 'monospace' : 'inherit' }}>{row.value}</span>
                  </div>
                ))}
                {ev.event_type === 'sample_received' && sample?.receipt_notes && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#9CA3AF', minWidth: 64, flexShrink: 0 }}>Remarks</span>
                    <span style={{ fontSize: 10, fontWeight: 500, color: '#111827' }}>{sample.receipt_notes}</span>
                  </div>
                )}
                {ev.event_type === 'stored' && (ev.details?.storage_path as string | undefined) && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#9CA3AF', minWidth: 64, flexShrink: 0 }}>Remarks</span>
                    <span style={{ fontSize: 10, fontWeight: 500, color: '#111827' }}>Stored in {ev.details.storage_path as string}</span>
                  </div>
                )}
                {ev.event_type === 'update' && changes.length > 0 && (
                  <div style={{ marginTop: 2 }}>
                    {changes.slice(0, 3).map((c, ci) => (
                      <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#6B7280', lineHeight: 1.5 }}>
                        <span style={{ color: '#9CA3AF', minWidth: 56 }}>{c.field.replace(/_/g, ' ')}</span>
                        <span style={{ color: '#EF4444' }}>{c.old || '—'}</span>
                        <MI name="arrow_forward" size={9} color="#9CA3AF" />
                        <span style={{ color: '#22C55E' }}>{c.new || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

// Full-history modal — same content as the timeline list, but flattened
// (no "no events yet" empty state, since it's only ever opened once events exist).
export function FullHistoryModal({ events, sample, sampleLabel, onClose }: {
  events: CocEvent[]; sample: CocSample | null; sampleLabel?: string; onClose: () => void
}) {
  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', top: 'var(--dashboard-header-h)', bottom: 'var(--dashboard-footer-h)', left: 0, right: 0, zIndex: 500, backgroundColor: 'rgba(17,24,39,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="bg-white rounded-2xl flex flex-col" style={{ width: 560, maxWidth: '94vw', maxHeight: '84vh', overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <MI name="history" size={16} color="#0154FC" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              Full Custody History{sampleLabel ? ` — ${sampleLabel}` : ''}
            </span>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
            <MI name="close" size={18} color="#6B7280" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ padding: '16px 20px' }}>
          {events.map(ev => {
            const meta = eventMeta(ev)
            const rows = eventRows(ev, sample)
            const changes = (ev.details?.changes as FieldChange[]) ?? []
            return (
              <div key={ev.id} className="flex gap-3 mb-4">
                <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: meta.color + '1A', border: `2px solid ${meta.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MI name={meta.icon} size={13} color={meta.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-start justify-between gap-2">
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{meta.label}</span>
                    <span style={{ fontSize: 10, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{fmtDateShort(ev.timestamp)} • {fmtTime(ev.timestamp)}</span>
                  </div>
                  {rows.map(row => (
                    <div key={row.key} style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 10, color: '#9CA3AF', minWidth: 64 }}>{row.key}</span>
                      <span style={{ fontSize: 10, fontWeight: 500, color: '#111827', wordBreak: 'break-word' }}>{row.value}</span>
                    </div>
                  ))}
                  {changes.map((c, ci) => (
                    <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6B7280' }}>
                      <span style={{ color: '#9CA3AF', minWidth: 64 }}>{c.field.replace(/_/g, ' ')}</span>
                      <span style={{ color: '#EF4444' }}>{c.old || '—'}</span>
                      <MI name="arrow_forward" size={10} color="#9CA3AF" />
                      <span style={{ color: '#22C55E' }}>{c.new || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

'use client'
import { MATRIX_ROLE_ORDER, MATRIX_ROLE_SHORT_LABELS, ROLE_ACTIVITY_MATRIX } from '@/app/lib/role-matrix'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

/** Reference-only display of the role-privilege matrix that the backend
 * actually enforces (core/permissions.py ACTIVITY_ROLES) — opened from the
 * "?" button beside New User. Not editable here; this is documentation. */
export default function RoleMatrixModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', top: 'var(--dashboard-header-h)', bottom: 'var(--dashboard-footer-h)', left: 0, right: 0, zIndex: 500, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div className="bg-white flex flex-col" style={{ width: 'min(980px, 96%)', maxHeight: '92%', borderRadius: 14, boxShadow: '0 12px 48px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <MI name="help" size={18} color="#0154FC" />
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Role &amp; Action Matrix</h2>
              <p style={{ fontSize: 11, color: '#374151' }}>What each lab role is allowed to do — enforced by the backend, shown here for reference.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
            <MI name="close" size={18} color="#374151" />
          </button>
        </div>

        <div className="xl-visible-scrollbar" style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', minWidth: 780, borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10.5, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.03em', position: 'sticky', left: 0, backgroundColor: '#F9FAFB', whiteSpace: 'nowrap', minWidth: 190 }}>Activity</th>
                {MATRIX_ROLE_ORDER.map(role => (
                  <th key={role} style={{ textAlign: 'center', padding: '9px 8px', fontSize: 10.5, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap', borderLeft: '1px solid #F3F4F6' }}>
                    {MATRIX_ROLE_SHORT_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLE_ACTIVITY_MATRIX.map((row, i) => (
                <tr key={row.activity} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: i % 2 ? '#FAFBFC' : '#fff' }}>
                  <td style={{ padding: '7px 14px', fontWeight: 600, color: '#111827', position: 'sticky', left: 0, backgroundColor: i % 2 ? '#FAFBFC' : '#fff', whiteSpace: 'nowrap' }}>
                    {row.activity}
                    {row.note && (
                      <span title={row.note} style={{ marginLeft: 5, cursor: 'help' }}>
                        <MI name="info" size={12} color="#9CA3AF" />
                      </span>
                    )}
                  </td>
                  {MATRIX_ROLE_ORDER.map(role => (
                    <td key={role} style={{ textAlign: 'center', padding: '7px 8px', borderLeft: '1px solid #F3F4F6' }}>
                      {row.roles.includes(role)
                        ? <MI name="check" size={14} color="#059669" />
                        : <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3" style={{ borderTop: '1px solid #E5E7EB', flexShrink: 0, fontSize: 10.5, color: '#374151' }}>
          <MI name="info" size={12} color="#9CA3AF" /> next to an activity means it's defined here but has no dedicated action to enforce yet.
        </div>
      </div>
    </div>
  )
}

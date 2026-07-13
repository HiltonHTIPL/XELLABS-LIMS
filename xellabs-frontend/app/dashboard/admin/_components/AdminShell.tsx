'use client'
import { useState, useCallback } from 'react'
import { getStaffUsers, toggleStaffUserActive, toggleSenaiteRole, type StaffUser } from '@/app/actions/users'
import { STAFF_ROLE_LABELS, SENAITE_USER_ROLES } from '@/app/lib/roles'
import UserModal from './UserModal'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  admin:        { bg: '#EDE9FE', color: '#6D28D9' },
  lab_manager:  { bg: '#DBEAFE', color: '#1D4ED8' },
  analyst:      { bg: '#DCFCE7', color: '#15803D' },
  reviewer:     { bg: '#FEF3C7', color: '#B45309' },
  receptionist: { bg: '#F3F4F6', color: '#374151' },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminShell({ initialUsers }: { initialUsers: StaffUser[] }) {
  const [users, setUsers] = useState<StaffUser[]>(initialUsers)
  const [modal, setModal] = useState<{ editing: StaffUser | null } | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const refresh = useCallback(async () => {
    const fresh = await getStaffUsers()
    setUsers(fresh)
  }, [])

  async function handleToggleActive(user: StaffUser) {
    const result = await toggleStaffUserActive(user.id, !user.is_active)
    showToast(result.success, result.message)
    if (result.success) await refresh()
  }

  async function handleToggleSenaiteRole(user: StaffUser, role: string) {
    const enabled = !user.senaite_roles.includes(role)
    // Optimistic update — this table has 11 checkbox columns per row, a round
    // trip before any visual feedback would make every click feel unresponsive.
    setUsers(prev => prev.map(u => u.id !== user.id ? u : {
      ...u,
      senaite_roles: enabled ? [...u.senaite_roles, role] : u.senaite_roles.filter(r => r !== role),
    }))
    const result = await toggleSenaiteRole(user.id, role, enabled)
    if (!result.success) {
      showToast(false, result.message ?? 'Failed to update SENAITE role.')
      await refresh() // revert the optimistic change back to server truth
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F5F6FA' }}>
      <div className="flex items-center justify-between px-5 py-3" style={{ backgroundColor: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <div>
          <h1 className="text-lg font-bold" style={{ color: '#111827' }}>Administration</h1>
          <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Manage staff users and their lab roles</p>
        </div>
        <button
          onClick={() => setModal({ editing: null })}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-white"
          style={{ backgroundColor: '#0154FC', border: 'none', cursor: 'pointer' }}
        >
          <MI name="person_add" size={15} color="#fff" />
          New User
        </button>
      </div>

      {toast && (
        <div className="mx-5 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${toast.ok ? '#A7F3D0' : '#FECACA'}`, color: toast.ok ? '#065F46' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#10B981' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', margin: '12px 20px 20px' }}>
        <div style={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Name', 'Username', 'Email', 'Role', 'Status', 'Joined'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
                {SENAITE_USER_ROLES.map(role => (
                  <th key={role} title={`SENAITE role: ${role}`} style={{ textAlign: 'center', padding: '10px 8px', fontSize: 10, fontWeight: 600, color: '#6B7280', whiteSpace: 'nowrap', borderLeft: '1px solid #F3F4F6' }}>{role}</th>
                ))}
                <th style={{ padding: '10px 14px' }} />
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6 + SENAITE_USER_ROLES.length + 1} style={{ padding: '32px', textAlign: 'center', color: '#9CA3AF' }}>
                    No staff users yet — click "New User" to create one.
                  </td>
                </tr>
              ) : (
                users.map(u => {
                  const badge = ROLE_BADGE[u.role] ?? { bg: '#F3F4F6', color: '#374151' }
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: '#111827' }}>{u.full_name}</td>
                      <td style={{ padding: '10px 14px', color: '#6B7280' }}>{u.username}</td>
                      <td style={{ padding: '10px 14px', color: '#6B7280' }}>{u.email || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, backgroundColor: badge.bg, color: badge.color }}>
                          {STAFF_ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, backgroundColor: u.is_active ? '#ECFDF5' : '#FEF2F2', color: u.is_active ? '#065F46' : '#991B1B' }}>
                          {u.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#9CA3AF' }}>{fmtDate(u.date_joined)}</td>
                      {SENAITE_USER_ROLES.map(role => (
                        <td key={role} style={{ padding: '10px 8px', textAlign: 'center', borderLeft: '1px solid #F3F4F6' }}>
                          <input
                            type="checkbox"
                            checked={u.senaite_roles.includes(role)}
                            onChange={() => handleToggleSenaiteRole(u, role)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                      ))}
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setModal({ editing: u })} title="Edit"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6 }}>
                            <MI name="edit" size={14} color="#6B7280" />
                          </button>
                          <button onClick={() => handleToggleActive(u)} title={u.is_active ? 'Deactivate' : 'Activate'}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6 }}>
                            <MI name={u.is_active ? 'block' : 'check_circle'} size={14} color={u.is_active ? '#DC2626' : '#10B981'} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <UserModal
          editing={modal.editing}
          onClose={() => setModal(null)}
          onDone={async (msg) => { showToast(true, msg); await refresh(); setModal(null) }}
        />
      )}
    </div>
  )
}

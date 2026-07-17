'use client'
import { useActionState, useEffect } from 'react'
import {
  createStaffUser, updateStaffUser,
  type StaffUser, type StaffUserFormState,
} from '@/app/actions/users'
import { STAFF_ROLE_LABELS } from '@/app/lib/roles'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const ROLE_OPTIONS = Object.entries(STAFF_ROLE_LABELS) as [keyof typeof STAFF_ROLE_LABELS, string][]

export default function UserModal({
  editing,
  onClose,
  onDone,
}: {
  editing: StaffUser | null
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const initialState: StaffUserFormState = {}
  const [state, action, pending] = useActionState(
    async (prev: StaffUserFormState, formData: FormData) => {
      const result = editing
        ? await updateStaffUser(editing.id, prev, formData)
        : await createStaffUser(prev, formData)
      return result
    },
    initialState
  )

  useEffect(() => {
    if (state.success) {
      onDone(state.message ?? 'Saved.')
      onClose()
    }
  }, [state.success, state.message, onDone, onClose])

  const err = state.errors ?? {}

  return (
    <div
      onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1100 }}
    >
      <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', right: 0, bottom: 'var(--dashboard-footer-h)', width: 440, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
              <MI name="person_add" size={16} color="#0154FC" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{editing ? `Edit ${editing.username}` : 'New Staff User'}</h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>{editing ? 'Update role and profile details' : 'Create a staff account'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <MI name="close" size={16} color="#9CA3AF" />
          </button>
        </div>

        <form action={action} className="px-5 py-4 flex flex-col gap-3">
            {state.message && (
              <div className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
                {state.message}
              </div>
            )}

            {!editing && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                  Username <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <p className="mb-1" style={{ fontSize: 10.5, color: '#6B7280', lineHeight: 1.4 }}>
                  Usually something like &lsquo;jsmith&rsquo;. No spaces or special characters — this is the name used to log in, to both XelLabs and SENAITE.
                </p>
                <input
                  name="username"
                  defaultValue={editing ? (editing as StaffUser).username : ''}
                  placeholder="e.g. jane.analyst"
                  autoFocus
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                  style={{ border: `1px solid ${err.username ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
                />
                {err.username && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{err.username[0]}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>First Name</label>
                <input name="first_name" defaultValue={editing?.first_name ?? ''} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Last Name</label>
                <input name="last_name" defaultValue={editing?.last_name ?? ''} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Email</label>
              <p className="mb-1" style={{ fontSize: 10.5, color: '#6B7280', lineHeight: 1.4 }}>
                Used for account recovery and notifications. Not shared with any third party.
              </p>
              <input name="email" type="email" defaultValue={editing?.email ?? ''} placeholder="jane@xellabs.com" className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
            </div>

            {editing && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                  Role <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <p className="mb-1" style={{ fontSize: 10.5, color: '#6B7280', lineHeight: 1.4 }}>
                  Sets default permissions in XelLabs and the matching SENAITE group this user is added to (e.g. Analyst → SENAITE Analysts group).
                </p>
                <select
                  name="role"
                  defaultValue={editing?.role ?? 'analyst'}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                  style={{ border: `1px solid ${err.role ? '#EF4444' : '#D1D5DB'}`, color: '#111827', backgroundColor: '#fff' }}
                >
                  {ROLE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {err.role && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{err.role[0]}</p>}
              </div>
            )}

            {!editing && (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                    Password <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    name="password"
                    type="password"
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                    style={{ border: `1px solid ${err.password ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
                  />
                  {err.password && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{err.password[0]}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                    Confirm Password <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    name="confirm_password"
                    type="password"
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                    style={{ border: `1px solid ${err.confirm_password ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
                  />
                  {err.confirm_password && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{err.confirm_password[0]}</p>}
                </div>
                <div className="px-3 py-2.5 rounded-lg" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <p style={{ fontSize: 10.5, color: '#4B5563', lineHeight: 1.5 }}>
                    This account is also created in SENAITE with the same password, so it works for logging into both.
                    Role/permissions can be assigned afterward by editing this user.
                  </p>
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
              <button type="button" onClick={onClose} disabled={pending}
                style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={pending}
                className="flex items-center gap-1.5"
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}>
                <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
                {pending ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}
              </button>
            </div>
        </form>
      </div>
    </div>
  )
}

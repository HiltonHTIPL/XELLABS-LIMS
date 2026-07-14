'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { type SenaiteRefOption, type CreateRefOptionState } from '@/app/actions/reference-data'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

type Props = {
  title: string
  subtitle: string
  entityLabel: string
  icon: string
  initialItems: SenaiteRefOption[]
  createAction: (prev: CreateRefOptionState, formData: FormData) => Promise<CreateRefOptionState>
}

// Generic list + create page for a simple SENAITE setup reference list (name +
// optional description, no edit/delete — matches the existing Container
// Type/Sample Matrix precedent). Parameterized so Sample Containers,
// Preservations, and Sample Points each get a thin page.tsx instead of three
// near-duplicate components.
export default function ReferenceListShell({ title, subtitle, entityLabel, icon, initialItems, createAction }: Props) {
  const router = useRouter()
  const [showDrawer, setShowDrawer] = useState(false)
  const [items, setItems] = useState(initialItems)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState('')

  const [, action, pending] = useActionState(
    async (prev: CreateRefOptionState, fd: FormData) => {
      const result = await createAction(prev, fd)
      if (result.success && result.option) {
        setItems(prev => [...prev, result.option!])
        setShowDrawer(false)
        setName('')
        setDescription('')
        setToast({ ok: true, msg: result.message ?? `${entityLabel} created.` })
        setTimeout(() => setToast(null), 4000)
        router.refresh()
      } else if (result.message) {
        setNameError(result.message)
      }
      return result
    },
    {}
  )

  function openCreate() { setName(''); setDescription(''); setNameError(''); setShowDrawer(true) }
  function closeDrawer() { setShowDrawer(false) }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>{title}</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>{subtitle}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New {entityLabel}
        </button>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* ── Right Drawer ── */}
      <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, zIndex: 200, pointerEvents: showDrawer ? 'auto' : 'none' }}>
        <div onClick={closeDrawer} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showDrawer ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 400, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showDrawer ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>

          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
                <MI name="add" size={16} color="#0154FC" />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>New {entityLabel}</h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>Adds a lab-wide {entityLabel.toLowerCase()} option</p>
              </div>
            </div>
            <button onClick={closeDrawer} className="p-1.5 rounded-lg hover:bg-gray-100">
              <MI name="close" size={16} color="#9CA3AF" />
            </button>
          </div>

          <form action={action} className="flex-1 overflow-y-auto flex flex-col min-h-0">
            <div className="flex-1 px-5 py-4 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                  Name<span style={{ color: '#EF4444' }}> *</span>
                </label>
                <input
                  name="title"
                  value={name}
                  onChange={e => { setName(e.target.value); setNameError('') }}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                  style={{ border: `1px solid ${nameError ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
                />
                {nameError && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{nameError}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                  Description <span className="font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
                </label>
                <textarea
                  name="description"
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none"
                  style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                />
              </div>
            </div>

            <div className="px-5 py-4 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#fff' }}>
              <button type="button" onClick={closeDrawer} disabled={pending}
                style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={pending} className="flex items-center gap-1.5"
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}>
                <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
                {pending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Table / empty state */}
      {items.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name={icon} size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No {entityLabel.toLowerCase()}s yet</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New {entityLabel}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                <th className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>Name</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.uid} style={{ borderBottom: i < items.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                        <MI name={icon} size={13} color="#0154FC" />
                      </div>
                      <span className="text-xs font-medium" style={{ color: '#111827' }}>{item.title}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{items.length} {entityLabel.toLowerCase()}{items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

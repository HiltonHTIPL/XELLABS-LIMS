'use client'
import { useState, useActionState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { type SenaiteRefOption } from '@/app/lib/senaite'
import { type CreateRefOptionState, type ToggleRefOptionState } from '@/app/actions/reference-data'

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
  // Both optional — a consumer with neither still gets the original create-only
  // behavior (matches the Sample Containers precedent this shell was built from).
  updateAction?: (uid: string, prev: CreateRefOptionState, formData: FormData) => Promise<CreateRefOptionState>
  toggleActiveAction?: (uid: string, active: boolean) => Promise<ToggleRefOptionState>
}

// Generic list + create/edit page for a simple SENAITE setup reference list
// (name + optional description + active/inactive). Parameterized so Sample
// Points, Preservations, and Sampling Deviations each get a thin page.tsx
// instead of three near-duplicate components.
export default function ReferenceListShell({ title, subtitle, entityLabel, icon, initialItems, createAction, updateAction, toggleActiveAction }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showDrawer, setShowDrawer] = useState(false)
  const [items, setItems] = useState(initialItems)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [editing, setEditing] = useState<SenaiteRefOption | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState('')

  const isEditing = editing !== null

  const [, action, pending] = useActionState(
    async (prev: CreateRefOptionState, fd: FormData) => {
      const result = isEditing && updateAction
        ? await updateAction(editing.uid, prev, fd)
        : await createAction(prev, fd)
      if (result.success && result.option) {
        setItems(prev => isEditing
          ? prev.map(it => it.uid === result.option!.uid ? { ...it, ...result.option! } : it)
          : [...prev, result.option!])
        setShowDrawer(false)
        setEditing(null)
        setName('')
        setDescription('')
        setToast({ ok: true, msg: result.message ?? `${entityLabel} ${isEditing ? 'updated' : 'created'}.` })
        setTimeout(() => setToast(null), 4000)
        router.refresh()
      } else if (result.message) {
        setNameError(result.message)
      }
      return result
    },
    {}
  )

  function openCreate() { setEditing(null); setName(''); setDescription(''); setNameError(''); setShowDrawer(true) }
  function openEdit(item: SenaiteRefOption) {
    setEditing(item); setName(item.title); setDescription(item.description ?? ''); setNameError(''); setShowDrawer(true)
  }
  function closeDrawer() { setShowDrawer(false); setEditing(null) }

  function handleToggleActive(item: SenaiteRefOption) {
    if (!toggleActiveAction) return
    const nextActive = item.review_state !== 'active'
    startTransition(async () => {
      const result = await toggleActiveAction(item.url ?? '', nextActive)
      if (result.success) {
        setItems(prev => prev.map(it => it.uid === item.uid ? { ...it, review_state: nextActive ? 'active' : 'inactive' } : it))
        setToast({ ok: true, msg: result.message })
      } else {
        setToast({ ok: false, msg: result.message })
      }
      setTimeout(() => setToast(null), 4000)
      router.refresh()
    })
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-3" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="arrow_back" size={16} color="#6B7280" />
          </Link>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>{title}</h1>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.refresh()} disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: isPending ? 'not-allowed' : 'pointer' }}>
            <MI name="refresh" size={15} color="#6B7280" /> Refresh
          </button>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={15} color="#fff" /> New {entityLabel}
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, color: toast.ok ? '#0154FC' : '#991B1B', flexShrink: 0 }}>
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
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEditing ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEditing ? 'edit' : 'add'} size={16} color={isEditing ? '#2563EB' : '#0154FC'} />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEditing ? `Edit ${entityLabel}` : `New ${entityLabel}`}</h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>{isEditing ? `Updates this ${entityLabel.toLowerCase()} option` : `Adds a lab-wide ${entityLabel.toLowerCase()} option`}</p>
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
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: isEditing ? '#2563EB' : '#0154FC', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}>
                <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
                {pending ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Table / empty state — only this area scrolls; header above stays fixed. */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
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
                <th className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', width: '26%' }}>Name</th>
                <th className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>Description</th>
                <th className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', width: 100 }}>Status</th>
                <th className="px-3 py-2 text-right uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', width: 150 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const active = item.review_state !== 'inactive'
                return (
                  <tr key={item.uid} style={{ borderBottom: i < items.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                          <MI name={icon} size={13} color="#0154FC" />
                        </div>
                        <span className="text-xs font-medium" style={{ color: '#111827' }}>{item.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs" style={{ color: item.description ? '#6B7280' : '#D1D5DB' }}>
                        {item.description || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: active ? '#ECFDF5' : '#FFFBEB', color: active ? '#059669' : '#D97706' }}>
                        {active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openEdit(item)} title="Edit"
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium hover:bg-gray-50"
                          style={{ border: '1px solid #E8EAF2', background: '#fff', color: '#374151', cursor: 'pointer' }}>
                          <MI name="edit" size={13} color="#6B7280" /> Edit
                        </button>
                        {toggleActiveAction && (
                          <button onClick={() => handleToggleActive(item)} disabled={isPending} title={active ? 'Deactivate' : 'Activate'}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium hover:opacity-80"
                            style={{
                              border: `1px solid ${active ? '#FCA5A5' : '#A7F3D0'}`,
                              background: active ? '#FEF2F2' : '#ECFDF5',
                              color: active ? '#DC2626' : '#059669',
                              cursor: isPending ? 'not-allowed' : 'pointer',
                              opacity: isPending ? 0.6 : 1,
                            }}>
                            <MI name={active ? 'block' : 'check_circle'} size={13} color={active ? '#DC2626' : '#059669'} />
                            {active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{items.length} {entityLabel.toLowerCase()}{items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

'use client'
import { useState, useActionState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createContainerType, updateContainerType, type ContainerTypeFormState } from '@/app/actions/container-types'
import type { SenaiteContainerType } from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({
  label, name, placeholder, required, error, as, value, onChange,
}: {
  label: string; name: string; placeholder?: string
  required?: boolean; error?: string; as?: 'textarea'
  value: string; onChange: (v: string) => void
}) {
  const base = 'w-full px-3 py-2 text-xs rounded-lg outline-none'
  const style = { border: `1px solid ${error ? '#FCA5A5' : '#D1D5DB'}`, color: '#111827' }
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      {as === 'textarea'
        ? <textarea name={name} rows={4} placeholder={placeholder} value={value}
            onChange={e => onChange(e.target.value)} className={`${base} resize-none`} style={style} />
        : <input name={name} placeholder={placeholder} required={required}
            value={value} onChange={e => onChange(e.target.value)} className={base} style={style} />}
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

const initialState: ContainerTypeFormState = {}

export default function ContainerTypesShell({ initialContainerTypes }: { initialContainerTypes: SenaiteContainerType[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SenaiteContainerType | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const isEditing = editing !== null

  const [state, action, pending] = useActionState(
    async (prev: ContainerTypeFormState, formData: FormData) => {
      const uid = formData.get('_uid') as string | null
      const result = uid ? await updateContainerType(uid, prev, formData) : await createContainerType(prev, formData)
      if (result.success) {
        setShowForm(false); setEditing(null); setTitle(''); setDescription('')
        router.refresh()
      }
      return result
    },
    initialState
  )

  function openCreate() { setEditing(null); setTitle(''); setDescription(''); setShowForm(true) }
  function openEdit(ct: SenaiteContainerType) { setEditing(ct); setTitle(ct.title); setDescription(ct.description); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditing(null) }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <div className="flex items-center justify-between mb-3" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="arrow_back" size={16} color="#6B7280" />
          </Link>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Container Types</h1>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage sample container types</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New Container Type
        </button>
      </div>

      {/* Drawer */}
      <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', bottom: 'var(--dashboard-footer-h)', left: 0, right: 0, zIndex: 200, pointerEvents: showForm ? 'auto' : 'none' }}>
        <div onClick={closeForm} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showForm ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 420, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showForm ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>

          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEditing ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEditing ? 'edit' : 'add_box'} size={16} color={isEditing ? '#2563EB' : '#0154FC'} />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                {isEditing ? `Edit — ${editing.title}` : 'New Container Type'}
              </h2>
            </div>
            <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
          </div>

          <form ref={formRef} action={action} className="flex flex-col flex-1 min-h-0">
            {isEditing && <input type="hidden" name="_uid" value={editing.uid} />}
            <input type="hidden" name="title" value={title} />
            <input type="hidden" name="description" value={description} />

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <Field label="Name" name="title" placeholder="e.g. Amber Glass Bottle" required
                value={title} onChange={setTitle} error={state.errors?.title?.[0]} />
              <Field label="Description" name="description" as="textarea" placeholder="Optional description"
                value={description} onChange={setDescription} />
              {state.message && !state.success && (
                <p className="text-xs" style={{ color: '#DC2626' }}>{state.message}</p>
              )}
            </div>

            <div className="px-6 py-4 flex gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
              <button type="button" onClick={closeForm} className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium" style={{ border: '1px solid #D1D5DB', color: '#374151' }}>
                <MI name="close" size={13} color="#374151" /> Cancel
              </button>
              <div className="flex-1" />
              <button type="submit" disabled={pending}
                className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium text-white"
                style={{ backgroundColor: pending ? '#DBEAFE' : isEditing ? '#2563EB' : '#0154FC', cursor: pending ? 'not-allowed' : 'pointer' }}>
                <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
                {pending ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {state.success && (
        <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#DBEAFE', border: '1px solid #93C5FD', color: '#0154FC', flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <MI name="check_circle" size={13} color="#0154FC" /><span>{state.message}</span>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      {initialContainerTypes.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="inventory_2" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No container types yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create your first container type to get started</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Container Type
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '25%' }} /><col style={{ width: '65%' }} /><col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Description', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialContainerTypes.map((ct, i) => (
                <tr key={ct.uid} style={{ borderBottom: i < initialContainerTypes.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs font-medium truncate" style={{ color: '#111827' }}>{ct.title}</td>
                  <td className="px-3 py-2 text-xs truncate" style={{ color: '#6B7280' }}>{ct.description || '—'}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => openEdit(ct)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                      <MI name="edit" size={14} color="#6B7280" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialContainerTypes.length} container type{initialContainerTypes.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

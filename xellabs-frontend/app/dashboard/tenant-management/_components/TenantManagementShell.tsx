'use client'
import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { TenantDetail } from '@/app/actions/tenants'
import {
  createTenant, toggleTenantActive, uploadTenantLogo, removeTenantLogo,
  type TenantFormState,
} from '@/app/actions/tenants'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, lineHeight: 1, color }}>{name}</span>
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 12,
  border: '1px solid #E5E7EB', outline: 'none', color: '#111827',
}

export default function TenantManagementShell({ tenants }: { tenants: TenantDetail[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [state, formAction, pending] = useActionState<TenantFormState, FormData>(createTenant, {})
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state.success])

  return (
    <div className="p-5" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4" style={{ flexShrink: 0 }}>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: '#111827' }}>Tenant Management</h1>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            Lab organisations on the platform. Creating one provisions its workspace, portal address and admin account.
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white"
          style={{ backgroundColor: '#0154FC' }}
        >
          <MI name={showForm ? 'close' : 'add'} size={14} color="#fff" />
          {showForm ? 'Close' : 'New Organisation'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl p-4 mb-4" style={{ border: '1px solid #E8EAF2', flexShrink: 0 }}>
          <h2 className="text-xs font-semibold mb-3" style={{ color: '#374151' }}>Create Organisation</h2>

          {state.message && !state.success && (
            <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
              {state.message}
            </div>
          )}
          {state.success && (
            <div className="mb-3 px-3 py-2 rounded-lg text-xs space-y-1" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' }}>
              <p className="font-medium">{state.message}</p>
              {state.admin_username && (
                <p>
                  Admin login — username: <strong className="font-mono">{state.admin_username}</strong>{' '}
                  password: <strong className="font-mono">{state.admin_password}</strong>
                  <br />
                  <span style={{ color: '#B45309' }}>Copy these now — the password is shown only once.</span>
                </p>
              )}
            </div>
          )}

          <form ref={formRef} action={formAction} className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Organisation Name *</label>
              <input name="name" style={inputStyle} placeholder="Green Valley Labs" />
              {state.errors?.name && <p className="mt-1" style={{ fontSize: 10, color: '#DC2626' }}>{state.errors.name[0]}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Slug (portal address) *</label>
              <input name="slug" style={inputStyle} placeholder="greenvalley" />
              {state.errors?.slug && <p className="mt-1" style={{ fontSize: 10, color: '#DC2626' }}>{state.errors.slug[0]}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Email</label>
              <input name="email" type="email" style={inputStyle} placeholder="contact@lab.com" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Phone</label>
              <input name="phone" style={inputStyle} placeholder="+1 555 000 0000" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Address</label>
              <textarea name="address" rows={2} style={inputStyle} />
            </div>
            <div className="col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white"
                style={{ backgroundColor: pending ? '#93C5FD' : '#0154FC', cursor: pending ? 'not-allowed' : 'pointer' }}
              >
                {pending ? 'Creating…' : 'Create Organisation'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tenant table */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E8EAF2' }}>
              {['Logo', 'Organisation', 'Portal Address', 'Contact', 'Status', 'Created', 'Actions'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-semibold" style={{ fontSize: 11, color: '#6B7280' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenants.filter(t => t.schema_name !== 'public').map(t => (
              <TenantRow key={t.id} tenant={t} onChanged={() => router.refresh()} />
            ))}
            {tenants.filter(t => t.schema_name !== 'public').length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-xs" style={{ color: '#9CA3AF' }}>No organisations yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  )
}

function TenantRow({ tenant, onChanged }: { tenant: TenantDetail; onChanged: () => void }) {
  const [busy, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const primaryDomain = tenant.domains.find(d => !d.domain.endsWith('.localhost'))?.domain
    ?? tenant.domains[0]?.domain ?? `${tenant.slug}.xellabs.com`

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    startTransition(async () => {
      const fd = new FormData()
      fd.append('logo', file)
      await uploadTenantLogo(tenant.id, fd)
      onChanged()
    })
  }

  return (
    <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
      <td className="px-3 py-2">
        <div className="w-14 h-8 rounded flex items-center justify-center overflow-hidden" style={{ border: '1px dashed #E5E7EB', backgroundColor: '#FAFAFA' }}>
          {tenant.logo
            ? <img src={tenant.logo} alt="logo" className="max-w-full max-h-full object-contain" />
            : <MI name="image" size={14} color="#D1D5DB" />}
        </div>
      </td>
      <td className="px-3 py-2">
        <p className="text-xs font-medium" style={{ color: '#111827' }}>{tenant.name}</p>
        <p className="font-mono" style={{ fontSize: 10, color: '#9CA3AF' }}>{tenant.slug}</p>
      </td>
      <td className="px-3 py-2">
        <span className="font-mono" style={{ fontSize: 11, color: '#0369A1' }}>{primaryDomain}</span>
      </td>
      <td className="px-3 py-2 text-xs" style={{ color: '#6B7280' }}>
        {tenant.email || '—'}{tenant.phone ? ` · ${tenant.phone}` : ''}
      </td>
      <td className="px-3 py-2">
        <span className="font-semibold px-2 py-0.5 rounded-full" style={{ fontSize: 10, backgroundColor: tenant.is_active ? '#DBEAFE' : '#FEF2F2', color: tenant.is_active ? '#0154FC' : '#991B1B' }}>
          {tenant.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-3 py-2" style={{ fontSize: 10, color: '#9CA3AF' }}>
        {new Date(tenant.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
          <button
            title="Upload logo" disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="p-1.5 rounded-lg" style={{ border: '1px solid #E5E7EB', cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            <MI name="upload" size={13} color="#6B7280" />
          </button>
          {tenant.logo && (
            <button
              title="Remove logo" disabled={busy}
              onClick={() => startTransition(async () => { await removeTenantLogo(tenant.id); onChanged() })}
              className="p-1.5 rounded-lg" style={{ border: '1px solid #E5E7EB', cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              <MI name="hide_image" size={13} color="#DC2626" />
            </button>
          )}
          <button
            title={tenant.is_active ? 'Deactivate' : 'Activate'} disabled={busy}
            onClick={() => startTransition(async () => { await toggleTenantActive(tenant.id, !tenant.is_active); onChanged() })}
            className="p-1.5 rounded-lg"
            style={{ border: '1px solid #E5E7EB', cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            <MI name={tenant.is_active ? 'toggle_on' : 'toggle_off'} size={16} color={tenant.is_active ? '#0154FC' : '#9CA3AF'} />
          </button>
        </div>
      </td>
    </tr>
  )
}

'use client'
import { useState, useActionState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateTenant, uploadTenantLogo, removeTenantLogo,
  type TenantDetail, type TenantFormState,
} from '@/app/actions/tenants'
import {
  PageHeader, Card, Btn, Field, Toggle, EmptyState,
  thStyle, tdStyle, MI, T,
} from '@/app/dashboard/_components/ui'

function TenantModal({ tenant, onClose, onDone }: { tenant: TenantDetail; onClose: () => void; onDone: (msg: string) => void }) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isActive, setIsActive] = useState(tenant.is_active)
  const [logoUrl, setLogoUrl] = useState<string | null>(tenant.logo)
  const [logoBusy, setLogoBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const action = async (prev: TenantFormState, fd: FormData) => {
    fd.set('is_active', String(isActive))
    const result = await updateTenant(tenant.id, prev, fd)
    if (result.success) { onDone(result.message ?? 'Tenant updated.'); onClose() }
    return result
  }
  const [state, formAction, pending] = useActionState(action, {})

  useEffect(() => {
    if (state.errors) {
      const fe: Record<string, string> = {}
      for (const [k, msgs] of Object.entries(state.errors)) { if (msgs?.length) fe[k] = msgs[0] }
      setFieldErrors(fe)
    }
  }, [state])

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoBusy(true)
    const fd = new FormData()
    fd.set('logo', file)
    const res = await uploadTenantLogo(tenant.id, fd)
    if (res.logo) setLogoUrl(res.logo)
    setLogoBusy(false)
  }

  async function handleLogoRemove() {
    setLogoBusy(true)
    await removeTenantLogo(tenant.id)
    setLogoUrl(null)
    setLogoBusy(false)
  }

  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
              <MI name="domain" size={16} color={T.primary} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: T.heading }}>Edit — {tenant.name}</h2>
              <p style={{ fontSize: 10, color: T.faint }}>schema: {tenant.schema_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
            <MI name="close" size={16} color={T.faint} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center shrink-0" style={{ width: 56, height: 56, borderRadius: 12, border: `1px solid ${T.cardBorder}`, backgroundColor: '#FAFAFA', overflow: 'hidden' }}>
              {logoUrl
                ? <img src={logoUrl} alt={tenant.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <MI name="domain" size={24} color="#D1D5DB" />}
            </div>
            <div className="flex flex-col gap-1.5">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              <div className="flex items-center gap-2">
                <Btn type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={logoBusy} style={{ fontSize: 11, padding: '5px 10px' }}>
                  {logoBusy ? 'Uploading…' : 'Upload logo'}
                </Btn>
                {logoUrl && (
                  <Btn type="button" variant="ghost" onClick={handleLogoRemove} disabled={logoBusy} style={{ fontSize: 11, padding: '5px 10px' }}>
                    Remove
                  </Btn>
                )}
              </div>
              <p style={{ fontSize: 10, color: T.faint }}>PNG or JPG, shown on tenant login page</p>
            </div>
          </div>

          <form id="tenant-form" action={formAction} className="flex flex-col gap-3">
            <Field label="Tenant Name" required>
              <input name="name" defaultValue={tenant.name} required className="w-full outline-none bg-white"
                style={{ height: 36, borderRadius: 10, border: `1px solid ${fieldErrors.name ? T.danger : T.inputBorder}`, fontSize: 13, padding: '0 12px', color: T.text }} />
              {fieldErrors.name && <p className="mt-0.5" style={{ fontSize: 11, color: T.danger }}>{fieldErrors.name}</p>}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <input name="email" type="email" defaultValue={tenant.email} className="w-full outline-none bg-white"
                  style={{ height: 36, borderRadius: 10, border: `1px solid ${T.inputBorder}`, fontSize: 13, padding: '0 12px', color: T.text }} />
              </Field>
              <Field label="Phone">
                <input name="phone" defaultValue={tenant.phone} className="w-full outline-none bg-white"
                  style={{ height: 36, borderRadius: 10, border: `1px solid ${T.inputBorder}`, fontSize: 13, padding: '0 12px', color: T.text }} />
              </Field>
            </div>
            <Field label="Address">
              <textarea name="address" rows={2} defaultValue={tenant.address} className="w-full outline-none bg-white resize-none"
                style={{ borderRadius: 10, border: `1px solid ${T.inputBorder}`, fontSize: 13, padding: '10px 12px', color: T.text }} />
            </Field>
            <div className="flex items-center justify-between" style={{ padding: '8px 0' }}>
              <div>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>Active</p>
                <p style={{ fontSize: 10.5, color: T.faint }}>Inactive tenants cannot log in</p>
              </div>
              <Toggle checked={isActive} onChange={setIsActive} disabled={pending} />
            </div>
            {state.message && !state.success && (
              <p style={{ fontSize: 11.5, color: T.danger }}>{state.message}</p>
            )}
          </form>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
          <Btn type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Btn>
          <Btn type="submit" form="tenant-form" icon={pending ? 'hourglass_top' : 'check'} disabled={pending}>
            {pending ? 'Saving…' : 'Save Changes'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

export default function TenantsShell({ initialTenants }: { initialTenants: TenantDetail[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<TenantDetail | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  function handleDone(msg: string) {
    setToast({ ok: true, msg })
    setTimeout(() => setToast(null), 4000)
    router.refresh()
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <PageHeader
        title="Tenants"
        subtitle="Manage lab organisations provisioned on this platform"
      />

      <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
        style={{ backgroundColor: '#F1F5F9', border: `1px solid ${T.cardBorder}`, color: T.muted }}>
        <MI name="info" size={14} color={T.faint} />
        New tenants are provisioned via setup scripts — this page only lets you view and edit existing tenants.
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? T.primary : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? T.primary : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {editing && (
        <TenantModal tenant={editing} onClose={() => setEditing(null)} onDone={handleDone} />
      )}

      <Card pad={false}>
        {initialTenants.length === 0 ? (
          <EmptyState icon="domain" title="No tenants found" sub="Tenants are provisioned via setup scripts." />
        ) : (
          <>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Schema / Subdomain</th>
                  <th style={thStyle}>Domain</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {initialTenants.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50" style={{ cursor: 'pointer' }} onClick={() => setEditing(t)}>
                    <td style={tdStyle}>
                      <div className="flex items-center gap-2">
                        {t.logo
                          ? <img src={t.logo} alt={t.name} style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'contain', border: `1px solid ${T.cardBorder}` }} />
                          : <div className="flex items-center justify-center" style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: '#EFF6FF' }}>
                              <MI name="domain" size={14} color={T.primary} />
                            </div>}
                        <span style={{ fontWeight: 600, color: T.heading }}>{t.name}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span className="font-mono" style={{ fontSize: 12, backgroundColor: '#EFF6FF', color: T.primary, borderRadius: 999, padding: '2px 8px', fontWeight: 600 }}>
                        {t.schema_name}
                      </span>
                    </td>
                    <td style={tdStyle}>{t.domains?.[0]?.domain ?? '—'}</td>
                    <td style={tdStyle}>
                      <span className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, color: t.is_active ? T.primary : T.muted }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: t.is_active ? T.primary : '#9CA3AF', display: 'inline-block' }} />
                        {t.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={tdStyle}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</td>
                    <td style={tdStyle}>
                      <button onClick={e => { e.stopPropagation(); setEditing(t) }} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                        <MI name="edit" size={14} color={T.faint} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2" style={{ borderTop: `1px solid ${T.cardBorder}`, backgroundColor: T.tableHeadBg }}>
              <p style={{ fontSize: 10, color: T.faint }}>{initialTenants.length} tenant{initialTenants.length !== 1 ? 's' : ''}</p>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

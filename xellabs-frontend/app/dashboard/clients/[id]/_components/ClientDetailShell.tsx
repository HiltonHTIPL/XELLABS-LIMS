'use client'
import { useState, useRef, useActionState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { DjangoClient, ClientFormState } from '@/app/actions/clients'
import { updateClient } from '@/app/actions/clients'
import type { TenantDetail, TenantUser } from '@/app/actions/tenants'
import { uploadTenantLogo, removeTenantLogo } from '@/app/actions/tenants'

function MI({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const TABS = ['Overview', 'Domain & Tenant', 'Users', 'Branding'] as const
type Tab = typeof TABS[number]

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:        { bg: '#EFF6FF', text: '#1D4ED8' },
  lab_manager:  { bg: '#F0FDF4', text: '#15803D' },
  analyst:      { bg: '#FFFBEB', text: '#B45309' },
  reviewer:     { bg: '#FAF5FF', text: '#7C3AED' },
  client:       { bg: '#FFF7ED', text: '#C2410C' },
  receptionist: { bg: '#F0F9FF', text: '#0369A1' },
}

// ── Overview Tab ─────────────────────────────────────────────────────────────
function Field({ label, value, icon }: { label: string; value?: string; icon: string }) {
  return (
    <div className="flex items-center gap-2.5 py-2.5" style={{ borderBottom: '1px solid #F3F4F6' }}>
      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: '#F0FDFA' }}>
        <MI name={icon} size={13} color="#14B8A6" />
      </div>
      <div className="min-w-0 flex-1 flex items-center justify-between gap-4">
        <p className="text-xs font-medium shrink-0" style={{ color: '#9CA3AF', width: 120 }}>{label}</p>
        <p className="text-xs truncate" style={{ color: value ? '#111827' : '#D1D5DB' }}>{value || '—'}</p>
      </div>
    </div>
  )
}

function AddrBlock({ label, addr }: { label: string; addr: Record<string, string> | undefined }) {
  if (!addr || !Object.values(addr).some(v => v)) return null
  const line1 = addr.address || ''
  const line2 = [addr.city, addr.state, addr.zip].filter(Boolean).join(', ')
  const line3 = addr.country || ''
  return (
    <div>
      <p className="text-xs font-medium mb-0.5" style={{ color: '#9CA3AF' }}>{label}</p>
      {line1 && <p className="text-xs" style={{ color: '#111827' }}>{line1}</p>}
      {line2 && <p className="text-xs" style={{ color: '#111827' }}>{line2}</p>}
      {line3 && <p className="text-xs" style={{ color: '#111827' }}>{line3}</p>}
    </div>
  )
}

function SectionHead({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide pt-3 pb-1" style={{ color: '#374151', letterSpacing: '0.06em', borderTop: '1px solid #F3F4F6' }}>
      {label}
    </p>
  )
}

function OverviewTab({ client }: { client: DjangoClient }) {
  const contactName = [client.salutation, client.contact_first_name, client.contact_last_name].filter(Boolean).join(' ')
    || client.contact_person

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
      {/* Left column */}
      <div className="space-y-3">
        {/* Organisation */}
        <div className="bg-white rounded-xl px-4 py-2" style={{ border: '1px solid #E5E7EB' }}>
          <h2 className="text-xs font-semibold py-2" style={{ color: '#374151', borderBottom: '1px solid #F3F4F6' }}>Organisation</h2>
          <Field label="Email Address"  value={client.email}          icon="email" />
          <Field label="Phone"          value={client.phone}          icon="phone" />
          <Field label="Fax"            value={client.fax}            icon="fax" />
          <Field label="Mobile"         value={client.mobile}         icon="smartphone" />
          <Field label="Tax Number"     value={client.tax_number}     icon="receipt" />
          <Field label="Account No."    value={client.account_number} icon="tag" />
        </div>

        {/* Primary Contact */}
        <div className="bg-white rounded-xl px-4 py-2" style={{ border: '1px solid #E5E7EB' }}>
          <h2 className="text-xs font-semibold py-2" style={{ color: '#374151', borderBottom: '1px solid #F3F4F6' }}>Primary Contact</h2>
          <Field label="Name"       value={contactName || undefined}          icon="person" />
          <Field label="Job Title"  value={client.contact_job_title}          icon="work" />
          <Field label="Department" value={client.contact_department}         icon="corporate_fare" />
          <Field label="Email"      value={client.contact_email}              icon="email" />
          <Field label="Phone"      value={client.contact_phone}              icon="phone" />
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl px-4 py-3" style={{ border: '1px solid #E5E7EB' }}>
          <h2 className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>Notes / Remarks</h2>
          {client.remarks
            ? <p className="text-xs whitespace-pre-line" style={{ color: '#6B7280' }}>{client.remarks}</p>
            : <p className="text-xs" style={{ color: '#D1D5DB' }}>No remarks</p>}
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-3">
        {/* Addresses */}
        <div className="bg-white rounded-xl px-4 py-2" style={{ border: '1px solid #E5E7EB' }}>
          <h2 className="text-xs font-semibold py-2" style={{ color: '#374151', borderBottom: '1px solid #F3F4F6' }}>Addresses</h2>
          <div className="space-y-4 pt-2">
            <AddrBlock label="Physical Address" addr={client.physical_address as Record<string, string>} />
            <AddrBlock label="Postal Address"   addr={client.postal_address   as Record<string, string>} />
            <AddrBlock label="Billing Address"  addr={client.billing_address  as Record<string, string>} />
          </div>
          {!Object.values(client.physical_address ?? {}).some(v => v) &&
           !Object.values(client.postal_address   ?? {}).some(v => v) &&
           !Object.values(client.billing_address  ?? {}).some(v => v) && (
            <p className="py-2 text-xs" style={{ color: '#D1D5DB' }}>No addresses on file</p>
          )}
        </div>

        {/* Financial */}
        <div className="bg-white rounded-xl px-4 py-2" style={{ border: '1px solid #E5E7EB' }}>
          <h2 className="text-xs font-semibold py-2" style={{ color: '#374151', borderBottom: '1px solid #F3F4F6' }}>Financial</h2>
          <Field label="Bank Name"       value={client.bank_name}   icon="account_balance" />
          <Field label="Bank Branch"     value={client.bank_branch} icon="account_balance" />
          <Field label="SWIFT Code"      value={client.swift_code}  icon="swap_horiz" />
          <Field label="IBAN"            value={client.iban}        icon="credit_card" />
          <Field label="NIB"             value={client.nib}         icon="credit_card" />
          <Field label="Bulk Discount"   value={Number(client.bulk_discount)   > 0 ? `${client.bulk_discount}%`   : undefined} icon="percent" />
          <Field label="Member Discount" value={Number(client.member_discount) > 0 ? `${client.member_discount}%` : undefined} icon="percent" />
        </div>

      </div>
    </div>
  )
}

// ── Domain & Tenant Tab ───────────────────────────────────────────────────────
function DomainTab({ tenant }: { tenant: TenantDetail | null }) {
  if (!tenant) {
    return (
      <div className="bg-white rounded-xl p-8 flex flex-col items-center" style={{ border: '1px solid #E5E7EB' }}>
        <MI name="domain_disabled" size={32} color="#D1D5DB" />
        <p className="mt-2 text-xs font-medium" style={{ color: '#6B7280' }}>No tenant linked to this client</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {/* Tenant info card */}
      <div className="bg-white rounded-xl px-4 py-1" style={{ border: '1px solid #E5E7EB' }}>
        <h2 className="text-xs font-semibold py-2.5" style={{ color: '#374151', borderBottom: '1px solid #F3F4F6' }}>Tenant Details</h2>
        {[
          { label: 'Organisation Name', value: tenant.name,        icon: 'business' },
          { label: 'Schema Name',       value: tenant.schema_name, icon: 'storage' },
          { label: 'Slug',              value: tenant.slug,        icon: 'tag' },
          { label: 'Email',             value: tenant.email,       icon: 'email' },
          { label: 'Phone',             value: tenant.phone,       icon: 'phone' },
        ].map(f => <Field key={f.label} {...f} />)}
      </div>

      {/* Domains card */}
      <div className="bg-white rounded-xl px-4 py-1" style={{ border: '1px solid #E5E7EB' }}>
        <h2 className="text-xs font-semibold py-2.5" style={{ color: '#374151', borderBottom: '1px solid #F3F4F6' }}>
          Registered Domains
          <span className="ml-2 font-normal px-1.5 py-0.5 rounded" style={{ fontSize: 10, backgroundColor: '#F0FDFA', color: '#0D9488' }}>{tenant.domains.length}</span>
        </h2>
        {tenant.domains.length === 0 ? (
          <p className="py-3 text-xs" style={{ color: '#9CA3AF' }}>No domains registered</p>
        ) : (
          tenant.domains.map(d => (
            <div key={d.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #F9FAFB' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: '#F0FDFA' }}>
                  <MI name="language" size={13} color="#14B8A6" />
                </div>
                <span className="text-xs font-mono" style={{ color: '#111827' }}>{d.domain}</span>
              </div>
              {d.is_primary && (
                <span className="font-semibold px-2 py-0.5 rounded-full" style={{ fontSize: 10, backgroundColor: '#ECFDF5', color: '#065F46' }}>Primary</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab({ users }: { users: TenantUser[] }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <h2 className="text-xs font-semibold" style={{ color: '#374151' }}>
          Users
          <span className="ml-2 font-normal px-1.5 py-0.5 rounded" style={{ fontSize: 10, backgroundColor: '#F0FDFA', color: '#0D9488' }}>{users.length}</span>
        </h2>
      </div>
      {users.length === 0 ? (
        <div className="py-10 flex flex-col items-center">
          <MI name="group" size={32} color="#D1D5DB" />
          <p className="mt-2 text-xs font-medium" style={{ color: '#6B7280' }}>No users assigned to this tenant</p>
        </div>
      ) : (
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#FAFAFA' }}>
              {['User', 'Role', 'Email', 'Status', 'Joined'].map(h => (
                <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', borderBottom: '1px solid #F3F4F6' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => {
              const rc = ROLE_COLORS[u.role] ?? { bg: '#F3F4F6', text: '#374151' }
              return (
                <tr key={u.id} className="hover:bg-gray-50" style={{ borderBottom: i < users.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 10, backgroundColor: '#14B8A6' }}>
                        {(u.full_name || u.username).slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-medium" style={{ color: '#111827' }}>{u.full_name || u.username}</p>
                        <p style={{ fontSize: 10, color: '#9CA3AF' }}>@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-semibold px-2 py-0.5 rounded-full capitalize" style={{ fontSize: 10, backgroundColor: rc.bg, color: rc.text }}>{u.role.replace('_', ' ')}</span>
                  </td>
                  <td className="px-3 py-2 text-xs" style={{ color: '#6B7280' }}>{u.email || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="font-semibold px-2 py-0.5 rounded-full" style={{ fontSize: 10, backgroundColor: u.is_active ? '#ECFDF5' : '#FEF2F2', color: u.is_active ? '#065F46' : '#991B1B' }}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2" style={{ fontSize: 10, color: '#9CA3AF' }}>
                    {new Date(u.date_joined).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Branding Tab ──────────────────────────────────────────────────────────────
function BrandingTab({ tenant, clientId }: { tenant: TenantDetail | null; clientId: number }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(tenant?.logo ?? null)
  const [error, setError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !tenant) return
    setError('')
    setPreview(URL.createObjectURL(file))
    setUploading(true)
    const fd = new FormData()
    fd.append('logo', file)
    const result = await uploadTenantLogo(tenant.id, fd)
    setUploading(false)
    if (result.error) { setError(result.error); setPreview(tenant.logo) }
    else { router.refresh() }
  }

  async function handleRemove() {
    if (!tenant) return
    setUploading(true)
    await removeTenantLogo(tenant.id)
    setPreview(null)
    setUploading(false)
    router.refresh()
  }

  if (!tenant) {
    return (
      <div className="bg-white rounded-xl p-8 flex flex-col items-center" style={{ border: '1px solid #E5E7EB' }}>
        <MI name="palette" size={32} color="#D1D5DB" />
        <p className="mt-2 text-xs font-medium" style={{ color: '#6B7280' }}>No tenant linked — branding unavailable</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Logo card */}
      <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #E5E7EB' }}>
        <h2 className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>White-Label Logo</h2>
        <p style={{ fontSize: 10, color: '#6B7280', marginBottom: 12 }}>
          PNG or SVG, min 200×60 px, transparent background.
        </p>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>{error}</div>
        )}

        <div className="flex items-center gap-4">
          {/* Logo preview */}
          <div
            className="w-40 h-20 rounded-lg flex items-center justify-center overflow-hidden shrink-0"
            style={{ border: '2px dashed #E5E7EB', backgroundColor: '#FAFAFA' }}
          >
            {preview ? (
              <img src={preview} alt="Tenant logo" className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-1">
                <MI name="image" size={22} color="#D1D5DB" />
                <span style={{ fontSize: 10, color: '#9CA3AF' }}>No logo yet</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: uploading ? '#99F6E4' : '#14B8A6', cursor: uploading ? 'not-allowed' : 'pointer' }}
            >
              <MI name="upload" size={13} color="#fff" />
              {uploading ? 'Uploading…' : preview ? 'Replace Logo' : 'Upload Logo'}
            </button>
            {preview && (
              <button
                onClick={handleRemove}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ border: '1px solid #FECACA', color: '#DC2626', cursor: uploading ? 'not-allowed' : 'pointer' }}
              >
                <MI name="delete" size={13} color="#DC2626" />
                Remove Logo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subdomain info */}
      <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #E5E7EB' }}>
        <h2 className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>Subdomain</h2>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
          <MI name="link" size={13} color="#14B8A6" />
          <span className="text-xs font-mono" style={{ color: '#374151' }}>{tenant.slug}.xellabs.com</span>
          <span className="ml-auto font-medium px-2 py-0.5 rounded" style={{ fontSize: 10, backgroundColor: '#FFF7ED', color: '#C2410C' }}>Pending DNS</span>
        </div>
        <p className="mt-1.5" style={{ fontSize: 10, color: '#9CA3AF' }}>
          Point a CNAME record for <strong>{tenant.slug}.xellabs.com</strong> to your server to activate the client portal.
        </p>
      </div>
    </div>
  )
}

// ── Inline Edit Drawer ────────────────────────────────────────────────────────
function EditField({
  label, name, type = 'text', placeholder, defaultValue, as,
}: {
  label: string; name: string; type?: string; placeholder?: string; defaultValue?: string; as?: 'textarea'
}) {
  const base = 'w-full px-2.5 py-1.5 text-xs rounded-lg outline-none'
  const border = { border: '1px solid #D1D5DB', color: '#111827' }
  return (
    <div>
      <label className="block text-xs font-medium mb-0.5" style={{ color: '#374151' }}>{label}</label>
      {as === 'textarea'
        ? <textarea name={name} rows={3} placeholder={placeholder} defaultValue={defaultValue} className={`${base} resize-none`} style={border} />
        : <input name={name} type={type} placeholder={placeholder} defaultValue={defaultValue} className={base} style={border} />}
    </div>
  )
}

function EditRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>{children}</div>
}

function EditAddrSection({ prefix, label, addr }: { prefix: string; label: string; addr?: Record<string, string> }) {
  return (
    <div className="space-y-2 p-3 rounded-lg" style={{ backgroundColor: '#FAFAFA', border: '1px solid #E5E7EB' }}>
      <p className="text-xs font-semibold" style={{ color: '#374151' }}>{label}</p>
      <EditField label="Street" name={`${prefix}_street`} placeholder="123 Main St" defaultValue={addr?.address} />
      <EditRow>
        <EditField label="City"    name={`${prefix}_city`}    placeholder="City"    defaultValue={addr?.city} />
        <EditField label="State"   name={`${prefix}_state`}   placeholder="State"   defaultValue={addr?.state} />
      </EditRow>
      <EditRow>
        <EditField label="ZIP"     name={`${prefix}_zip`}     placeholder="00000"   defaultValue={addr?.zip} />
        <EditField label="Country" name={`${prefix}_country`} placeholder="Country" defaultValue={addr?.country} />
      </EditRow>
    </div>
  )
}

function EditDrawer({ client, onClose }: { client: DjangoClient; onClose: () => void }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(
    async (prev: ClientFormState, formData: FormData) => {
      const result = await updateClient(client.id, prev, formData)
      if (result.success) { onClose(); router.refresh() }
      return result
    },
    {}
  )
  const phys = client.physical_address as Record<string, string> | undefined
  const post = client.postal_address   as Record<string, string> | undefined
  const bill = client.billing_address  as Record<string, string> | undefined

  return (
    <div style={{ position: 'fixed', top: 56, bottom: 40, left: 0, right: 0, zIndex: 200 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} />
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 540,
        backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
              <MI name="edit" size={14} color="#2563EB" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Edit Client</h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>{client.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={15} color="#9CA3AF" /></button>
        </div>

        {state.message && !state.success && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg text-xs shrink-0" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
            {state.message}
          </div>
        )}

        <form action={action} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Basic */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Basic Info</p>
              <div className="space-y-2">
                <EditRow>
                  <EditField label="Client Name *" name="name" placeholder="e.g. Green Valley Farms" defaultValue={client.name} />
                  <EditField label="Client ID *"   name="client_id" placeholder="e.g. CL-001"         defaultValue={client.client_id} />
                </EditRow>
                <EditRow>
                  <EditField label="Email"  name="email"  type="email" placeholder="contact@client.com" defaultValue={client.email} />
                  <EditField label="Phone"  name="phone"               placeholder="+1 555 000 0000"    defaultValue={client.phone} />
                </EditRow>
                <EditRow>
                  <EditField label="Fax"    name="fax"    placeholder="+1 555 000 0001" defaultValue={client.fax} />
                  <EditField label="Mobile" name="mobile" placeholder="+1 555 000 0002" defaultValue={client.mobile} />
                </EditRow>
                <EditRow>
                  <EditField label="Tax Number"     name="tax_number"     placeholder="VAT / Tax" defaultValue={client.tax_number} />
                  <EditField label="Account Number" name="account_number" placeholder="Billing account no." defaultValue={client.account_number} />
                </EditRow>
              </div>
            </div>

            {/* Contact */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Primary Contact</p>
              <div className="space-y-2">
                <div className="grid gap-3" style={{ gridTemplateColumns: '90px 1fr 1fr' }}>
                  <div>
                    <label className="block text-xs font-medium mb-0.5" style={{ color: '#374151' }}>Salutation</label>
                    <select name="salutation" defaultValue={client.salutation} className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                      <option value="">—</option>
                      {['Mr','Mrs','Ms','Dr','Prof'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <EditField label="First Name" name="contact_first_name" placeholder="First name" defaultValue={client.contact_first_name} />
                  <EditField label="Last Name"  name="contact_last_name"  placeholder="Last name"  defaultValue={client.contact_last_name} />
                </div>
                <EditRow>
                  <EditField label="Contact Email" name="contact_email" type="email" placeholder="person@client.com" defaultValue={client.contact_email} />
                  <EditField label="Contact Phone" name="contact_phone"               placeholder="+1 555 000 0003"   defaultValue={client.contact_phone} />
                </EditRow>
                <EditRow>
                  <EditField label="Job Title"  name="contact_job_title"  placeholder="e.g. Lab Director"     defaultValue={client.contact_job_title} />
                  <EditField label="Department" name="contact_department" placeholder="e.g. Quality Assurance" defaultValue={client.contact_department} />
                </EditRow>
              </div>
            </div>

            {/* Addresses */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Addresses</p>
              <div className="space-y-2">
                <EditAddrSection prefix="physical" label="Physical Address" addr={phys} />
                <EditAddrSection prefix="postal"   label="Postal Address"   addr={post} />
                <EditAddrSection prefix="billing"  label="Billing Address"  addr={bill} />
              </div>
            </div>

            {/* Financial */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Financial</p>
              <div className="space-y-2">
                <EditRow>
                  <EditField label="Bank Name"   name="bank_name"   placeholder="Bank name"   defaultValue={client.bank_name} />
                  <EditField label="Bank Branch" name="bank_branch" placeholder="Branch name" defaultValue={client.bank_branch} />
                </EditRow>
                <EditRow>
                  <EditField label="SWIFT Code" name="swift_code" placeholder="e.g. AAAABBCC" defaultValue={client.swift_code} />
                  <EditField label="IBAN"       name="iban"       placeholder="e.g. GB29..."  defaultValue={client.iban} />
                </EditRow>
                <EditRow>
                  <EditField label="NIB"                name="nib"           placeholder="NIB"   defaultValue={client.nib} />
                  <EditField label="Bulk Discount (%)"  name="bulk_discount"   type="number" placeholder="0" defaultValue={client.bulk_discount} />
                </EditRow>
                <EditRow>
                  <EditField label="Member Discount (%)" name="member_discount" type="number" placeholder="0" defaultValue={client.member_discount} />
                  <div />
                </EditRow>
              </div>
            </div>

            {/* Notes */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Notes</p>
              <EditField label="Remarks" name="remarks" as="textarea" placeholder="Any additional notes…" defaultValue={client.remarks} />
            </div>

          </div>

          {/* Footer */}
          <div className="px-5 py-3 flex gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button type="button" onClick={onClose} className="px-4 py-1.5 text-xs rounded-lg font-medium" style={{ border: '1px solid #D1D5DB', color: '#374151' }}>
              Cancel
            </button>
            <div className="flex-1" />
            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg font-medium text-white"
              style={{ backgroundColor: pending ? '#93C5FD' : '#2563EB', cursor: pending ? 'not-allowed' : 'pointer' }}
            >
              <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
              {pending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Shell ─────────────────────────────────────────────────────────────────────
export default function ClientDetailShell({
  client, tenant, users,
}: {
  client: DjangoClient
  tenant: TenantDetail | null
  users: TenantUser[]
}) {
  const [tab, setTab] = useState<Tab>('Overview')
  const [showEdit, setShowEdit] = useState(false)

  const createdDate = new Date(client.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const initials = client.name.slice(0, 2).toUpperCase()

  return (
    <div style={{ padding: '12px 20px 0', backgroundColor: '#F5F6FA', minHeight: '100%' }}>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-3">
        <Link
          href="/dashboard/clients"
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg"
          style={{ color: '#6B7280', backgroundColor: '#fff', border: '1px solid #E5E7EB' }}
        >
          <MI name="arrow_back" size={13} color="#6B7280" />
          Clients
        </Link>
        <span style={{ color: '#D1D5DB', fontSize: 12 }}>/</span>
        <span className="text-xs font-medium" style={{ color: '#111827' }}>{client.name}</span>
      </div>

      {/* Top identity card */}
      <div className="bg-white rounded-xl p-4 mb-3 flex items-center gap-4" style={{ border: '1px solid #E5E7EB' }}>
        {/* Avatar or logo */}
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold shrink-0 overflow-hidden"
          style={{ fontSize: 16, backgroundColor: '#14B8A6' }}
        >
          {tenant?.logo
            ? <img src={tenant.logo} alt="logo" className="w-full h-full object-contain" />
            : initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold" style={{ color: '#111827' }}>{client.name}</h1>
            {client.client_id && (
              <span className="font-mono px-2 py-0.5 rounded" style={{ fontSize: 10, backgroundColor: '#F0FDFA', color: '#0D9488' }}>{client.client_id}</span>
            )}
            <span
              className="font-semibold px-2 py-0.5 rounded-full"
              style={{ fontSize: 10, backgroundColor: client.is_active ? '#ECFDF5' : '#FEF2F2', color: client.is_active ? '#065F46' : '#991B1B' }}
            >
              {client.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>Added {createdDate}</p>
          {tenant && (
            <p className="flex items-center gap-1" style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>
              <MI name="business" size={11} color="#14B8A6" />
              {tenant.name} · <span className="font-mono">{tenant.schema_name}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right mr-3">
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>Users</p>
            <p className="text-xl font-bold" style={{ color: '#111827' }}>{users.length}</p>
          </div>
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ backgroundColor: '#2563EB' }}
          >
            <MI name="edit" size={13} color="#fff" />
            Edit
          </button>
        </div>
      </div>

      {showEdit && <EditDrawer client={client} onClose={() => setShowEdit(false)} />}

      {/* Tabs */}
      <div className="flex gap-0.5 mb-3 p-1 rounded-lg w-fit" style={{ backgroundColor: '#E5E7EB' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-1 rounded-md text-xs font-medium transition-all"
            style={{
              backgroundColor: tab === t ? '#fff' : 'transparent',
              color: tab === t ? '#111827' : '#6B7280',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Overview'        && <OverviewTab client={client} />}
      {tab === 'Domain & Tenant' && <DomainTab tenant={tenant} />}
      {tab === 'Users'           && <UsersTab users={users} />}
      {tab === 'Branding'        && <BrandingTab tenant={tenant} clientId={client.id} />}
    </div>
  )
}

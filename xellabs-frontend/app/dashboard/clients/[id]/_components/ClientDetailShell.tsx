'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { DjangoClient } from '@/app/actions/clients'
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
    <div className="space-y-3">
      {/* Organisation contact */}
      <div className="bg-white rounded-xl px-4 py-2" style={{ border: '1px solid #E5E7EB' }}>
        <h2 className="text-xs font-semibold py-2" style={{ color: '#374151', borderBottom: '1px solid #F3F4F6' }}>Organisation</h2>
        <Field label="Email Address" value={client.email}  icon="email" />
        <Field label="Phone"         value={client.phone}  icon="phone" />
        {client.fax    && <Field label="Fax"    value={client.fax}    icon="fax" />}
        {client.mobile && <Field label="Mobile" value={client.mobile} icon="smartphone" />}
        {client.tax_number     && <Field label="Tax Number"    value={client.tax_number}    icon="receipt" />}
        {client.account_number && <Field label="Account No."  value={client.account_number} icon="tag" />}
      </div>

      {/* Primary contact person */}
      {contactName && (
        <div className="bg-white rounded-xl px-4 py-2" style={{ border: '1px solid #E5E7EB' }}>
          <h2 className="text-xs font-semibold py-2" style={{ color: '#374151', borderBottom: '1px solid #F3F4F6' }}>Primary Contact</h2>
          <Field label="Name"       value={contactName}               icon="person" />
          {client.contact_job_title   && <Field label="Job Title"   value={client.contact_job_title}   icon="work" />}
          {client.contact_department  && <Field label="Department"  value={client.contact_department}  icon="corporate_fare" />}
          {client.contact_email       && <Field label="Email"       value={client.contact_email}       icon="email" />}
          {client.contact_phone       && <Field label="Phone"       value={client.contact_phone}       icon="phone" />}
        </div>
      )}

      {/* Addresses */}
      {(Object.values(client.physical_address ?? {}).some(v => v) ||
        Object.values(client.postal_address   ?? {}).some(v => v) ||
        Object.values(client.billing_address  ?? {}).some(v => v)) && (
        <div className="bg-white rounded-xl px-4 py-2" style={{ border: '1px solid #E5E7EB' }}>
          <h2 className="text-xs font-semibold py-2" style={{ color: '#374151', borderBottom: '1px solid #F3F4F6' }}>Addresses</h2>
          <div className="grid gap-4 pt-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <AddrBlock label="Physical"  addr={client.physical_address as Record<string, string>} />
            <AddrBlock label="Postal"    addr={client.postal_address   as Record<string, string>} />
            <AddrBlock label="Billing"   addr={client.billing_address  as Record<string, string>} />
          </div>
        </div>
      )}

      {/* Financial */}
      {(client.bank_name || client.swift_code || client.iban || Number(client.bulk_discount) > 0) && (
        <div className="bg-white rounded-xl px-4 py-2" style={{ border: '1px solid #E5E7EB' }}>
          <h2 className="text-xs font-semibold py-2" style={{ color: '#374151', borderBottom: '1px solid #F3F4F6' }}>Financial</h2>
          {client.bank_name   && <Field label="Bank"         value={`${client.bank_name}${client.bank_branch ? ' — ' + client.bank_branch : ''}`} icon="account_balance" />}
          {client.swift_code  && <Field label="SWIFT"        value={client.swift_code}  icon="swap_horiz" />}
          {client.iban        && <Field label="IBAN"         value={client.iban}        icon="credit_card" />}
          {client.nib         && <Field label="NIB"          value={client.nib}         icon="credit_card" />}
          {Number(client.bulk_discount) > 0   && <Field label="Bulk Discount"   value={`${client.bulk_discount}%`}   icon="percent" />}
          {Number(client.member_discount) > 0 && <Field label="Member Discount" value={`${client.member_discount}%`} icon="percent" />}
        </div>
      )}

      {/* Remarks */}
      {client.remarks && (
        <div className="bg-white rounded-xl px-4 py-3" style={{ border: '1px solid #E5E7EB' }}>
          <h2 className="text-xs font-semibold mb-1.5" style={{ color: '#374151' }}>Notes</h2>
          <p className="text-xs whitespace-pre-line" style={{ color: '#6B7280' }}>{client.remarks}</p>
        </div>
      )}

      {/* SENAITE sync badge */}
      {client.senaite_uid && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1' }}>
          <MI name="sync" size={13} color="#0D9488" />
          <p style={{ fontSize: 10, color: '#0D9488' }}>Synced to SENAITE — UID: <span className="font-mono">{client.senaite_uid}</span></p>
        </div>
      )}
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

// ── Shell ─────────────────────────────────────────────────────────────────────
export default function ClientDetailShell({
  client, tenant, users,
}: {
  client: DjangoClient
  tenant: TenantDetail | null
  users: TenantUser[]
}) {
  const [tab, setTab] = useState<Tab>('Overview')

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
        <div className="text-right shrink-0">
          <p style={{ fontSize: 10, color: '#9CA3AF' }}>Users</p>
          <p className="text-xl font-bold" style={{ color: '#111827' }}>{users.length}</p>
        </div>
      </div>

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

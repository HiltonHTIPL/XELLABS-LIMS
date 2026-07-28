'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toggleSenaiteClientActive } from '@/app/actions/senaite-clients'
import type { SenaiteClientFull, SenaiteAddress } from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', width: 150, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#111827' }}>{value || '—'}</span>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #E8EAF2' }}>
      <div className="flex items-center gap-2 mb-3">
        <MI name={icon} size={16} color="#0154FC" />
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#14265E' }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

function fmtAddress(a: SenaiteAddress | null): string {
  if (!a) return ''
  return [a.address, a.city, a.state, a.zip, a.country].filter(Boolean).join(', ')
}

export default function ClientDetailShell({ client }: { client: SenaiteClientFull }) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const active = client.review_state === 'active'
  const ct = client.contact
  const contactName = [ct?.Salutation, ct?.Firstname, ct?.Surname].filter(Boolean).join(' ')

  function toggle() {
    startTransition(async () => {
      const res = await toggleSenaiteClientActive(client.uid, !active)
      setToast({ ok: res.success, msg: res.message })
      setTimeout(() => setToast(null), 4000)
      if (res.success) router.refresh()
    })
  }

  return (
    <div style={{ padding: 20, minHeight: '100%' }}>
      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/clients" className="p-1.5 rounded-lg hover:bg-gray-100" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="arrow_back" size={16} color="#374151" />
          </Link>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ fontSize: 16, backgroundColor: '#0154FC' }}>
            {client.title.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>{client.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {client.ClientID && <span className="font-mono" style={{ fontSize: 11, color: '#374151' }}>{client.ClientID}</span>}
              <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: active ? '#ECFDF5' : '#FFFBEB', color: active ? '#059669' : '#D97706' }}>
                {active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
        <button onClick={toggle} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
          style={{ border: `1px solid ${active ? '#FCA5A5' : '#93C5FD'}`, color: active ? '#DC2626' : '#0154FC', backgroundColor: '#fff', cursor: busy ? 'not-allowed' : 'pointer' }}>
          <MI name={active ? 'block' : 'check_circle'} size={14} color={active ? '#DC2626' : '#0154FC'} />
          {busy ? 'Updating…' : active ? 'Deactivate' : 'Activate'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Section title="Organisation" icon="business">
          <InfoRow label="Client Name" value={client.title} />
          <InfoRow label="Client ID" value={client.ClientID} />
          <InfoRow label="Email" value={client.EmailAddress} />
          <InfoRow label="Phone" value={client.Phone} />
          <InfoRow label="Fax" value={client.Fax} />
          <InfoRow label="Tax Number" value={client.TaxNumber} />
          <InfoRow label="CC Emails" value={client.CCEmails} />
        </Section>

        <Section title="Primary Contact" icon="person">
          {ct ? (
            <>
              <InfoRow label="Name" value={contactName} />
              <InfoRow label="Email" value={ct.EmailAddress} />
              <InfoRow label="Business Phone" value={ct.BusinessPhone} />
              <InfoRow label="Mobile" value={ct.MobilePhone} />
              <InfoRow label="Fax" value={ct.Fax} />
              <InfoRow label="Job Title" value={ct.JobTitle} />
              <InfoRow label="Department" value={ct.Department} />
            </>
          ) : <p style={{ fontSize: 12, color: '#374151' }}>No primary contact on file.</p>}
        </Section>

        <Section title="Addresses" icon="location_on">
          <InfoRow label="Physical" value={fmtAddress(client.PhysicalAddress)} />
          <InfoRow label="Postal" value={fmtAddress(client.PostalAddress)} />
          <InfoRow label="Billing" value={fmtAddress(client.BillingAddress)} />
        </Section>

        <Section title="Financial" icon="account_balance">
          <InfoRow label="Account Name" value={client.AccountName} />
          <InfoRow label="Account Number" value={client.AccountNumber} />
          <InfoRow label="Account Type" value={client.AccountType} />
          <InfoRow label="Bank Name" value={client.BankName} />
          <InfoRow label="Bank Branch" value={client.BankBranch} />
          <InfoRow label="Bulk Discount" value={client.BulkDiscount ? 'Yes' : 'No'} />
          <InfoRow label="Member Discount" value={client.MemberDiscountApplies ? 'Yes' : 'No'} />
          <InfoRow label="Decimal Mark" value={client.DecimalMark} />
        </Section>

        {client.description && (
          <div className="col-span-2">
            <Section title="Remarks" icon="notes">
              <p style={{ fontSize: 12, color: '#111827', whiteSpace: 'pre-wrap' }}>{client.description}</p>
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}

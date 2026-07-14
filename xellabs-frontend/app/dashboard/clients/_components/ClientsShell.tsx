'use client'
import { useState, useActionState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createSenaiteClient, updateSenaiteClient, toggleSenaiteClientActive,
  type ClientFormState, type SenaiteClientFull,
} from '@/app/actions/senaite-clients'
import { StatCard, Pagination, EmptyState } from '@/app/dashboard/_components/ui'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

// ── Controlled field ──────────────────────────────────────────────────────────
function Field({ label, name, type = 'text', placeholder, required, error, as, value, onChange }: {
  label: string; name: string; type?: string; placeholder?: string
  required?: boolean; error?: string; as?: 'textarea'
  value: string; onChange: (v: string) => void
}) {
  const base = 'w-full px-3 py-2 text-xs rounded-lg outline-none'
  const style = { border: `1px solid ${error ? '#FCA5A5' : '#D1D5DB'}`, color: '#111827' }
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      {as === 'textarea'
        ? <textarea name={name} rows={4} placeholder={placeholder} value={value}
            onChange={e => onChange(e.target.value)} className={`${base} resize-none`} style={style} />
        : <input name={name} type={type} placeholder={placeholder} value={value}
            onChange={e => onChange(e.target.value)} className={base} style={style} />}
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3">{children}</div>
}

function AddressBlock({ prefix, label, vals, set }: {
  prefix: string; label: string; vals: FV; set: (k: string, v: string) => void
}) {
  return (
    <div className="space-y-2.5 rounded-xl p-4" style={{ border: '1px solid #E8EAF2', backgroundColor: '#FAFAFA' }}>
      <p className="text-xs font-semibold" style={{ color: '#374151' }}>{label}</p>
      <Field label="Street / Address" name={`${prefix}_street`} placeholder="123 Main Street" value={vals[`${prefix}_street`] ?? ''} onChange={v => set(`${prefix}_street`, v)} />
      <Row>
        <Field label="City" name={`${prefix}_city`} placeholder="City" value={vals[`${prefix}_city`] ?? ''} onChange={v => set(`${prefix}_city`, v)} />
        <Field label="State / Province" name={`${prefix}_state`} placeholder="State" value={vals[`${prefix}_state`] ?? ''} onChange={v => set(`${prefix}_state`, v)} />
      </Row>
      <Row>
        <Field label="ZIP / Postal" name={`${prefix}_zip`} placeholder="00000" value={vals[`${prefix}_zip`] ?? ''} onChange={v => set(`${prefix}_zip`, v)} />
        <Field label="Country" name={`${prefix}_country`} placeholder="Country" value={vals[`${prefix}_country`] ?? ''} onChange={v => set(`${prefix}_country`, v)} />
      </Row>
    </div>
  )
}

const STEPS = [
  { label: 'Basic Info', icon: 'business' },
  { label: 'Contact', icon: 'person' },
  { label: 'Addresses', icon: 'location_on' },
  { label: 'Financial', icon: 'account_balance' },
  { label: 'Notes', icon: 'notes' },
] as const

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0 mb-5">
      {STEPS.map((s, i) => {
        const done = i < step; const active = i === step; const isLast = i === STEPS.length - 1
        return (
          <div key={s.label} className="flex items-center flex-1">
            <div className="flex flex-col items-center" style={{ minWidth: 56 }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: done ? '#0154FC' : active ? '#DBEAFE' : '#F3F4F6', border: (active || done) ? '2px solid #0154FC' : '2px solid #E5E7EB' }}>
                {done ? <MI name="check" size={14} color="#fff" /> : <MI name={s.icon} size={13} color={active ? '#0154FC' : '#9CA3AF'} />}
              </div>
              <span className="mt-1 text-center" style={{ fontSize: 9, fontWeight: active ? 600 : 400, color: (active || done) ? '#0154FC' : '#9CA3AF', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
            {!isLast && <div className="flex-1 h-px mx-1 mb-4" style={{ backgroundColor: done ? '#0154FC' : '#E5E7EB' }} />}
          </div>
        )
      })}
    </div>
  )
}

type FV = Record<string, string>

function blankFV(): FV {
  return {
    name: '', client_id: '', email: '', phone: '', fax: '', tax_number: '',
    salutation: '', contact_first_name: '', contact_last_name: '', contact_email: '',
    contact_phone: '', contact_mobile: '', contact_fax: '', contact_job_title: '', contact_department: '',
    physical_street: '', physical_city: '', physical_state: '', physical_zip: '', physical_country: '',
    postal_street: '', postal_city: '', postal_state: '', postal_zip: '', postal_country: '',
    billing_street: '', billing_city: '', billing_state: '', billing_zip: '', billing_country: '',
    account_name: '', account_number: '', account_type: '', bank_name: '', bank_branch: '',
    bulk_discount: '', member_discount: '', decimal_mark: '.', cc_emails: '', description: '',
  }
}

function clientToFV(c: SenaiteClientFull): FV {
  const phys = c.PhysicalAddress; const post = c.PostalAddress; const bill = c.BillingAddress
  const ct = c.contact
  return {
    name: c.title, client_id: c.ClientID, email: c.EmailAddress, phone: c.Phone, fax: c.Fax, tax_number: c.TaxNumber,
    salutation: ct?.Salutation ?? '', contact_first_name: ct?.Firstname ?? '', contact_last_name: ct?.Surname ?? '',
    contact_email: ct?.EmailAddress ?? '', contact_phone: ct?.BusinessPhone ?? '', contact_mobile: ct?.MobilePhone ?? '',
    contact_fax: ct?.Fax ?? '', contact_job_title: ct?.JobTitle ?? '', contact_department: ct?.Department ?? '',
    physical_street: phys?.address ?? '', physical_city: phys?.city ?? '', physical_state: phys?.state ?? '', physical_zip: phys?.zip ?? '', physical_country: phys?.country ?? '',
    postal_street: post?.address ?? '', postal_city: post?.city ?? '', postal_state: post?.state ?? '', postal_zip: post?.zip ?? '', postal_country: post?.country ?? '',
    billing_street: bill?.address ?? '', billing_city: bill?.city ?? '', billing_state: bill?.state ?? '', billing_zip: bill?.zip ?? '', billing_country: bill?.country ?? '',
    account_name: c.AccountName, account_number: c.AccountNumber, account_type: c.AccountType,
    bank_name: c.BankName, bank_branch: c.BankBranch,
    bulk_discount: c.BulkDiscount ? 'true' : '', member_discount: c.MemberDiscountApplies ? 'true' : '',
    decimal_mark: c.DecimalMark || '.', cc_emails: c.CCEmails, description: c.description,
  }
}

// ── Row actions menu ────────────────────────────────────────────────────────
function ActionsMenu({ client, onEdit, onDone }: { client: SenaiteClientFull; onEdit: (c: SenaiteClientFull) => void; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, startTransition] = useTransition()
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node) &&
          menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleOpen() {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setOpen(o => !o)
  }

  function toggle() {
    startTransition(async () => {
      await toggleSenaiteClientActive(client.uid, client.review_state !== 'active')
      onDone()
    })
    setOpen(false)
  }

  const isActive = client.review_state === 'active'
  return (
    <div style={{ display: 'inline-block' }}>
      <button ref={btnRef} onClick={handleOpen} disabled={busy} className="p-1 rounded hover:bg-gray-100" style={{ cursor: 'pointer', border: 'none', background: 'none' }}>
        <span className="material-icons" style={{ fontSize: 16, color: '#9CA3AF', lineHeight: 1 }}>more_vert</span>
      </button>
      {open && menuPos && (
        <div ref={menuRef} style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999, backgroundColor: '#fff', border: '1px solid #E8EAF2', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 170, padding: '4px 0' }}>
          <Link href={`/dashboard/clients/${client.uid}`} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50" style={{ color: '#374151', textDecoration: 'none' }} onClick={() => setOpen(false)}>
            <span className="material-icons" style={{ fontSize: 14, color: '#6B7280' }}>visibility</span>View Details
          </Link>
          <button onClick={() => { setOpen(false); onEdit(client) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50" style={{ color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <span className="material-icons" style={{ fontSize: 14, color: '#2563EB' }}>edit</span>Edit Client
          </button>
          <div style={{ borderTop: '1px solid #F3F4F6', margin: '2px 0' }} />
          <button onClick={toggle} disabled={busy} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50"
            style={{ color: isActive ? '#DC2626' : '#0154FC', background: 'none', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', textAlign: 'left' }}>
            <span className="material-icons" style={{ fontSize: 14 }}>{isActive ? 'block' : 'check_circle'}</span>
            {busy ? 'Updating…' : isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function ClientsShell({ initialClients }: { initialClients: SenaiteClientFull[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [step, setStep] = useState(0)
  const [editing, setEditing] = useState<SenaiteClientFull | null>(null)
  const [vals, setVals] = useState<FV>(blankFV)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, startRefresh] = useTransition()
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => { setLastUpdated(new Date()) }, [initialClients])

  const primaryContactName = (c: SenaiteClientFull) =>
    [c.contact?.Salutation, c.contact?.Firstname, c.contact?.Surname].filter(Boolean).join(' ')

  const filtered = initialClients.filter(c => {
    const active = c.review_state === 'active'
    if (statusFilter === 'active' && !active) return false
    if (statusFilter === 'inactive' && active) return false
    if (search) {
      const needle = search.toLowerCase()
      const hay = [c.title, c.ClientID, primaryContactName(c), c.EmailAddress].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })

  const total = initialClients.length
  const activeCount = initialClients.filter(c => c.review_state === 'active').length
  const inactiveCount = total - activeCount
  const contactsCount = initialClients.filter(c => c.contact && (c.contact.Firstname || c.contact.Surname)).length

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  function clearFilters() { setSearch(''); setStatusFilter('all'); setPage(1) }
  function handleRefresh() { startRefresh(() => { router.refresh(); setLastUpdated(new Date()) }) }
  function showToast(ok: boolean, msg: string) { setToast({ ok, msg }); setTimeout(() => setToast(null), 4000) }

  function setVal(k: string, v: string) {
    setVals(prev => ({ ...prev, [k]: v }))
    if (fieldErrors[k]) setFieldErrors(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  const [, action, pending] = useActionState(
    async (prev: ClientFormState, fd: FormData) => {
      const result = editing
        ? await updateSenaiteClient(editing.uid, editing.path, editing.contact?.uid ?? null, prev, fd)
        : await createSenaiteClient(prev, fd)
      if (result.success) {
        setShowForm(false); setStep(0); setEditing(null); setVals(blankFV()); setFieldErrors({})
        showToast(true, result.message ?? 'Saved.')
        router.refresh()
      } else if (result.errors) {
        const fe: Record<string, string> = {}
        for (const [k, msgs] of Object.entries(result.errors)) { if (msgs?.length) fe[k] = msgs[0] }
        setFieldErrors(fe); setStep(0)
      } else if (result.message) {
        showToast(false, result.message)
      }
      return result
    },
    {},
  )

  function openCreate() { setEditing(null); setVals(blankFV()); setFieldErrors({}); setStep(0); setShowForm(true) }
  function openEdit(c: SenaiteClientFull) { setEditing(c); setVals(clientToFV(c)); setFieldErrors({}); setStep(0); setShowForm(true) }
  function closeForm() { setShowForm(false); setStep(0); setEditing(null); setFieldErrors({}) }

  const isFirst = step === 0
  const isLast = step === STEPS.length - 1
  const isEditing = editing !== null

  function handleNext() {
    if (step === 0 && !vals.name?.trim()) { setFieldErrors(prev => ({ ...prev, name: 'Client name is required' })); return }
    setStep(s => s + 1)
  }

  return (
    <div style={{ padding: 20, minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Clients</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage all clients and their contact information.</p>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#9CA3AF' }}>
            Last updated: {lastUpdated.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            <button onClick={handleRefresh} disabled={refreshing} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: refreshing ? 'not-allowed' : 'pointer' }}>
              <MI name="refresh" size={14} color="#9CA3AF" />
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* Stat cards — first 3 act as quick status filters */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <button onClick={() => { setStatusFilter('all'); setPage(1) }} className="text-left rounded-xl"
          style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0, outline: statusFilter === 'all' ? '2px solid #0154FC' : 'none' }}>
          <StatCard icon="groups" label="Total Clients" value={total} sub="All time" />
        </button>
        <button onClick={() => { setStatusFilter('active'); setPage(1) }} className="text-left rounded-xl"
          style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0, outline: statusFilter === 'active' ? '2px solid #059669' : 'none' }}>
          <StatCard icon="person" iconColor="#059669" iconBg="#ECFDF5" label="Active Clients" value={activeCount}
            sub={total ? `${((activeCount / total) * 100).toFixed(1)}% of total` : undefined} />
        </button>
        <button onClick={() => { setStatusFilter('inactive'); setPage(1) }} className="text-left rounded-xl"
          style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0, outline: statusFilter === 'inactive' ? '2px solid #D97706' : 'none' }}>
          <StatCard icon="person_off" iconColor="#D97706" iconBg="#FFFBEB" label="Inactive Clients" value={inactiveCount}
            sub={total ? `${((inactiveCount / total) * 100).toFixed(1)}% of total` : undefined} />
        </button>
        <StatCard icon="contact_page" iconColor="#7C3AED" iconBg="#F5F3FF" label="Contacts" value={contactsCount} sub="Across all clients" />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative" style={{ flex: 1, minWidth: 260, maxWidth: 420 }}>
          <span className="absolute" style={{ left: 10, top: '50%', transform: 'translateY(-50%)' }}>
            <MI name="search" size={16} color="#9CA3AF" />
          </span>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search clients by name, ID, contact or email…"
            style={{ width: '100%', height: 36, borderRadius: 10, border: '1px solid #D1D5DB', fontSize: 13, padding: '0 12px 0 32px', outline: 'none' }} />
        </div>
        <div>
          <label className="block" style={{ fontSize: 10, color: '#9CA3AF' }}>Status</label>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as 'all' | 'active' | 'inactive'); setPage(1) }}
            style={{ height: 36, borderRadius: 10, border: '1px solid #D1D5DB', fontSize: 13, padding: '0 10px', outline: 'none', color: '#374151' }}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex-1" />
        <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium"
          style={{ height: 36, border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#fff' }}>
          Clear Filters
        </button>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium text-white" style={{ height: 36, backgroundColor: '#0154FC' }}>
          <MI name="add" size={14} color="#fff" /> New Client
        </button>
      </div>

      {/* ── Drawer ── */}
      <div style={{ position: 'fixed', top: 56, bottom: 40, left: 0, right: 0, zIndex: 200, pointerEvents: showForm ? 'auto' : 'none' }}>
        <div onClick={closeForm} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showForm ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 500, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showForm ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEditing ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEditing ? 'edit' : 'person_add'} size={16} color={isEditing ? '#2563EB' : '#0154FC'} />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEditing ? `Edit — ${editing!.title}` : 'Create New Client'}</h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>{STEPS[step].label} — step {step + 1} of {STEPS.length}</p>
              </div>
            </div>
            <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
          </div>

          <div className="px-6 pt-4 shrink-0"><StepBar step={step} /></div>

          <form action={action} className="flex flex-col flex-1 min-h-0">
            {Object.entries(vals).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-1">
              {/* Step 1 — Basic */}
              <div style={{ display: step === 0 ? 'block' : 'none' }}>
                <div className="space-y-3">
                  <Row>
                    <Field label="Client Name" name="_name" placeholder="e.g. Green Valley Farms" required value={vals.name} onChange={v => setVal('name', v)} error={fieldErrors.name} />
                    <Field label="Client ID" name="_client_id" placeholder="e.g. CL-001" value={vals.client_id} onChange={v => setVal('client_id', v)} />
                  </Row>
                  <Row>
                    <Field label="Email Address" name="_email" type="email" placeholder="contact@client.com" value={vals.email} onChange={v => setVal('email', v)} />
                    <Field label="Phone" name="_phone" placeholder="+1 555 000 0000" value={vals.phone} onChange={v => setVal('phone', v)} />
                  </Row>
                  <Row>
                    <Field label="Fax" name="_fax" placeholder="+1 555 000 0001" value={vals.fax} onChange={v => setVal('fax', v)} />
                    <Field label="Tax Number" name="_tax_number" placeholder="VAT / Tax registration" value={vals.tax_number} onChange={v => setVal('tax_number', v)} />
                  </Row>
                </div>
              </div>

              {/* Step 2 — Contact */}
              <div style={{ display: step === 1 ? 'block' : 'none' }}>
                <div className="space-y-3">
                  <Row>
                    <div style={{ width: 120, flexShrink: 0 }}>
                      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Salutation</label>
                      <select value={vals.salutation} onChange={e => setVal('salutation', e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                        <option value="">—</option><option value="Mr">Mr</option><option value="Mrs">Mrs</option>
                        <option value="Ms">Ms</option><option value="Dr">Dr</option><option value="Prof">Prof</option>
                      </select>
                    </div>
                    <Field label="First Name" name="_cf" placeholder="First name" value={vals.contact_first_name} onChange={v => setVal('contact_first_name', v)} />
                    <Field label="Last Name" name="_cl" placeholder="Last name" value={vals.contact_last_name} onChange={v => setVal('contact_last_name', v)} />
                  </Row>
                  <Row>
                    <Field label="Contact Email" name="_ce" type="email" placeholder="person@client.com" value={vals.contact_email} onChange={v => setVal('contact_email', v)} />
                    <Field label="Business Phone" name="_cp" placeholder="+1 555 000 0003" value={vals.contact_phone} onChange={v => setVal('contact_phone', v)} />
                  </Row>
                  <Row>
                    <Field label="Mobile" name="_cm" placeholder="+1 555 000 0004" value={vals.contact_mobile} onChange={v => setVal('contact_mobile', v)} />
                    <Field label="Contact Fax" name="_cfx" placeholder="+1 555 000 0005" value={vals.contact_fax} onChange={v => setVal('contact_fax', v)} />
                  </Row>
                  <Row>
                    <Field label="Job Title" name="_cjt" placeholder="e.g. Lab Director" value={vals.contact_job_title} onChange={v => setVal('contact_job_title', v)} />
                    <Field label="Department" name="_cd" placeholder="e.g. Quality Assurance" value={vals.contact_department} onChange={v => setVal('contact_department', v)} />
                  </Row>
                </div>
              </div>

              {/* Step 3 — Addresses */}
              <div style={{ display: step === 2 ? 'block' : 'none' }}>
                <div className="space-y-3">
                  <AddressBlock prefix="physical" label="Physical Address" vals={vals} set={setVal} />
                  <AddressBlock prefix="postal" label="Postal Address" vals={vals} set={setVal} />
                  <AddressBlock prefix="billing" label="Billing Address" vals={vals} set={setVal} />
                </div>
              </div>

              {/* Step 4 — Financial */}
              <div style={{ display: step === 3 ? 'block' : 'none' }}>
                <div className="space-y-3">
                  <Row>
                    <Field label="Account Name" name="_an" placeholder="Account name" value={vals.account_name} onChange={v => setVal('account_name', v)} />
                    <Field label="Account Number" name="_annum" placeholder="Billing account no." value={vals.account_number} onChange={v => setVal('account_number', v)} />
                  </Row>
                  <Row>
                    <Field label="Account Type" name="_at" placeholder="e.g. Corporate" value={vals.account_type} onChange={v => setVal('account_type', v)} />
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Decimal Mark</label>
                      <select value={vals.decimal_mark} onChange={e => setVal('decimal_mark', e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                        <option value=".">Period (.)</option><option value=",">Comma (,)</option>
                      </select>
                    </div>
                  </Row>
                  <Row>
                    <Field label="Bank Name" name="_bn" placeholder="Bank name" value={vals.bank_name} onChange={v => setVal('bank_name', v)} />
                    <Field label="Bank Branch" name="_bb" placeholder="Branch name" value={vals.bank_branch} onChange={v => setVal('bank_branch', v)} />
                  </Row>
                  <div className="flex flex-col gap-2 pt-1">
                    <label className="flex items-center gap-2 text-xs" style={{ color: '#374151' }}>
                      <input type="checkbox" checked={vals.bulk_discount === 'true'} onChange={e => setVal('bulk_discount', e.target.checked ? 'true' : '')} />
                      Apply bulk discount
                    </label>
                    <label className="flex items-center gap-2 text-xs" style={{ color: '#374151' }}>
                      <input type="checkbox" checked={vals.member_discount === 'true'} onChange={e => setVal('member_discount', e.target.checked ? 'true' : '')} />
                      Member discount applies
                    </label>
                  </div>
                </div>
              </div>

              {/* Step 5 — Notes */}
              <div style={{ display: step === 4 ? 'block' : 'none' }}>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>CC Emails</label>
                    <input value={vals.cc_emails} onChange={e => setVal('cc_emails', e.target.value)} placeholder="comma-separated emails"
                      className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
                  </div>
                  <Field label="Description / Remarks" name="_desc" as="textarea" placeholder="Any additional notes about this client…" value={vals.description} onChange={v => setVal('description', v)} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#fff' }}>
              <button type="button" onClick={isFirst ? closeForm : () => setStep(s => s - 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium" style={{ border: '1px solid #D1D5DB', color: '#374151' }}>
                <MI name={isFirst ? 'close' : 'arrow_back'} size={13} color="#374151" />{isFirst ? 'Cancel' : 'Back'}
              </button>
              <div className="flex-1" />
              {!isLast ? (
                <button type="button" onClick={handleNext} className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
                  Next<MI name="arrow_forward" size={13} color="#fff" />
                </button>
              ) : (
                <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium text-white"
                  style={{ backgroundColor: pending ? '#DBEAFE' : isEditing ? '#2563EB' : '#0154FC', cursor: pending ? 'not-allowed' : 'pointer' }}>
                  <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
                  {pending ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save Changes' : 'Create Client'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Table */}
      {initialClients.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="people" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No clients yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create your first client to get started</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Client
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl" style={{ border: '1px solid #E8EAF2' }}>
          <EmptyState icon="search_off" title="No clients match your filters" sub="Try a different search or clear the filters." />
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '10%' }} /><col style={{ width: '20%' }} /><col style={{ width: '18%' }} />
              <col style={{ width: '13%' }} /><col style={{ width: '20%' }} /><col style={{ width: '10%' }} />
              <col style={{ width: '9%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Client ID', 'Client Name', 'Primary Contact', 'Phone', 'Email', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((c, i) => {
                const active = c.review_state === 'active'
                return (
                  <tr key={c.uid} style={{ borderBottom: i < pageRows.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/clients/${c.uid}`} className="font-mono text-xs font-medium" style={{ color: '#0154FC', textDecoration: 'none' }}>{c.ClientID || '—'}</Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/clients/${c.uid}`} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 10, backgroundColor: '#0154FC' }}>
                          {c.title.slice(0, 1).toUpperCase()}
                        </div>
                        <span className="text-xs font-medium truncate" style={{ color: '#111827' }}>{c.title}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs truncate" style={{ color: '#374151' }}>{primaryContactName(c) || '—'}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: '#6B7280' }}>{c.Phone || '—'}</td>
                    <td className="px-3 py-2 text-xs truncate" style={{ color: '#6B7280' }}>{c.EmailAddress || '—'}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: active ? '#ECFDF5' : '#FFFBEB', color: active ? '#059669' : '#D97706' }}>
                        {active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <ActionsMenu client={c} onEdit={openEdit} onDone={() => router.refresh()} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 12, color: '#6B7280' }}>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: '#6B7280' }}>
                Show
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                  style={{ height: 28, borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 12, padding: '0 6px', outline: 'none', color: '#374151' }}>
                  {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                per page
              </div>
              <Pagination page={page} pages={pages} onPage={setPage} alwaysShow />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

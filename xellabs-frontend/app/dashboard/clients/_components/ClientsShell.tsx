'use client'
import { useState, useActionState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createClient, updateClient, toggleClientActive, resetClientPassword,
  checkClientIdAvailable, type ClientFormState, type DjangoClient, type SenaiteAddress,
} from '@/app/actions/clients'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

// ── Controlled Field ──────────────────────────────────────────────────────────
function Field({
  label, name, type = 'text', placeholder, required, error, as,
  value, onChange,
}: {
  label: string; name: string; type?: string; placeholder?: string
  required?: boolean; error?: string; as?: 'textarea'
  value: string; onChange: (v: string) => void
}) {
  const base = 'w-full px-3 py-2 text-xs rounded-lg outline-none'
  const borderColor = error ? '#FCA5A5' : '#D1D5DB'
  const style = { border: `1px solid ${borderColor}`, color: '#111827' }
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      {as === 'textarea'
        ? <textarea name={name} rows={4} placeholder={placeholder} value={value}
            onChange={e => onChange(e.target.value)} className={`${base} resize-none`} style={style} />
        : <input name={name} type={type} placeholder={placeholder} required={required}
            value={value} onChange={e => onChange(e.target.value)} className={base} style={style} />}
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3">{children}</div>
}

// ── Controlled AddressBlock ───────────────────────────────────────────────────
function AddressBlock({ prefix, label, vals, set }: {
  prefix: string; label: string
  vals: Record<string, string>
  set: (key: string, v: string) => void
}) {
  return (
    <div className="space-y-2.5 rounded-xl p-4" style={{ border: '1px solid #E8EAF2', backgroundColor: '#FAFAFA' }}>
      <p className="text-xs font-semibold" style={{ color: '#374151' }}>{label}</p>
      <Field label="Street / Address" name={`${prefix}_street`} placeholder="123 Main Street" value={vals[`${prefix}_street`] ?? ''} onChange={v => set(`${prefix}_street`, v)} />
      <Row>
        <Field label="City"             name={`${prefix}_city`}    placeholder="City"    value={vals[`${prefix}_city`]    ?? ''} onChange={v => set(`${prefix}_city`,    v)} />
        <Field label="State / Province" name={`${prefix}_state`}   placeholder="State"   value={vals[`${prefix}_state`]   ?? ''} onChange={v => set(`${prefix}_state`,   v)} />
      </Row>
      <Row>
        <Field label="ZIP / Postal"     name={`${prefix}_zip`}     placeholder="00000"   value={vals[`${prefix}_zip`]     ?? ''} onChange={v => set(`${prefix}_zip`,     v)} />
        <Field label="Country"          name={`${prefix}_country`} placeholder="Country" value={vals[`${prefix}_country`] ?? ''} onChange={v => set(`${prefix}_country`, v)} />
      </Row>
    </div>
  )
}

// ── Logo upload ───────────────────────────────────────────────────────────────
function LogoUpload() {
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) { setFileName(f.name); setPreview(URL.createObjectURL(f)) }
  function clear(e: React.MouseEvent) {
    e.preventDefault(); setPreview(null); setFileName(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>
        Client Logo <span className="ml-1 font-normal" style={{ color: '#9CA3AF' }}>(optional · compressed to &lt;30 KB)</span>
      </label>
      <div className="flex items-center gap-3">
        {preview
          ? <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ border: '1px solid #E8EAF2', backgroundColor: '#F9FAFB' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Logo preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
          : <div className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center" style={{ border: '1px dashed #D1D5DB', backgroundColor: '#F9FAFB' }}>
              <MI name="add_photo_alternate" size={22} color="#D1D5DB" />
            </div>}
        <div className="flex-1 min-w-0">
          {fileName && <p className="text-xs truncate mb-1" style={{ color: '#6B7280' }}>{fileName}</p>}
          <div className="flex gap-2">
            <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#fff' }}>
              <MI name="upload" size={12} color="#6B7280" />
              {preview ? 'Change' : 'Upload'}
              <input ref={inputRef} type="file" name="logo" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </label>
            {preview && (
              <button onClick={clear} type="button" className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ border: '1px solid #FECACA', color: '#DC2626', backgroundColor: '#FEF2F2' }}>Remove</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Basic Info',  icon: 'business'       },
  { label: 'Contact',     icon: 'person'          },
  { label: 'Addresses',   icon: 'location_on'     },
  { label: 'Financial',   icon: 'account_balance' },
  { label: 'Notes',       icon: 'notes'           },
] as const

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0 mb-5">
      {STEPS.map((s, i) => {
        const done = i < step; const active = i === step; const isLast = i === STEPS.length - 1
        return (
          <div key={s.label} className="flex items-center flex-1">
            <div className="flex flex-col items-center" style={{ minWidth: 56 }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{ backgroundColor: done ? '#0154FC' : active ? '#DBEAFE' : '#F3F4F6', border: active ? '2px solid #0154FC' : done ? '2px solid #0154FC' : '2px solid #E5E7EB' }}>
                {done ? <MI name="check" size={14} color="#fff" /> : <MI name={s.icon} size={13} color={active ? '#0154FC' : '#9CA3AF'} />}
              </div>
              <span className="mt-1 text-center" style={{ fontSize: 9, fontWeight: active ? 600 : 400, color: active ? '#0154FC' : done ? '#0154FC' : '#9CA3AF', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
            </div>
            {!isLast && <div className="flex-1 h-px mx-1 mb-4" style={{ backgroundColor: done ? '#0154FC' : '#E5E7EB' }} />}
          </div>
        )
      })}
    </div>
  )
}

// ── Form values type ──────────────────────────────────────────────────────────
type FV = Record<string, string>

type ClientIdCheck = 'idle' | 'checking' | 'available' | 'taken'

// ── Step panels (all controlled) ──────────────────────────────────────────────
function Step1({ vals, set, errors, fieldErrors, clientIdCheck, onClientIdBlur, isEditing }: {
  vals: FV; set: (k: string, v: string) => void
  errors?: ClientFormState['errors']; fieldErrors: Record<string, string>
  clientIdCheck: ClientIdCheck
  onClientIdBlur: (v: string) => void
  isEditing: boolean
}) {
  const clientIdErr = clientIdCheck === 'taken'
    ? 'This Client ID is already in use — choose a different one.'
    : fieldErrors.client_id

  return (
    <div className="space-y-3">
      <Row>
        <Field label="Client Name" name="name" placeholder="e.g. Green Valley Farms" required
          value={vals.name ?? ''} onChange={v => set('name', v)}
          error={fieldErrors.name} />
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
            Client ID<span style={{ color: '#EF4444' }}> *</span>
          </label>
          <div className="relative">
            <input name="client_id" placeholder="e.g. CL-001" required
              value={vals.client_id ?? ''}
              onChange={e => set('client_id', e.target.value)}
              onBlur={e => onClientIdBlur(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg outline-none"
              style={{ border: `1px solid ${clientIdErr ? '#FCA5A5' : '#D1D5DB'}`, color: '#111827' }} />
            {clientIdCheck === 'checking' && (
              <span className="absolute right-2.5" style={{ top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: '#9CA3AF' }}>checking…</span>
            )}
            {clientIdCheck === 'available' && (
              <span className="absolute right-2.5" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                <MI name="check_circle" size={13} color="#0154FC" />
              </span>
            )}
          </div>
          {clientIdErr && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{clientIdErr}</p>}
        </div>
      </Row>
      <Row>
        <Field label="Email Address" name="email"  type="email" placeholder="contact@client.com"
          value={vals.email ?? ''} onChange={v => set('email', v)} error={fieldErrors.email} />
        <Field label="Phone" name="phone" placeholder="+1 555 000 0000"
          value={vals.phone ?? ''} onChange={v => set('phone', v)} />
      </Row>
      <Row>
        <Field label="Fax"    name="fax"    placeholder="+1 555 000 0001" value={vals.fax    ?? ''} onChange={v => set('fax',    v)} />
        <Field label="Mobile" name="mobile" placeholder="+1 555 000 0002" value={vals.mobile ?? ''} onChange={v => set('mobile', v)} />
      </Row>
      <Row>
        <Field label="Tax Number"     name="tax_number"     placeholder="VAT / Tax registration" value={vals.tax_number     ?? ''} onChange={v => set('tax_number',     v)} />
        <Field label="Account Number" name="account_number" placeholder="Billing account no."    value={vals.account_number ?? ''} onChange={v => set('account_number', v)} />
      </Row>
    </div>
  )
}

function Step2({ vals, set, errors, fieldErrors }: { vals: FV; set: (k: string, v: string) => void; errors?: ClientFormState['errors']; fieldErrors: Record<string, string> }) {
  return (
    <div className="space-y-3">
      <Row>
        <div style={{ width: 120, flexShrink: 0 }}>
          <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Salutation</label>
          <select name="salutation" value={vals.salutation ?? ''} onChange={e => set('salutation', e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
            <option value="">—</option><option value="Mr">Mr</option><option value="Mrs">Mrs</option>
            <option value="Ms">Ms</option><option value="Dr">Dr</option><option value="Prof">Prof</option>
          </select>
        </div>
        <Field label="First Name" name="contact_first_name" placeholder="First name"
          value={vals.contact_first_name ?? ''} onChange={v => set('contact_first_name', v)}
          error={fieldErrors.contact_first_name} />
        <Field label="Last Name"  name="contact_last_name"  placeholder="Last name"
          value={vals.contact_last_name ?? ''} onChange={v => set('contact_last_name', v)} />
      </Row>
      <Row>
        <Field label="Contact Email" name="contact_email" type="email" placeholder="person@client.com"
          value={vals.contact_email ?? ''} onChange={v => set('contact_email', v)}
          error={fieldErrors.contact_email} />
        <Field label="Contact Phone" name="contact_phone" placeholder="+1 555 000 0003"
          value={vals.contact_phone ?? ''} onChange={v => set('contact_phone', v)} />
      </Row>
      <Row>
        <Field label="Job Title"  name="contact_job_title"  placeholder="e.g. Lab Director"
          value={vals.contact_job_title  ?? ''} onChange={v => set('contact_job_title',  v)} />
        <Field label="Department" name="contact_department" placeholder="e.g. Quality Assurance"
          value={vals.contact_department ?? ''} onChange={v => set('contact_department', v)} />
      </Row>
    </div>
  )
}

function Step3({ vals, set }: { vals: FV; set: (k: string, v: string) => void }) {
  return (
    <div className="space-y-3">
      <AddressBlock prefix="physical" label="Physical Address" vals={vals} set={set} />
      <AddressBlock prefix="postal"   label="Postal Address"   vals={vals} set={set} />
      <AddressBlock prefix="billing"  label="Billing Address"  vals={vals} set={set} />
    </div>
  )
}

function Step4({ vals, set, errors, fieldErrors }: { vals: FV; set: (k: string, v: string) => void; errors?: ClientFormState['errors']; fieldErrors: Record<string, string> }) {
  return (
    <div className="space-y-3">
      <Row>
        <Field label="Bank Name"   name="bank_name"   placeholder="Bank name"   value={vals.bank_name   ?? ''} onChange={v => set('bank_name',   v)} />
        <Field label="Bank Branch" name="bank_branch" placeholder="Branch name" value={vals.bank_branch ?? ''} onChange={v => set('bank_branch', v)} />
      </Row>
      <Row>
        <Field label="SWIFT Code" name="swift_code" placeholder="e.g. AAAABBCC"               value={vals.swift_code ?? ''} onChange={v => set('swift_code', v)} />
        <Field label="IBAN"       name="iban"       placeholder="e.g. GB29NWBK60161331926819" value={vals.iban       ?? ''} onChange={v => set('iban',       v)} />
      </Row>
      <Row>
        <Field label="NIB"                  name="nib"           placeholder="Bank account NIB" value={vals.nib           ?? ''} onChange={v => set('nib',           v)} />
        <Field label="Bulk Discount (%)"   name="bulk_discount"   type="number" placeholder="0" value={vals.bulk_discount   ?? ''} onChange={v => set('bulk_discount',   v)}
          error={fieldErrors.bulk_discount} />
        <Field label="Member Discount (%)" name="member_discount" type="number" placeholder="0" value={vals.member_discount ?? ''} onChange={v => set('member_discount', v)}
          error={fieldErrors.member_discount} />
      </Row>
    </div>
  )
}

function Step5({ vals, set }: { vals: FV; set: (k: string, v: string) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Remarks" name="remarks" as="textarea" placeholder="Any additional notes about this client…"
        value={vals.remarks ?? ''} onChange={v => set('remarks', v)} />
    </div>
  )
}

// ── Reset Password Modal ──────────────────────────────────────────────────────
function ResetPasswordModal({ client, onClose }: { client: DjangoClient; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [show, setShow] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setResult({ ok: false, msg: 'Password must be at least 8 characters.' }); return }
    if (password !== confirm) { setResult({ ok: false, msg: 'Passwords do not match.' }); return }
    setBusy(true)
    const res = await resetClientPassword(client.id, password)
    setResult({ ok: res.success, msg: res.message })
    setBusy(false)
    if (res.success) setTimeout(onClose, 1800)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MI name="lock_reset" size={18} color="#2563EB" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Reset Password</h3>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><MI name="close" size={16} color="#9CA3AF" /></button>
        </div>
        <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
          Set a new login password for <strong style={{ color: '#111827' }}>{client.name}</strong>
          {client.client_id && <> (username: <code style={{ background: '#F3F4F6', padding: '1px 4px', borderRadius: 3 }}>{client.client_id}</code>)</>}
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>New Password</label>
            <div style={{ position: 'relative' }}>
              <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                style={{ width: '100%', padding: '8px 32px 8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, outline: 'none' }} required />
              <button type="button" onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer' }}>
                <MI name={show ? 'visibility_off' : 'visibility'} size={14} color="#9CA3AF" />
              </button>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Confirm Password</label>
            <input type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, outline: 'none' }} required />
          </div>
          {result && (
            <div style={{ fontSize: 12, padding: '8px 10px', borderRadius: 6, backgroundColor: result.ok ? '#DBEAFE' : '#FEF2F2', color: result.ok ? '#0154FC' : '#991B1B', border: `1px solid ${result.ok ? '#93C5FD' : '#FECACA'}` }}>
              {result.msg}
            </div>
          )}
          <div className="flex gap-2 justify-end" style={{ marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '7px 14px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#374151' }}>Cancel</button>
            <button type="submit" disabled={busy} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 6, border: 'none', background: busy ? '#93C5FD' : '#2563EB', color: '#fff', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
              {busy ? 'Saving…' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── ActionsMenu ───────────────────────────────────────────────────────────────
function ActionsMenu({ client, onEdit, onDone }: { client: DjangoClient; onEdit: (c: DjangoClient) => void; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, startTransition] = useTransition()
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [showResetPwd, setShowResetPwd] = useState(false)
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
      const result = await toggleClientActive(client.id, !client.is_active)
      setToast({ ok: result.success, msg: result.message })
      setTimeout(() => setToast(null), 3000)
      if (result.success) onDone()
    })
    setOpen(false)
  }

  return (
    <div style={{ display: 'inline-block' }}>
      {showResetPwd && <ResetPasswordModal client={client} onClose={() => setShowResetPwd(false)} />}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999, backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, color: toast.ok ? '#0154FC' : '#991B1B', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {toast.msg}
        </div>
      )}
      <button ref={btnRef} onClick={handleOpen} disabled={busy} className="p-1 rounded hover:bg-gray-100" style={{ cursor: 'pointer', border: 'none', background: 'none' }}>
        <span className="material-icons" style={{ fontSize: 16, color: '#9CA3AF', lineHeight: 1 }}>more_vert</span>
      </button>
      {open && menuPos && (
        <div ref={menuRef} style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999, backgroundColor: '#fff', border: '1px solid #E8EAF2', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 170, padding: '4px 0' }}>
          <Link href={`/dashboard/clients/${client.id}`} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50" style={{ color: '#374151', textDecoration: 'none' }} onClick={() => setOpen(false)}>
            <span className="material-icons" style={{ fontSize: 14, color: '#6B7280' }}>visibility</span>View Details
          </Link>
          <button onClick={() => { setOpen(false); onEdit(client) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50" style={{ color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <span className="material-icons" style={{ fontSize: 14, color: '#2563EB' }}>edit</span>Edit Client
          </button>
          <button onClick={() => { setOpen(false); setShowResetPwd(true) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50" style={{ color: '#7C3AED', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <span className="material-icons" style={{ fontSize: 14, color: '#7C3AED' }}>lock_reset</span>Reset Password
          </button>
          <div style={{ borderTop: '1px solid #F3F4F6', margin: '2px 0' }} />
          <button onClick={toggle} disabled={busy} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50"
            style={{ color: client.is_active ? '#DC2626' : '#0154FC', background: 'none', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', textAlign: 'left' }}>
            <span className="material-icons" style={{ fontSize: 14, color: client.is_active ? '#DC2626' : '#0154FC' }}>{client.is_active ? 'block' : 'check_circle'}</span>
            {busy ? 'Updating…' : client.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function clientToFV(c: DjangoClient): FV {
  const phys = c.physical_address as SenaiteAddress | undefined
  const post = c.postal_address   as SenaiteAddress | undefined
  const bill = c.billing_address  as SenaiteAddress | undefined
  return {
    name: c.name, client_id: c.client_id, email: c.email, phone: c.phone,
    fax: c.fax, mobile: c.mobile, tax_number: c.tax_number, account_number: c.account_number,
    salutation: c.salutation, contact_first_name: c.contact_first_name, contact_last_name: c.contact_last_name,
    contact_email: c.contact_email, contact_phone: c.contact_phone,
    contact_job_title: c.contact_job_title, contact_department: c.contact_department,
    physical_street: phys?.address ?? '', physical_city: phys?.city ?? '', physical_state: phys?.state ?? '',
    physical_zip: phys?.zip ?? '', physical_country: phys?.country ?? '',
    postal_street: post?.address ?? '', postal_city: post?.city ?? '', postal_state: post?.state ?? '',
    postal_zip: post?.zip ?? '', postal_country: post?.country ?? '',
    billing_street: bill?.address ?? '', billing_city: bill?.city ?? '', billing_state: bill?.state ?? '',
    billing_zip: bill?.zip ?? '', billing_country: bill?.country ?? '',
    bank_name: c.bank_name, bank_branch: c.bank_branch, swift_code: c.swift_code,
    iban: c.iban, nib: c.nib, bulk_discount: c.bulk_discount, member_discount: c.member_discount,
    remarks: c.remarks,
  }
}

function blankFV(): FV {
  return { name: '', client_id: '', email: '', phone: '', fax: '', mobile: '', tax_number: '', account_number: '', salutation: '', contact_first_name: '', contact_last_name: '', contact_email: '', contact_phone: '', contact_job_title: '', contact_department: '', physical_street: '', physical_city: '', physical_state: '', physical_zip: '', physical_country: '', postal_street: '', postal_city: '', postal_state: '', postal_zip: '', postal_country: '', billing_street: '', billing_city: '', billing_state: '', billing_zip: '', billing_country: '', bank_name: '', bank_branch: '', swift_code: '', iban: '', nib: '', bulk_discount: '', member_discount: '', remarks: '' }
}

// ── Main shell ────────────────────────────────────────────────────────────────
const initialState: ClientFormState = {}

export default function ClientsShell({ initialClients }: { initialClients: DjangoClient[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [step, setStep] = useState(0)
  const [editingClient, setEditingClient] = useState<DjangoClient | null>(null)
  const [clientIdCheck, setClientIdCheck] = useState<ClientIdCheck>('idle')
  const [checkingNext, setCheckingNext] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [vals, setVals] = useState<FV>(blankFV)
  const formRef = useRef<HTMLFormElement>(null)

  function setVal(key: string, value: string) {
    setVals(prev => ({ ...prev, [key]: value }))
    // clear inline error for this field when user starts editing
    if (fieldErrors[key]) setFieldErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  const [state, action, pending] = useActionState(
    async (prev: ClientFormState, formData: FormData) => {
      const clientIdField = formData.get('_clientId')
      let result: ClientFormState
      if (clientIdField) {
        result = await updateClient(Number(clientIdField), prev, formData)
      } else {
        result = await createClient(prev, formData)
      }
      if (result.success) {
        setShowForm(false); setStep(0); setEditingClient(null)
        setVals(blankFV()); setFieldErrors({})
        router.refresh()
      } else if (result.errors) {
        // Map server errors into fieldErrors for inline display
        const fe: Record<string, string> = {}
        for (const [k, msgs] of Object.entries(result.errors)) {
          if (msgs && msgs.length > 0) fe[k] = msgs[0]
        }
        setFieldErrors(fe)
        // Navigate to the step that has the first error
        const step1Fields = ['name', 'client_id', 'email', 'phone', 'fax', 'mobile', 'tax_number', 'account_number']
        const step2Fields = ['contact_first_name', 'contact_last_name', 'contact_email', 'contact_phone', 'contact_job_title', 'contact_department']
        const step4Fields = ['bank_name', 'bank_branch', 'swift_code', 'iban', 'nib', 'bulk_discount', 'member_discount']
        const errKeys = Object.keys(fe)
        if (errKeys.some(k => step1Fields.includes(k))) setStep(0)
        else if (errKeys.some(k => step2Fields.includes(k))) setStep(1)
        else if (errKeys.some(k => k.startsWith('physical_') || k.startsWith('postal_') || k.startsWith('billing_'))) setStep(2)
        else if (errKeys.some(k => step4Fields.includes(k))) setStep(3)
      } else if (result.message && !result.success) {
        // Generic message — attach to client_id or name on step 1
        const msg = result.message
        const lmsg = msg.toLowerCase()
        if (lmsg.includes('digit') || lmsg.includes('client id') || lmsg.includes('client_id')) {
          setFieldErrors({ client_id: msg }); setStep(0)
        } else if (lmsg.includes('name')) {
          setFieldErrors({ name: msg }); setStep(0)
        } else {
          setFieldErrors({ _general: msg })
        }
      }
      return result
    },
    initialState
  )

  function resetForm() { setClientIdCheck('idle'); setFieldErrors({}); setStep(0) }
  function openForm() { setEditingClient(null); setVals(blankFV()); setShowForm(true); resetForm() }
  function openEdit(c: DjangoClient) { setEditingClient(c); setVals(clientToFV(c)); setShowForm(true); resetForm() }
  function closeForm() { setShowForm(false); setStep(0); setEditingClient(null); resetForm() }

  const isLast = step === STEPS.length - 1
  const isFirst = step === 0
  const isEditing = editingClient !== null

  async function handleNext() {
    if (step !== 0) { setStep(s => s + 1); return }

    const name = vals.name?.trim() ?? ''
    const clientId = vals.client_id?.trim() ?? ''

    if (!name) { setFieldErrors(prev => ({ ...prev, name: 'Client name is required' })); return }
    if (!clientId) { setFieldErrors(prev => ({ ...prev, client_id: 'Client ID is required' })); return }

    setCheckingNext(true)
    const available = await checkClientIdAvailable(clientId, editingClient?.id)
    setCheckingNext(false)
    setClientIdCheck(available ? 'available' : 'taken')
    if (!available) return

    setFieldErrors(prev => { const n = { ...prev }; delete n.name; delete n.client_id; return n })
    setStep(s => s + 1)
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Client Management</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage laboratory clients</p>
        </div>
        <button onClick={openForm} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New Client
        </button>
      </div>

      {/* ── Drawer ── */}
      <div style={{ position: 'fixed', top: 56, bottom: 40, left: 0, right: 0, zIndex: 200, pointerEvents: showForm ? 'auto' : 'none' }}>
        <div onClick={closeForm} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showForm ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 500, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showForm ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>

          {/* Drawer header */}
          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEditing ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEditing ? 'edit' : 'person_add'} size={16} color={isEditing ? '#2563EB' : '#0154FC'} />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                  {isEditing ? `Edit — ${editingClient.name}` : 'Create New Client'}
                </h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>{STEPS[step].label} — step {step + 1} of {STEPS.length}</p>
              </div>
            </div>
            <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
          </div>

          {/* Step indicator */}
          <div className="px-6 pt-4 shrink-0"><StepBar step={step} /></div>

          {/* General error (only for truly non-field errors) */}
          {fieldErrors._general && (
            <div className="mx-6 mb-2 px-3 py-2 rounded-lg text-xs shrink-0" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
              {fieldErrors._general}
            </div>
          )}

          {/* Form */}
          <form ref={formRef} action={action} noValidate className="flex flex-col flex-1 min-h-0">
            {isEditing && <input type="hidden" name="_clientId" value={editingClient.id} />}
            {/* Hidden inputs carry all controlled values to the FormData */}
            {Object.entries(vals).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}

            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-1">
              <div style={{ display: step === 0 ? 'block' : 'none' }}>
                <Step1 vals={vals} set={setVal} errors={state.errors} fieldErrors={fieldErrors}
                  clientIdCheck={clientIdCheck}
                  onClientIdBlur={async (value) => {
                    const trimmed = value.trim()
                    if (!trimmed) { setClientIdCheck('idle'); return }
                    setClientIdCheck('checking')
                    const available = await checkClientIdAvailable(trimmed, editingClient?.id)
                    setClientIdCheck(available ? 'available' : 'taken')
                  }}
                  isEditing={isEditing}
                />
                {!isEditing && <div className="mt-3"><LogoUpload /></div>}
              </div>
              <div style={{ display: step === 1 ? 'block' : 'none' }}>
                <Step2 vals={vals} set={setVal} errors={state.errors} fieldErrors={fieldErrors} />
              </div>
              <div style={{ display: step === 2 ? 'block' : 'none' }}>
                <Step3 vals={vals} set={setVal} />
              </div>
              <div style={{ display: step === 3 ? 'block' : 'none' }}>
                <Step4 vals={vals} set={setVal} errors={state.errors} fieldErrors={fieldErrors} />
              </div>
              <div style={{ display: step === 4 ? 'block' : 'none' }}>
                <Step5 vals={vals} set={setVal} />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#fff' }}>
              <button type="button" onClick={isFirst ? closeForm : () => setStep(s => s - 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium"
                style={{ border: '1px solid #D1D5DB', color: '#374151' }}>
                <MI name={isFirst ? 'close' : 'arrow_back'} size={13} color="#374151" />
                {isFirst ? 'Cancel' : 'Back'}
              </button>
              <div className="flex-1" />
              {!isLast ? (
                <button type="button" onClick={handleNext} disabled={checkingNext}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium text-white"
                  style={{ backgroundColor: checkingNext ? '#DBEAFE' : '#0154FC', cursor: checkingNext ? 'not-allowed' : 'pointer' }}>
                  {checkingNext ? 'Checking…' : 'Next'}
                  <MI name={checkingNext ? 'hourglass_top' : 'arrow_forward'} size={13} color="#fff" />
                </button>
              ) : (
                <button type="submit" disabled={pending}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium text-white"
                  style={{ backgroundColor: pending ? '#DBEAFE' : isEditing ? '#2563EB' : '#0154FC', cursor: pending ? 'not-allowed' : 'pointer' }}>
                  <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
                  {pending ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save Changes' : 'Create Client'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Success toast */}
      {state.success && (
        <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#DBEAFE', border: '1px solid #93C5FD', color: '#0154FC' }}>
          <div className="flex items-center gap-2">
            <MI name="check_circle" size={13} color="#0154FC" /><span>{state.message}</span>
          </div>
          {state.login_username && (
            <div className="mt-1.5 flex flex-col gap-1 px-2 py-1.5 rounded-md" style={{ backgroundColor: '#BFDBFE', color: '#0154FC' }}>
              <div className="flex items-center gap-2">
                <MI name="person" size={13} color="#0154FC" />
                <span>Username: <strong style={{ fontFamily: 'monospace', letterSpacing: '0.03em' }}>{state.login_username}</strong></span>
              </div>
              {state.login_password && (
                <div className="flex items-center gap-2">
                  <MI name="key" size={13} color="#0154FC" />
                  <span>Temp password: <strong style={{ fontFamily: 'monospace', letterSpacing: '0.03em' }}>{state.login_password}</strong></span>
                </div>
              )}
              <span style={{ color: '#0154FC', fontSize: 10, marginTop: 2 }}>Share these with the client now — the password is shown only once.</span>
            </div>
          )}
        </div>
      )}

      {/* Clients table */}
      {initialClients.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="people" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No clients yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create your first client to get started</p>
          <button onClick={openForm} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Client
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '18%' }} /><col style={{ width: '8%' }} /><col style={{ width: '15%' }} />
              <col style={{ width: '9%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} /><col style={{ width: '7%' }} /><col style={{ width: '10%' }} />
              <col style={{ width: '3%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Client Name', 'Client ID', 'Email', 'Phone', 'Contact', 'Schema', 'Username', 'Status', 'Tax No.', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialClients.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < initialClients.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-3 py-2">
                    <Link href={`/dashboard/clients/${c.id}`} className="flex items-center gap-2">
                      {c.logo_url
                        ? <div className="w-6 h-6 rounded-full shrink-0 overflow-hidden flex items-center justify-center" style={{ border: '1px solid #E8EAF2' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={c.logo_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          </div>
                        : <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 10, backgroundColor: '#0154FC' }}>
                            {c.name.slice(0, 1).toUpperCase()}
                          </div>}
                      <span className="text-xs font-medium truncate" style={{ color: '#0154FC' }}>{c.name}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono" style={{ fontSize: 11, color: '#374151' }}>{c.client_id || '—'}</td>
                  <td className="px-3 py-2 text-xs truncate" style={{ color: '#6B7280' }}>{c.email || '—'}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: '#6B7280' }}>{c.phone || '—'}</td>
                  <td className="px-3 py-2 text-xs truncate" style={{ color: '#6B7280' }}>
                    {[c.contact_first_name, c.contact_last_name].filter(Boolean).join(' ') || c.contact_person || '—'}
                  </td>
                  <td className="px-3 py-2">
                    {c.tenant_detail?.schema_name
                      ? <span className="font-mono" style={{ fontSize: 10, color: '#0369A1', backgroundColor: '#E0F2FE', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>{c.tenant_detail.schema_name}</span>
                      : <span style={{ color: '#9CA3AF', fontSize: 11 }}>—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {c.client_id
                      ? <span className="font-mono flex items-center gap-1" style={{ fontSize: 10, color: '#0154FC', backgroundColor: '#DBEAFE', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                          <MI name="person" size={11} color="#0154FC" />{c.client_id.toUpperCase()}
                        </span>
                      : <span style={{ color: '#9CA3AF', fontSize: 11 }}>—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, color: c.is_active ? '#0154FC' : '#6B7280' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: c.is_active ? '#0154FC' : '#9CA3AF', display: 'inline-block' }} />
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs" style={{ color: '#6B7280' }}>{c.tax_number || '—'}</td>
                  <td className="px-3 py-2">
                    <ActionsMenu client={c} onEdit={openEdit} onDone={() => router.refresh()} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialClients.length} client{initialClients.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

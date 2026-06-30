'use client'
import { useState, useActionState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient, updateClient, toggleClientActive, syncClientsFromSenaite, type ClientFormState, type DjangoClient, type SenaiteAddress, type SyncResult } from '@/app/actions/clients'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

// ── Primitives ────────────────────────────────────────────────────────────────
function Field({
  label, name, type = 'text', placeholder, required, error, as, defaultValue,
}: {
  label: string; name: string; type?: string; placeholder?: string
  required?: boolean; error?: string; as?: 'textarea'; defaultValue?: string
}) {
  const base = 'w-full px-3 py-2 text-xs rounded-lg outline-none'
  const border = { border: '1px solid #D1D5DB', color: '#111827' }
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      {as === 'textarea'
        ? <textarea name={name} rows={4} placeholder={placeholder} defaultValue={defaultValue} className={`${base} resize-none`} style={border} />
        : <input name={name} type={type} placeholder={placeholder} required={required} defaultValue={defaultValue} className={base} style={border} />}
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3">{children}</div>
}

function AddressBlock({ prefix, label, defaultValue }: { prefix: string; label: string; defaultValue?: SenaiteAddress }) {
  return (
    <div className="space-y-2.5 rounded-xl p-4" style={{ border: '1px solid #E5E7EB', backgroundColor: '#FAFAFA' }}>
      <p className="text-xs font-semibold" style={{ color: '#374151' }}>{label}</p>
      <Field label="Street / Address" name={`${prefix}_street`}  placeholder="123 Main Street" defaultValue={defaultValue?.address} />
      <Row>
        <Field label="City"             name={`${prefix}_city`}    placeholder="City"   defaultValue={defaultValue?.city} />
        <Field label="State / Province" name={`${prefix}_state`}   placeholder="State"  defaultValue={defaultValue?.state} />
      </Row>
      <Row>
        <Field label="ZIP / Postal"     name={`${prefix}_zip`}     placeholder="00000"  defaultValue={defaultValue?.zip} />
        <Field label="Country"          name={`${prefix}_country`} placeholder="Country" defaultValue={defaultValue?.country} />
      </Row>
    </div>
  )
}

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Basic Info',   icon: 'business'         },
  { label: 'Contact',      icon: 'person'            },
  { label: 'Addresses',    icon: 'location_on'       },
  { label: 'Financial',    icon: 'account_balance'   },
  { label: 'Notes',        icon: 'notes'             },
] as const

// ── Step indicator ────────────────────────────────────────────────────────────
function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0 mb-5">
      {STEPS.map((s, i) => {
        const done    = i < step
        const active  = i === step
        const isLast  = i === STEPS.length - 1
        return (
          <div key={s.label} className="flex items-center flex-1">
            <div className="flex flex-col items-center" style={{ minWidth: 56 }}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{
                  backgroundColor: done ? '#14B8A6' : active ? '#F0FDFA' : '#F3F4F6',
                  border: active ? '2px solid #14B8A6' : done ? '2px solid #14B8A6' : '2px solid #E5E7EB',
                }}
              >
                {done
                  ? <MI name="check" size={14} color="#fff" />
                  : <MI name={s.icon} size={13} color={active ? '#14B8A6' : '#9CA3AF'} />}
              </div>
              <span className="mt-1 text-center" style={{ fontSize: 9, fontWeight: active ? 600 : 400, color: active ? '#14B8A6' : done ? '#0D9488' : '#9CA3AF', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 h-px mx-1 mb-4" style={{ backgroundColor: done ? '#14B8A6' : '#E5E7EB' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step panels ───────────────────────────────────────────────────────────────
function Step1({ errors, client }: { errors?: ClientFormState['errors']; client?: DjangoClient }) {
  return (
    <div className="space-y-3">
      <Row>
        <Field label="Client Name" name="name"      placeholder="e.g. Green Valley Farms" required error={errors?.name?.[0]}      defaultValue={client?.name} />
        <Field label="Client ID"   name="client_id" placeholder="e.g. CL-001"             required error={errors?.client_id?.[0]} defaultValue={client?.client_id} />
      </Row>
      <Row>
        <Field label="Email Address" name="email"  type="email" placeholder="contact@client.com" defaultValue={client?.email} />
        <Field label="Phone"         name="phone"               placeholder="+1 555 000 0000"    defaultValue={client?.phone} />
      </Row>
      <Row>
        <Field label="Fax"    name="fax"    placeholder="+1 555 000 0001" defaultValue={client?.fax} />
        <Field label="Mobile" name="mobile" placeholder="+1 555 000 0002" defaultValue={client?.mobile} />
      </Row>
      <Row>
        <Field label="Tax Number"     name="tax_number"    placeholder="VAT / Tax registration" defaultValue={client?.tax_number} />
        <Field label="Account Number" name="account_number" placeholder="Billing account no."  defaultValue={client?.account_number} />
      </Row>
    </div>
  )
}

function Step2({ client }: { client?: DjangoClient }) {
  return (
    <div className="space-y-3">
      <Row>
        <div style={{ width: 120, flexShrink: 0 }}>
          <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Salutation</label>
          <select name="salutation" defaultValue={client?.salutation ?? ''} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
            <option value="">—</option>
            <option value="Mr">Mr</option>
            <option value="Mrs">Mrs</option>
            <option value="Ms">Ms</option>
            <option value="Dr">Dr</option>
            <option value="Prof">Prof</option>
          </select>
        </div>
        <Field label="First Name" name="contact_first_name" placeholder="First name" defaultValue={client?.contact_first_name} />
        <Field label="Last Name"  name="contact_last_name"  placeholder="Last name"  defaultValue={client?.contact_last_name} />
      </Row>
      <Row>
        <Field label="Contact Email" name="contact_email" type="email" placeholder="person@client.com"   defaultValue={client?.contact_email} />
        <Field label="Contact Phone" name="contact_phone"              placeholder="+1 555 000 0003"      defaultValue={client?.contact_phone} />
      </Row>
      <Row>
        <Field label="Job Title"  name="contact_job_title"  placeholder="e.g. Lab Director"       defaultValue={client?.contact_job_title} />
        <Field label="Department" name="contact_department" placeholder="e.g. Quality Assurance"   defaultValue={client?.contact_department} />
      </Row>
    </div>
  )
}

function Step3({ client }: { client?: DjangoClient }) {
  const phys = client?.physical_address as SenaiteAddress | undefined
  const post = client?.postal_address   as SenaiteAddress | undefined
  const bill = client?.billing_address  as SenaiteAddress | undefined
  return (
    <div className="space-y-3">
      <AddressBlock prefix="physical" label="Physical Address" defaultValue={phys} />
      <AddressBlock prefix="postal"   label="Postal Address"   defaultValue={post} />
      <AddressBlock prefix="billing"  label="Billing Address"  defaultValue={bill} />
    </div>
  )
}

function Step4({ client }: { client?: DjangoClient }) {
  return (
    <div className="space-y-3">
      <Row>
        <Field label="Bank Name"   name="bank_name"   placeholder="Bank name"   defaultValue={client?.bank_name} />
        <Field label="Bank Branch" name="bank_branch" placeholder="Branch name" defaultValue={client?.bank_branch} />
      </Row>
      <Row>
        <Field label="SWIFT Code" name="swift_code" placeholder="e.g. AAAABBCC"               defaultValue={client?.swift_code} />
        <Field label="IBAN"       name="iban"       placeholder="e.g. GB29NWBK60161331926819" defaultValue={client?.iban} />
      </Row>
      <Row>
        <Field label="NIB"                  name="nib"           placeholder="Bank account NIB" defaultValue={client?.nib} />
        <Field label="Bulk Discount (%)"   name="bulk_discount"   type="number" placeholder="0" defaultValue={client?.bulk_discount} />
        <Field label="Member Discount (%)" name="member_discount" type="number" placeholder="0" defaultValue={client?.member_discount} />
      </Row>
    </div>
  )
}

function Step5({ client }: { client?: DjangoClient }) {
  return (
    <div className="space-y-3">
      <Field label="Remarks" name="remarks" as="textarea" placeholder="Any additional notes about this client…" defaultValue={client?.remarks} />
    </div>
  )
}

// ── Per-row actions menu ──────────────────────────────────────────────────────
function ActionsMenu({ client, onEdit, onDone }: { client: DjangoClient; onEdit: (c: DjangoClient) => void; onDone: () => void }) {
  const [open, setOpen]       = useState(false)
  const [busy, startTransition] = useTransition()
  const [toast, setToast]     = useState<{ ok: boolean; msg: string } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 999,
          backgroundColor: toast.ok ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${toast.ok ? '#A7F3D0' : '#FECACA'}`,
          color: toast.ok ? '#065F46' : '#991B1B',
          padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          {toast.msg}
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        className="p-1 rounded hover:bg-gray-100"
        style={{ cursor: 'pointer', border: 'none', background: 'none' }}
      >
        <span className="material-icons" style={{ fontSize: 16, color: '#9CA3AF', lineHeight: 1 }}>more_vert</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', zIndex: 50,
          backgroundColor: '#fff', border: '1px solid #E5E7EB',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
          minWidth: 160, padding: '4px 0',
        }}>
          <Link href={`/dashboard/clients/${client.id}`}
            className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50"
            style={{ color: '#374151', textDecoration: 'none' }}
            onClick={() => setOpen(false)}>
            <span className="material-icons" style={{ fontSize: 14, color: '#6B7280' }}>visibility</span>
            View Details
          </Link>
          <button
            onClick={() => { setOpen(false); onEdit(client) }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50"
            style={{ color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <span className="material-icons" style={{ fontSize: 14, color: '#2563EB' }}>edit</span>
            Edit Client
          </button>
          <div style={{ borderTop: '1px solid #F3F4F6', margin: '2px 0' }} />
          <button
            onClick={toggle}
            disabled={busy}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50"
            style={{
              color: client.is_active ? '#DC2626' : '#059669',
              background: 'none', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', textAlign: 'left',
            }}>
            <span className="material-icons" style={{ fontSize: 14, color: client.is_active ? '#DC2626' : '#059669' }}>
              {client.is_active ? 'block' : 'check_circle'}
            </span>
            {busy ? 'Updating…' : client.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main shell ────────────────────────────────────────────────────────────────
const initialState: ClientFormState = {}

export default function ClientsShell({ initialClients }: { initialClients: DjangoClient[] }) {
  const router  = useRouter()
  const [showForm, setShowForm]       = useState(false)
  const [step, setStep]               = useState(0)
  const [editingClient, setEditingClient] = useState<DjangoClient | null>(null)
  const [syncing, startSync]          = useTransition()
  const [syncResult, setSyncResult]   = useState<SyncResult | null>(null)

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
        setShowForm(false)
        setStep(0)
        setEditingClient(null)
        router.refresh()
      }
      return result
    },
    initialState
  )

  function openForm() { setEditingClient(null); setShowForm(true); setStep(0) }
  function openEdit(c: DjangoClient) { setEditingClient(c); setShowForm(true); setStep(0) }
  function closeForm() { setShowForm(false); setStep(0); setEditingClient(null) }

  const isLast  = step === STEPS.length - 1
  const isFirst = step === 0
  const isEditing = editingClient !== null

  return (
    <div style={{ padding: '12px 20px 0', backgroundColor: '#F5F6FA', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#111827' }}>Client Management</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage laboratory clients</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              startSync(async () => {
                const result = await syncClientsFromSenaite()
                setSyncResult(result)
                setTimeout(() => setSyncResult(null), 5000)
                if (result.success) router.refresh()
              })
            }}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#fff', cursor: syncing ? 'not-allowed' : 'pointer' }}
          >
            <MI name={syncing ? 'sync' : 'sync'} size={15} color={syncing ? '#9CA3AF' : '#6B7280'} />
            {syncing ? 'Syncing…' : 'Sync SENAITE'}
          </button>
          <button
            onClick={openForm}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#14B8A6' }}
          >
            <MI name="add" size={15} color="#fff" />
            New Client
          </button>
        </div>
      </div>

      {/* ── Drawer ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          top: 56, bottom: 40, left: 0, right: 0,
          zIndex: 200,
          pointerEvents: showForm ? 'auto' : 'none',
        }}
      >
        {/* Backdrop */}
        <div
          onClick={closeForm}
          style={{
            position: 'absolute', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.30)',
            opacity: showForm ? 1 : 0,
            transition: 'opacity 0.25s ease',
          }}
        />

        {/* Slide-over panel */}
        <div
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0,
            width: 500,
            backgroundColor: '#fff',
            boxShadow: '-6px 0 32px rgba(0,0,0,0.12)',
            transform: showForm ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEditing ? '#EFF6FF' : '#F0FDFA' }}>
                <MI name={isEditing ? 'edit' : 'person_add'} size={16} color={isEditing ? '#2563EB' : '#14B8A6'} />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                  {isEditing ? `Edit — ${editingClient.name}` : 'Create New Client'}
                </h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>{STEPS[step].label} — step {step + 1} of {STEPS.length}</p>
              </div>
            </div>
            <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100">
              <MI name="close" size={16} color="#9CA3AF" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="px-6 pt-4 shrink-0">
            <StepBar step={step} />
          </div>

          {/* Error banner */}
          {state.message && !state.success && (
            <div className="mx-6 mb-2 px-3 py-2 rounded-lg text-xs shrink-0" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
              {state.message}
            </div>
          )}

          {/* Scrollable form body */}
          <form action={action} className="flex flex-col flex-1 min-h-0">
            {/* Hidden field — signals update vs create */}
            {isEditing && <input type="hidden" name="_clientId" value={editingClient.id} />}

            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-1">
              <div style={{ display: step === 0 ? 'block' : 'none' }}><Step1 errors={state.errors} client={editingClient ?? undefined} /></div>
              <div style={{ display: step === 1 ? 'block' : 'none' }}><Step2 client={editingClient ?? undefined} /></div>
              <div style={{ display: step === 2 ? 'block' : 'none' }}><Step3 client={editingClient ?? undefined} /></div>
              <div style={{ display: step === 3 ? 'block' : 'none' }}><Step4 client={editingClient ?? undefined} /></div>
              <div style={{ display: step === 4 ? 'block' : 'none' }}><Step5 client={editingClient ?? undefined} /></div>
            </div>

            {/* Sticky footer navigation */}
            <div className="px-6 py-4 flex gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#fff' }}>
              <button
                type="button"
                onClick={isFirst ? closeForm : () => setStep(s => s - 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium"
                style={{ border: '1px solid #D1D5DB', color: '#374151' }}
              >
                <MI name={isFirst ? 'close' : 'arrow_back'} size={13} color="#374151" />
                {isFirst ? 'Cancel' : 'Back'}
              </button>

              <div className="flex-1" />

              {!isLast ? (
                <button
                  type="button"
                  onClick={() => setStep(s => s + 1)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium text-white"
                  style={{ backgroundColor: '#14B8A6' }}
                >
                  Next
                  <MI name="arrow_forward" size={13} color="#fff" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={pending}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium text-white"
                  style={{ backgroundColor: pending ? '#99F6E4' : isEditing ? '#2563EB' : '#14B8A6', cursor: pending ? 'not-allowed' : 'pointer' }}
                >
                  <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
                  {pending ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save Changes' : 'Create Client'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Sync result toast */}
      {syncResult && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{
            backgroundColor: syncResult.success ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${syncResult.success ? '#A7F3D0' : '#FECACA'}`,
            color: syncResult.success ? '#065F46' : '#991B1B',
          }}>
          <MI name={syncResult.success ? 'check_circle' : 'error'} size={13} color={syncResult.success ? '#10B981' : '#EF4444'} />
          {syncResult.message}
        </div>
      )}

      {/* Success toast */}
      {state.success && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46' }}>
          <MI name="check_circle" size={13} color="#10B981" />
          {state.message}
        </div>
      )}

      {/* Clients table */}
      {initialClients.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E5E7EB' }}>
          <MI name="people" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No clients yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create your first client to get started</p>
          <button
            onClick={openForm}
            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ backgroundColor: '#14B8A6' }}
          >
            <MI name="add" size={13} color="#fff" />
            New Client
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '4%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Client Name', 'Client ID', 'Email', 'Phone', 'Contact', 'Tax No.', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialClients.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < initialClients.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-3 py-2">
                    <Link href={`/dashboard/clients/${c.id}`} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 10, backgroundColor: '#14B8A6' }}>
                        {c.name.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium truncate" style={{ color: '#14B8A6' }}>{c.name}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono" style={{ fontSize: 11, color: '#374151' }}>{c.client_id || '—'}</td>
                  <td className="px-3 py-2 text-xs truncate" style={{ color: '#6B7280' }}>{c.email || '—'}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: '#6B7280' }}>{c.phone || '—'}</td>
                  <td className="px-3 py-2 text-xs truncate" style={{ color: '#6B7280' }}>
                    {[c.contact_first_name, c.contact_last_name].filter(Boolean).join(' ') || c.contact_person || '—'}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono" style={{ color: '#6B7280' }}>{c.tax_number || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, color: c.is_active ? '#166534' : '#6B7280' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: c.is_active ? '#22C55E' : '#9CA3AF', display: 'inline-block' }} />
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
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

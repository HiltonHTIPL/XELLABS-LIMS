'use client'
import { useState, useActionState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateLaboratory, type LaboratoryData, type LaboratoryFormState, type Address,
} from '@/app/actions/laboratory'
import type { RefOption } from '../../_components/AdminRefShell'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const inputBase = 'w-full px-3 py-2 text-xs rounded-lg outline-none'
function Txt({ label, value, onChange, required, error, placeholder, type = 'text', readOnly }: {
  label: string; value: string; onChange: (v: string) => void
  required?: boolean; error?: string; placeholder?: string; type?: string; readOnly?: boolean
}) {
  if (readOnly) {
    return (
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>{label}</label>
        <p className="text-xs py-2" style={{ color: value ? '#111827' : '#374151' }}>{value || '—'}</p>
      </div>
    )
  }
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={inputBase} style={{ border: `1px solid ${error ? '#FCA5A5' : '#D1D5DB'}`, color: '#111827' }} />
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

const ADDR_FIELDS: { key: keyof Address; label: string }[] = [
  { key: 'address', label: 'Address' }, { key: 'city', label: 'City' }, { key: 'zip', label: 'Zip' },
  { key: 'district', label: 'District' }, { key: 'state', label: 'State' }, { key: 'country', label: 'Country' },
]

const TABS = [
  { key: 'default', label: 'Default' },
  { key: 'address', label: 'Address' },
  { key: 'bank-details', label: 'Bank details' },
  { key: 'accreditation', label: 'Accreditation' },
] as const
type TabKey = typeof TABS[number]['key']

export default function LaboratoryShell({ data, supervisors }: { data: LaboratoryData; supervisors: RefOption[] }) {
  const router = useRouter()
  const [vals, setVals] = useState<LaboratoryData>(data)
  const [logoName, setLogoName] = useState('')
  const [logoData, setLogoData] = useState('')
  const logoRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<TabKey>('default')
  const [mode, setMode] = useState<'view' | 'edit'>('view')

  const [state, action, pending] = useActionState(
    async (prev: LaboratoryFormState, fd: FormData) => {
      const result = await updateLaboratory(data.path, prev, fd)
      if (result.success) router.refresh()
      return result
    },
    {},
  )

  useEffect(() => {
    if (state.success) setMode('view')
  }, [state.success])

  function cancelEdit() {
    setVals(data)
    setLogoName('')
    setLogoData('')
    setMode('view')
  }

  const readOnly = mode === 'view'

  function set<K extends keyof LaboratoryData>(k: K, v: LaboratoryData[K]) { setVals(p => ({ ...p, [k]: v })) }
  function setAddr(which: 'PhysicalAddress' | 'PostalAddress' | 'BillingAddress', key: keyof Address, v: string) {
    setVals(p => ({ ...p, [which]: { ...p[which], [key]: v } }))
  }
  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) { setLogoName(''); setLogoData(''); return }
    setLogoName(f.name)
    const reader = new FileReader()
    reader.onload = () => setLogoData(String(reader.result))
    reader.readAsDataURL(f)
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <div style={{ maxWidth: 880, marginLeft: 'auto', marginRight: 'auto' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Laboratory Information</h1>
          <p className="text-sm mt-0.5" style={{ color: '#374151' }}>Your laboratory&apos;s identity, contact, and accreditation details</p>
        </div>
        {mode === 'view' && (
          <button type="button" onClick={() => setMode('edit')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium text-white"
            style={{ backgroundColor: '#0154FC', cursor: 'pointer' }}>
            <MI name="edit" size={13} color="#fff" />
            Edit
          </button>
        )}
      </div>

      {state.success && (
        <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#DBEAFE', border: '1px solid #93C5FD', color: '#0154FC' }}>
          <div className="flex items-center gap-2"><MI name="check_circle" size={13} color="#0154FC" /><span>{state.message}</span></div>
        </div>
      )}
      {state.message && !state.success && (
        <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626' }}>{state.message}</div>
      )}

      <form action={action} className="space-y-4">
        {/* hidden address serialization */}
        {(['PhysicalAddress', 'PostalAddress', 'BillingAddress'] as const).map(which =>
          ADDR_FIELDS.map(f => {
            const prefix = which === 'PhysicalAddress' ? 'physical' : which === 'PostalAddress' ? 'postal' : 'billing'
            return <input key={`${prefix}-${f.key}`} type="hidden" name={`${prefix}_${f.key}`} value={vals[which][f.key]} />
          }),
        )}
        <input type="hidden" name="LaboratoryAccredited" value={vals.LaboratoryAccredited ? 'true' : 'false'} />
        <input type="hidden" name="AccreditationBodyLogo" value={logoData} />

        <div className="flex gap-1 border-b" style={{ borderColor: '#E8EAF2' }}>
          {TABS.map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className="px-4 py-2 text-xs font-medium"
              style={{
                color: tab === t.key ? '#0154FC' : '#374151',
                borderBottom: tab === t.key ? '2px solid #0154FC' : '2px solid transparent',
                marginBottom: -1, cursor: 'pointer',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: tab === 'default' ? 'block' : 'none' }} className="space-y-4">
          <Card title="Identity">
            <div className="grid grid-cols-2 gap-3">
              <input type="hidden" name="Name" value={vals.Name} />
              <Txt label="Laboratory Name" value={vals.Name} onChange={v => set('Name', v)} required error={state.errors?.Name?.[0]} readOnly={readOnly} />
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: readOnly ? '#374151' : '#374151' }}>Supervisor</label>
                {readOnly ? (
                  <p className="text-xs py-2" style={{ color: vals.Supervisor ? '#111827' : '#374151' }}>
                    {supervisors.find(s => s.uid === vals.Supervisor)?.title || '—'}
                  </p>
                ) : (
                  <select name="Supervisor" value={vals.Supervisor} onChange={e => set('Supervisor', e.target.value)}
                    className={inputBase} style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                    <option value="">— None —</option>
                    {supervisors.map(s => <option key={s.uid} value={s.uid}>{s.title}</option>)}
                  </select>
                )}
              </div>
              <WrapTxt name="LabURL" label="Lab URL" value={vals.LabURL} onChange={v => set('LabURL', v)} placeholder="https://…" readOnly={readOnly} />
              <WrapTxt name="TaxNumber" label="Tax Number" value={vals.TaxNumber} onChange={v => set('TaxNumber', v)} readOnly={readOnly} />
              <WrapTxt name="AccountType" label="Account Type" value={vals.AccountType} onChange={v => set('AccountType', v)} readOnly={readOnly} />
              <WrapTxt name="Confidence" label="Confidence %" value={vals.Confidence} onChange={v => set('Confidence', v)} type="number" error={state.errors?.Confidence?.[0]} readOnly={readOnly} />
            </div>
          </Card>

          <Card title="Contact">
            <div className="grid grid-cols-3 gap-3">
              <WrapTxt name="EmailAddress" label="Email" value={vals.EmailAddress} onChange={v => set('EmailAddress', v)} placeholder="lab@company.com" readOnly={readOnly} />
              <WrapTxt name="Phone" label="Phone" value={vals.Phone} onChange={v => set('Phone', v)} readOnly={readOnly} />
              <WrapTxt name="Fax" label="Fax" value={vals.Fax} onChange={v => set('Fax', v)} readOnly={readOnly} />
            </div>
          </Card>
        </div>

        <div style={{ display: tab === 'address' ? 'block' : 'none' }} className="space-y-4">
          <AddressCard title="Physical Address" addr={vals.PhysicalAddress} onChange={(k, v) => setAddr('PhysicalAddress', k, v)} readOnly={readOnly} />
          <AddressCard title="Postal Address" addr={vals.PostalAddress} onChange={(k, v) => setAddr('PostalAddress', k, v)} readOnly={readOnly} />
          <AddressCard title="Billing Address" addr={vals.BillingAddress} onChange={(k, v) => setAddr('BillingAddress', k, v)} readOnly={readOnly} />
        </div>

        <div style={{ display: tab === 'bank-details' ? 'block' : 'none' }} className="space-y-4">
          <Card title="Banking">
            <div className="grid grid-cols-2 gap-3">
              <WrapTxt name="AccountName" label="Account Name" value={vals.AccountName} onChange={v => set('AccountName', v)} readOnly={readOnly} />
              <WrapTxt name="AccountNumber" label="Account Number" value={vals.AccountNumber} onChange={v => set('AccountNumber', v)} readOnly={readOnly} />
              <WrapTxt name="BankName" label="Bank Name" value={vals.BankName} onChange={v => set('BankName', v)} readOnly={readOnly} />
              <WrapTxt name="BankBranch" label="Bank Branch" value={vals.BankBranch} onChange={v => set('BankBranch', v)} readOnly={readOnly} />
            </div>
          </Card>
        </div>

        <div style={{ display: tab === 'accreditation' ? 'block' : 'none' }} className="space-y-4">
          <Card title="Accreditation">
            {readOnly ? (
              <p className="text-xs mb-3" style={{ color: '#374151' }}>
                {vals.LaboratoryAccredited ? 'This laboratory is accredited' : 'This laboratory is not accredited'}
              </p>
            ) : (
              <label className="flex items-center gap-2 text-xs mb-3 cursor-pointer" style={{ color: '#374151' }}>
                <input type="checkbox" checked={vals.LaboratoryAccredited} onChange={e => set('LaboratoryAccredited', e.target.checked)} />
                This laboratory is accredited
              </label>
            )}
            <div className="grid grid-cols-2 gap-3">
              <WrapTxt name="AccreditationBody" label="Accreditation Body" value={vals.AccreditationBody} onChange={v => set('AccreditationBody', v)} placeholder="e.g. SANAS" readOnly={readOnly} />
              <WrapTxt name="AccreditationBodyURL" label="Accreditation Body URL" value={vals.AccreditationBodyURL} onChange={v => set('AccreditationBodyURL', v)} readOnly={readOnly} />
              <WrapTxt name="Accreditation" label="Accreditation" value={vals.Accreditation} onChange={v => set('Accreditation', v)} placeholder="e.g. ISO 17025" readOnly={readOnly} />
              <WrapTxt name="AccreditationReference" label="Accreditation Reference" value={vals.AccreditationReference} onChange={v => set('AccreditationReference', v)} readOnly={readOnly} />
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium mb-1" style={{ color: readOnly ? '#374151' : '#374151' }}>Accreditation Page Header</label>
              {readOnly ? (
                <p className="text-xs py-2 whitespace-pre-wrap" style={{ color: vals.AccreditationPageHeader ? '#111827' : '#374151' }}>
                  {vals.AccreditationPageHeader || '—'}
                </p>
              ) : (
                <textarea name="AccreditationPageHeader" rows={3} value={vals.AccreditationPageHeader}
                  onChange={e => set('AccreditationPageHeader', e.target.value)}
                  className={`${inputBase} resize-none`} style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
              )}
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium mb-1" style={{ color: readOnly ? '#374151' : '#374151' }}>Accreditation Body Logo</label>
              {readOnly ? (
                <p className="text-xs py-2" style={{ color: vals.hasLogo ? '#111827' : '#374151' }}>
                  {vals.hasLogo ? 'Logo on file' : '—'}
                </p>
              ) : (
                <>
                  <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => logoRef.current?.click()} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#F9FAFB', cursor: 'pointer' }}>Choose Image</button>
                    <span className="text-xs truncate" style={{ color: logoName ? '#374151' : '#374151' }}>
                      {logoName || (vals.hasLogo ? 'Logo on file (upload to replace)' : 'No file chosen')}
                    </span>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>

        {mode === 'edit' && (
          <div className="flex justify-end gap-2 pb-4">
            <button type="button" onClick={cancelEdit} disabled={pending} className="flex items-center gap-1.5 px-5 py-2 text-xs rounded-lg font-medium"
              style={{ border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#fff', cursor: pending ? 'not-allowed' : 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-5 py-2 text-xs rounded-lg font-medium text-white"
              style={{ backgroundColor: pending ? '#DBEAFE' : '#0154FC', cursor: pending ? 'not-allowed' : 'pointer' }}>
              <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
              {pending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </form>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #E8EAF2' }}>
      <p className="uppercase tracking-wide mb-3" style={{ fontSize: 10, fontWeight: 700, color: '#374151', letterSpacing: '0.06em' }}>{title}</p>
      {children}
    </div>
  )
}

// A Txt whose value is serialized via a named hidden input for FormData.
function WrapTxt({ name, ...rest }: { name: string } & Parameters<typeof Txt>[0]) {
  return (
    <div>
      <input type="hidden" name={name} value={rest.value} />
      <Txt {...rest} />
    </div>
  )
}

function AddressCard({ title, addr, onChange, readOnly }: { title: string; addr: Address; onChange: (k: keyof Address, v: string) => void; readOnly?: boolean }) {
  return (
    <Card title={title}>
      <div className="grid grid-cols-3 gap-3">
        {ADDR_FIELDS.map(f => <Txt key={f.key} label={f.label} value={addr[f.key]} onChange={v => onChange(f.key, v)} readOnly={readOnly} />)}
      </div>
    </Card>
  )
}

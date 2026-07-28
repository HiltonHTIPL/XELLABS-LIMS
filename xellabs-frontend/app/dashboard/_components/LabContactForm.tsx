'use client'
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Address, LabContactRow } from '@/app/actions/lab-contacts'
import type { RefOption } from './AdminRefShell'

// Shared Lab Contact field set + tabbed layout — used by both the standalone
// Lab Contacts page (full drawer) and the inline "New Lab Contact" panel
// launched from Lab Department's Manager field (select-or-add). One
// definition (DRY) so the two never drift out of sync.

export const LAB_CONTACT_TABS = ['Default', 'Email telephone fax', 'Address'] as const
export type LabContactTab = typeof LAB_CONTACT_TABS[number]

export type LabContactFV = {
  Salutation: string; Firstname: string; Middleinitial: string; Middlename: string; Surname: string
  EmailAddress: string; BusinessPhone: string; BusinessFax: string; HomePhone: string; MobilePhone: string
  JobTitle: string; Department: string
  Departments: string[]; DefaultDepartment: string
  PhysicalAddress: Address; PostalAddress: Address
  Signature: string  // base64 data-URI (new upload only)
}

const EMPTY_ADDR: Address = { address: '', city: '', zip: '', state: '', district: '', country: '' }

export function blankLabContactFV(): LabContactFV {
  return {
    Salutation: '', Firstname: '', Middleinitial: '', Middlename: '', Surname: '',
    EmailAddress: '', BusinessPhone: '', BusinessFax: '', HomePhone: '', MobilePhone: '',
    JobTitle: '', Department: '', Departments: [], DefaultDepartment: '',
    PhysicalAddress: { ...EMPTY_ADDR }, PostalAddress: { ...EMPTY_ADDR }, Signature: '',
  }
}

export function labContactRowToFV(r: LabContactRow): LabContactFV {
  return {
    Salutation: r.Salutation, Firstname: r.Firstname, Middleinitial: r.Middleinitial,
    Middlename: r.Middlename, Surname: r.Surname, EmailAddress: r.EmailAddress,
    BusinessPhone: r.BusinessPhone, BusinessFax: r.BusinessFax, HomePhone: r.HomePhone,
    MobilePhone: r.MobilePhone, JobTitle: r.JobTitle, Department: r.Department,
    Departments: r.Departments, DefaultDepartment: r.DefaultDepartment,
    PhysicalAddress: { ...r.PhysicalAddress }, PostalAddress: { ...r.PostalAddress }, Signature: '',
  }
}

export const ADDR_FIELDS: { key: keyof Address; label: string }[] = [
  { key: 'country', label: 'Country' }, { key: 'state', label: 'State' }, { key: 'district', label: 'District' },
  { key: 'city', label: 'City' }, { key: 'zip', label: 'Postal code' }, { key: 'address', label: 'Address' },
]

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const inputBase = 'w-full px-3 py-2 text-xs rounded-lg outline-none'

function Txt({ label, value, onChange, required, error, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  required?: boolean; error?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={inputBase} style={{ border: `1px solid ${error ? '#FCA5A5' : '#D1D5DB'}`, color: '#111827' }} />
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

export function LabContactTabBar({ activeTab, onChange }: { activeTab: LabContactTab; onChange: (t: LabContactTab) => void }) {
  return (
    <div className="flex items-center gap-1 px-5 pt-2 shrink-0" style={{ borderBottom: '1px solid #F3F4F6', overflowX: 'auto' }}>
      {LAB_CONTACT_TABS.map(t => (
        <button key={t} type="button" onClick={() => onChange(t)}
          className="px-3 py-2 text-xs font-medium whitespace-nowrap"
          style={{
            border: 'none', background: 'none', cursor: 'pointer',
            color: activeTab === t ? '#0154FC' : '#374151',
            borderBottom: activeTab === t ? '2px solid #0154FC' : '2px solid transparent',
          }}>
          {t}
        </button>
      ))}
    </div>
  )
}

type BodyProps = {
  activeTab: LabContactTab
  vals: LabContactFV
  errors?: Record<string, string[]>
  departments: RefOption[]
  set: <K extends keyof LabContactFV>(k: K, v: LabContactFV[K]) => void
  setAddr: (which: 'PhysicalAddress' | 'PostalAddress', key: keyof Address, v: string) => void
  toggleDept: (uid: string) => void
  sigName: string
  sigRef: RefObject<HTMLInputElement | null>
  onSigFile: (e: React.ChangeEvent<HTMLInputElement>) => void
  existingSignatureNote?: string
}

export function LabContactFormBody({
  activeTab, vals, errors, departments, set, setAddr, toggleDept, sigName, sigRef, onSigFile, existingSignatureNote,
}: BodyProps) {
  const defaultDeptOptions = departments.filter(d => vals.Departments.includes(d.uid))

  return (
    <>
      <div style={{ display: activeTab === 'Default' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
        <div className="grid grid-cols-2 gap-3">
          <Txt label="Salutation" value={vals.Salutation} onChange={v => set('Salutation', v)} placeholder="e.g. Mr, Mrs, Dr" />
          <Txt label="Job Title" value={vals.JobTitle} onChange={v => set('JobTitle', v)} />
          <Txt label="First name" value={vals.Firstname} onChange={v => set('Firstname', v)} required error={errors?.Firstname?.[0]} />
          <Txt label="Surname" value={vals.Surname} onChange={v => set('Surname', v)} required error={errors?.Surname?.[0]} />
          <Txt label="Middle initial" value={vals.Middleinitial} onChange={v => set('Middleinitial', v)} />
          <Txt label="Middle name" value={vals.Middlename} onChange={v => set('Middlename', v)} />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Signature</label>
          <input ref={sigRef} type="file" accept="image/*" className="hidden" onChange={onSigFile} />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => sigRef.current?.click()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#F9FAFB', cursor: 'pointer' }}>
              Choose Image
            </button>
            <span className="text-xs truncate" style={{ color: sigName ? '#374151' : '#374151' }}>
              {sigName || existingSignatureNote || 'No file chosen'}
            </span>
          </div>
          <p className="mt-1" style={{ fontSize: 10, color: '#374151' }}>Ideal size 250×150px, used on printed reports.</p>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Departments</label>
          <div className="rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto xl-visible-scrollbar" style={{ border: '1px solid #D1D5DB' }}>
            {departments.length === 0
              ? <p style={{ fontSize: 11, color: '#374151' }}>No departments available</p>
              : departments.map(d => (
                <label key={d.uid} className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#374151' }}>
                  <input type="checkbox" checked={vals.Departments.includes(d.uid)} onChange={() => toggleDept(d.uid)} />
                  {d.title}
                </label>
              ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Default Department</label>
          <select value={vals.DefaultDepartment} onChange={e => set('DefaultDepartment', e.target.value)}
            className={inputBase} style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
            <option value="">— None —</option>
            {defaultDeptOptions.map(d => <option key={d.uid} value={d.uid}>{d.title}</option>)}
          </select>
          {vals.DefaultDepartment && !vals.Departments.includes(vals.DefaultDepartment) && (
            <p className="mt-0.5" style={{ fontSize: 10, color: '#374151' }}>Select the department above to keep it as default.</p>
          )}
        </div>
      </div>

      <div style={{ display: activeTab === 'Email telephone fax' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
        <Txt label="Email Address" value={vals.EmailAddress} onChange={v => set('EmailAddress', v)} placeholder="name@lab.com" />
        <Txt label="Phone (business)" value={vals.BusinessPhone} onChange={v => set('BusinessPhone', v)} />
        <Txt label="Fax (business)" value={vals.BusinessFax} onChange={v => set('BusinessFax', v)} />
        <Txt label="Phone (home)" value={vals.HomePhone} onChange={v => set('HomePhone', v)} />
        <Txt label="Phone (mobile)" value={vals.MobilePhone} onChange={v => set('MobilePhone', v)} />
      </div>

      <div style={{ display: activeTab === 'Address' ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
        <AddressBlock
          title="Physical address" addr={vals.PhysicalAddress}
          onChange={(k, v) => setAddr('PhysicalAddress', k, v)}
          copyOptions={[{ label: 'Postal address', source: vals.PostalAddress }]}
        />
        <AddressBlock
          title="Postal address" addr={vals.PostalAddress}
          onChange={(k, v) => setAddr('PostalAddress', k, v)}
          copyOptions={[{ label: 'Physical address', source: vals.PhysicalAddress }]}
        />
      </div>
    </>
  )
}

// SENAITE-style "Copy from" — copies another address block's field values
// into this block's fields in one click. Matches ClientsShell.tsx's pattern.
function CopyFromMenu({ options, onCopy }: { options: { label: string; source: Address }[]; onCopy: (source: Address) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  if (!options.length) return null
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
        style={{ border: '1px solid #BFDBFE', color: '#2563EB', background: '#fff', cursor: 'pointer' }}>
        <MI name="content_copy" size={12} color="#2563EB" /> Copy from
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 20, backgroundColor: '#fff', border: '1px solid #E8EAF2', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 150, padding: '4px 0' }}>
          {options.map(o => (
            <button key={o.label} type="button" onClick={() => { onCopy(o.source); setOpen(false) }}
              className="flex items-center w-full px-3 py-1.5 text-xs hover:bg-gray-50" style={{ color: '#374151', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AddressBlock({ title, addr, onChange, copyOptions }: {
  title: string; addr: Address; onChange: (k: keyof Address, v: string) => void
  copyOptions?: { label: string; source: Address }[]
}) {
  function copyFrom(source: Address) {
    (Object.keys(source) as (keyof Address)[]).forEach(k => onChange(k, source[k]))
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 700, color: '#374151', letterSpacing: '0.06em' }}>{title}</p>
        {copyOptions && <CopyFromMenu options={copyOptions} onCopy={copyFrom} />}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ADDR_FIELDS.map(f => (
          <Txt key={f.key} label={f.label} value={addr[f.key]} onChange={v => onChange(f.key, v)} />
        ))}
      </div>
    </div>
  )
}

export { MI as LabContactMI }

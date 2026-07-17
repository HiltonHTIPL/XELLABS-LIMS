'use client'
import { useState, useActionState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  createLabContact, updateLabContact,
  type LabContactRow, type LabContactFormState, type Address,
} from '@/app/actions/lab-contacts'
import type { RefOption } from '../../_components/AdminRefShell'

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

const EMPTY_ADDR: Address = { address: '', city: '', zip: '', state: '', district: '', country: '' }

type FV = {
  Salutation: string; Firstname: string; Middleinitial: string; Middlename: string; Surname: string
  EmailAddress: string; BusinessPhone: string; BusinessFax: string; HomePhone: string; MobilePhone: string
  JobTitle: string; Department: string
  Departments: string[]; DefaultDepartment: string
  PhysicalAddress: Address; PostalAddress: Address
  Signature: string  // base64 data-URI (new upload only)
}
function blankFV(): FV {
  return {
    Salutation: '', Firstname: '', Middleinitial: '', Middlename: '', Surname: '',
    EmailAddress: '', BusinessPhone: '', BusinessFax: '', HomePhone: '', MobilePhone: '',
    JobTitle: '', Department: '', Departments: [], DefaultDepartment: '',
    PhysicalAddress: { ...EMPTY_ADDR }, PostalAddress: { ...EMPTY_ADDR }, Signature: '',
  }
}
function rowToFV(r: LabContactRow): FV {
  return {
    Salutation: r.Salutation, Firstname: r.Firstname, Middleinitial: r.Middleinitial,
    Middlename: r.Middlename, Surname: r.Surname, EmailAddress: r.EmailAddress,
    BusinessPhone: r.BusinessPhone, BusinessFax: r.BusinessFax, HomePhone: r.HomePhone,
    MobilePhone: r.MobilePhone, JobTitle: r.JobTitle, Department: r.Department,
    Departments: r.Departments, DefaultDepartment: r.DefaultDepartment,
    PhysicalAddress: { ...r.PhysicalAddress }, PostalAddress: { ...r.PostalAddress }, Signature: '',
  }
}

const ADDR_FIELDS: { key: keyof Address; label: string }[] = [
  { key: 'address', label: 'Address' }, { key: 'city', label: 'City' }, { key: 'zip', label: 'Zip' },
  { key: 'district', label: 'District' }, { key: 'state', label: 'State' }, { key: 'country', label: 'Country' },
]

type TabKey = 'overview' | 'contact' | 'address'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'contact', label: 'Contact' },
  { key: 'address', label: 'Address' },
]

export default function LabContactsShell({ rows, departments }: { rows: LabContactRow[]; departments: RefOption[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LabContactRow | null>(null)
  const [vals, setVals] = useState<FV>(blankFV())
  const [sigName, setSigName] = useState('')
  const [tab, setTab] = useState<TabKey>('overview')
  const sigRef = useRef<HTMLInputElement>(null)
  const isEditing = editing !== null

  const [state, action, pending] = useActionState(
    async (prev: LabContactFormState, fd: FormData) => {
      const path = fd.get('_path') as string | null
      const result = path ? await updateLabContact(path, prev, fd) : await createLabContact(prev, fd)
      if (result.success) { closeForm(); router.refresh() }
      else if (result.errors?.Firstname || result.errors?.Surname) setTab('overview')
      return result
    },
    {},
  )

  function openCreate() { setEditing(null); setVals(blankFV()); setSigName(''); setTab('overview'); setShowForm(true) }
  function openEdit(r: LabContactRow) { setEditing(r); setVals(rowToFV(r)); setSigName(''); setTab('overview'); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditing(null); setSigName('') }
  function set<K extends keyof FV>(k: K, v: FV[K]) { setVals(p => ({ ...p, [k]: v })) }
  function setAddr(which: 'PhysicalAddress' | 'PostalAddress', key: keyof Address, v: string) {
    setVals(p => ({ ...p, [which]: { ...p[which], [key]: v } }))
  }
  function toggleDept(uid: string) {
    setVals(p => ({ ...p, Departments: p.Departments.includes(uid) ? p.Departments.filter(u => u !== uid) : [...p.Departments, uid] }))
  }
  function onSigFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) { setSigName(''); set('Signature', ''); return }
    setSigName(f.name)
    const reader = new FileReader()
    reader.onload = () => set('Signature', String(reader.result))
    reader.readAsDataURL(f)
  }

  // Default Department options limited to the selected Departments (SENAITE rule)
  const defaultDeptOptions = departments.filter(d => vals.Departments.includes(d.uid))
  const deptTitle = (uid: string) => departments.find(d => d.uid === uid)?.title ?? ''

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-3" style={{ flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Lab Contacts</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage laboratory staff and their contact details</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New Lab Contact
        </button>
      </div>

      <div style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: showForm ? 'auto' : 'none' }}>
        <div onClick={closeForm} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showForm ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 520, maxWidth: '94vw', backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showForm ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEditing ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEditing ? 'edit' : 'contact_page'} size={16} color={isEditing ? '#2563EB' : '#0154FC'} />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEditing ? `Edit — ${editing.title}` : 'New Lab Contact'}</h2>
            </div>
            <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
          </div>

          <form action={action} className="flex flex-col flex-1 min-h-0">
            {isEditing && <input type="hidden" name="_path" value={editing.path} />}
            {/* hidden serialization */}
            {(['Salutation', 'Firstname', 'Middleinitial', 'Middlename', 'Surname', 'EmailAddress', 'BusinessPhone', 'BusinessFax', 'HomePhone', 'MobilePhone', 'JobTitle', 'Department', 'DefaultDepartment', 'Signature'] as const).map(k => (
              <input key={k} type="hidden" name={k} value={vals[k] as string} />
            ))}
            {vals.Departments.map(uid => <input key={`d-${uid}`} type="hidden" name="Departments" value={uid} />)}
            {ADDR_FIELDS.map(f => <input key={`ph-${f.key}`} type="hidden" name={`physical_${f.key}`} value={vals.PhysicalAddress[f.key]} />)}
            {ADDR_FIELDS.map(f => <input key={`po-${f.key}`} type="hidden" name={`postal_${f.key}`} value={vals.PostalAddress[f.key]} />)}

            <div className="flex gap-1 px-6 pt-3 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
              {TABS.map(t => (
                <button key={t.key} type="button" onClick={() => setTab(t.key)}
                  className="px-3 py-2 text-xs font-medium"
                  style={{
                    color: tab === t.key ? '#0154FC' : '#6B7280',
                    borderBottom: tab === t.key ? '2px solid #0154FC' : '2px solid transparent',
                    marginBottom: -1,
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {tab === 'overview' && (
                <>
                  <Section title="Personal">
                    <div className="grid grid-cols-2 gap-3">
                      <Txt label="Salutation" value={vals.Salutation} onChange={v => set('Salutation', v)} placeholder="e.g. Dr" />
                      <Txt label="Job Title" value={vals.JobTitle} onChange={v => set('JobTitle', v)} />
                      <Txt label="First name" value={vals.Firstname} onChange={v => set('Firstname', v)} required error={state.errors?.Firstname?.[0]} />
                      <Txt label="Surname" value={vals.Surname} onChange={v => set('Surname', v)} required error={state.errors?.Surname?.[0]} />
                      <Txt label="Middle initial" value={vals.Middleinitial} onChange={v => set('Middleinitial', v)} />
                      <Txt label="Middle name" value={vals.Middlename} onChange={v => set('Middlename', v)} />
                    </div>
                  </Section>

                  <Section title="Departments">
                    <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Assigned Departments</label>
                    <div className="rounded-lg p-2 space-y-1 max-h-36 overflow-y-auto" style={{ border: '1px solid #D1D5DB' }}>
                      {departments.length === 0
                        ? <p style={{ fontSize: 11, color: '#9CA3AF' }}>No departments available</p>
                        : departments.map(d => (
                          <label key={d.uid} className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#374151' }}>
                            <input type="checkbox" checked={vals.Departments.includes(d.uid)} onChange={() => toggleDept(d.uid)} />
                            {d.title}
                          </label>
                        ))}
                    </div>
                    <div className="mt-2">
                      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Default Department</label>
                      <select value={vals.DefaultDepartment} onChange={e => set('DefaultDepartment', e.target.value)}
                        className={inputBase} style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                        <option value="">— None —</option>
                        {defaultDeptOptions.map(d => <option key={d.uid} value={d.uid}>{d.title}</option>)}
                      </select>
                      {vals.DefaultDepartment && !vals.Departments.includes(vals.DefaultDepartment) && (
                        <p className="mt-0.5" style={{ fontSize: 10, color: '#9CA3AF' }}>Select the department above to keep it as default.</p>
                      )}
                    </div>
                  </Section>

                  <Section title="Signature">
                    <input ref={sigRef} type="file" accept="image/*" className="hidden" onChange={onSigFile} />
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => sigRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#F9FAFB', cursor: 'pointer' }}>
                        Choose Image
                      </button>
                      <span className="text-xs truncate" style={{ color: sigName ? '#374151' : '#9CA3AF' }}>
                        {sigName || (isEditing && editing?.Signature ? 'Signature on file (upload to replace)' : 'No file chosen')}
                      </span>
                    </div>
                    <p className="mt-1" style={{ fontSize: 10, color: '#9CA3AF' }}>Ideal size 250×150px, used on printed reports.</p>
                  </Section>
                </>
              )}

              {tab === 'contact' && (
                <Section title="Contact">
                  <div className="grid grid-cols-2 gap-3">
                    <Txt label="Email" value={vals.EmailAddress} onChange={v => set('EmailAddress', v)} placeholder="name@lab.com" />
                    <Txt label="Phone (business)" value={vals.BusinessPhone} onChange={v => set('BusinessPhone', v)} />
                    <Txt label="Fax (business)" value={vals.BusinessFax} onChange={v => set('BusinessFax', v)} />
                    <Txt label="Phone (mobile)" value={vals.MobilePhone} onChange={v => set('MobilePhone', v)} />
                    <Txt label="Phone (home)" value={vals.HomePhone} onChange={v => set('HomePhone', v)} />
                  </div>
                </Section>
              )}

              {tab === 'address' && (
                <>
                  <AddressSection title="Physical Address" addr={vals.PhysicalAddress} onChange={(k, v) => setAddr('PhysicalAddress', k, v)} />
                  <AddressSection title="Postal Address" addr={vals.PostalAddress} onChange={(k, v) => setAddr('PostalAddress', k, v)}
                    onCopyFrom={() => setVals(p => ({ ...p, PostalAddress: { ...p.PhysicalAddress } }))} />
                </>
              )}

              {state.message && !state.success && <p className="text-xs" style={{ color: '#DC2626' }}>{state.message}</p>}
            </div>

            <div className="px-6 py-4 flex gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
              <button type="button" onClick={closeForm} className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium" style={{ border: '1px solid #D1D5DB', color: '#374151' }}>
                <MI name="close" size={13} color="#374151" /> Cancel
              </button>
              <div className="flex-1" />
              <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium text-white"
                style={{ backgroundColor: pending ? '#DBEAFE' : isEditing ? '#2563EB' : '#0154FC', cursor: pending ? 'not-allowed' : 'pointer' }}>
                <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
                {pending ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {state.success && (
        <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#DBEAFE', border: '1px solid #93C5FD', color: '#0154FC', flexShrink: 0 }}>
          <div className="flex items-center gap-2"><MI name="check_circle" size={13} color="#0154FC" /><span>{state.message}</span></div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      {rows.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="contact_page" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No lab contacts yet</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Lab Contact
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup><col style={{ width: '26%' }} /><col style={{ width: '24%' }} /><col style={{ width: '18%' }} /><col style={{ width: '24%' }} /><col style={{ width: '8%' }} /></colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Email', 'Job Title', 'Departments', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.uid} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs font-medium truncate" style={{ color: '#111827' }}>{r.title || '—'}</td>
                  <td className="px-3 py-2 text-xs truncate" style={{ color: '#6B7280' }}>{r.EmailAddress || '—'}</td>
                  <td className="px-3 py-2 text-xs truncate" style={{ color: '#6B7280' }}>{r.JobTitle || '—'}</td>
                  <td className="px-3 py-2 text-xs truncate" style={{ color: '#6B7280' }}>{r.Departments.map(deptTitle).filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => openEdit(r)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                      <MI name="edit" size={14} color="#6B7280" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{rows.length} lab contact{rows.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="uppercase tracking-wide mb-2" style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em' }}>{title}</p>
      {children}
    </div>
  )
}

function AddressSection({ title, addr, onChange, onCopyFrom }: {
  title: string; addr: Address; onChange: (k: keyof Address, v: string) => void; onCopyFrom?: () => void
}) {
  return (
    <Section title={title}>
      {onCopyFrom && (
        <button type="button" onClick={onCopyFrom} className="mb-2 flex items-center gap-1" style={{ fontSize: 11, color: '#0154FC', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <span className="material-icons" style={{ fontSize: 13, lineHeight: 1 }}>content_copy</span>
          Copy from Physical Address
        </button>
      )}
      <div className="grid grid-cols-2 gap-3">
        {ADDR_FIELDS.map(f => (
          <Txt key={f.key} label={f.label} value={addr[f.key]} onChange={v => onChange(f.key, v)} />
        ))}
      </div>
    </Section>
  )
}

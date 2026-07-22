'use client'
import { useState, useActionState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  createLabContact, updateLabContact,
  type LabContactRow, type LabContactFormState, type Address,
} from '@/app/actions/lab-contacts'
import type { RefOption } from '../../_components/AdminRefShell'
import DataTable, { type DataTableColumn } from '../../_components/DataTable'
import {
  LAB_CONTACT_TABS, type LabContactTab, type LabContactFV,
  blankLabContactFV, labContactRowToFV, LabContactTabBar, LabContactFormBody,
} from '../../_components/LabContactForm'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export default function LabContactsShell({ rows, departments }: { rows: LabContactRow[]; departments: RefOption[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LabContactRow | null>(null)
  const [vals, setVals] = useState<LabContactFV>(blankLabContactFV())
  const [activeTab, setActiveTab] = useState<LabContactTab>(LAB_CONTACT_TABS[0])
  const [sigName, setSigName] = useState('')
  const sigRef = useRef<HTMLInputElement>(null)
  const isEditing = editing !== null

  const [state, action, pending] = useActionState(
    async (prev: LabContactFormState, fd: FormData) => {
      const path = fd.get('_path') as string | null
      const result = path ? await updateLabContact(path, prev, fd) : await createLabContact(prev, fd)
      if (result.success) { closeForm(); router.refresh() }
      else if (result.errors?.Firstname || result.errors?.Surname) setActiveTab(LAB_CONTACT_TABS[0])
      return result
    },
    {},
  )

  function openCreate() { setEditing(null); setVals(blankLabContactFV()); setSigName(''); setActiveTab(LAB_CONTACT_TABS[0]); setShowForm(true) }
  function openEdit(r: LabContactRow) { setEditing(r); setVals(labContactRowToFV(r)); setSigName(''); setActiveTab(LAB_CONTACT_TABS[0]); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditing(null); setSigName('') }
  function set<K extends keyof LabContactFV>(k: K, v: LabContactFV[K]) { setVals(p => ({ ...p, [k]: v })) }
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

  const deptTitle = (uid: string) => departments.find(d => d.uid === uid)?.title ?? ''

  // LabContactRow has no `id` — key by uid for the shared table. Departments is a
  // string[] of uids, so expose a joined label string as a sortable/renderable primitive.
  type Row = LabContactRow & { id: string; departmentsLabel: string }
  const tableRows: Row[] = rows.map(r => ({
    ...r,
    id: r.uid,
    departmentsLabel: r.Departments.map(deptTitle).filter(Boolean).join(', '),
  }))
  const columns: DataTableColumn<Row>[] = [
    {
      id: 'title', label: 'Name', sortable: true, minWidth: 220,
      render: r => <span className="text-xs font-medium" style={{ color: '#111827' }}>{r.title || '—'}</span>,
    },
    {
      id: 'EmailAddress', label: 'Email', sortable: true, minWidth: 200,
      render: r => <span className="text-xs" style={{ color: '#374151' }}>{r.EmailAddress || '—'}</span>,
    },
    {
      id: 'JobTitle', label: 'Job Title', sortable: true, minWidth: 150,
      render: r => <span className="text-xs" style={{ color: '#374151' }}>{r.JobTitle || '—'}</span>,
    },
    {
      id: 'departmentsLabel', label: 'Departments', sortable: true, minWidth: 200,
      render: r => <span className="text-xs" style={{ color: '#374151' }}>{r.departmentsLabel || '—'}</span>,
    },
  ]

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-3" style={{ flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Lab Contacts</h1>
          <p className="text-sm mt-0.5" style={{ color: '#374151' }}>Manage laboratory staff and their contact details</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New Lab Contact
        </button>
      </div>

      <div style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: showForm ? 'auto' : 'none' }}>
        <div onClick={closeForm} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showForm ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 'var(--dashboard-header-h)', right: 0, bottom: 'var(--dashboard-footer-h)', width: 640, maxWidth: '94vw', backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showForm ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEditing ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEditing ? 'edit' : 'contact_page'} size={16} color={isEditing ? '#2563EB' : '#0154FC'} />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEditing ? `Edit — ${editing.title}` : 'New Lab Contact'}</h2>
            </div>
            <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#374151" /></button>
          </div>

          <LabContactTabBar activeTab={activeTab} onChange={setActiveTab} />

          <form action={action} className="flex flex-col flex-1 min-h-0">
            {isEditing && <input type="hidden" name="_path" value={editing.path} />}
            {/* hidden serialization — every tab's values stay submitted regardless of which tab is visible */}
            {(['Salutation', 'Firstname', 'Middleinitial', 'Middlename', 'Surname', 'EmailAddress', 'BusinessPhone', 'BusinessFax', 'HomePhone', 'MobilePhone', 'JobTitle', 'Department', 'DefaultDepartment', 'Signature'] as const).map(k => (
              <input key={k} type="hidden" name={k} value={vals[k] as string} />
            ))}
            {vals.Departments.map(uid => <input key={`d-${uid}`} type="hidden" name="Departments" value={uid} />)}
            {(['country', 'state', 'district', 'city', 'zip', 'address'] as const).map(k => (
              <input key={`ph-${k}`} type="hidden" name={`physical_${k}`} value={vals.PhysicalAddress[k]} />
            ))}
            {(['country', 'state', 'district', 'city', 'zip', 'address'] as const).map(k => (
              <input key={`po-${k}`} type="hidden" name={`postal_${k}`} value={vals.PostalAddress[k]} />
            ))}

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <LabContactFormBody
                activeTab={activeTab}
                vals={vals}
                errors={state.errors}
                departments={departments}
                set={set}
                setAddr={setAddr}
                toggleDept={toggleDept}
                sigName={sigName}
                sigRef={sigRef}
                onSigFile={onSigFile}
                existingSignatureNote={isEditing && editing?.Signature ? 'Signature on file (upload to replace)' : undefined}
              />
              {state.message && !state.success && <p className="mt-3 text-xs" style={{ color: '#DC2626' }}>{state.message}</p>}
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

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {rows.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="contact_page" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#374151' }}>No lab contacts yet</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Lab Contact
          </button>
        </div>
      ) : (
        <DataTable<Row>
          data={tableRows}
          columns={columns}
          searchable
          persistKey="lab-contacts"
          emptyMessage="No lab contacts found."
          rowActions={r => (
            <button onClick={() => openEdit(r)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }} title="Edit">
              <MI name="edit" size={14} color="#6B7280" />
            </button>
          )}
        />
      )}
      </div>
    </div>
  )
}

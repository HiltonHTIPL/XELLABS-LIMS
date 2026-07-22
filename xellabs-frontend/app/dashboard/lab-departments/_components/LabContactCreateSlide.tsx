'use client'
import { useActionState, useRef, useState } from 'react'
import { createLabContact, type Address, type LabContactFormState } from '@/app/actions/lab-contacts'
import type { RefOption } from '../../_components/AdminRefShell'
import {
  LAB_CONTACT_TABS, type LabContactTab, type LabContactFV,
  blankLabContactFV, LabContactTabBar, LabContactFormBody,
} from '../../_components/LabContactForm'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const ADDR_KEYS = ['country', 'state', 'district', 'city', 'zip', 'address'] as const

/**
 * Full multi-tab "New Lab Contact" slide, launched from Lab Department's
 * Manager field (select-or-add) instead of the generic flat quick-create
 * form — reuses the same shared field set/tabs as the standalone Lab
 * Contacts page (LabContactForm.tsx) so both stay in sync.
 */
export default function LabContactCreateSlide({
  open, onClose, onCreated, departments,
}: {
  open: boolean
  onClose: () => void
  onCreated: (option: RefOption) => void
  departments: RefOption[]
}) {
  const [vals, setVals] = useState<LabContactFV>(blankLabContactFV())
  const [activeTab, setActiveTab] = useState<LabContactTab>(LAB_CONTACT_TABS[0])
  const [sigName, setSigName] = useState('')
  const sigRef = useRef<HTMLInputElement>(null)

  const [state, action, pending] = useActionState(
    async (prev: LabContactFormState, fd: FormData) => {
      const result = await createLabContact(prev, fd)
      if (result.success && result.uid) {
        onCreated({ uid: result.uid, title: result.title ?? '' })
        reset()
      }
      return result
    },
    {},
  )

  function reset() {
    setVals(blankLabContactFV()); setSigName(''); setActiveTab(LAB_CONTACT_TABS[0])
  }
  function handleClose() { reset(); onClose() }
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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, pointerEvents: open ? 'auto' : 'none' }}>
      <div onClick={handleClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: open ? 1 : 0, transition: 'opacity 0.25s ease' }} />
      <div style={{
        position: 'absolute', top: 'var(--dashboard-header-h)', right: 0, bottom: 'var(--dashboard-footer-h)', width: 640, maxWidth: '94vw', backgroundColor: '#fff',
        boxShadow: '-6px 0 32px rgba(0,0,0,0.12)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
              <MI name="contact_page" size={16} color="#0154FC" />
            </div>
            <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>New Lab Contact</h2>
          </div>
          <button type="button" onClick={handleClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <MI name="close" size={16} color="#374151" />
          </button>
        </div>

        <LabContactTabBar activeTab={activeTab} onChange={setActiveTab} />

        <form action={action} className="flex flex-col flex-1 min-h-0">
          {(['Salutation', 'Firstname', 'Middleinitial', 'Middlename', 'Surname', 'EmailAddress', 'BusinessPhone', 'BusinessFax', 'HomePhone', 'MobilePhone', 'JobTitle', 'Department', 'DefaultDepartment', 'Signature'] as const).map(k => (
            <input key={k} type="hidden" name={k} value={vals[k] as string} />
          ))}
          {vals.Departments.map(uid => <input key={`d-${uid}`} type="hidden" name="Departments" value={uid} />)}
          {ADDR_KEYS.map(k => <input key={`ph-${k}`} type="hidden" name={`physical_${k}`} value={vals.PhysicalAddress[k]} />)}
          {ADDR_KEYS.map(k => <input key={`po-${k}`} type="hidden" name={`postal_${k}`} value={vals.PostalAddress[k]} />)}

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
            />
            {state.message && !state.success && <p className="mt-3 text-xs" style={{ color: '#DC2626' }}>{state.message}</p>}
          </div>

          <div className="px-6 py-4 flex gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button type="button" onClick={handleClose} className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium" style={{ border: '1px solid #D1D5DB', color: '#374151' }}>
              <MI name="close" size={13} color="#374151" /> Cancel
            </button>
            <div className="flex-1" />
            <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium text-white"
              style={{ backgroundColor: pending ? '#DBEAFE' : '#0154FC', cursor: pending ? 'not-allowed' : 'pointer' }}>
              <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
              {pending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createSampleContainerFull, updateSampleContainerFull,
  createContainerTypeInline, createPreservationInline,
  type SampleContainerFormState, type CreateRefOptionState,
} from '@/app/actions/sample-containers'
import type { SenaiteSampleContainer, SenaiteRefOption } from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({
  label, name, placeholder, required, error, value, onChange,
}: {
  label: string; name: string; placeholder?: string
  required?: boolean; error?: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      <input name={name} placeholder={placeholder} required={required} value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
        style={{ border: `1px solid ${error ? '#FCA5A5' : '#D1D5DB'}`, color: '#111827' }} />
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

function SelectField({
  label, name, value, onChange, options, error,
}: {
  label: string; name: string; value: string; onChange: (v: string) => void
  options: SenaiteRefOption[]; error?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>{label}</label>
      <select name={name} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none bg-white"
        style={{ border: `1px solid ${error ? '#FCA5A5' : '#D1D5DB'}`, color: '#111827' }}>
        <option value="">None</option>
        {options.map(o => <option key={o.uid} value={o.uid}>{o.title}</option>)}
      </select>
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
      {options.length === 0 && (
        <p className="mt-0.5 text-xs" style={{ color: '#9CA3AF' }}>None configured yet in the lab system.</p>
      )}
    </div>
  )
}

function InlineCreateBox({
  label, buttonLabel, onCreate, pending,
}: {
  label: string; buttonLabel: string; pending: boolean
  onCreate: (title: string, description: string) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  return (
    <div className="p-3 rounded-lg flex flex-col gap-2" style={{ backgroundColor: '#F9FAFB', border: '1px dashed #D1D5DB' }}>
      <p className="text-xs font-medium" style={{ color: '#374151' }}>{label}</p>
      <input placeholder="Name" value={title} onChange={e => setTitle(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
      <input placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
      <button type="button" disabled={!title.trim() || pending}
        onClick={() => { onCreate(title.trim(), description.trim()); setTitle(''); setDescription('') }}
        className="self-start flex items-center gap-1.5"
        style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: (!title.trim() || pending) ? 0.6 : 1 }}>
        <MI name={pending ? 'hourglass_top' : 'add'} size={13} color="#fff" />
        {pending ? 'Creating…' : buttonLabel}
      </button>
    </div>
  )
}

type FV = {
  title: string; description: string; capacity: string
  containerTypeUid: string; preservationUid: string
  prePreserved: boolean; securitySealIntact: boolean
}
const blank = (): FV => ({
  title: '', description: '', capacity: '',
  containerTypeUid: '', preservationUid: '',
  prePreserved: false, securitySealIntact: false,
})

const initialState: SampleContainerFormState = {}

export default function SampleContainersShell({
  initialSampleContainers, containerTypes, preservations,
}: {
  initialSampleContainers: SenaiteSampleContainer[]
  containerTypes: SenaiteRefOption[]
  preservations: SenaiteRefOption[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SenaiteSampleContainer | null>(null)
  const [vals, setVals] = useState<FV>(blank)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [containerTypeOptions, setContainerTypeOptions] = useState(containerTypes)
  const [preservationOptions, setPreservationOptions] = useState(preservations)
  const isEditing = editing !== null

  function setVal<K extends keyof FV>(key: K, value: FV[K]) {
    setVals(prev => ({ ...prev, [key]: value }))
  }

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), ok ? 4000 : 6000)
  }

  const [, createContainerTypeAction, creatingContainerType] = useActionState(
    async (prev: CreateRefOptionState, fd: FormData) => {
      const result = await createContainerTypeInline(prev, fd)
      if (result.success && result.option) {
        setContainerTypeOptions(prev => [...prev, result.option!])
        setVal('containerTypeUid', result.option.uid)
        showToast(true, result.message ?? 'Container type created.')
      } else if (result.message) showToast(false, result.message)
      return result
    },
    {}
  )

  const [, createPreservationAction, creatingPreservation] = useActionState(
    async (prev: CreateRefOptionState, fd: FormData) => {
      const result = await createPreservationInline(prev, fd)
      if (result.success && result.option) {
        setPreservationOptions(prev => [...prev, result.option!])
        setVal('preservationUid', result.option.uid)
        showToast(true, result.message ?? 'Preservation created.')
      } else if (result.message) showToast(false, result.message)
      return result
    },
    {}
  )

  const [state, action, pending] = useActionState(
    async (prev: SampleContainerFormState, formData: FormData) => {
      const uid = formData.get('_uid') as string | null
      const url = formData.get('_url') as string | null
      const result = uid && url
        ? await updateSampleContainerFull(uid, url, prev, formData)
        : await createSampleContainerFull(prev, formData)
      if (result.success) {
        setShowForm(false); setEditing(null); setVals(blank())
        showToast(true, result.warning ? `${result.message} ${result.warning}` : (result.message ?? 'Saved.'))
        router.refresh()
      }
      return result
    },
    initialState
  )

  function containerToFV(c: SenaiteSampleContainer): FV {
    return {
      title: c.title, description: c.description, capacity: c.capacity,
      containerTypeUid: c.containerTypeUid, preservationUid: c.preservationUid,
      prePreserved: c.prePreserved, securitySealIntact: c.securitySealIntact,
    }
  }

  function openCreate() { setEditing(null); setVals(blank()); setShowForm(true) }
  function openEdit(c: SenaiteSampleContainer) { setEditing(c); setVals(containerToFV(c)); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditing(null) }

  const fieldErrors = state.errors ?? {}

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>

      <div className="flex items-center justify-between mb-3">
        <div>
          <button onClick={() => router.push('/dashboard/admin')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, marginBottom: 4, padding: 0 }}>
            <MI name="arrow_back" size={16} /> Back
          </button>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Sample Containers</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage physical sample containers</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New Sample Container
        </button>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999, backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, color: toast.ok ? '#0154FC' : '#991B1B', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {toast.msg}
        </div>
      )}

      {/* Drawer */}
      <div style={{ position: 'fixed', top: 56, bottom: 40, left: 0, right: 0, zIndex: 200, pointerEvents: showForm ? 'auto' : 'none' }}>
        <div onClick={closeForm} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showForm ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 460, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showForm ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>

          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEditing ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEditing ? 'edit' : 'add_box'} size={16} color={isEditing ? '#2563EB' : '#0154FC'} />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                {isEditing ? `Edit — ${editing.title}` : 'New Sample Container'}
              </h2>
            </div>
            <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
          </div>

          <form action={action} className="flex flex-col flex-1 min-h-0">
            {isEditing && <input type="hidden" name="_uid" value={editing.uid} />}
            {isEditing && <input type="hidden" name="_url" value={editing.url} />}
            <input type="hidden" name="title" value={vals.title} />
            <input type="hidden" name="description" value={vals.description} />
            <input type="hidden" name="capacity" value={vals.capacity} />
            <input type="hidden" name="containerTypeUid" value={vals.containerTypeUid} />
            <input type="hidden" name="preservationUid" value={vals.preservationUid} />

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <Field label="Name" name="title" placeholder="e.g. Amber Glass Vial" required
                value={vals.title} onChange={v => setVal('title', v)} error={fieldErrors.title?.[0]} />
              <Field label="Description" name="description" placeholder="Optional description"
                value={vals.description} onChange={v => setVal('description', v)} />
              <Field label="Capacity" name="capacity" placeholder="e.g. 10 ml"
                value={vals.capacity} onChange={v => setVal('capacity', v)} />

              <SelectField label="Container Type" name="containerTypeUid" value={vals.containerTypeUid}
                onChange={v => setVal('containerTypeUid', v)} options={containerTypeOptions} />
              <InlineCreateBox label="Create a new container type" buttonLabel="Add Container Type"
                pending={creatingContainerType}
                onCreate={(title, description) => {
                  const fd = new FormData(); fd.set('title', title); fd.set('description', description)
                  createContainerTypeAction(fd)
                }} />

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="prePreserved" checked={vals.prePreserved}
                  onChange={e => setVal('prePreserved', e.target.checked)} style={{ accentColor: '#0154FC' }} />
                <span className="text-xs font-medium" style={{ color: '#374151' }}>Pre-preserved</span>
              </label>
              <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: -8 }}>
                Check this box if this container is already preserved — short-circuits the preservation workflow for partitions stored in it.
              </p>

              <SelectField label="Preservation" name="preservationUid" value={vals.preservationUid}
                onChange={v => setVal('preservationUid', v)} options={preservationOptions} error={fieldErrors.preservationUid?.[0]} />
              <InlineCreateBox label="Create a new preservation" buttonLabel="Add Preservation"
                pending={creatingPreservation}
                onCreate={(title, description) => {
                  const fd = new FormData(); fd.set('title', title); fd.set('description', description)
                  createPreservationAction(fd)
                }} />

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="securitySealIntact" checked={vals.securitySealIntact}
                  onChange={e => setVal('securitySealIntact', e.target.checked)} style={{ accentColor: '#0154FC' }} />
                <span className="text-xs font-medium" style={{ color: '#374151' }}>Security seal intact</span>
              </label>

              {state.message && !state.success && (
                <p className="text-xs" style={{ color: '#DC2626' }}>{state.message}</p>
              )}
            </div>

            <div className="px-6 py-4 flex gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
              <button type="button" onClick={closeForm} className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium" style={{ border: '1px solid #D1D5DB', color: '#374151' }}>
                <MI name="close" size={13} color="#374151" /> Cancel
              </button>
              <div className="flex-1" />
              <button type="submit" disabled={pending}
                className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium text-white"
                style={{ backgroundColor: pending ? '#DBEAFE' : isEditing ? '#2563EB' : '#0154FC', cursor: pending ? 'not-allowed' : 'pointer' }}>
                <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
                {pending ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {initialSampleContainers.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="science" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No sample containers yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create your first sample container to get started</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Sample Container
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '22%' }} /><col style={{ width: '20%' }} /><col style={{ width: '13%' }} />
              <col style={{ width: '15%' }} /><col style={{ width: '20%' }} /><col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Container Type', 'Capacity', 'Pre-preserved', 'Preservation', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialSampleContainers.map((c, i) => {
                // The legacy v1 API's containertype/preservation reference objects
                // only carry {url, uid, api_url} — never a title — so the table
                // (unlike the edit drawer's <select>, which matches by uid) needs
                // to resolve the display title itself from the already-fetched
                // option lists rather than trusting c.containerTypeTitle/preservationTitle.
                const containerTypeTitle = containerTypeOptions.find(o => o.uid === c.containerTypeUid)?.title || c.containerTypeTitle
                const preservationTitle = preservationOptions.find(o => o.uid === c.preservationUid)?.title || c.preservationTitle
                return (
                <tr key={c.uid} style={{ borderBottom: i < initialSampleContainers.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs font-medium truncate" style={{ color: '#111827' }}>{c.title}</td>
                  <td className="px-3 py-2 text-xs truncate" style={{ color: '#6B7280' }}>{containerTypeTitle || '—'}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: '#6B7280' }}>{c.capacity || '—'}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: c.prePreserved ? '#0154FC' : '#6B7280' }}>{c.prePreserved ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2 text-xs truncate" style={{ color: '#6B7280' }}>{preservationTitle || '—'}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => openEdit(c)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                      <MI name="edit" size={14} color="#6B7280" />
                    </button>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialSampleContainers.length} sample container{initialSampleContainers.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

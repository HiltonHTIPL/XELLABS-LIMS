'use client'
import { useState, useActionState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  createSamplePointFull, updateSamplePointFull, toggleSamplePointActiveFull,
  type SamplePointFormState,
} from '@/app/actions/sample-points'
import type { SenaiteSamplePoint, SenaiteRefOption } from '@/app/lib/senaite'
import CheckboxList from '../../_components/CheckboxList'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({
  label, name, placeholder, required, value, onChange,
}: {
  label: string; name: string; placeholder?: string; required?: boolean; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      <input name={name} placeholder={placeholder} required={required} value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
        style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
    </div>
  )
}

type FV = {
  title: string; description: string; elevation: string; latitude: string; longitude: string
  frequencyDays: string; frequencyHours: string; frequencyMinutes: string
  composite: boolean; sampleTypeUids: string[]
}
const blank = (): FV => ({
  title: '', description: '', elevation: '', latitude: '', longitude: '',
  frequencyDays: '0', frequencyHours: '0', frequencyMinutes: '0',
  composite: false, sampleTypeUids: [],
})

const initialState: SamplePointFormState = {}

export default function SamplePointsShell({
  initialSamplePoints, sampleTypes,
}: {
  initialSamplePoints: SenaiteSamplePoint[]
  sampleTypes: SenaiteRefOption[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SenaiteSamplePoint | null>(null)
  const [vals, setVals] = useState<FV>(blank)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const [attachmentName, setAttachmentName] = useState('')
  const isEditing = editing !== null

  function setVal<K extends keyof FV>(key: K, value: FV[K]) {
    setVals(prev => ({ ...prev, [key]: value }))
  }

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), ok ? 4000 : 6000)
  }

  const [state, action, pending] = useActionState(
    async (prev: SamplePointFormState, formData: FormData) => {
      const uid = formData.get('_uid') as string | null
      const url = formData.get('_url') as string | null
      const result = uid && url
        ? await updateSamplePointFull(uid, url, prev, formData)
        : await createSamplePointFull(prev, formData)
      if (result.success) {
        setShowForm(false); setEditing(null); setVals(blank())
        showToast(true, result.warning ? `${result.message} ${result.warning}` : (result.message ?? 'Saved.'))
        router.refresh()
      }
      return result
    },
    initialState
  )

  function pointToFV(p: SenaiteSamplePoint): FV {
    return {
      title: p.title, description: p.description, elevation: p.elevation,
      latitude: p.latitude, longitude: p.longitude,
      frequencyDays: String(p.samplingFrequency.days), frequencyHours: String(p.samplingFrequency.hours),
      frequencyMinutes: String(p.samplingFrequency.minutes),
      composite: p.composite, sampleTypeUids: p.sampleTypeUids,
    }
  }

  function openCreate() { setEditing(null); setVals(blank()); setAttachmentName(''); setShowForm(true) }
  function openEdit(p: SenaiteSamplePoint) { setEditing(p); setVals(pointToFV(p)); setAttachmentName(''); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditing(null) }

  async function handleToggleActive(p: SenaiteSamplePoint) {
    const nextActive = p.reviewState !== 'active'
    setToggling(p.uid)
    const result = await toggleSamplePointActiveFull(p.url, nextActive)
    showToast(result.success, result.message)
    setToggling(null)
    router.refresh()
  }

  const fieldErrors = state.errors ?? {}

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>

      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Sample Points</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage the sample point options offered when building sample templates</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.refresh()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff' }}>
            <MI name="refresh" size={15} color="#6B7280" /> Refresh
          </button>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={15} color="#fff" /> New Sample Point
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* Drawer */}
      <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, zIndex: 200, pointerEvents: showForm ? 'auto' : 'none' }}>
        <div onClick={closeForm} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showForm ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 460, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showForm ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>

          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEditing ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEditing ? 'edit' : 'place'} size={16} color={isEditing ? '#2563EB' : '#0154FC'} />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                {isEditing ? `Edit — ${editing.title}` : 'New Sample Point'}
              </h2>
            </div>
            <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
          </div>

          <form action={action} className="flex flex-col flex-1 min-h-0" encType="multipart/form-data">
            {isEditing && <input type="hidden" name="_uid" value={editing.uid} />}
            {isEditing && <input type="hidden" name="_url" value={editing.url} />}
            <input type="hidden" name="title" value={vals.title} />
            <input type="hidden" name="description" value={vals.description} />
            <input type="hidden" name="elevation" value={vals.elevation} />
            <input type="hidden" name="latitude" value={vals.latitude} />
            <input type="hidden" name="longitude" value={vals.longitude} />
            <input type="hidden" name="frequencyDays" value={vals.frequencyDays} />
            <input type="hidden" name="frequencyHours" value={vals.frequencyHours} />
            <input type="hidden" name="frequencyMinutes" value={vals.frequencyMinutes} />
            <input type="hidden" name="sampleTypeUids" value={JSON.stringify(vals.sampleTypeUids)} />

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <Field label="Name" name="title" placeholder="e.g. Intake Point A" required
                value={vals.title} onChange={v => setVal('title', v)} />
              {fieldErrors.title && <p className="text-xs" style={{ color: '#EF4444', marginTop: -8 }}>{fieldErrors.title[0]}</p>}

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Description</label>
                <textarea rows={2} value={vals.description} onChange={e => setVal('description', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
              </div>

              <div>
                <p className="text-xs font-medium mb-1" style={{ color: '#374151' }}>Sampling Frequency</p>
                <p className="text-xs mb-1.5" style={{ color: '#9CA3AF' }}>If a sample is taken periodically at this point, enter frequency here, e.g. weekly</p>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Days" name="_freqDays" value={vals.frequencyDays} onChange={v => setVal('frequencyDays', v)} />
                  <Field label="Hours" name="_freqHours" value={vals.frequencyHours} onChange={v => setVal('frequencyHours', v)} />
                  <Field label="Minutes" name="_freqMinutes" value={vals.frequencyMinutes} onChange={v => setVal('frequencyMinutes', v)} />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium mb-1" style={{ color: '#374151' }}>Sample Types</p>
                <p className="text-xs mb-1.5" style={{ color: '#9CA3AF' }}>Sample types that can be collected at this point. Leave empty to allow all types.</p>
                <CheckboxList options={sampleTypes} selected={vals.sampleTypeUids} onChange={v => setVal('sampleTypeUids', v)} />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="composite" checked={vals.composite}
                  onChange={e => setVal('composite', e.target.checked)} style={{ accentColor: '#0154FC' }} />
                <span className="text-xs font-medium" style={{ color: '#374151' }}>Composite</span>
              </label>
              <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: -8 }}>
                Check this box if samples taken at this point are &apos;composite&apos; (combined from more than one sub-sample). Default (unchecked) indicates &apos;grab&apos; samples.
              </p>

              <div>
                <p className="text-xs font-medium mb-1" style={{ color: '#374151' }}>Location</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <Field label="Latitude" name="_lat" value={vals.latitude} onChange={v => setVal('latitude', v)} />
                  <Field label="Longitude" name="_lng" value={vals.longitude} onChange={v => setVal('longitude', v)} />
                </div>
                <Field label="Elevation" name="_elevation" placeholder="e.g. 10m" value={vals.elevation} onChange={v => setVal('elevation', v)} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Attachment</label>
                <input ref={attachmentInputRef} type="file" name="attachment" className="hidden"
                  onChange={e => setAttachmentName(e.target.files?.[0]?.name ?? '')} />
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => attachmentInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ border: '1px solid #D1D5DB', color: '#374151', background: '#fff', cursor: 'pointer' }}>
                    <MI name="upload_file" size={13} color="#6B7280" /> Choose File
                  </button>
                  <span className="text-xs" style={{ color: attachmentName ? '#111827' : '#9CA3AF' }}>{attachmentName || 'No file chosen'}</span>
                </div>
                {isEditing && editing.attachmentFilename && (
                  <p className="mt-1 text-xs" style={{ color: '#9CA3AF' }}>Current: {editing.attachmentFilename}</p>
                )}
              </div>

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

      {initialSamplePoints.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="place" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No sample points yet</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Sample Point
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '20%' }} /><col style={{ width: '28%' }} /><col style={{ width: '15%' }} />
              <col style={{ width: '10%' }} /><col style={{ width: '12%' }} /><col style={{ width: '15%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Description', 'Sample Types', 'Composite', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialSamplePoints.map((p, i) => {
                const active = p.reviewState === 'active'
                return (
                  <tr key={p.uid} style={{ borderBottom: i < initialSamplePoints.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                          <MI name="place" size={13} color="#0154FC" />
                        </div>
                        <span className="text-xs font-medium truncate" style={{ color: '#111827' }}>{p.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs truncate" style={{ color: p.description ? '#6B7280' : '#D1D5DB' }}>{p.description || '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{p.sampleTypeUids.length ? p.sampleTypeUids.length : 'All'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: p.composite ? '#0154FC' : '#6B7280' }}>{p.composite ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: active ? '#ECFDF5' : '#FFFBEB', color: active ? '#059669' : '#D97706' }}>
                        {active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openEdit(p)} title="Edit"
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium hover:bg-gray-50"
                          style={{ border: '1px solid #E8EAF2', background: '#fff', color: '#374151', cursor: 'pointer' }}>
                          <MI name="edit" size={13} color="#6B7280" /> Edit
                        </button>
                        <button onClick={() => handleToggleActive(p)} disabled={toggling === p.uid} title={active ? 'Deactivate' : 'Activate'}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium hover:opacity-80"
                          style={{
                            border: `1px solid ${active ? '#FCA5A5' : '#A7F3D0'}`,
                            background: active ? '#FEF2F2' : '#ECFDF5',
                            color: active ? '#DC2626' : '#059669',
                            cursor: toggling === p.uid ? 'not-allowed' : 'pointer',
                            opacity: toggling === p.uid ? 0.6 : 1,
                          }}>
                          <MI name={active ? 'block' : 'check_circle'} size={13} color={active ? '#DC2626' : '#059669'} />
                          {active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialSamplePoints.length} sample point{initialSamplePoints.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

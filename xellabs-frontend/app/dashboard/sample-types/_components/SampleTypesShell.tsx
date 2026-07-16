'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createSampleType, updateSampleType, createContainerType, createSampleMatrix, type SampleTypeFormState, type CreateRefOptionState } from '@/app/actions/sample-types'
import { type SenaiteSampleType, type SenaiteRefOption, STICKER_TEMPLATES } from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({
  label, name, placeholder, required, error, hint, value, onChange,
}: {
  label: string; name: string; placeholder?: string; required?: boolean
  error?: string; hint?: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
        {hint && <span className="ml-1 font-normal" style={{ color: '#9CA3AF' }}>{hint}</span>}
      </label>
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
        style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
      />
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

function SelectField({
  label, name, value, onChange, options, hint,
}: {
  label: string; name: string; value: string; onChange: (v: string) => void
  options: SenaiteRefOption[]; hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}
        {hint && <span className="ml-1 font-normal" style={{ color: '#9CA3AF' }}>{hint}</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none bg-white"
        style={{ border: '1px solid #D1D5DB', color: '#111827' }}
      >
        <option value="">None</option>
        {options.map(o => <option key={o.uid} value={o.uid}>{o.title}</option>)}
      </select>
      {options.length === 0 && (
        <p className="mt-0.5 text-xs" style={{ color: '#9CA3AF' }}>None configured yet in the lab system.</p>
      )}
    </div>
  )
}

type FV = {
  title: string; Prefix: string; MinimumVolume: string; description: string
  hazardous: boolean
  sampleMatrixUid: string; containerTypeUid: string
  retentionDays: string; retentionHours: string; retentionMinutes: string
  admittedStickers: string[]; smallDefaultSticker: string; largeDefaultSticker: string
}
const blank = (): FV => ({
  title: '', Prefix: '', MinimumVolume: '', description: '',
  hazardous: false,
  sampleMatrixUid: '', containerTypeUid: '',
  retentionDays: '30', retentionHours: '0', retentionMinutes: '0',
  admittedStickers: [], smallDefaultSticker: '', largeDefaultSticker: '',
})

export default function SampleTypesShell({
  initialSampleTypes, sampleMatrices, containerTypes,
}: {
  initialSampleTypes: SenaiteSampleType[]
  sampleMatrices: SenaiteRefOption[]
  containerTypes: SenaiteRefOption[]
}) {
  const router = useRouter()
  const [showDrawer, setShowDrawer] = useState(false)
  const [editing, setEditing] = useState<SenaiteSampleType | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [vals, setVals] = useState<FV>(blank)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [containerTypeOptions, setContainerTypeOptions] = useState(containerTypes)
  const [newContainerType, setNewContainerType] = useState({ title: '', description: '' })
  const [sampleMatrixOptions, setSampleMatrixOptions] = useState(sampleMatrices)
  const [newSampleMatrix, setNewSampleMatrix] = useState({ title: '', description: '' })

  const isEdit = editing !== null

  const [, createContainerTypeAction, creatingContainerType] = useActionState(
    async (prev: CreateRefOptionState, fd: FormData) => {
      const result = await createContainerType(prev, fd)
      if (result.success && result.option) {
        setContainerTypeOptions(prev => [...prev, result.option!])
        setVal('containerTypeUid', result.option.uid)
        setNewContainerType({ title: '', description: '' })
        setToast({ ok: true, msg: result.message ?? 'Container type created.' })
        setTimeout(() => setToast(null), 4000)
      } else if (result.message) {
        setToast({ ok: false, msg: result.message })
        setTimeout(() => setToast(null), 6000)
      }
      return result
    },
    {}
  )

  const [, createSampleMatrixAction, creatingSampleMatrix] = useActionState(
    async (prev: CreateRefOptionState, fd: FormData) => {
      const result = await createSampleMatrix(prev, fd)
      if (result.success && result.option) {
        setSampleMatrixOptions(prev => [...prev, result.option!])
        setVal('sampleMatrixUid', result.option.uid)
        setNewSampleMatrix({ title: '', description: '' })
        setToast({ ok: true, msg: result.message ?? 'Sample matrix created.' })
        setTimeout(() => setToast(null), 4000)
      } else if (result.message) {
        setToast({ ok: false, msg: result.message })
        setTimeout(() => setToast(null), 6000)
      }
      return result
    },
    {}
  )

  function setVal<K extends keyof FV>(k: K, v: FV[K]) {
    setVals(prev => ({ ...prev, [k]: v }))
    if (fieldErrors[k]) setFieldErrors(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  const [state, action, pending] = useActionState(
    async (prev: SampleTypeFormState, fd: FormData) => {
      const uid = fd.get('_editingUid') as string | null
      const result = uid ? await updateSampleType(uid, prev, fd) : await createSampleType(prev, fd)
      if (result.success) {
        setShowDrawer(false)
        setEditing(null)
        setVals(blank())
        setFieldErrors({})
        setToast({ ok: true, msg: result.message ?? (editing ? 'Sample type updated.' : 'Sample type created.') })
        setTimeout(() => setToast(null), 4000)
        router.refresh()
      } else if (result.errors) {
        const fe: Record<string, string> = {}
        for (const [k, msgs] of Object.entries(result.errors)) { if (msgs?.length) fe[k] = msgs[0] }
        setFieldErrors(fe)
      }
      return result
    },
    {}
  )

  function openCreate() { setEditing(null); setVals(blank()); setFieldErrors({}); setShowDrawer(true) }
  function openEdit(st: SenaiteSampleType) {
    setEditing(st)
    setVals({
      title: st.title,
      Prefix: st.Prefix ?? '',
      MinimumVolume: st.MinimumVolume ?? '',
      description: st.description ?? '',
      hazardous: st.Hazardous ?? false,
      sampleMatrixUid: st.SampleMatrixUid ?? '',
      containerTypeUid: st.ContainerTypeUid ?? '',
      retentionDays: String(st.RetentionPeriod?.days ?? 0),
      retentionHours: String(st.RetentionPeriod?.hours ?? 0),
      retentionMinutes: String(st.RetentionPeriod?.minutes ?? 0),
      admittedStickers: st.AdmittedStickerTemplates?.admitted ?? [],
      smallDefaultSticker: st.AdmittedStickerTemplates?.smallDefault ?? '',
      largeDefaultSticker: st.AdmittedStickerTemplates?.largeDefault ?? '',
    })
    setFieldErrors({})
    setShowDrawer(true)
  }
  function closeDrawer() { setShowDrawer(false) }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Sample Types</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage sample types used across the laboratory</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New Sample Type
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* ── Right Drawer ── */}
      <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, zIndex: 200, pointerEvents: showDrawer ? 'auto' : 'none' }}>
        <div onClick={closeDrawer} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showDrawer ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 460, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showDrawer ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEdit ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEdit ? 'edit' : 'add'} size={16} color={isEdit ? '#2563EB' : '#0154FC'} />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                  {isEdit ? `Edit — ${editing!.title}` : 'New Sample Type'}
                </h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                  {isEdit ? 'Update sample type details' : 'Create a new sample type'}
                </p>
              </div>
            </div>
            <button onClick={closeDrawer} className="p-1.5 rounded-lg hover:bg-gray-100">
              <MI name="close" size={16} color="#9CA3AF" />
            </button>
          </div>

          {/* Form */}
          <form action={action} className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {isEdit && <input type="hidden" name="_editingUid" value={editing!.uid} />}
            <div className="flex-1 px-5 py-4 flex flex-col gap-3">
              <Field label="Sample Type Name" name="title" placeholder="e.g. Blood Plasma" required
                error={fieldErrors.title} value={vals.title} onChange={v => setVal('title', v)} />

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Description</label>
                <textarea
                  name="description"
                  placeholder="Optional description"
                  value={vals.description}
                  onChange={e => setVal('description', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none"
                  style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <Field label="Prefix" name="Prefix" placeholder="e.g. BP" required
                    hint="(used in sample ID generation)"
                    error={fieldErrors.Prefix} value={vals.Prefix} onChange={v => setVal('Prefix', v)} />
                </div>
                <div className="flex-1">
                  <Field label="Minimum Volume" name="MinimumVolume" placeholder="e.g. 5 mL"
                    hint="(optional)" value={vals.MinimumVolume} onChange={v => setVal('MinimumVolume', v)} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                  Retention Period<span style={{ color: '#EF4444' }}> *</span>
                  <span className="ml-1 font-normal" style={{ color: '#9CA3AF' }}>(how long unpreserved samples stay valid)</span>
                </label>
                <div className="flex gap-2">
                  {(['retentionDays', 'retentionHours', 'retentionMinutes'] as const).map((k, i) => (
                    <div key={k} className="flex-1">
                      <input
                        name={k}
                        type="number"
                        min={0}
                        value={vals[k]}
                        onChange={e => setVal(k, e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                        style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                      />
                      <p className="mt-0.5 text-center" style={{ fontSize: 10, color: '#9CA3AF' }}>{['Days', 'Hours', 'Minutes'][i]}</p>
                    </div>
                  ))}
                </div>
              </div>

              <SelectField label="Sample Matrix" name="sampleMatrixUid" value={vals.sampleMatrixUid}
                onChange={v => setVal('sampleMatrixUid', v)} options={sampleMatrixOptions} />

              <div className="p-3 rounded-lg flex flex-col gap-2" style={{ backgroundColor: '#F9FAFB', border: '1px dashed #D1D5DB' }}>
                <p className="text-xs font-medium" style={{ color: '#374151' }}>Create a new sample matrix</p>
                <input
                  placeholder="Name"
                  value={newSampleMatrix.title}
                  onChange={e => setNewSampleMatrix(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                  style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                />
                <input
                  placeholder="Description (optional)"
                  value={newSampleMatrix.description}
                  onChange={e => setNewSampleMatrix(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                  style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                />
                <button
                  type="button"
                  disabled={!newSampleMatrix.title.trim() || creatingSampleMatrix}
                  onClick={() => {
                    const fd = new FormData()
                    fd.set('title', newSampleMatrix.title.trim())
                    fd.set('description', newSampleMatrix.description.trim())
                    createSampleMatrixAction(fd)
                  }}
                  className="self-start flex items-center gap-1.5"
                  style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: creatingSampleMatrix ? 'not-allowed' : 'pointer', opacity: (!newSampleMatrix.title.trim() || creatingSampleMatrix) ? 0.6 : 1 }}
                >
                  <MI name={creatingSampleMatrix ? 'hourglass_top' : 'add'} size={13} color="#fff" />
                  {creatingSampleMatrix ? 'Creating…' : 'Add Sample Matrix'}
                </button>
              </div>

              <SelectField label="Default Container Type" name="containerTypeUid" value={vals.containerTypeUid}
                onChange={v => setVal('containerTypeUid', v)} options={containerTypeOptions} />

              <div className="p-3 rounded-lg flex flex-col gap-2" style={{ backgroundColor: '#F9FAFB', border: '1px dashed #D1D5DB' }}>
                <p className="text-xs font-medium" style={{ color: '#374151' }}>Create a new container type</p>
                <input
                  placeholder="Name"
                  value={newContainerType.title}
                  onChange={e => setNewContainerType(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                  style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                />
                <input
                  placeholder="Description (optional)"
                  value={newContainerType.description}
                  onChange={e => setNewContainerType(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                  style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                />
                <button
                  type="button"
                  disabled={!newContainerType.title.trim() || creatingContainerType}
                  onClick={() => {
                    const fd = new FormData()
                    fd.set('title', newContainerType.title.trim())
                    fd.set('description', newContainerType.description.trim())
                    createContainerTypeAction(fd)
                  }}
                  className="self-start flex items-center gap-1.5"
                  style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: creatingContainerType ? 'not-allowed' : 'pointer', opacity: (!newContainerType.title.trim() || creatingContainerType) ? 0.6 : 1 }}
                >
                  <MI name={creatingContainerType ? 'hourglass_top' : 'add'} size={13} color="#fff" />
                  {creatingContainerType ? 'Creating…' : 'Add Container Type'}
                </button>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="hazardous" checked={vals.hazardous}
                  onChange={e => setVal('hazardous', e.target.checked)} style={{ accentColor: '#0154FC' }} />
                <span className="text-xs font-medium" style={{ color: '#374151' }}>Hazardous</span>
                <span style={{ fontSize: 10, color: '#9CA3AF' }}>Samples of this type should be treated as hazardous</span>
              </label>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Admitted sticker templates</label>
                <p className="mb-1" style={{ fontSize: 10, color: '#9CA3AF' }}>Defines the stickers to use for this sample type.</p>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <p className="mb-1" style={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>Admitted stickers</p>
                    <select multiple size={5} value={vals.admittedStickers}
                      onChange={e => {
                        const selected = Array.from(e.target.selectedOptions).map(o => o.value)
                        setVal('admittedStickers', selected)
                        if (!selected.includes(vals.smallDefaultSticker)) setVal('smallDefaultSticker', '')
                        if (!selected.includes(vals.largeDefaultSticker)) setVal('largeDefaultSticker', '')
                      }}
                      className="w-full text-xs rounded-lg outline-none"
                      style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                    >
                      {STICKER_TEMPLATES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <div>
                      <p className="mb-1" style={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>Default small sticker</p>
                      <select value={vals.smallDefaultSticker} onChange={e => setVal('smallDefaultSticker', e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg outline-none bg-white"
                        style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                      >
                        <option value="">No value</option>
                        {STICKER_TEMPLATES.filter(s => vals.admittedStickers.includes(s.value)).map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="mb-1" style={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>Default large sticker</p>
                      <select value={vals.largeDefaultSticker} onChange={e => setVal('largeDefaultSticker', e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg outline-none bg-white"
                        style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                      >
                        <option value="">No value</option>
                        {STICKER_TEMPLATES.filter(s => vals.admittedStickers.includes(s.value)).map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#fff' }}>
              <button type="button" onClick={closeDrawer} disabled={pending}
                style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={pending} className="flex items-center gap-1.5"
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: isEdit ? '#2563EB' : '#0154FC', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}>
                <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
                {pending ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Table / empty state */}
      {initialSampleTypes.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="science" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No sample types yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create your first sample type to get started</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Sample Type
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '24%' }} /><col style={{ width: '10%' }} /><col style={{ width: '14%' }} />
              <col style={{ width: '16%' }} /><col style={{ width: '12%' }} /><col style={{ width: '16%' }} /><col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Prefix', 'Min. Volume', 'Retention', 'Hazardous', 'UID', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialSampleTypes.map((st, i) => (
                <tr key={st.uid} style={{ borderBottom: i < initialSampleTypes.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                        <MI name="science" size={13} color="#0154FC" />
                      </div>
                      <span className="text-xs font-medium" style={{ color: '#111827' }}>{st.title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>
                      {st.Prefix || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{st.MinimumVolume || '—'}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>
                    {st.RetentionPeriod?.days || st.RetentionPeriod?.hours || st.RetentionPeriod?.minutes
                      ? `${st.RetentionPeriod.days}d ${st.RetentionPeriod.hours}h ${st.RetentionPeriod.minutes}m`
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    {st.Hazardous ? (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', fontWeight: 600 }}>Yes</span>
                    ) : (
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>No</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs truncate" style={{ color: '#9CA3AF' }}>{st.uid}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => openEdit(st)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }} title="Edit">
                      <MI name="edit" size={14} color="#9CA3AF" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialSampleTypes.length} sample type{initialSampleTypes.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

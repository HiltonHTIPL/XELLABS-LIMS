'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createSampleTemplate, updateSampleTemplate, deleteSampleTemplate,
  createSampleContainer, createPreservation, createSamplePoint,
  type SampleTemplateFormState, type CreateRefOptionState,
} from '@/app/actions/sample-templates'
import {
  type SenaiteSampleTemplate, type SenaiteSampleType, type SenaiteAnalysisService,
  type SenaiteRefOption, type SampleTemplatePartition, type SampleTemplateService,
} from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

// Compact "+ New" affordance for a reference list (Container/Preservation/Sample
// Point) that lives directly in SENAITE setup — lets the user add a missing
// option without leaving the drawer, mirroring the dashed-box pattern already
// used on the Sample Types page, just condensed to fit inside a partition row.
function InlineCreate({ placeholder, creating, onCreate }: {
  placeholder: string; creating: boolean; onCreate: (title: string) => void
}) {
  const [title, setTitle] = useState('')
  return (
    <div className="flex flex-col gap-1 mt-1 w-full">
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1 text-xs rounded-lg outline-none"
        style={{ border: '1px dashed #D1D5DB', color: '#111827', backgroundColor: '#fff' }}
      />
      <button
        type="button"
        disabled={!title.trim() || creating}
        onClick={() => { onCreate(title.trim()); setTitle('') }}
        className="flex items-center justify-center gap-1 w-full"
        style={{ fontSize: 10, fontWeight: 600, padding: '4px 8px', borderRadius: 6, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: creating ? 'not-allowed' : 'pointer', opacity: (!title.trim() || creating) ? 0.6 : 1 }}
      >
        <MI name={creating ? 'hourglass_top' : 'add'} size={11} color="#fff" />
        {creating ? 'Adding…' : 'New'}
      </button>
    </div>
  )
}

const blankPartition = (n: number): SampleTemplatePartition => ({
  partId: `part-${n}`, containerUid: '', preservationUid: '', sampleTypeUid: '',
})

type FV = {
  title: string
  description: string
  sampleTypeUid: string
  samplePointUid: string
  composite: boolean
  samplingRequired: boolean
  autoPartition: boolean
  partitions: SampleTemplatePartition[]
  services: SampleTemplateService[]
}

const blank = (): FV => ({
  title: '', description: '',
  sampleTypeUid: '', samplePointUid: '',
  composite: false, samplingRequired: false, autoPartition: false,
  partitions: [blankPartition(1)],
  services: [],
})

type Props = {
  initialTemplates: SenaiteSampleTemplate[]
  sampleTypes: SenaiteSampleType[]
  analysisServices: SenaiteAnalysisService[]
  sampleContainers: SenaiteRefOption[]
  preservations: SenaiteRefOption[]
  samplePoints: SenaiteRefOption[]
}

export default function SampleTemplatesShell({
  initialTemplates, sampleTypes, analysisServices, sampleContainers, preservations, samplePoints,
}: Props) {
  const router = useRouter()
  const [showDrawer, setShowDrawer] = useState(false)
  const [editing, setEditing] = useState<SenaiteSampleTemplate | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [vals, setVals] = useState<FV>(blank)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<SenaiteSampleTemplate | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [sampleContainerOptions, setSampleContainerOptions] = useState(sampleContainers)
  const [preservationOptions, setPreservationOptions] = useState(preservations)
  const [samplePointOptions, setSamplePointOptions] = useState(samplePoints)
  // Tracks which partition row triggered an inline "+ New Container/Preservation"
  // create, so the newly created option can be auto-selected on that specific
  // row once the shared create action resolves.
  const [pendingContainerIdx, setPendingContainerIdx] = useState<number | null>(null)
  const [pendingPreservationIdx, setPendingPreservationIdx] = useState<number | null>(null)

  const isEdit = editing !== null

  const [, createContainerAction, creatingContainer] = useActionState(
    async (prev: CreateRefOptionState, fd: FormData) => {
      const result = await createSampleContainer(prev, fd)
      if (result.success && result.option) {
        setSampleContainerOptions(prev => [...prev, result.option!])
        if (pendingContainerIdx !== null) setPartition(pendingContainerIdx, { containerUid: result.option.uid })
        setPendingContainerIdx(null)
        setToast({ ok: true, msg: result.message ?? 'Container created.' })
        setTimeout(() => setToast(null), 4000)
      } else if (result.message) {
        setToast({ ok: false, msg: result.message })
        setTimeout(() => setToast(null), 6000)
      }
      return result
    },
    {}
  )

  const [, createPreservationAction, creatingPreservation] = useActionState(
    async (prev: CreateRefOptionState, fd: FormData) => {
      const result = await createPreservation(prev, fd)
      if (result.success && result.option) {
        setPreservationOptions(prev => [...prev, result.option!])
        if (pendingPreservationIdx !== null) setPartition(pendingPreservationIdx, { preservationUid: result.option.uid })
        setPendingPreservationIdx(null)
        setToast({ ok: true, msg: result.message ?? 'Preservation created.' })
        setTimeout(() => setToast(null), 4000)
      } else if (result.message) {
        setToast({ ok: false, msg: result.message })
        setTimeout(() => setToast(null), 6000)
      }
      return result
    },
    {}
  )

  const [, createSamplePointAction, creatingSamplePoint] = useActionState(
    async (prev: CreateRefOptionState, fd: FormData) => {
      const result = await createSamplePoint(prev, fd)
      if (result.success && result.option) {
        setSamplePointOptions(prev => [...prev, result.option!])
        setVal('samplePointUid', result.option.uid)
        setToast({ ok: true, msg: result.message ?? 'Sample point created.' })
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

  function setPartition(idx: number, patch: Partial<SampleTemplatePartition>) {
    setVals(prev => ({
      ...prev,
      partitions: prev.partitions.map((p, i) => i === idx ? { ...p, ...patch } : p),
    }))
  }

  function addPartition() {
    setVals(prev => ({ ...prev, partitions: [...prev.partitions, blankPartition(prev.partitions.length + 1)] }))
  }

  function removePartition(idx: number) {
    setVals(prev => {
      const removedPartId = prev.partitions[idx]?.partId
      return {
        ...prev,
        partitions: prev.partitions.filter((_, i) => i !== idx),
        // Services tagged to a removed partition become unassigned rather than
        // silently vanishing — matches SENAITE's own services field, which is
        // template-level and only references partitions by part_id string.
        services: prev.services.map(s => s.partId === removedPartId ? { ...s, partId: '' } : s),
      }
    })
  }

  const [state, action, pending] = useActionState(
    async (prev: SampleTemplateFormState, fd: FormData) => {
      const url = fd.get('_editingUrl') as string | null
      const result = url ? await updateSampleTemplate(url, prev, fd) : await createSampleTemplate(prev, fd)
      if (result.success) {
        setShowDrawer(false)
        setEditing(null)
        setVals(blank())
        setFieldErrors({})
        setToast({ ok: true, msg: editing ? 'Sample template updated.' : 'Sample template created.' })
        setTimeout(() => setToast(null), 4000)
        router.refresh()
      } else if (result.errors) {
        const fe: Record<string, string> = {}
        for (const [k, msgs] of Object.entries(result.errors)) {
          if (Array.isArray(msgs) && msgs.length) fe[k] = typeof msgs[0] === 'string' ? msgs[0] : JSON.stringify(msgs[0])
          else if (msgs) fe[k] = typeof msgs === 'string' ? msgs : JSON.stringify(msgs)
        }
        setFieldErrors(fe)
      }
      return result
    },
    {}
  )

  function openCreate() { setEditing(null); setVals(blank()); setFieldErrors({}); setShowDrawer(true) }
  function openEdit(t: SenaiteSampleTemplate) {
    setEditing(t)
    setVals({
      title: t.title,
      description: t.description ?? '',
      sampleTypeUid: t.sampleTypeUid ?? '',
      samplePointUid: t.samplePointUid ?? '',
      composite: t.composite ?? false,
      samplingRequired: t.samplingRequired ?? false,
      autoPartition: t.autoPartition ?? false,
      partitions: t.partitions?.length ? t.partitions : [blankPartition(1)],
      services: t.services ?? [],
    })
    setFieldErrors({})
    setShowDrawer(true)
  }
  function closeDrawer() { setShowDrawer(false) }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteSampleTemplate(deleteTarget.url)
    setDeleting(false)
    setDeleteTarget(null)
    setToast({ ok: result.success, msg: result.success ? 'Sample template deleted.' : (result.message ?? 'Delete failed.') })
    setTimeout(() => setToast(null), 4000)
    router.refresh()
  }

  function toggleService(svc: SenaiteAnalysisService, partId: string) {
    const exists = vals.services.some(s => s.uid === svc.uid)
    setVal('services', exists
      ? vals.services.filter(s => s.uid !== svc.uid)
      : [...vals.services, { uid: svc.uid, hidden: false, partId }])
  }

  function setServicePartId(uid: string, partId: string) {
    setVal('services', vals.services.map(s => s.uid === uid ? { ...s, partId } : s))
  }

  function toggleServiceHidden(uid: string) {
    setVal('services', vals.services.map(s => s.uid === uid ? { ...s, hidden: !s.hidden } : s))
  }

  const titleFor = (uid: string, list: SenaiteRefOption[]) => list.find(o => o.uid === uid)?.title ?? ''

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Sample Templates</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Predefined sample type, partitions, and analysis combinations for quick sample registration</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New Sample Template
        </button>
      </div>

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
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 520, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showDrawer ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>

          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEdit ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEdit ? 'edit' : 'add'} size={16} color={isEdit ? '#2563EB' : '#0154FC'} />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                  {isEdit ? `Edit — ${editing!.title}` : 'New Sample Template'}
                </h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                  {isEdit ? 'Update template details' : 'Bundle a sample type, partitions, and analyses together'}
                </p>
              </div>
            </div>
            <button onClick={closeDrawer} className="p-1.5 rounded-lg hover:bg-gray-100">
              <MI name="close" size={16} color="#9CA3AF" />
            </button>
          </div>

          <form action={action} className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {isEdit && <input type="hidden" name="_editingUrl" value={editing!.url} />}
            <input type="hidden" name="sampleTypeUid" value={vals.sampleTypeUid} />
            <input type="hidden" name="samplePointUid" value={vals.samplePointUid} />
            <input type="hidden" name="partitions" value={JSON.stringify(vals.partitions)} />
            <input type="hidden" name="services" value={JSON.stringify(vals.services)} />

            <div className="flex-1 px-5 py-4 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                  Template Name<span style={{ color: '#EF4444' }}> *</span>
                </label>
                <input
                  name="title"
                  placeholder="e.g. Standard Water Panel"
                  value={vals.title}
                  onChange={e => setVal('title', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                  style={{ border: `1px solid ${fieldErrors.title ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
                />
                {fieldErrors.title && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{fieldErrors.title}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                  Description <span className="font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
                </label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Notes about when to use this template…"
                  value={vals.description}
                  onChange={e => setVal('description', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none"
                  style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                    Sample Type <span className="font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
                  </label>
                  <select
                    value={vals.sampleTypeUid}
                    onChange={e => setVal('sampleTypeUid', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                    style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                  >
                    <option value="">None</option>
                    {sampleTypes.map(st => <option key={st.uid} value={st.uid}>{st.title}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                    Sample Point <span className="font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
                  </label>
                  <select
                    value={vals.samplePointUid}
                    onChange={e => setVal('samplePointUid', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                    style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                  >
                    <option value="">None</option>
                    {samplePointOptions.map(sp => <option key={sp.uid} value={sp.uid}>{sp.title}</option>)}
                  </select>
                  <InlineCreate placeholder="New sample point…" creating={creatingSamplePoint}
                    onCreate={title => { const fd = new FormData(); fd.set('title', title); createSamplePointAction(fd) }} />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" name="composite" checked={vals.composite} onChange={e => setVal('composite', e.target.checked)} style={{ accentColor: '#0154FC' }} />
                  <span className="text-xs" style={{ color: '#374151' }}>Composite sample</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" name="samplingRequired" checked={vals.samplingRequired} onChange={e => setVal('samplingRequired', e.target.checked)} style={{ accentColor: '#0154FC' }} />
                  <span className="text-xs" style={{ color: '#374151' }}>Sample collected by the laboratory</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" name="autoPartition" checked={vals.autoPartition} onChange={e => setVal('autoPartition', e.target.checked)} style={{ accentColor: '#0154FC' }} />
                  <span className="text-xs" style={{ color: '#374151' }}>Auto-partition on sample reception</span>
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium" style={{ color: '#374151' }}>Sample Partitions</label>
                  <button type="button" onClick={addPartition} className="flex items-center gap-1 text-xs font-medium" style={{ color: '#0154FC' }}>
                    <MI name="add" size={13} color="#0154FC" /> Add Partition
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {vals.partitions.map((p, idx) => (
                    <div key={p.partId} className="rounded-lg p-3" style={{ border: '1px solid #E8EAF2', backgroundColor: '#FAFAFA' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold" style={{ color: '#374151' }}>{p.partId}</span>
                        {vals.partitions.length > 1 && (
                          <button type="button" onClick={() => removePartition(idx)} className="p-1 rounded hover:bg-gray-200" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                            <MI name="delete" size={13} color="#9CA3AF" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block mb-0.5" style={{ fontSize: 10, color: '#6B7280' }}>Container</label>
                          <select
                            value={p.containerUid}
                            onChange={e => setPartition(idx, { containerUid: e.target.value })}
                            className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                            style={{ border: '1px solid #D1D5DB', color: '#111827', backgroundColor: '#fff' }}
                          >
                            <option value="">None</option>
                            {sampleContainerOptions.map(c => <option key={c.uid} value={c.uid}>{c.title}</option>)}
                          </select>
                          <InlineCreate placeholder="New container…" creating={creatingContainer}
                            onCreate={title => {
                              setPendingContainerIdx(idx)
                              const fd = new FormData(); fd.set('title', title); createContainerAction(fd)
                            }} />
                        </div>
                        <div>
                          <label className="block mb-0.5" style={{ fontSize: 10, color: '#6B7280' }}>Preservation</label>
                          <select
                            value={p.preservationUid}
                            onChange={e => setPartition(idx, { preservationUid: e.target.value })}
                            className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                            style={{ border: '1px solid #D1D5DB', color: '#111827', backgroundColor: '#fff' }}
                          >
                            <option value="">None</option>
                            {preservationOptions.map(pr => <option key={pr.uid} value={pr.uid}>{pr.title}</option>)}
                          </select>
                          <InlineCreate placeholder="New preservation…" creating={creatingPreservation}
                            onCreate={title => {
                              setPendingPreservationIdx(idx)
                              const fd = new FormData(); fd.set('title', title); createPreservationAction(fd)
                            }} />
                        </div>
                        <div>
                          <label className="block mb-0.5" style={{ fontSize: 10, color: '#6B7280' }}>Sample Type</label>
                          <select
                            value={p.sampleTypeUid}
                            onChange={e => setPartition(idx, { sampleTypeUid: e.target.value })}
                            className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                            style={{ border: '1px solid #D1D5DB', color: '#111827', backgroundColor: '#fff' }}
                          >
                            <option value="">Inherit</option>
                            {sampleTypes.map(st => <option key={st.uid} value={st.uid}>{st.title}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium" style={{ color: '#374151' }}>Analyses</label>
                  <span style={{ fontSize: 10, color: '#9CA3AF' }}>{vals.services.length} selected</span>
                </div>
                <div className="rounded-lg" style={{ border: '1px solid #D1D5DB', maxHeight: 220, overflowY: 'auto', backgroundColor: '#fff' }}>
                  {analysisServices.length === 0 ? (
                    <p className="px-3 py-3 text-xs" style={{ color: '#9CA3AF' }}>No analyses available.</p>
                  ) : (
                    analysisServices.map(svc => {
                      const selected = vals.services.find(s => s.uid === svc.uid)
                      return (
                        <div key={svc.uid} className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <input type="checkbox" checked={!!selected}
                            onChange={() => toggleService(svc, vals.partitions[0]?.partId ?? 'part-1')} style={{ accentColor: '#0154FC' }} />
                          <span className="text-xs" style={{ color: '#111827', flex: 1 }}>{svc.title}</span>
                          {selected && (
                            <>
                              <select
                                value={selected.partId}
                                onChange={e => setServicePartId(svc.uid, e.target.value)}
                                style={{ fontSize: 10, border: '1px solid #E8EAF2', borderRadius: 6, color: '#6B7280', padding: '2px 4px' }}
                              >
                                {vals.partitions.map(p => <option key={p.partId} value={p.partId}>{p.partId}</option>)}
                              </select>
                              <label className="flex items-center gap-1 cursor-pointer" title="Hide from report">
                                <input type="checkbox" checked={!!selected.hidden}
                                  onChange={() => toggleServiceHidden(svc.uid)} style={{ accentColor: '#9CA3AF' }} />
                                <span style={{ fontSize: 10, color: '#9CA3AF' }}>Hidden</span>
                              </label>
                            </>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

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

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => !deleting && setDeleteTarget(null)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} />
          <div style={{ position: 'relative', width: 380, backgroundColor: '#fff', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', padding: 20 }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#FEF2F2' }}>
                <MI name="delete" size={16} color="#DC2626" />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: '#111827' }}>Delete sample template?</h3>
            </div>
            <p className="text-xs mb-5" style={{ color: '#6B7280' }}>
              This will permanently delete &ldquo;{deleteTarget.title}&rdquo;. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="flex items-center gap-1.5"
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#DC2626', color: '#fff', border: 'none', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                <MI name={deleting ? 'hourglass_top' : 'delete'} size={13} color="#fff" />
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table / empty state */}
      {initialTemplates.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="assignment" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No sample templates yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create your first template to speed up sample registration</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Sample Template
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '22%' }} /><col style={{ width: '18%' }} /><col style={{ width: '12%' }} /><col style={{ width: '30%' }} /><col style={{ width: '10%' }} /><col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Sample Type', 'Partitions', 'Analyses', 'Flags', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialTemplates.map((t, i) => (
                <tr key={t.uid} style={{ borderBottom: i < initialTemplates.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                        <MI name="assignment" size={13} color="#0154FC" />
                      </div>
                      <span className="text-xs font-medium" style={{ color: '#111827' }}>{t.title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#374151' }}>{titleFor(t.sampleTypeUid, sampleTypes) || '—'}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{t.partitions?.length || 0}</td>
                  <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#6B7280' }}>
                    {t.services?.length
                      ? t.services.map(s => titleFor(s.uid, analysisServices)).filter(Boolean).join(', ') || `${t.services.length} selected`
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#9CA3AF' }}>
                    {[t.composite && 'Composite', t.samplingRequired && 'Sampling', t.autoPartition && 'Auto-part.'].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(t)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }} title="Edit">
                        <MI name="edit" size={14} color="#9CA3AF" />
                      </button>
                      <button onClick={() => setDeleteTarget(t)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }} title="Delete">
                        <MI name="delete" size={14} color="#9CA3AF" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialTemplates.length} template{initialTemplates.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

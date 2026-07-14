'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createSampleTemplate, updateSampleTemplate, deleteSampleTemplate,
  type SampleTemplate, type SampleTemplateFormState, type AnalysisServiceRef, type TemplatePartition,
} from '@/app/actions/sample-templates'
import { type SenaiteSampleType, type SenaiteAnalysisService, type SenaiteRefOption } from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

type PartitionFV = {
  partId: string
  containerUid: string
  containerName: string
  preservationUid: string
  preservationName: string
  sampleTypeUid: string
  sampleTypeName: string
  services: AnalysisServiceRef[]
}

const blankPartition = (n: number): PartitionFV => ({
  partId: `part-${n}`,
  containerUid: '', containerName: '',
  preservationUid: '', preservationName: '',
  sampleTypeUid: '', sampleTypeName: '',
  services: [],
})

type FV = {
  name: string
  description: string
  sampleTypeUid: string
  sampleTypeName: string
  samplePointUid: string
  samplePointName: string
  composite: boolean
  samplingRequired: boolean
  autoPartition: boolean
  partitions: PartitionFV[]
}

const blank = (): FV => ({
  name: '', description: '',
  sampleTypeUid: '', sampleTypeName: '',
  samplePointUid: '', samplePointName: '',
  composite: false, samplingRequired: false, autoPartition: false,
  partitions: [blankPartition(1)],
})

function toFormPartitions(partitions: PartitionFV[]): TemplatePartition[] {
  return partitions.map(p => ({
    part_id: p.partId,
    container_uid: p.containerUid,
    container_name: p.containerName,
    preservation_uid: p.preservationUid,
    preservation_name: p.preservationName,
    sample_type_uid: p.sampleTypeUid,
    sample_type_name: p.sampleTypeName,
    services: p.services,
  }))
}

function fromApiPartitions(partitions: TemplatePartition[] | undefined): PartitionFV[] {
  if (!partitions?.length) return [blankPartition(1)]
  return partitions.map(p => ({
    partId: p.part_id,
    containerUid: p.container_uid ?? '',
    containerName: p.container_name ?? '',
    preservationUid: p.preservation_uid ?? '',
    preservationName: p.preservation_name ?? '',
    sampleTypeUid: p.sample_type_uid ?? '',
    sampleTypeName: p.sample_type_name ?? '',
    services: p.services ?? [],
  }))
}

type Props = {
  initialTemplates: SampleTemplate[]
  sampleTypes: SenaiteSampleType[]
  analysisServices: SenaiteAnalysisService[]
  containerTypes: SenaiteRefOption[]
  preservations: SenaiteRefOption[]
  samplePoints: SenaiteRefOption[]
}

export default function SampleTemplatesShell({
  initialTemplates, sampleTypes, analysisServices, containerTypes, preservations, samplePoints,
}: Props) {
  const router = useRouter()
  const [showDrawer, setShowDrawer] = useState(false)
  const [editing, setEditing] = useState<SampleTemplate | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [vals, setVals] = useState<FV>(blank)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<SampleTemplate | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isEdit = editing !== null

  function setVal<K extends keyof FV>(k: K, v: FV[K]) {
    setVals(prev => ({ ...prev, [k]: v }))
    if (fieldErrors[k]) setFieldErrors(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  function setPartition(idx: number, patch: Partial<PartitionFV>) {
    setVals(prev => ({
      ...prev,
      partitions: prev.partitions.map((p, i) => i === idx ? { ...p, ...patch } : p),
    }))
  }

  function addPartition() {
    setVals(prev => ({ ...prev, partitions: [...prev.partitions, blankPartition(prev.partitions.length + 1)] }))
  }

  function removePartition(idx: number) {
    setVals(prev => ({ ...prev, partitions: prev.partitions.filter((_, i) => i !== idx) }))
  }

  const [state, action, pending] = useActionState(
    async (prev: SampleTemplateFormState, fd: FormData) => {
      const id = fd.get('_editingId') as string | null
      const result = id ? await updateSampleTemplate(Number(id), prev, fd) : await createSampleTemplate(prev, fd)
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
        for (const [k, msgs] of Object.entries(result.errors)) { if (msgs?.length) fe[k] = msgs[0] }
        setFieldErrors(fe)
      }
      return result
    },
    {}
  )

  function openCreate() { setEditing(null); setVals(blank()); setFieldErrors({}); setShowDrawer(true) }
  function openEdit(t: SampleTemplate) {
    setEditing(t)
    setVals({
      name: t.name,
      description: t.description ?? '',
      sampleTypeUid: t.sample_type_uid ?? '',
      sampleTypeName: t.sample_type_name ?? '',
      samplePointUid: t.sample_point_uid ?? '',
      samplePointName: t.sample_point_name ?? '',
      composite: t.composite ?? false,
      samplingRequired: t.sampling_required ?? false,
      autoPartition: t.auto_partition ?? false,
      partitions: fromApiPartitions(t.partitions),
    })
    setFieldErrors({})
    setShowDrawer(true)
  }
  function closeDrawer() { setShowDrawer(false) }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteSampleTemplate(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    setToast({ ok: result.success, msg: result.success ? 'Sample template deleted.' : (result.message ?? 'Delete failed.') })
    setTimeout(() => setToast(null), 4000)
    router.refresh()
  }

  function onSampleTypeChange(uid: string) {
    const st = sampleTypes.find(s => s.uid === uid)
    setVal('sampleTypeUid', uid)
    setVal('sampleTypeName', st?.title ?? '')
  }

  function onSamplePointChange(uid: string) {
    const sp = samplePoints.find(s => s.uid === uid)
    setVal('samplePointUid', uid)
    setVal('samplePointName', sp?.title ?? '')
  }

  function onPartitionContainerChange(idx: number, uid: string) {
    const c = containerTypes.find(c => c.uid === uid)
    setPartition(idx, { containerUid: uid, containerName: c?.title ?? '' })
  }

  function onPartitionPreservationChange(idx: number, uid: string) {
    const p = preservations.find(p => p.uid === uid)
    setPartition(idx, { preservationUid: uid, preservationName: p?.title ?? '' })
  }

  function onPartitionSampleTypeChange(idx: number, uid: string) {
    const st = sampleTypes.find(s => s.uid === uid)
    setPartition(idx, { sampleTypeUid: uid, sampleTypeName: st?.title ?? '' })
  }

  function togglePartitionService(idx: number, svc: SenaiteAnalysisService) {
    const partition = vals.partitions[idx]
    const exists = partition.services.some(s => s.uid === svc.uid)
    setPartition(idx, {
      services: exists
        ? partition.services.filter(s => s.uid !== svc.uid)
        : [...partition.services, { uid: svc.uid, title: svc.title, hidden: false }],
    })
  }

  function togglePartitionServiceHidden(idx: number, uid: string) {
    const partition = vals.partitions[idx]
    setPartition(idx, {
      services: partition.services.map(s => s.uid === uid ? { ...s, hidden: !s.hidden } : s),
    })
  }

  const totalServiceCount = vals.partitions.reduce((n, p) => n + p.services.length, 0)

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
                  {isEdit ? `Edit — ${editing!.name}` : 'New Sample Template'}
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
            {isEdit && <input type="hidden" name="_editingId" value={editing!.id} />}
            <input type="hidden" name="sample_type_uid" value={vals.sampleTypeUid} />
            <input type="hidden" name="sample_type_name" value={vals.sampleTypeName} />
            <input type="hidden" name="sample_point_uid" value={vals.samplePointUid} />
            <input type="hidden" name="sample_point_name" value={vals.samplePointName} />
            <input type="hidden" name="composite" value={String(vals.composite)} />
            <input type="hidden" name="sampling_required" value={String(vals.samplingRequired)} />
            <input type="hidden" name="auto_partition" value={String(vals.autoPartition)} />
            <input type="hidden" name="partitions" value={JSON.stringify(toFormPartitions(vals.partitions))} />

            <div className="flex-1 px-5 py-4 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                  Template Name<span style={{ color: '#EF4444' }}> *</span>
                </label>
                <input
                  name="name"
                  placeholder="e.g. Standard Water Panel"
                  value={vals.name}
                  onChange={e => setVal('name', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                  style={{ border: `1px solid ${fieldErrors.name ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
                />
                {fieldErrors.name && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{fieldErrors.name}</p>}
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
                    Sample Type<span style={{ color: '#EF4444' }}> *</span>
                  </label>
                  <select
                    value={vals.sampleTypeUid}
                    onChange={e => onSampleTypeChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                    style={{ border: `1px solid ${fieldErrors.sample_type_uid ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
                  >
                    <option value="">Select sample type…</option>
                    {sampleTypes.map(st => <option key={st.uid} value={st.uid}>{st.title}</option>)}
                  </select>
                  {fieldErrors.sample_type_uid && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{fieldErrors.sample_type_uid}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                    Sample Point <span className="font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
                  </label>
                  <select
                    value={vals.samplePointUid}
                    onChange={e => onSamplePointChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                    style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                  >
                    <option value="">None</option>
                    {samplePoints.map(sp => <option key={sp.uid} value={sp.uid}>{sp.title}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={vals.composite} onChange={e => setVal('composite', e.target.checked)} style={{ accentColor: '#0154FC' }} />
                  <span className="text-xs" style={{ color: '#374151' }}>Composite</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={vals.samplingRequired} onChange={e => setVal('samplingRequired', e.target.checked)} style={{ accentColor: '#0154FC' }} />
                  <span className="text-xs" style={{ color: '#374151' }}>Sampling Required</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={vals.autoPartition} onChange={e => setVal('autoPartition', e.target.checked)} style={{ accentColor: '#0154FC' }} />
                  <span className="text-xs" style={{ color: '#374151' }}>Auto-partition</span>
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium" style={{ color: '#374151' }}>
                    Partitions <span style={{ fontSize: 10, color: '#9CA3AF' }}>({totalServiceCount} analyses total)</span>
                  </label>
                  <button type="button" onClick={addPartition} className="flex items-center gap-1 text-xs font-medium" style={{ color: '#0154FC' }}>
                    <MI name="add" size={13} color="#0154FC" /> Add Partition
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {vals.partitions.map((p, idx) => (
                    <div key={p.partId} className="rounded-lg p-3" style={{ border: '1px solid #E8EAF2', backgroundColor: '#FAFAFA' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold" style={{ color: '#374151' }}>Partition {idx + 1}</span>
                        {vals.partitions.length > 1 && (
                          <button type="button" onClick={() => removePartition(idx)} className="p-1 rounded hover:bg-gray-200" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                            <MI name="delete" size={13} color="#9CA3AF" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="block mb-0.5" style={{ fontSize: 10, color: '#6B7280' }}>Container</label>
                          <select
                            value={p.containerUid}
                            onChange={e => onPartitionContainerChange(idx, e.target.value)}
                            className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                            style={{ border: '1px solid #D1D5DB', color: '#111827', backgroundColor: '#fff' }}
                          >
                            <option value="">None</option>
                            {containerTypes.map(c => <option key={c.uid} value={c.uid}>{c.title}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block mb-0.5" style={{ fontSize: 10, color: '#6B7280' }}>Preservation</label>
                          <select
                            value={p.preservationUid}
                            onChange={e => onPartitionPreservationChange(idx, e.target.value)}
                            className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                            style={{ border: '1px solid #D1D5DB', color: '#111827', backgroundColor: '#fff' }}
                          >
                            <option value="">None</option>
                            {preservations.map(pr => <option key={pr.uid} value={pr.uid}>{pr.title}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="mb-2">
                        <label className="block mb-0.5" style={{ fontSize: 10, color: '#6B7280' }}>Sample Type Override <span style={{ color: '#9CA3AF' }}>(optional)</span></label>
                        <select
                          value={p.sampleTypeUid}
                          onChange={e => onPartitionSampleTypeChange(idx, e.target.value)}
                          className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                          style={{ border: '1px solid #D1D5DB', color: '#111827', backgroundColor: '#fff' }}
                        >
                          <option value="">Inherit ({vals.sampleTypeName || 'template default'})</option>
                          {sampleTypes.map(st => <option key={st.uid} value={st.uid}>{st.title}</option>)}
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label style={{ fontSize: 10, color: '#6B7280' }}>Analyses</label>
                          <span style={{ fontSize: 10, color: '#9CA3AF' }}>{p.services.length} selected</span>
                        </div>
                        <div className="rounded-lg" style={{ border: '1px solid #D1D5DB', maxHeight: 160, overflowY: 'auto', backgroundColor: '#fff' }}>
                          {analysisServices.length === 0 ? (
                            <p className="px-3 py-3 text-xs" style={{ color: '#9CA3AF' }}>No analyses available.</p>
                          ) : (
                            analysisServices.map(svc => {
                              const selected = p.services.find(s => s.uid === svc.uid)
                              return (
                                <div key={svc.uid} className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid #F3F4F6' }}>
                                  <input type="checkbox" checked={!!selected}
                                    onChange={() => togglePartitionService(idx, svc)} style={{ accentColor: '#0154FC' }} />
                                  <span className="text-xs" style={{ color: '#111827', flex: 1 }}>{svc.title}</span>
                                  {selected && (
                                    <label className="flex items-center gap-1 cursor-pointer" title="Hide from report">
                                      <input type="checkbox" checked={!!selected.hidden}
                                        onChange={() => togglePartitionServiceHidden(idx, svc.uid)} style={{ accentColor: '#9CA3AF' }} />
                                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>Hidden</span>
                                    </label>
                                  )}
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
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
              This will permanently delete &ldquo;{deleteTarget.name}&rdquo;. This action cannot be undone.
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
              {initialTemplates.map((t, i) => {
                const allServices = (t.partitions ?? []).flatMap(p => p.services ?? [])
                return (
                  <tr key={t.id} style={{ borderBottom: i < initialTemplates.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                          <MI name="assignment" size={13} color="#0154FC" />
                        </div>
                        <span className="text-xs font-medium" style={{ color: '#111827' }}>{t.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#374151' }}>{t.sample_type_name || '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{t.partitions?.length || 0}</td>
                    <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#6B7280' }}>
                      {allServices.length ? allServices.map(a => a.title).join(', ') : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#9CA3AF' }}>
                      {[t.composite && 'Composite', t.sampling_required && 'Sampling', t.auto_partition && 'Auto-part.'].filter(Boolean).join(', ') || '—'}
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
                )
              })}
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

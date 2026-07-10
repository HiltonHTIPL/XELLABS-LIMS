'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createSampleTemplate, updateSampleTemplate, deleteSampleTemplate,
  type SampleTemplate, type SampleTemplateFormState, type AnalysisServiceRef,
} from '@/app/actions/sample-templates'
import { type SenaiteSampleType, type SenaiteAnalysisService } from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

type FV = { name: string; sampleTypeUid: string; sampleTypeName: string; container: string; analysisServices: AnalysisServiceRef[] }
const blank = (): FV => ({ name: '', sampleTypeUid: '', sampleTypeName: '', container: '', analysisServices: [] })

type Props = {
  initialTemplates: SampleTemplate[]
  sampleTypes: SenaiteSampleType[]
  analysisServices: SenaiteAnalysisService[]
}

export default function SampleTemplatesShell({ initialTemplates, sampleTypes, analysisServices }: Props) {
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
      sampleTypeUid: t.sample_type_uid ?? '',
      sampleTypeName: t.sample_type_name ?? '',
      container: t.container ?? '',
      analysisServices: t.analysis_services ?? [],
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

  function toggleAnalysis(svc: SenaiteAnalysisService) {
    setVal('analysisServices', vals.analysisServices.some(a => a.uid === svc.uid)
      ? vals.analysisServices.filter(a => a.uid !== svc.uid)
      : [...vals.analysisServices, { uid: svc.uid, title: svc.title }])
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Sample Templates</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Predefined sample type, analysis profile, and container combinations for quick sample registration</p>
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
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 440, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showDrawer ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>

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
                  {isEdit ? 'Update template details' : 'Bundle a sample type, analyses, and container together'}
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
            <input type="hidden" name="analysis_services" value={JSON.stringify(vals.analysisServices)} />

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
                  Container <span className="font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
                </label>
                <input
                  name="container"
                  placeholder="e.g. Sterile 50mL Tube"
                  value={vals.container}
                  onChange={e => setVal('container', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                  style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium" style={{ color: '#374151' }}>Analysis Profile</label>
                  <span style={{ fontSize: 10, color: '#9CA3AF' }}>{vals.analysisServices.length} selected</span>
                </div>
                <div className="rounded-lg" style={{ border: '1px solid #D1D5DB', maxHeight: 220, overflowY: 'auto' }}>
                  {analysisServices.length === 0 ? (
                    <p className="px-3 py-3 text-xs" style={{ color: '#9CA3AF' }}>No analyses available.</p>
                  ) : (
                    analysisServices.map(svc => (
                      <label key={svc.uid} className="flex items-center gap-2 px-3 py-2 cursor-pointer" style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <input type="checkbox" checked={vals.analysisServices.some(a => a.uid === svc.uid)}
                          onChange={() => toggleAnalysis(svc)} style={{ accentColor: '#0154FC' }} />
                        <span className="text-xs" style={{ color: '#111827', flex: 1 }}>{svc.title}</span>
                      </label>
                    ))
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
              <col style={{ width: '25%' }} /><col style={{ width: '20%' }} /><col style={{ width: '30%' }} /><col style={{ width: '17%' }} /><col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Sample Type', 'Analysis Profile', 'Container', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialTemplates.map((t, i) => (
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
                  <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#6B7280' }}>
                    {t.analysis_services?.length ? t.analysis_services.map(a => a.title).join(', ') : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{t.container || '—'}</td>
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

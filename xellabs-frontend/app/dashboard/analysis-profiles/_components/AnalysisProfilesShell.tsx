'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createAnalysisProfile, updateAnalysisProfile, deleteAnalysisProfile,
  type AnalysisProfile, type AnalysisProfileFormState, type ProfileServiceRef,
} from '@/app/actions/analysis-profiles'
import { type SenaiteAnalysisService } from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

type FV = {
  name: string
  description: string
  profileKey: string
  sampleTypes: string[]
  analysisServices: ProfileServiceRef[]
  commercialId: string
  usePrice: boolean
  price: string
  vat: string
}
const blank = (): FV => ({
  name: '', description: '', profileKey: '', sampleTypes: [], analysisServices: [],
  commercialId: '', usePrice: false, price: '', vat: '',
})

type Props = {
  initialProfiles: AnalysisProfile[]
  analysisServices: SenaiteAnalysisService[]
  sampleTypeOptions: { uid: string; title: string }[]
}

export default function AnalysisProfilesShell({ initialProfiles, analysisServices, sampleTypeOptions }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AnalysisProfile | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [vals, setVals] = useState<FV>(blank)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<AnalysisProfile | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isEdit = editing !== null

  function setVal<K extends keyof FV>(k: K, v: FV[K]) {
    setVals(prev => ({ ...prev, [k]: v }))
    if (fieldErrors[k]) setFieldErrors(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  const [state, action, pending] = useActionState(
    async (prev: AnalysisProfileFormState, fd: FormData) => {
      const path = fd.get('_editingPath') as string | null
      const result = path ? await updateAnalysisProfile(path, prev, fd) : await createAnalysisProfile(prev, fd)
      if (result.success) {
        setShowForm(false)
        setEditing(null)
        setVals(blank())
        setFieldErrors({})
        setToast({ ok: true, msg: editing ? 'Analysis profile updated.' : 'Analysis profile created.' })
        setTimeout(() => setToast(null), 4000)
        router.refresh()
      } else {
        // Map recognised field errors onto inputs; surface everything else
        // (auth {detail}, non-field errors, 500s) as an error toast so a failed
        // create never dies silently with the drawer just sitting open.
        const fe: Record<string, string> = {}
        const KNOWN_FIELDS = ['name', 'analysis_services']
        const unknown: string[] = []
        for (const [k, msgs] of Object.entries(result.errors ?? {})) {
          const msgList = Array.isArray(msgs) ? msgs : [String(msgs)]
          if (!msgList.length) continue
          if (KNOWN_FIELDS.includes(k)) fe[k] = msgList[0]
          else unknown.push(msgList[0])
        }
        setFieldErrors(fe)
        if (Object.keys(fe).length === 0) {
          setToast({ ok: false, msg: unknown[0] ?? result.message ?? 'Failed to save the analysis profile.' })
          setTimeout(() => setToast(null), 6000)
        }
      }
      return result
    },
    {}
  )

  function openCreate() { setEditing(null); setVals(blank()); setFieldErrors({}); setShowForm(true) }
  function openEdit(p: AnalysisProfile) {
    setEditing(p)
    setVals({
      name: p.name,
      description: p.description ?? '',
      profileKey: p.profile_key ?? '',
      sampleTypes: p.sample_types ?? [],
      analysisServices: p.analysis_services ?? [],
      commercialId: p.commercial_id ?? '',
      usePrice: p.use_analysis_profile_price ?? false,
      price: p.analysis_profile_price ?? '',
      vat: p.analysis_profile_vat ?? '',
    })
    setFieldErrors({})
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditing(null); setFieldErrors({}) }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteAnalysisProfile(deleteTarget.path)
    setDeleting(false)
    setDeleteTarget(null)
    setToast({ ok: result.success, msg: result.success ? 'Analysis profile deactivated.' : (result.message ?? 'Deactivation failed.') })
    setTimeout(() => setToast(null), 4000)
    router.refresh()
  }

  function toggleAnalysis(svc: SenaiteAnalysisService) {
    setVal('analysisServices', vals.analysisServices.some(a => a.uid === svc.uid)
      ? vals.analysisServices.filter(a => a.uid !== svc.uid)
      : [...vals.analysisServices, { uid: svc.uid, hidden: false }])
  }

  function toggleSampleType(uid: string) {
    setVal('sampleTypes', vals.sampleTypes.includes(uid)
      ? vals.sampleTypes.filter(u => u !== uid)
      : [...vals.sampleTypes, uid])
  }

  function serviceTitle(uid: string): string {
    return analysisServices.find(s => s.uid === uid)?.title ?? uid
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3" style={{ flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Analysis Profiles</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Reusable bundles of analyses you can apply to any sample, independent of sample type</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New Analysis Profile
        </button>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, color: toast.ok ? '#0154FC' : '#991B1B', flexShrink: 0 }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* ── Inline create/edit panel ── */}
      {showForm && (
        <div className="bg-white rounded-xl mb-3" style={{ border: '1px solid #E8EAF2', flexShrink: 0 }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEdit ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEdit ? 'edit' : 'add'} size={16} color={isEdit ? '#2563EB' : '#0154FC'} />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                  {isEdit ? `Edit — ${editing!.name}` : 'New Analysis Profile'}
                </h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                  {isEdit ? 'Update profile details' : 'Bundle a set of analyses under one reusable name'}
                </p>
              </div>
            </div>
            <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100">
              <MI name="close" size={16} color="#9CA3AF" />
            </button>
          </div>

          <form action={action}>
            {isEdit && <input type="hidden" name="_editingPath" value={editing!.path} />}
            <input type="hidden" name="analysis_services" value={JSON.stringify(vals.analysisServices)} />
            <input type="hidden" name="sample_types" value={JSON.stringify(vals.sampleTypes)} />

            <div className="px-5 py-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                    Profile Name<span style={{ color: '#EF4444' }}> *</span>
                  </label>
                  <input
                    name="name"
                    placeholder="e.g. Full Metals Panel"
                    value={vals.name}
                    onChange={e => setVal('name', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                    style={{ border: `1px solid ${fieldErrors.name ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
                  />
                  {fieldErrors.name && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{fieldErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Profile Keyword</label>
                  <input
                    name="profile_key"
                    placeholder="Unique profile keyword"
                    value={vals.profileKey}
                    onChange={e => setVal('profileKey', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                    style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Description</label>
                <textarea
                  name="description"
                  rows={2}
                  value={vals.description}
                  onChange={e => setVal('description', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                  style={{ border: '1px solid #D1D5DB', color: '#111827', resize: 'vertical' }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium" style={{ color: '#374151' }}>Sample Types</label>
                  <span style={{ fontSize: 10, color: '#9CA3AF' }}>{vals.sampleTypes.length} selected — leave empty to allow any sample type</span>
                </div>
                <div className="rounded-lg" style={{ border: '1px solid #D1D5DB', maxHeight: 140, overflowY: 'auto' }}>
                  {sampleTypeOptions.length === 0 ? (
                    <p className="px-3 py-3 text-xs" style={{ color: '#9CA3AF' }}>No sample types available.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-3">
                      {sampleTypeOptions.map(st => (
                        <label key={st.uid} className="flex items-center gap-2 px-3 py-2 cursor-pointer" style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <input type="checkbox" checked={vals.sampleTypes.includes(st.uid)}
                            onChange={() => toggleSampleType(st.uid)} style={{ accentColor: '#0154FC' }} />
                          <span className="text-xs" style={{ color: '#111827', flex: 1 }}>{st.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium" style={{ color: '#374151' }}>Analyses<span style={{ color: '#EF4444' }}> *</span></label>
                  <span style={{ fontSize: 10, color: '#9CA3AF' }}>{vals.analysisServices.length} selected</span>
                </div>
                <div className="rounded-lg" style={{ border: `1px solid ${fieldErrors.analysis_services ? '#EF4444' : '#D1D5DB'}`, maxHeight: 280, overflowY: 'auto' }}>
                  {analysisServices.length === 0 ? (
                    <p className="px-3 py-3 text-xs" style={{ color: '#9CA3AF' }}>No analyses available.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-3">
                      {analysisServices.map(svc => (
                        <label key={svc.uid} className="flex items-center gap-2 px-3 py-2 cursor-pointer" style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <input type="checkbox" checked={vals.analysisServices.some(a => a.uid === svc.uid)}
                            onChange={() => toggleAnalysis(svc)} style={{ accentColor: '#0154FC' }} />
                          <span className="text-xs" style={{ color: '#111827', flex: 1 }}>{svc.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {fieldErrors.analysis_services && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{fieldErrors.analysis_services}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Commercial ID</label>
                  <input
                    name="commercial_id"
                    placeholder="Used for accounting"
                    value={vals.commercialId}
                    onChange={e => setVal('commercialId', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                    style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 mt-5 cursor-pointer text-xs" style={{ color: '#374151' }}>
                    <input type="checkbox" name="use_analysis_profile_price" checked={vals.usePrice}
                      onChange={e => setVal('usePrice', e.target.checked)} style={{ accentColor: '#0154FC' }} />
                    Use profile price instead of single analyses prices
                  </label>
                  {vals.usePrice && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <input
                        name="analysis_profile_price"
                        placeholder="Price (excl. VAT)"
                        value={vals.price}
                        onChange={e => setVal('price', e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                        style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                      />
                      <input
                        name="analysis_profile_vat"
                        placeholder="VAT %"
                        value={vals.vat}
                        onChange={e => setVal('vat', e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                        style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #F3F4F6' }}>
              <button type="button" onClick={closeForm} disabled={pending}
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
      )}

      {/* ── Deactivate confirmation modal ── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', left: 0, right: 0, bottom: 'var(--dashboard-footer-h)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => !deleting && setDeleteTarget(null)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} />
          <div style={{ position: 'relative', width: 380, backgroundColor: '#fff', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', padding: 20 }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#FEF2F2' }}>
                <MI name="visibility_off" size={16} color="#DC2626" />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: '#111827' }}>Deactivate analysis profile?</h3>
            </div>
            <p className="text-xs mb-5" style={{ color: '#6B7280' }}>
              &ldquo;{deleteTarget.name}&rdquo; will no longer be available for selection when registering samples. It can be reactivated later if needed.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="flex items-center gap-1.5"
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#DC2626', color: '#fff', border: 'none', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                <MI name={deleting ? 'hourglass_top' : 'visibility_off'} size={13} color="#fff" />
                {deleting ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table / empty state */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      {initialProfiles.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="science" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No analysis profiles yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create your first profile to speed up sample registration</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Analysis Profile
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '30%' }} /><col style={{ width: '58%' }} /><col style={{ width: '12%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Analyses', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialProfiles.map((p, i) => (
                <tr key={p.uid} style={{ borderBottom: i < initialProfiles.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                        <MI name="science" size={13} color="#0154FC" />
                      </div>
                      <span className="text-xs font-medium" style={{ color: '#111827' }}>{p.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#6B7280' }}>
                    {p.analysis_services?.length ? p.analysis_services.map(a => serviceTitle(a.uid)).join(', ') : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(p)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }} title="Edit">
                        <MI name="edit" size={14} color="#9CA3AF" />
                      </button>
                      <button onClick={() => setDeleteTarget(p)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }} title="Deactivate">
                        <MI name="visibility_off" size={14} color="#9CA3AF" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialProfiles.length} profile{initialProfiles.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

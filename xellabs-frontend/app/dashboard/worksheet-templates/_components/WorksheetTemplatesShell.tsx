'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createWorksheetTemplate, updateWorksheetTemplate, deactivateWorksheetTemplate,
  type WorksheetTemplateRow, type WtPosition, type WtPositionType,
  type WorksheetTemplateFormState,
} from '@/app/actions/worksheet-templates'
import type { RefOption } from '@/app/dashboard/_components/AdminRefShell'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const TYPE_LABELS: Record<WtPositionType, string> = {
  a: 'Analysis', b: 'Blank', c: 'Control', d: 'Duplicate',
}

type FV = {
  title: string
  description: string
  instrumentUid: string
  restrictToMethodUid: string
  serviceUids: string[]
  positions: WtPosition[]
}

const blank = (): FV => ({
  title: '', description: '', instrumentUid: '', restrictToMethodUid: '',
  serviceUids: [], positions: [],
})

// Sequential 1-based positions — SENAITE stores a per-position layout where
// `dup` references a position number, so positions must always be renumbered
// contiguously when rows are added/removed.
function renumber(positions: WtPosition[]): WtPosition[] {
  return positions.map((p, i) => ({ ...p, pos: i + 1 }))
}

type Props = {
  rows: WorksheetTemplateRow[]
  instruments: RefOption[]
  methods: RefOption[]
  services: RefOption[]
  referenceDefinitions: RefOption[]
}

export default function WorksheetTemplatesShell({
  rows, instruments, methods, services, referenceDefinitions,
}: Props) {
  const router = useRouter()
  const [showDrawer, setShowDrawer] = useState(false)
  const [editing, setEditing] = useState<WorksheetTemplateRow | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [vals, setVals] = useState<FV>(blank)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<WorksheetTemplateRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isEdit = editing !== null
  const noRefDefs = referenceDefinitions.length === 0

  function setVal<K extends keyof FV>(k: K, v: FV[K]) {
    setVals(prev => ({ ...prev, [k]: v }))
    if (fieldErrors[k]) setFieldErrors(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  // Regenerate the layout grid to N positions, preserving already-configured rows.
  function setPositionCount(n: number) {
    const count = Math.max(0, Math.min(100, Math.floor(n) || 0))
    setVals(prev => {
      const next: WtPosition[] = []
      for (let i = 0; i < count; i++) {
        next.push(prev.positions[i] ?? { pos: i + 1, type: 'a', ref: '', dup: null })
      }
      return { ...prev, positions: renumber(next) }
    })
    if (fieldErrors.positions) setFieldErrors(prev => { const n = { ...prev }; delete n.positions; return n })
  }

  function addPosition() {
    setVals(prev => ({ ...prev, positions: renumber([...prev.positions, { pos: prev.positions.length + 1, type: 'a', ref: '', dup: null }]) }))
  }

  function removePosition(idx: number) {
    setVals(prev => ({ ...prev, positions: renumber(prev.positions.filter((_, i) => i !== idx)) }))
  }

  function setPosition(idx: number, patch: Partial<WtPosition>) {
    setVals(prev => ({
      ...prev,
      positions: prev.positions.map((p, i) => {
        if (i !== idx) return p
        const merged = { ...p, ...patch }
        // Clear the sub-value that no longer applies when the type changes.
        if (patch.type) {
          if (patch.type !== 'b' && patch.type !== 'c') merged.ref = ''
          if (patch.type !== 'd') merged.dup = null
        }
        return merged
      }),
    }))
    if (fieldErrors.positions) setFieldErrors(prev => { const n = { ...prev }; delete n.positions; return n })
  }

  function toggleService(uid: string) {
    setVal('serviceUids', vals.serviceUids.includes(uid)
      ? vals.serviceUids.filter(u => u !== uid)
      : [...vals.serviceUids, uid])
  }

  const [state, action, pending] = useActionState(
    async (prev: WorksheetTemplateFormState, fd: FormData) => {
      const result = isEdit ? await updateWorksheetTemplate(prev, fd) : await createWorksheetTemplate(prev, fd)
      if (result.success) {
        setShowDrawer(false); setEditing(null); setVals(blank()); setFieldErrors({})
        setToast({ ok: true, msg: result.message ?? 'Saved.' })
        setTimeout(() => setToast(null), 4000)
        router.refresh()
      } else if (result.errors) {
        const fe: Record<string, string> = {}
        for (const [k, msgs] of Object.entries(result.errors)) {
          if (Array.isArray(msgs) && msgs.length) fe[k] = String(msgs[0])
        }
        setFieldErrors(fe)
      } else if (result.message) {
        setToast({ ok: false, msg: result.message })
        setTimeout(() => setToast(null), 5000)
      }
      return result
    },
    {},
  )

  function openCreate() { setEditing(null); setVals(blank()); setFieldErrors({}); setShowDrawer(true) }
  function openEdit(t: WorksheetTemplateRow) {
    setEditing(t)
    setVals({
      title: t.title,
      description: t.description ?? '',
      instrumentUid: t.instrumentUid ?? '',
      restrictToMethodUid: t.restrictToMethodUid ?? '',
      serviceUids: t.serviceUids ?? [],
      positions: renumber(t.positions ?? []),
    })
    setFieldErrors({})
    setShowDrawer(true)
  }
  function closeDrawer() { if (!pending) { setShowDrawer(false); setEditing(null) } }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const r = await deactivateWorksheetTemplate(deleteTarget.path)
    setDeleting(false)
    setDeleteTarget(null)
    if (r.success) { setToast({ ok: true, msg: 'Worksheet template removed.' }); router.refresh() }
    else { setToast({ ok: false, msg: r.message ?? 'Failed to remove.' }) }
    setTimeout(() => setToast(null), 4000)
  }

  const titleFor = (uid: string, list: RefOption[]) => list.find(o => o.uid === uid)?.title ?? ''
  const routineOptions = vals.positions.filter(p => p.type === 'a')

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="arrow_back" size={16} color="#6B7280" />
          </Link>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Worksheet Templates</h1>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Predefined worksheet layouts — tray size, routine/QC position plan, analyses, instrument and method</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New Worksheet Template
        </button>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, color: toast.ok ? '#0154FC' : '#991B1B', flexShrink: 0 }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* ── Right Drawer ── */}
      <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, zIndex: 200, pointerEvents: showDrawer ? 'auto' : 'none' }}>
        <div onClick={closeDrawer} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showDrawer ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 560, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showDrawer ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>

          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEdit ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEdit ? 'edit' : 'add'} size={16} color={isEdit ? '#2563EB' : '#0154FC'} />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
                  {isEdit ? `Edit — ${editing!.title}` : 'New Worksheet Template'}
                </h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                  {isEdit ? 'Update layout and analyses' : 'Define the tray size, positions, and analyses'}
                </p>
              </div>
            </div>
            <button onClick={closeDrawer} className="p-1.5 rounded-lg hover:bg-gray-100">
              <MI name="close" size={16} color="#9CA3AF" />
            </button>
          </div>

          <form action={action} className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {isEdit && <input type="hidden" name="_path" value={editing!.path} />}
            <input type="hidden" name="instrumentUid" value={vals.instrumentUid} />
            <input type="hidden" name="restrictToMethodUid" value={vals.restrictToMethodUid} />
            <input type="hidden" name="numOfPositions" value={vals.positions.length} />
            <input type="hidden" name="serviceUids" value={JSON.stringify(vals.serviceUids)} />
            <input type="hidden" name="positions" value={JSON.stringify(vals.positions)} />

            <div className="flex-1 px-5 py-4 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                  Template Name<span style={{ color: '#EF4444' }}> *</span>
                </label>
                <input
                  name="title"
                  placeholder="e.g. ICP-MS Metals Tray"
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
                    Restrict to Method <span className="font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
                  </label>
                  <select
                    value={vals.restrictToMethodUid}
                    onChange={e => setVal('restrictToMethodUid', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                    style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                  >
                    <option value="">None</option>
                    {methods.map(m => <option key={m.uid} value={m.uid}>{m.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                    Preferred Instrument <span className="font-normal" style={{ color: '#9CA3AF' }}>(optional)</span>
                  </label>
                  <select
                    value={vals.instrumentUid}
                    onChange={e => setVal('instrumentUid', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                    style={{ border: '1px solid #D1D5DB', color: '#111827' }}
                  >
                    <option value="">None</option>
                    {instruments.map(i => <option key={i.uid} value={i.uid}>{i.title}</option>)}
                  </select>
                </div>
              </div>

              {/* Number of positions + layout grid */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium" style={{ color: '#374151' }}>Worksheet Layout</label>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>Positions</span>
                    <input
                      type="number" min={0} max={100}
                      value={vals.positions.length}
                      onChange={e => setPositionCount(Number(e.target.value))}
                      className="px-2 py-1 text-xs rounded-lg outline-none"
                      style={{ border: '1px solid #D1D5DB', color: '#111827', width: 60 }}
                    />
                    <button type="button" onClick={addPosition} className="flex items-center gap-1 text-xs font-medium" style={{ color: '#0154FC' }}>
                      <MI name="add" size={13} color="#0154FC" /> Add
                    </button>
                  </div>
                </div>

                {noRefDefs && (
                  <p className="mb-1.5 px-2 py-1.5 rounded-lg" style={{ fontSize: 10, color: '#92400E', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A' }}>
                    Blank &amp; Control positions need a Reference Definition. Add one under Administration → Reference Definitions to enable them.
                  </p>
                )}

                {vals.positions.length === 0 ? (
                  <p className="px-3 py-3 text-xs rounded-lg" style={{ color: '#9CA3AF', border: '1px dashed #D1D5DB', backgroundColor: '#FAFAFA' }}>
                    Set the number of positions (tray size), then choose an Analysis type for each.
                  </p>
                ) : (
                  <div className="rounded-lg" style={{ border: '1px solid #E8EAF2', maxHeight: 260, overflowY: 'auto', backgroundColor: '#fff' }}>
                    {vals.positions.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5" style={{ borderBottom: idx < vals.positions.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                        <span className="shrink-0 w-8 text-center text-xs font-semibold rounded" style={{ color: '#0154FC', backgroundColor: '#EFF6FF', padding: '3px 0' }}>{p.pos}</span>
                        <select
                          value={p.type}
                          onChange={e => setPosition(idx, { type: e.target.value as WtPositionType })}
                          className="px-2 py-1 text-xs rounded-lg outline-none"
                          style={{ border: '1px solid #D1D5DB', color: '#111827', backgroundColor: '#fff', width: 110 }}
                        >
                          {(Object.keys(TYPE_LABELS) as WtPositionType[]).map(t => (
                            <option key={t} value={t} disabled={(t === 'b' || t === 'c') && noRefDefs}>{TYPE_LABELS[t]}</option>
                          ))}
                        </select>

                        {(p.type === 'b' || p.type === 'c') && (
                          <select
                            value={p.ref}
                            onChange={e => setPosition(idx, { ref: e.target.value })}
                            className="flex-1 px-2 py-1 text-xs rounded-lg outline-none"
                            style={{ border: `1px solid ${p.ref ? '#D1D5DB' : '#FCA5A5'}`, color: '#111827', backgroundColor: '#fff' }}
                          >
                            <option value="">Select reference…</option>
                            {referenceDefinitions.map(r => <option key={r.uid} value={r.uid}>{r.title}</option>)}
                          </select>
                        )}

                        {p.type === 'd' && (
                          <select
                            value={p.dup ?? ''}
                            onChange={e => setPosition(idx, { dup: e.target.value ? Number(e.target.value) : null })}
                            className="flex-1 px-2 py-1 text-xs rounded-lg outline-none"
                            style={{ border: `1px solid ${p.dup ? '#D1D5DB' : '#FCA5A5'}`, color: '#111827', backgroundColor: '#fff' }}
                          >
                            <option value="">Duplicate of…</option>
                            {routineOptions.map(r => <option key={r.pos} value={r.pos}>Position {r.pos}</option>)}
                          </select>
                        )}

                        {p.type === 'a' && <span className="flex-1 text-xs" style={{ color: '#9CA3AF' }}>Routine analysis</span>}

                        <button type="button" onClick={() => removePosition(idx)} className="p-1 rounded hover:bg-gray-200 shrink-0" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                          <MI name="delete" size={13} color="#9CA3AF" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {fieldErrors.positions && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{fieldErrors.positions}</p>}
              </div>

              {/* Analysis services */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium" style={{ color: '#374151' }}>Analysis Services</label>
                  <span style={{ fontSize: 10, color: '#9CA3AF' }}>{vals.serviceUids.length} selected</span>
                </div>
                <div className="rounded-lg" style={{ border: '1px solid #D1D5DB', maxHeight: 200, overflowY: 'auto', backgroundColor: '#fff' }}>
                  {services.length === 0 ? (
                    <p className="px-3 py-3 text-xs" style={{ color: '#9CA3AF' }}>No analysis services available.</p>
                  ) : (
                    services.map(svc => (
                      <label key={svc.uid} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer" style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <input type="checkbox" checked={vals.serviceUids.includes(svc.uid)} onChange={() => toggleService(svc.uid)} style={{ accentColor: '#0154FC' }} />
                        <span className="text-xs" style={{ color: '#111827' }}>{svc.title}</span>
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
              <h3 className="text-sm font-semibold" style={{ color: '#111827' }}>Remove worksheet template?</h3>
            </div>
            <p className="text-xs mb-5" style={{ color: '#6B7280' }}>
              This will remove &ldquo;{deleteTarget.title}&rdquo; from the active list. It can be reactivated in the backend if needed.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="flex items-center gap-1.5"
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#DC2626', color: '#fff', border: 'none', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                <MI name={deleting ? 'hourglass_top' : 'delete'} size={13} color="#fff" />
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table / empty state */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      {rows.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="grid_on" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No worksheet templates yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create your first layout to speed up worksheet creation</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Worksheet Template
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '24%' }} /><col style={{ width: '12%' }} /><col style={{ width: '20%' }} /><col style={{ width: '16%' }} /><col style={{ width: '20%' }} /><col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Positions', 'Layout', 'Method', 'Analyses', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => {
                const counts = t.positions.reduce((acc, p) => { acc[p.type] = (acc[p.type] ?? 0) + 1; return acc }, {} as Record<string, number>)
                const layoutSummary = (['a', 'b', 'c', 'd'] as WtPositionType[])
                  .filter(k => counts[k]).map(k => `${counts[k]} ${TYPE_LABELS[k]}`).join(', ')
                return (
                  <tr key={t.uid} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                          <MI name="grid_on" size={13} color="#0154FC" />
                        </div>
                        <span className="text-xs font-medium truncate" style={{ color: '#111827' }}>{t.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#374151' }}>{t.numOfPositions || t.positions.length || '—'}</td>
                    <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#6B7280' }}>{layoutSummary || '—'}</td>
                    <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#6B7280' }}>{titleFor(t.restrictToMethodUid, methods) || '—'}</td>
                    <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#6B7280' }}>
                      {t.serviceUids.length ? (t.serviceUids.map(u => titleFor(u, services)).filter(Boolean).join(', ') || `${t.serviceUids.length} selected`) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(t)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }} title="Edit">
                          <MI name="edit" size={14} color="#9CA3AF" />
                        </button>
                        <button onClick={() => setDeleteTarget(t)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }} title="Remove">
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
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{rows.length} template{rows.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

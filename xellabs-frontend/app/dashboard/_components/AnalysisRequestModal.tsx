'use client'
import { useState, useActionState } from 'react'
import { createAnalysisRequest, updateAnalysisRequest, type AnalysisRequest, type ARFormState } from '@/app/actions/analysis-requests'
import { type LabSample } from '@/app/actions/lab-samples'
import { type SenaiteAnalysisService } from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

type Props = {
  samples: LabSample[]
  services: SenaiteAnalysisService[]
  onClose: () => void
  onDone: () => void
  preselectedSampleId?: string
  editing?: AnalysisRequest | null
}

/** Shared create/edit form for Analysis Requests — used by both the standalone
 * Analysis Requests page and inline on the Sample Detail page, so the fields
 * and flow never drift apart between the two entry points. */
export default function AnalysisRequestModal({ samples, services, onClose, onDone, preselectedSampleId, editing }: Props) {
  const isEdit = Boolean(editing)
  const [selectedUids, setSelectedUids] = useState<string[]>(() => (editing?.analyses ?? []).map(a => a.senaite_service_uid))

  function toggleService(uid: string, checked: boolean) {
    setSelectedUids(prev => checked ? [...prev, uid] : prev.filter(u => u !== uid))
  }

  const formAction = async (prev: ARFormState, fd: FormData) => {
    const analyses = selectedUids.map(uid => {
      const svc = services.find(s => s.uid === uid)
      return { senaite_service_uid: uid, senaite_service_name: svc?.title ?? '' }
    })
    fd.set('analyses_json', JSON.stringify(analyses))
    const result = isEdit ? await updateAnalysisRequest(editing!.id, prev, fd) : await createAnalysisRequest(prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const [state, action, pending] = useActionState(formAction, {})
  const inputStyle = (err?: string) => ({ border: `1px solid ${err ? '#EF4444' : '#D1D5DB'}`, color: '#111827' })

  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1000 }}>
      <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', right: 0, bottom: 'var(--dashboard-footer-h)', width: 520, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
              <MI name="assignment_add" size={16} color="#0154FC" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEdit ? `Edit — ${editing!.ar_id}` : 'New Analysis Request'}</h2>
              <p style={{ fontSize: 12, color: '#1F2937', fontWeight: 500 }}>{isEdit ? 'Update tests, priority and notes' : 'Link a sample to tests and set priority'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#374151" /></button>
        </div>
        <form action={action} className="px-5 py-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Sample <span style={{ color: '#EF4444' }}>*</span></label>
            {isEdit ? (
              <input readOnly value={editing!.sample_id || `#${editing!.sample}`} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ ...inputStyle(), backgroundColor: '#FAFAFA', color: '#374151' }} />
            ) : (
              <select name="sample" required defaultValue={preselectedSampleId ?? ''} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle(state.errors?.sample?.[0])}>
                <option value="">Select sample…</option>
                {samples.map(s => <option key={s.id} value={s.id}>{s.sample_id} — {s.client_name} ({s.sample_type_name})</option>)}
              </select>
            )}
            {state.errors?.sample && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.sample[0]}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Tests <span style={{ color: '#EF4444' }}>*</span> <span style={{ color: '#374151', fontWeight: 400 }}>(select multiple)</span></label>
            <div style={{ border: `1px solid ${state.errors?.analyses?.[0] ? '#EF4444' : '#D1D5DB'}`, borderRadius: 8, backgroundColor: '#FAFAFA', maxHeight: 160, overflowY: 'auto', padding: '8px 12px' }}>
              {services.map(s => (
                <label key={s.uid} className="flex items-center gap-2 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={selectedUids.includes(s.uid)} onChange={e => toggleService(s.uid, e.target.checked)} style={{ accentColor: '#2563EB' }} />
                  <span style={{ fontSize: 12, color: '#374151' }}>{s.title}</span>
                  <span style={{ fontSize: 10, color: '#374151' }}>({s.Keyword})</span>
                  {s.Unit && <span style={{ fontSize: 10, color: '#374151' }}>— {s.Unit}</span>}
                </label>
              ))}
              {services.length === 0 && <p style={{ fontSize: 12, color: '#374151' }}>No analysis services — create one in Analyses first.</p>}
            </div>
            {state.errors?.analyses && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.analyses[0]}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Priority</label>
              <select name="priority" defaultValue={editing?.priority ?? 'normal'} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle(state.errors?.priority?.[0])}>
                {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {state.errors?.priority?.[0] && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.priority[0]}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Due Date</label>
              <input type="date" name="due_date" defaultValue={editing?.due_date?.slice(0, 10) ?? ''} className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={inputStyle(state.errors?.due_date?.[0])} />
              {state.errors?.due_date?.[0] && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.due_date[0]}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Notes</label>
            <textarea name="notes" rows={2} defaultValue={editing?.notes ?? ''} placeholder="Any additional instructions…" className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none" style={inputStyle(state.errors?.notes?.[0])} />
            {state.errors?.notes?.[0] && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{state.errors.notes[0]}</p>}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button type="button" onClick={onClose} disabled={pending}
              style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className="flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}>
              <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
              {pending ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save Changes' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

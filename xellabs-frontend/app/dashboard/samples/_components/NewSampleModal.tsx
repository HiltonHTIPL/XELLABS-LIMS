'use client'
import { useActionState, useEffect, useRef } from 'react'
import { createSample, SampleFormState } from '@/app/actions/samples'
import { SenaiteSampleType, SenaiteAnalysisService } from '@/app/lib/senaite'

type SenaiteClientOption = { uid: string; name: string; client_id: string }

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const PRIORITIES = [
  { value: '1', label: 'Critical' },
  { value: '2', label: 'High' },
  { value: '3', label: 'Normal' },
  { value: '4', label: 'Low' },
  { value: '5', label: 'Routine' },
]

type Props = {
  onClose: () => void
  clients: SenaiteClientOption[]
  sampleTypes: SenaiteSampleType[]
  analysisServices: SenaiteAnalysisService[]
  onCreated: () => void
}

const INITIAL_STATE: SampleFormState = {}

export default function NewSampleModal({ onClose, clients, sampleTypes, analysisServices, onCreated }: Props) {
  const [state, action, isPending] = useActionState(createSample, INITIAL_STATE)

  useEffect(() => {
    if (state.success) { onCreated(); onClose() }
  }, [state.success]) // eslint-disable-line react-hooks/exhaustive-deps

  const overlayRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>New Sample</h2>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, marginTop: 2 }}>Register a new sample in SENAITE</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <MI name="close" size={20} color="#9CA3AF" />
          </button>
        </div>

        {/* Error banner */}
        {state.message && !state.success && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <MI name="error_outline" size={16} color="#EF4444" />
            <span style={{ fontSize: 13, color: '#B91C1C' }}>{state.message}</span>
          </div>
        )}

        <form action={action} className="px-6 py-4 flex flex-col gap-4">
          {/* Client */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Client <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              name="client_uid"
              required
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: `1px solid ${state.errors?.client_uid ? '#EF4444' : '#E5E7EB'}`, backgroundColor: '#FAFAFA', color: '#374151' }}
            >
              <option value="">Select client…</option>
              {clients.map(c => (
                <option key={c.uid} value={c.uid}>{c.name} ({c.client_id})</option>
              ))}
            </select>
            {state.errors?.client_uid && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{state.errors.client_uid[0]}</p>}
          </div>

          {/* Sample Type */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Sample Type <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              name="sample_type_uid"
              required
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: `1px solid ${state.errors?.sample_type_uid ? '#EF4444' : '#E5E7EB'}`, backgroundColor: '#FAFAFA', color: '#374151' }}
            >
              <option value="">Select sample type…</option>
              {sampleTypes.map(t => (
                <option key={t.uid} value={t.uid}>{t.title}</option>
              ))}
            </select>
            {state.errors?.sample_type_uid && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{state.errors.sample_type_uid[0]}</p>}
          </div>

          {/* Date Sampled + Priority row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Date Sampled <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="datetime-local"
                name="date_sampled"
                required
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: `1px solid ${state.errors?.date_sampled ? '#EF4444' : '#E5E7EB'}`, backgroundColor: '#FAFAFA', color: '#374151' }}
              />
              {state.errors?.date_sampled && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{state.errors.date_sampled[0]}</p>}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Priority</label>
              <select
                name="priority"
                defaultValue="3"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid #E5E7EB', backgroundColor: '#FAFAFA', color: '#374151' }}
              >
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Client Sample ID */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Client Sample ID <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              name="client_sample_id"
              placeholder="Your internal reference ID"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid #E5E7EB', backgroundColor: '#FAFAFA', color: '#374151' }}
            />
          </div>

          {/* Analyses */}
          {analysisServices.length > 0 && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Analyses <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>(optional — select multiple)</span>
              </label>
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, backgroundColor: '#FAFAFA', maxHeight: 180, overflowY: 'auto', padding: '8px 12px' }}>
                {analysisServices.map(a => (
                  <label key={a.uid} className="flex items-center gap-2 py-1.5 cursor-pointer">
                    <input type="checkbox" name="analyses" value={a.uid} style={{ accentColor: '#2563EB' }} />
                    <span style={{ fontSize: 12, color: '#374151' }}>{a.title}</span>
                    {a.Category && <span style={{ fontSize: 10, color: '#9CA3AF' }}>— {a.Category}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button type="button" onClick={onClose} disabled={isPending}
              style={{ fontSize: 13, fontWeight: 500, padding: '8px 18px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="flex items-center gap-2"
              style={{ fontSize: 13, fontWeight: 600, padding: '8px 20px', borderRadius: 8, backgroundColor: '#2563EB', color: '#fff', border: 'none', cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1 }}>
              {isPending ? <><MI name="hourglass_empty" size={14} color="#fff" /> Creating…</> : <><MI name="add" size={14} color="#fff" /> Create Sample</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

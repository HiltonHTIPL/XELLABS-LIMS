'use client'
import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSample, SampleFormState } from '@/app/actions/samples'
import { SenaiteSampleTemplate, SenaiteRefOption } from '@/app/lib/senaite'
import { AnalysisProfile } from '@/app/actions/analysis-profiles'
import { T, MI, Breadcrumb, Btn, SectionCard, Field, inputStyle, selectStyle, textareaStyle, TagChip } from '../../../_components/ui'

type ClientOption = { uid: string; name: string; client_id: string }
type DropdownOption = { uid: string; title: string }
type Props = {
  clients: ClientOption[]
  sampleTypes: DropdownOption[]
  analysisServices: DropdownOption[]
  sampleTemplates: SenaiteSampleTemplate[]
  sampleContainers: SenaiteRefOption[]
  analysisProfiles: AnalysisProfile[]
  // Set when embedded in a drawer (e.g. SamplesShell) instead of the standalone
  // /dashboard/samples/new route — swaps router.push navigation for closing the drawer.
  onClose?: () => void
  onCreated?: () => void
}

const PRIORITIES = [
  { value: '1', label: 'Critical' }, { value: '2', label: 'High' },
  { value: '3', label: 'Normal' },   { value: '4', label: 'Low' }, { value: '5', label: 'Routine' },
]

export default function NewSamplePage({ clients, sampleTypes, analysisServices, sampleTemplates, sampleContainers, analysisProfiles, onClose, onCreated }: Props) {
  const router = useRouter()
  const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>([])
  const [remarks, setRemarks] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [sampleTypeUid, setSampleTypeUid] = useState('')
  const [container, setContainer] = useState('')
  const [sampleCount, setSampleCount] = useState(1)

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId)
    const template = sampleTemplates.find(t => t.uid === templateId)
    if (!template) return
    if (template.sampleTypeUid) setSampleTypeUid(template.sampleTypeUid)
    setSelectedAnalyses((template.services ?? []).map(s => s.uid))
    const firstContainerUid = template.partitions?.[0]?.containerUid
    setContainer(sampleContainers.find(c => c.uid === firstContainerUid)?.title ?? '')
  }

  function handleProfileChange(profileId: string) {
    setSelectedProfileId(profileId)
    const profile = analysisProfiles.find(p => String(p.id) === profileId)
    if (!profile) return
    // Analysis profiles don't set sample type/container — they only add analyses on top of the current selection.
    setSelectedAnalyses(prev => [...new Set([...prev, ...profile.analysis_services.map(a => a.uid)])])
  }

  const handleCreate = async (prev: SampleFormState, fd: FormData) => {
    const result = await createSample(prev, fd)
    if (!result.success) return result
    // sampleCount > 1 registers additional identical copies of the same sample details.
    for (let i = 1; i < sampleCount; i++) {
      await createSample(prev, fd)
    }
    if (onCreated) onCreated()
    else router.push('/dashboard/samples')
    return result
  }
  const [state, action, isPending] = useActionState(handleCreate, {})

  function toggleAnalysis(uid: string) {
    setSelectedAnalyses(prev => prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid])
  }

  const analysisTotal = 0  // no pricing API available

  return (
    <div style={{ backgroundColor: T.pageBg, minHeight: '100%', padding: 20 }}>

      {!onClose && <Breadcrumb items={[{ label: 'Samples', href: '/dashboard/samples' }, { label: 'New Sample' }]} />}

      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.heading, letterSpacing: '-0.02em', margin: 0 }}>New Sample</h1>
          <p className="mt-1" style={{ fontSize: 13, color: T.muted }}>Register and receive incoming laboratory samples.</p>
        </div>
        <div className="flex items-center gap-3">
          {onClose && (
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" style={{ marginRight: 4 }}>
              <MI name="close" size={18} color="#9CA3AF" />
            </button>
          )}
          <span style={{ fontSize: 12, color: T.muted }}>Number of samples</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setSampleCount(c => Math.max(1, c - 1))}
              className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.inputBorder}`, backgroundColor: '#fff', cursor: 'pointer', fontSize: 16, color: T.text }}>−</button>
            <span style={{ width: 36, textAlign: 'center', fontSize: 14, fontWeight: 600, color: T.heading }}>{sampleCount}</span>
            <button type="button" onClick={() => setSampleCount(c => Math.min(20, c + 1))}
              className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.inputBorder}`, backgroundColor: '#fff', cursor: 'pointer', fontSize: 16, color: T.text }}>+</button>
          </div>
          <Btn variant="outline" icon="add" onClick={() => setSampleCount(c => Math.min(20, c + 1))}>Add Another Sample</Btn>
        </div>
      </div>

      {/* Error banner */}
      {state.message && !state.success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4" style={{ backgroundColor: '#FEF2F2', border: `1px solid #FECACA` }}>
          <MI name="error_outline" size={16} color={T.danger} />
          <span style={{ fontSize: 13, color: '#991B1B' }}>{state.message}</span>
        </div>
      )}

      <form action={action}>
        {/* Hidden analyses inputs */}
        {selectedAnalyses.map(uid => (
          <input key={uid} type="hidden" name="analyses" value={uid} />
        ))}
        <input type="hidden" name="remarks" value={remarks} />

        <div className="flex gap-5" style={{ alignItems: 'flex-start' }}>

          {/* Left form column */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">

            {/* ① Client / Request Details */}
            <SectionCard step={1} title="Client / Request Details">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Field label="Sample Template" hint="auto-fills sample type, analyses & container">
                  <select value={selectedTemplateId} onChange={e => handleTemplateChange(e.target.value)}
                    style={selectStyle} className="w-full outline-none">
                    <option value="">None — configure manually</option>
                    {sampleTemplates.map(t => <option key={t.uid} value={t.uid}>{t.title}</option>)}
                  </select>
                </Field>
                <Field label="Analysis Profile" hint="adds a bundle of analyses on top of current selection">
                  <select value={selectedProfileId} onChange={e => handleProfileChange(e.target.value)}
                    style={selectStyle} className="w-full outline-none">
                    <option value="">None — select analyses manually</option>
                    {analysisProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="Client" required>
                  <select name="client_uid" required style={selectStyle} className="w-full outline-none"
                    defaultValue="">
                    <option value="">Select client…</option>
                    {clients.map(c => <option key={c.uid} value={c.uid}>{c.name} ({c.client_id})</option>)}
                  </select>
                  {state.errors?.client_uid && <p className="mt-1" style={{ fontSize: 11, color: T.danger }}>{state.errors.client_uid[0]}</p>}
                </Field>
                <Field label="Client Sample ID" hint="Your internal reference ID">
                  <input type="text" name="client_sample_id" placeholder="Ref-001" style={inputStyle} className="w-full outline-none" />
                </Field>
              </div>
            </SectionCard>

            {/* ② Sampling Details */}
            <SectionCard step={2} title="Sampling Details">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Field label="Date Sampled" required>
                  <input type="datetime-local" name="date_sampled" required style={inputStyle} className="w-full outline-none" />
                  {state.errors?.date_sampled && <p className="mt-1" style={{ fontSize: 11, color: T.danger }}>{state.errors.date_sampled[0]}</p>}
                </Field>
                <Field label="Sample Type" required>
                  <select name="sample_type_uid" required style={selectStyle} className="w-full outline-none"
                    value={sampleTypeUid} onChange={e => setSampleTypeUid(e.target.value)}>
                    <option value="">Select sample type…</option>
                    {sampleTypes.map(t => <option key={t.uid} value={t.uid}>{t.title}</option>)}
                  </select>
                  {state.errors?.sample_type_uid && <p className="mt-1" style={{ fontSize: 11, color: T.danger }}>{state.errors.sample_type_uid[0]}</p>}
                </Field>
                <Field label="Priority">
                  <select name="priority" defaultValue="3" style={selectStyle} className="w-full outline-none">
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
                <Field label="Container" hint="from Sample Template, editable">
                  <input type="text" name="container" placeholder="e.g. Sterile 50mL Tube" style={inputStyle} className="w-full outline-none"
                    value={container} onChange={e => setContainer(e.target.value)} />
                </Field>
              </div>
            </SectionCard>

            {/* ③ Additional Content */}
            <SectionCard step={3} title="Additional Content">
              <Field label="Remarks">
                <div className="relative">
                  <textarea
                    value={remarks}
                    onChange={e => setRemarks(e.target.value.slice(0, 500))}
                    placeholder="Add any relevant notes..."
                    rows={3}
                    style={textareaStyle}
                    className="w-full outline-none"
                  />
                  <span style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 11, color: T.faint }}>{remarks.length} / 500</span>
                </div>
              </Field>

              <div className="mt-4">
                <p style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 8 }}>Attachment</p>
                <div style={{ border: `1.5px dashed #C9D2E8`, borderRadius: 12, padding: '24px 16px', textAlign: 'center', backgroundColor: '#FAFBFE' }}>
                  <MI name="cloud_upload" size={28} color={T.faint} />
                  <p style={{ fontSize: 13, color: T.muted, marginTop: 8 }}>Drag and drop files here <strong>or browse</strong></p>
                  <p style={{ fontSize: 11, color: T.faint, marginTop: 4 }}>Accepted files: PDF, JPG, PNG (Max 10MB each)</p>
                </div>
              </div>
            </SectionCard>

            {/* Required note + form actions */}
            <div className="flex items-center justify-between pt-2">
              <p style={{ fontSize: 11, color: T.faint }}>
                <span style={{ color: T.danger }}>*</span> Required fields
              </p>
              <div className="flex items-center gap-2">
                <Btn type="button" variant="outline" onClick={() => (onClose ? onClose() : router.push('/dashboard/samples'))}>Clear Form</Btn>
                <Btn type="submit" variant="primary" disabled={isPending}>{isPending ? 'Saving…' : 'Save Draft'}</Btn>
                <Btn type="submit" variant="success" icon="check" disabled={isPending}>{isPending ? 'Logging…' : sampleCount > 1 ? `Log ${sampleCount} Samples` : 'Log Sample'}</Btn>
              </div>
            </div>
          </div>

          {/* Right rail */}
          <div className="flex flex-col gap-4" style={{ width: 320, flexShrink: 0 }}>

            {/* Lab Analyses */}
            <div className="bg-white" style={{ border: `1px solid ${T.cardBorder}`, borderRadius: T.cardRadius, boxShadow: T.cardShadow }}>
              <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <MI name="science" size={18} color={T.primary} />
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: T.heading }}>Lab Analyses</h3>
                </div>
                <span style={{ fontSize: 11, color: T.muted, backgroundColor: '#F3F4F6', borderRadius: 8, padding: '2px 8px' }}>
                  {selectedAnalyses.length} selected
                </span>
              </div>
              <div className="px-4 pb-2" style={{ maxHeight: 280, overflowY: 'auto' }}>
                {analysisServices.length === 0 ? (
                  <p style={{ fontSize: 12, color: T.faint, paddingBottom: 12 }}>No analyses available.</p>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {analysisServices.map(a => (
                      <label key={a.uid} className="flex items-center gap-2 py-2 cursor-pointer" style={{ borderBottom: `1px solid ${T.rowBorder}` }}>
                        <input type="checkbox" checked={selectedAnalyses.includes(a.uid)}
                          onChange={() => toggleAnalysis(a.uid)} style={{ accentColor: T.primary }} />
                        <span style={{ fontSize: 12, color: T.text, flex: 1 }}>{a.title}</span>
                        <span style={{ fontSize: 11, color: T.faint }}>—</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {selectedAnalyses.length > 0 && (
                <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                  {selectedAnalyses.map(uid => {
                    const svc = analysisServices.find(a => a.uid === uid)
                    return svc ? <TagChip key={uid} label={svc.title} onRemove={() => toggleAnalysis(uid)} /> : null
                  })}
                </div>
              )}
            </div>

            {/* Pricing Summary */}
            <div className="bg-white" style={{ border: `1px solid ${T.cardBorder}`, borderRadius: T.cardRadius, boxShadow: T.cardShadow }}>
              <div className="flex items-center gap-2 px-4 pt-4 pb-3">
                <MI name="attach_money" size={18} color={T.primary} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: T.heading }}>Pricing Summary</h3>
              </div>
              <div className="px-4 pb-4">
                <div className="flex justify-between py-2">
                  <span style={{ fontSize: 12, color: T.muted }}>Subtotal</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>${analysisTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2" style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
                  <span style={{ fontSize: 12, color: T.muted }}>VAT (15%)</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>${(analysisTotal * 0.15).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-3">
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.heading }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: T.primary }}>${(analysisTotal * 1.15).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

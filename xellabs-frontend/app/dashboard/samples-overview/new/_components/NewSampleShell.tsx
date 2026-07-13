'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSampleWithAnalyses, type DjangoSampleType } from '@/app/actions/lab-samples'
import { type DjangoClient } from '@/app/actions/clients'
import { type LimsTest } from '@/app/actions/tests'
import { type SampleTemplate } from '@/app/actions/sample-templates'
import StorageLocationInput from '@/app/dashboard/_components/StorageLocationInput'

const CONTAINER_OPTIONS = [
  { value: 'glass_tube_10ml', label: 'Glass Tube (10 mL)' },
  { value: 'glass_tube_50ml', label: 'Glass Tube (50 mL)' },
  { value: 'falcon_tube',     label: 'Falcon Tube (50 mL)' },
  { value: 'cryovial',        label: 'Cryovial (2 mL)' },
  { value: 'blood_tube',      label: 'Blood Collection Tube' },
  { value: 'urine_cup',       label: 'Urine Cup' },
]

// Containers valid for a given template's suggested container. If the template's
// container text doesn't match any preset option, it becomes the sole selectable
// option (as its own value) rather than being silently dropped.
function containerOptionsFor(templateContainer: string): { value: string; label: string }[] {
  const needle = templateContainer.trim().toLowerCase()
  if (!needle) return CONTAINER_OPTIONS
  const matched = CONTAINER_OPTIONS.filter(o => o.label.toLowerCase().includes(needle) || needle.includes(o.label.toLowerCase()))
  return matched.length ? matched : [{ value: templateContainer.trim(), label: templateContainer.trim() }]
}

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function SectionHeader({ num, title }: { num: number; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#2563EB', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{num}</div>
      <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{title}</span>
    </div>
  )
}

const inp = { border: '1px solid #D1D5DB', borderRadius: 7, padding: '9px 11px', fontSize: 13, color: '#111827', background: '#fff', width: '100%', outline: 'none', boxSizing: 'border-box' as const }
const lbl = { fontSize: 12, fontWeight: 600 as const, color: '#374151', marginBottom: 5, display: 'block' as const }

function TagInput({ tags, onAdd, onRemove, placeholder }: { tags: string[]; onAdd: (v: string) => void; onRemove: (v: string) => void; placeholder?: string }) {
  const [val, setVal] = useState('')
  return (
    <div style={{ border: '1px solid #D1D5DB', borderRadius: 7, padding: '5px 8px', minHeight: 38, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', background: '#fff' }}>
      {tags.map(t => (
        <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EFF6FF', color: '#1D4ED8', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 500 }}>
          {t}
          <button type="button" onClick={() => onRemove(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#1D4ED8', lineHeight: 1, fontSize: 14, fontWeight: 700 }}>×</button>
        </span>
      ))}
      <input value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && val.trim()) { e.preventDefault(); onAdd(val.trim()); setVal('') } }}
        placeholder={tags.length === 0 ? placeholder : ''} style={{ border: 'none', outline: 'none', fontSize: 12, color: '#374151', flex: 1, minWidth: 80, background: 'transparent' }} />
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      style={{ width: 40, height: 22, borderRadius: 11, background: checked ? '#2563EB' : '#D1D5DB', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: checked ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )
}

// ── Per-sample form state type ────────────────────────────────────────────────
type SampleForm = {
  primarySample: string; clientId: string; contactName: string; ccContact: string
  ccEmails: string[]; batchId: string; batchSubGroup: string; sampleTemplateId: string
  analysisProfiles: string[]; suggestedContainer: string; dateSampled: string; sampleTypeId: string
  containerType: string; preservation: string; analysisSpec: string; samplePoint: string
  storageLocation: string; storageLabelCode: string; samplingDeviation: string; condition: string; priority: string
  envConditions: string; composite: boolean; internalUse: boolean; clientOrderNum: string
  clientReference: string; clientSampleId: string; remarks: string; selectedTests: LimsTest[]
}

function blankForm(): SampleForm {
  return {
    primarySample: 'yes', clientId: '', contactName: '', ccContact: '', ccEmails: [],
    batchId: '', batchSubGroup: '', sampleTemplateId: '', analysisProfiles: [], suggestedContainer: '',
    dateSampled: '', sampleTypeId: '', containerType: '', preservation: '',
    analysisSpec: '', samplePoint: '', storageLocation: '', storageLabelCode: '', samplingDeviation: 'none',
    condition: 'good', priority: 'medium', envConditions: 'room_temp',
    composite: false, internalUse: false, clientOrderNum: '', clientReference: '',
    clientSampleId: '', remarks: '', selectedTests: [],
  }
}

type Props = { sampleTypes: DjangoSampleType[]; clients: DjangoClient[]; tests: LimsTest[]; sampleTemplates: SampleTemplate[] }

export default function NewSampleShell({ sampleTypes, clients, tests, sampleTemplates }: Props) {
  const router = useRouter()

  // Sample Types valid for a given template — filtered down to the one matching
  // the template's SENAITE sample type via senaite_uid. Falls back to the full
  // list when no template is selected (manual mode).
  function sampleTypeOptionsFor(templateId: string): DjangoSampleType[] {
    if (!templateId) return sampleTypes
    const template = sampleTemplates.find(t => String(t.id) === templateId)
    if (!template?.sample_type_uid) return sampleTypes
    const matched = sampleTypes.filter(st => st.senaite_uid === template.sample_type_uid)
    return matched.length ? matched : sampleTypes
  }

  const [forms, setForms] = useState<SampleForm[]>([blankForm()])
  const [activeTab, setActiveTab] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitProgress, setSubmitProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAddAnalysis, setShowAddAnalysis] = useState(false)
  const [analysisSearch, setAnalysisSearch] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)

  const f = forms[activeTab]
  const sampleCount = forms.length

  // Update a field on the active tab
  function set<K extends keyof SampleForm>(key: K, value: SampleForm[K]) {
    setForms(prev => prev.map((form, i) => i === activeTab ? { ...form, [key]: value } : form))
  }

  function addTab() {
    setForms(prev => [...prev, blankForm()])
    setActiveTab(forms.length)
  }

  function removeTab(idx: number) {
    if (forms.length === 1) return
    setForms(prev => prev.filter((_, i) => i !== idx))
    setActiveTab(prev => Math.min(prev, forms.length - 2))
  }

  function changeCount(delta: number) {
    if (delta > 0) { addTab() }
    else if (delta < 0 && forms.length > 1) { removeTab(forms.length - 1) }
  }

  function clearActiveForm() {
    setForms(prev => prev.map((form, i) => i === activeTab ? blankForm() : form))
    setError('')
  }

  // Submit in small concurrent batches (not all-at-once) so a large sample count
  // doesn't burst past the API rate limit in a single instant.
  const SUBMIT_BATCH_SIZE = 8
  const SUBMIT_BATCH_DELAY_MS = 400

  async function submitInBatches<T>(items: T[], run: (item: T) => Promise<{ success: boolean; message?: string; sample_id?: string; id?: number }>) {
    const results: Array<{ success: boolean; message?: string; sample_id?: string; id?: number }> = []
    for (let i = 0; i < items.length; i += SUBMIT_BATCH_SIZE) {
      const batch = items.slice(i, i + SUBMIT_BATCH_SIZE)
      const batchResults = await Promise.all(batch.map(run))
      results.push(...batchResults)
      setSubmitProgress({ done: results.length, total: items.length })
      if (i + SUBMIT_BATCH_SIZE < items.length) await new Promise(r => setTimeout(r, SUBMIT_BATCH_DELAY_MS))
    }
    return results
  }

  async function handleSubmit(asDraft = false) {
    const invalid = forms.findIndex(f => !f.clientId || !f.sampleTypeId)
    if (invalid !== -1) {
      setActiveTab(invalid)
      setError(`Sample ${invalid + 1}: Client and Sample Type are required.`)
      return
    }
    const futureDated = forms.findIndex(f => f.dateSampled && new Date(f.dateSampled) > new Date())
    if (futureDated !== -1) {
      setActiveTab(futureDated)
      setError(`Sample ${futureDated + 1}: Date Sampled cannot be in the future.`)
      return
    }
    setError(''); setSubmitting(true); setSubmitProgress({ done: 0, total: forms.length })
    const results = await submitInBatches(forms, f => {
      const client = clients.find(c => String(c.id) === f.clientId)
      const sampleType = sampleTypes.find(st => String(st.id) === f.sampleTypeId)
      return createSampleWithAnalyses(
        {
          client: Number(f.clientId), sample_type: Number(f.sampleTypeId),
          priority: f.priority, condition: f.condition,
          collection_date: f.dateSampled || undefined,
          description: f.remarks || undefined,
          preferred_storage_location: f.storageLocation || undefined,
          preferred_storage_label_code: f.storageLabelCode || undefined,
          contact_name: f.contactName || undefined, cc_contact: f.ccContact || undefined,
          cc_emails: f.ccEmails.join(',') || undefined, batch_id: f.batchId || undefined,
          batch_sub_group: f.batchSubGroup || undefined, container_type: f.containerType || undefined,
          preservation: f.preservation || undefined, analysis_specification: f.analysisSpec || undefined,
          sampling_deviation: f.samplingDeviation !== 'none' ? f.samplingDeviation : undefined,
          sample_point: f.samplePoint || undefined, environmental_conditions: f.envConditions || undefined,
          composite: f.composite, internal_use: f.internalUse,
          client_order_number: f.clientOrderNum || undefined,
          client_reference: f.clientReference || undefined,
          client_sample_id: f.clientSampleId || undefined,
          client_senaite_uid: client?.senaite_uid || undefined,
          sample_type_senaite_uid: sampleType?.senaite_uid || undefined,
        },
        asDraft ? [] : f.selectedTests.map(t => t.id),
        asDraft ? [] : f.selectedTests.map(t => t.senaite_uid).filter((u): u is string => Boolean(u)),
      )
    })
    setSubmitting(false)
    const failed = results.filter(r => !r.success)
    if (failed.length > 0) {
      setError(failed.map(r => r.message).join(' | '))
    } else {
      // Upload attachments to EVERY created sample in the batch — previously only
      // the first sample got them, silently. Must use the numeric DB id — the
      // display sample_id ("BL-2026-001") 404s against the DRF detail route.
      let failedUploads = 0
      const createdIds = results.map(r => r.id).filter((id): id is number => Boolean(id))
      if (createdIds.length > 0 && attachments.length > 0) {
        const { uploadSampleAttachment } = await import('@/app/actions/lab-samples')
        for (const sid of createdIds) {
          for (const file of attachments) {
            const fd = new FormData(); fd.append('attachment', file)
            const up = await uploadSampleAttachment(String(sid), fd)
            if (!up.ok) failedUploads++
          }
        }
      }
      const ids = results.map(r => r.sample_id).filter(Boolean).join(', ')
      const uploadWarning = failedUploads > 0
        ? ` — note: ${failedUploads} attachment${failedUploads > 1 ? 's' : ''} failed to upload; edit the sample to retry.`
        : ''
      setSuccess(`${forms.length} sample${forms.length > 1 ? 's' : ''} logged: ${ids}${uploadWarning}`)
      setTimeout(() => router.push('/dashboard/samples-overview'), 1800)
    }
  }

  // Auto-populate contact fields for active tab only
  function handleClientChange(clientId: string) {
    const client = clients.find(c => String(c.id) === clientId)
    if (!client) { set('clientId', ''); return }
    const contactName = [client.contact_first_name, client.contact_last_name].filter(Boolean).join(' ') || client.contact_person || ''
    const ccFromClient = (client.cc_emails ?? '').split(',').map(s => s.trim()).filter(Boolean)
    const emails: string[] = [...ccFromClient]
    if (client.contact_email && !emails.includes(client.contact_email)) emails.push(client.contact_email)
    if (client.email && !emails.includes(client.email)) emails.push(client.email)
    setForms(prev => prev.map((form, i) => i === activeTab ? {
      ...form, clientId,
      contactName: contactName || form.contactName,
      ccEmails: form.ccEmails.length === 0 ? emails : form.ccEmails,
    } : form))
  }

  // Propagate ALL Section 1 fields from active tab to every other tab
  function applyClientToAll() {
    if (!f.clientId) return
    setForms(prev => prev.map((form, i) => i === activeTab ? form : {
      ...form,
      primarySample: f.primarySample,
      clientId: f.clientId,
      contactName: f.contactName,
      ccContact: f.ccContact,
      ccEmails: f.ccEmails,
      batchId: f.batchId,
      batchSubGroup: f.batchSubGroup,
      sampleTemplateId: f.sampleTemplateId,
      analysisProfiles: f.analysisProfiles,
    }))
  }

  // Selecting a Sample Template auto-fills Sample Type, Container, and Lab Analyses
  // (matched via each Django record's senaite_uid — see Section 19 of CLAUDE.md:
  // never mix Django and SENAITE IDs directly).
  function handleTemplateChange(templateId: string) {
    const template = sampleTemplates.find(t => String(t.id) === templateId)
    const matchedSampleType = template ? sampleTypes.find(st => st.senaite_uid === template.sample_type_uid) : undefined
    const matchedTests = template
      ? tests.filter(t => template.analysis_services.some(a => a.uid === t.senaite_uid))
      : []
    const allowedContainers = template ? containerOptionsFor(template.container) : CONTAINER_OPTIONS
    setForms(prev => prev.map((form, i) => i === activeTab ? {
      ...form,
      sampleTemplateId: templateId,
      sampleTypeId: matchedSampleType ? String(matchedSampleType.id) : form.sampleTypeId,
      containerType: template ? (allowedContainers[0]?.value ?? '') : form.containerType,
      suggestedContainer: template?.container ?? '',
      analysisProfiles: template ? template.analysis_services.map(a => a.title) : form.analysisProfiles,
      selectedTests: matchedTests.length ? matchedTests : form.selectedTests,
    } : form))
  }

  function addTest(t: LimsTest) {
    if (!f.selectedTests.find(x => x.id === t.id)) set('selectedTests', [...f.selectedTests, t])
    setShowAddAnalysis(false); setAnalysisSearch('')
  }
  function removeTest(id: number) { set('selectedTests', f.selectedTests.filter(t => t.id !== id)) }

  const filteredTests = tests.filter(t =>
    !f.selectedTests.find(s => s.id === t.id) &&
    (t.name.toLowerCase().includes(analysisSearch.toLowerCase()) || t.code.toLowerCase().includes(analysisSearch.toLowerCase()))
  )

  // Pricing — active tab only
  const VAT_RATE = 0.15
  const subtotal = f.selectedTests.reduce((sum, t) => sum + parseFloat(t.price ?? '0'), 0)
  const vat = subtotal * VAT_RATE
  const total = subtotal + vat

  const CONDITION_DOT: Record<string, string> = { good: '#0154FC', acceptable: '#3B82F6', compromised: '#EF4444', not_acceptable: '#EF4444' }
  const PRIORITY_DOT: Record<string, string> = { high: '#EF4444', medium: '#F59E0B', low: '#0154FC' }
  const section = { background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: '22px 24px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }
  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } as const
  const grid4 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 } as const
  const field = { display: 'flex', flexDirection: 'column' as const }

  return (
    <div style={{ display: 'flex', height: '100%', background: '#F9FAFB', overflow: 'hidden' }}>

      {/* ── Left: Form ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, minWidth: 0 }}>

        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <button onClick={() => router.push('/dashboard/samples-overview')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, marginBottom: 4, padding: 0 }}>
              <MI name="arrow_back" size={16} /> Back
            </button>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#2563EB', margin: 0 }}>New Sample</h1>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Register and receive incoming laboratory samples.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>Number of samples</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button type="button" onClick={() => changeCount(-1)} disabled={sampleCount === 1}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #D1D5DB', background: sampleCount === 1 ? '#F9FAFB' : '#fff', cursor: sampleCount === 1 ? 'default' : 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: sampleCount === 1 ? '#D1D5DB' : '#374151' }}>−</button>
                <span style={{ minWidth: 24, textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#111827' }}>{sampleCount}</span>
                <button type="button" onClick={() => changeCount(1)}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}>+</button>
              </div>
            </div>
            <button type="button" onClick={addTab}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1.5px solid #2563EB', background: '#fff', color: '#2563EB', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <MI name="add" size={16} color="#2563EB" /> Add Another Sample
            </button>
          </div>
        </div>

        {/* ── Sample tabs ── */}
        {sampleCount > 1 && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap', borderBottom: '2px solid #E5E7EB', paddingBottom: 0 }}>
            {forms.map((_, idx) => {
              const isActive = idx === activeTab
              const hasData = forms[idx].clientId || forms[idx].sampleTypeId
              return (
                <div key={idx} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab(idx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px',
                      borderRadius: '8px 8px 0 0',
                      border: isActive ? '2px solid #2563EB' : '2px solid transparent',
                      borderBottom: isActive ? '2px solid #fff' : '2px solid transparent',
                      background: isActive ? '#fff' : '#F3F4F6',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? '#2563EB' : '#6B7280',
                      marginBottom: -2,
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}
                  >
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: isActive ? '#2563EB' : hasData ? '#0154FC' : '#D1D5DB',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>{idx + 1}</span>
                    Sample {idx + 1}
                    {forms[idx].clientId && (
                      <span style={{ fontSize: 10, color: isActive ? '#2563EB' : '#9CA3AF', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {clients.find(c => String(c.id) === forms[idx].clientId)?.name ?? ''}
                      </span>
                    )}
                  </button>
                  {/* Remove tab button */}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); removeTab(idx) }}
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 16, height: 16, borderRadius: '50%',
                      background: isActive ? '#DBEAFE' : '#E5E7EB',
                      border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, color: isActive ? '#2563EB' : '#6B7280', fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >×</button>
                </div>
              )
            })}
          </div>
        )}

        {error && <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, border: '1px solid #FECACA' }}>{error}</div>}
        {success && <div style={{ background: '#DBEAFE', color: '#0154FC', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{success}</div>}

        {/* Section 1 */}
        <div style={section}>
          <SectionHeader num={1} title="Client / Request Details" />
          {sampleCount > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button type="button" onClick={applyClientToAll} disabled={!f.clientId}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: '1.5px solid #2563EB', background: f.clientId ? '#EFF6FF' : '#F9FAFB', color: f.clientId ? '#2563EB' : '#9CA3AF', fontSize: 12, fontWeight: 600, cursor: f.clientId ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
                <MI name="sync" size={14} color={f.clientId ? '#2563EB' : '#9CA3AF'} />
                Apply client to all {sampleCount} samples
              </button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20 }}>
            {/* Left: form fields */}
            <div>
              <div style={{ ...grid4, marginBottom: 16 }}>
                <div style={field}><label style={lbl}>Primary Sample</label>
                  <select value={f.primarySample} onChange={e => set('primarySample', e.target.value)} style={inp}>
                    <option value="yes">Yes</option><option value="no">No</option>
                  </select></div>
                <div style={field}><label style={lbl}>Client *</label>
                  <select value={f.clientId} onChange={e => handleClientChange(e.target.value)} style={{ ...inp, borderColor: !f.clientId && error ? '#EF4444' : '#D1D5DB' }}>
                    <option value="">— select —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select></div>
                <div style={field}><label style={lbl}>Contact *</label>
                  <input value={f.contactName} onChange={e => set('contactName', e.target.value)} placeholder="e.g. Jane Doe" style={inp} /></div>
                <div style={field}><label style={lbl}>CC Contact</label>
                  <input value={f.ccContact} onChange={e => set('ccContact', e.target.value)} placeholder="e.g. John Smith" style={inp} /></div>
              </div>
              <div style={{ ...grid2, marginBottom: 16 }}>
                <div style={field}><label style={lbl}>CC Emails</label>
                  <TagInput tags={f.ccEmails} onAdd={v => set('ccEmails', [...f.ccEmails, v])} onRemove={v => set('ccEmails', f.ccEmails.filter(x => x !== v))} placeholder="Type email and press Enter" /></div>
                <div style={grid2}>
                  <div style={field}><label style={lbl}>Batch</label>
                    <input value={f.batchId} onChange={e => set('batchId', e.target.value)} placeholder="e.g. B-250519-001" style={inp} /></div>
                  <div style={field}><label style={lbl}>Batch Sub-group</label>
                    <input value={f.batchSubGroup} onChange={e => set('batchSubGroup', e.target.value)} placeholder="e.g. Stability Study" style={inp} /></div>
                </div>
              </div>
              <div style={grid2}>
                <div style={field}><label style={lbl}>Sample Template</label>
                  <select value={f.sampleTemplateId} onChange={e => handleTemplateChange(e.target.value)} style={inp}>
                    <option value="">None — configure manually</option>
                    {sampleTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div style={field}><label style={lbl}>Analysis Profiles</label>
                  <TagInput tags={f.analysisProfiles} onAdd={v => set('analysisProfiles', [...f.analysisProfiles, v])} onRemove={v => set('analysisProfiles', f.analysisProfiles.filter(x => x !== v))} placeholder="Type profile and press Enter" /></div>
              </div>
            </div>

            {/* Right: auto-populated client info card */}
            {(() => {
              const client = clients.find(c => String(c.id) === f.clientId)
              if (!client) return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', borderRadius: 10, border: '1.5px dashed #D1D5DB', padding: '24px 16px', gap: 8, textAlign: 'center' }}>
                  <MI name="business" size={32} color="#D1D5DB" />
                  <span style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5 }}>Select a client to see<br />auto-populated details</span>
                </div>
              )
              const fullName = [client.contact_first_name, client.contact_last_name].filter(Boolean).join(' ') || client.contact_person || '—'
              const initials = fullName !== '—' ? fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : client.name.slice(0, 2).toUpperCase()
              return (
                <div style={{ background: '#F0F7FF', borderRadius: 10, border: '1px solid #BFDBFE', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Client header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#2563EB', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</div>
                      <div style={{ fontSize: 11, color: '#3B82F6', fontWeight: 600 }}>ID: {client.client_id}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 10, background: client.is_active ? '#DBEAFE' : '#FEE2E2', color: client.is_active ? '#0154FC' : '#991B1B', borderRadius: 10, padding: '2px 7px', fontWeight: 600, flexShrink: 0 }}>
                      {client.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div style={{ borderTop: '1px solid #BFDBFE', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { icon: 'person', label: 'Contact', value: fullName },
                      { icon: 'work', label: 'Job Title', value: client.contact_job_title || '—' },
                      { icon: 'email', label: 'Email', value: client.contact_email || client.email || '—' },
                      { icon: 'phone', label: 'Phone', value: client.contact_phone || client.phone || '—' },
                      { icon: 'domain', label: 'Department', value: client.contact_department || '—' },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <MI name={row.icon} size={14} color="#3B82F6" />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{row.label}</div>
                          <div style={{ fontSize: 12, color: '#1E3A5F', fontWeight: 500, wordBreak: 'break-word' }}>{row.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <MI name="auto_fix_high" size={12} color="#3B82F6" />
                    <span style={{ fontSize: 10, color: '#3B82F6', fontWeight: 500 }}>Contact fields auto-filled from this client</span>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Section 2 */}
        <div style={section}>
          <SectionHeader num={2} title="Sampling Details" />
          <div style={{ ...grid4, marginBottom: 16 }}>
            <div style={field}><label style={lbl}>Date Sampled *</label>
              <input type="datetime-local" value={f.dateSampled} max={nowLocal}
                onChange={e => set('dateSampled', e.target.value)} style={inp} /></div>
            <div style={field}><label style={lbl}>Sample Type *</label>
              <select value={f.sampleTypeId} onChange={e => set('sampleTypeId', e.target.value)} style={{ ...inp, borderColor: !f.sampleTypeId && error ? '#EF4444' : '#D1D5DB' }}>
                {!f.sampleTemplateId && <option value="">— select —</option>}
                {sampleTypeOptionsFor(f.sampleTemplateId).map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
              </select>
              {f.sampleTemplateId && (
                <span style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>Filtered to the type set by this template</span>
              )}</div>
            <div style={field}><label style={lbl}>Container</label>
              <select value={f.containerType} onChange={e => set('containerType', e.target.value)} style={inp}>
                {!f.sampleTemplateId && <option value="">— select —</option>}
                {(f.sampleTemplateId ? containerOptionsFor(f.suggestedContainer) : CONTAINER_OPTIONS)
                  .map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {f.sampleTemplateId && (
                <span style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>Filtered to containers suited for this template</span>
              )}</div>
            <div style={field}><label style={lbl}>Preservation</label>
              <select value={f.preservation} onChange={e => set('preservation', e.target.value)} style={inp}>
                <option value="">None</option>
                <option value="refrigerated">Refrigerated</option>
                <option value="frozen">Frozen</option>
                <option value="chemical">Chemical Preservative</option>
                <option value="dark">Dark / Light-protected</option>
              </select></div>
          </div>
          <div style={{ ...grid4, marginBottom: 16 }}>
            <div style={field}><label style={lbl}>Analysis Specification</label>
              <select value={f.analysisSpec} onChange={e => set('analysisSpec', e.target.value)} style={inp}>
                <option value="">— select —</option>
                <option value="in_house">In-House Standard</option>
                <option value="iso_17025">ISO 17025</option>
                <option value="pharmacopeia">Pharmacopeia</option>
                <option value="regulatory">Regulatory Standard</option>
              </select></div>
            <div style={field}><label style={lbl}>Sample Point</label>
              <input value={f.samplePoint} onChange={e => set('samplePoint', e.target.value)} placeholder="e.g. Site A - Building 25" style={inp} /></div>
            <div style={field}><label style={lbl}>Storage Location</label>
              <StorageLocationInput
                value={f.storageLocation ? { labelCode: f.storageLabelCode, display: f.storageLocation } : null}
                onChange={sel => {
                  setForms(prev => prev.map((form, i) => i === activeTab
                    ? { ...form, storageLocation: sel?.display ?? '', storageLabelCode: sel?.labelCode ?? '' }
                    : form))
                }}
              /></div>
            <div style={field}><label style={lbl}>Sampling Deviation</label>
              <select value={f.samplingDeviation} onChange={e => set('samplingDeviation', e.target.value)} style={inp}>
                <option value="none">None</option>
                <option value="temperature_excursion">Temperature Excursion</option>
                <option value="delayed_transport">Delayed Transport</option>
                <option value="haemolysis">Haemolysis</option>
              </select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: 16, alignItems: 'end' }}>
            <div style={field}><label style={lbl}>Sample Condition *</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 8, height: 8, borderRadius: '50%', background: CONDITION_DOT[f.condition] ?? '#6B7280', pointerEvents: 'none' }} />
                <select value={f.condition} onChange={e => set('condition', e.target.value)} style={{ ...inp, paddingLeft: 26 }}>
                  <option value="good">Good</option><option value="acceptable">Acceptable</option>
                  <option value="compromised">Compromised</option><option value="not_acceptable">Not Acceptable</option>
                </select>
              </div></div>
            <div style={field}><label style={lbl}>Priority *</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 8, height: 8, borderRadius: '50%', background: PRIORITY_DOT[f.priority] ?? '#6B7280', pointerEvents: 'none' }} />
                <select value={f.priority} onChange={e => set('priority', e.target.value)} style={{ ...inp, paddingLeft: 26 }}>
                  <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
              </div></div>
            <div style={field}><label style={lbl}>Environmental Conditions</label>
              <select value={f.envConditions} onChange={e => set('envConditions', e.target.value)} style={inp}>
                <option value="room_temp">Room Temperature</option>
                <option value="refrigerated">Refrigerated (2–8 °C)</option>
                <option value="frozen">Frozen (-20 °C)</option>
                <option value="ultra_frozen">Ultra-frozen (-80 °C)</option>
              </select></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
              <Toggle checked={f.composite} onChange={v => set('composite', v)} />
              <span style={{ fontSize: 12, color: '#374151' }}>Composite</span>
              <MI name="info_outline" size={14} color="#9CA3AF" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
              <Toggle checked={f.internalUse} onChange={v => set('internalUse', v)} />
              <span style={{ fontSize: 12, color: '#374151' }}>Internal use</span>
              <MI name="info_outline" size={14} color="#9CA3AF" />
            </div>
          </div>
        </div>

        {/* Section 3 */}
        <div style={section}>
          <SectionHeader num={3} title="Client References" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div style={field}><label style={lbl}>Client Order Number</label>
              <input value={f.clientOrderNum} onChange={e => set('clientOrderNum', e.target.value)} placeholder="e.g. CO-250519-078" style={inp} /></div>
            <div style={field}><label style={lbl}>Client Reference</label>
              <input value={f.clientReference} onChange={e => set('clientReference', e.target.value)} placeholder="e.g. Project Atlas – Phase II" style={inp} /></div>
            <div style={field}><label style={lbl}>Client Sample ID</label>
              <input value={f.clientSampleId} onChange={e => set('clientSampleId', e.target.value)} placeholder="e.g. SMP-ATLS-00023" style={inp} /></div>
          </div>
        </div>

        {/* Section 4 */}
        <div style={section}>
          <SectionHeader num={4} title="Additional Content" />
          <div style={grid2}>
            <div style={field}>
              <label style={lbl}>Attachments</label>
              <label style={{ border: `2px dashed ${attachments.length ? '#2563EB' : '#D1D5DB'}`, borderRadius: 8, padding: '20px 16px', textAlign: 'center', cursor: 'pointer', background: attachments.length ? '#EFF6FF' : '#FAFAFA', display: 'block', transition: 'all 0.15s' }}>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple style={{ display: 'none' }}
                  onChange={e => { if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]) }} />
                <MI name="cloud_upload" size={28} color={attachments.length ? '#2563EB' : '#D1D5DB'} />
                <p style={{ margin: '6px 0 3px', fontSize: 13, color: '#374151' }}>
                  {attachments.length ? `${attachments.length} file${attachments.length > 1 ? 's' : ''} selected` : <>Drag and drop files here<br /><span style={{ color: '#2563EB', fontWeight: 600 }}>or browse</span></>}
                </p>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>PDF, JPG, PNG · max 10 MB each</p>
              </label>
              {attachments.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {attachments.map((file, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', background: '#F0F7FF', borderRadius: 6, fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <MI name="description" size={14} color="#2563EB" />
                        <span style={{ color: '#1D4ED8', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                        <span style={{ color: '#9CA3AF', flexShrink: 0 }}>({(file.size / 1024).toFixed(0)} KB)</span>
                      </div>
                      <button type="button" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2 }}>
                        <MI name="close" size={14} color="#9CA3AF" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={field}>
              <label style={lbl}>Remarks</label>
              <div style={{ position: 'relative' }}>
                <textarea value={f.remarks} onChange={e => set('remarks', e.target.value.slice(0, 500))} rows={6}
                  placeholder="Add any remarks about this sample..."
                  style={{ ...inp, resize: 'none', paddingBottom: 24 }} />
                <span style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 11, color: '#9CA3AF' }}>{f.remarks.length} / 500</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, padding: '14px 0' }}>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
            {submitting && submitProgress.total > 1
              ? `Logging sample ${Math.min(submitProgress.done + 1, submitProgress.total)} of ${submitProgress.total}…`
              : '* Required fields'}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={clearActiveForm} style={{ padding: '10px 22px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
              Clear Form
            </button>
            <button type="button" onClick={() => handleSubmit(true)} disabled={submitting}
              style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving…' : 'Save Draft'}
            </button>
            <button type="button" onClick={() => handleSubmit(false)} disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 8, border: 'none', background: '#0154FC', color: '#fff', fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              <MI name="check_circle" size={16} color="#fff" />
              {submitting ? 'Logging…' : `Log ${sampleCount > 1 ? `${sampleCount} Samples` : 'Sample'}`}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: Lab Analyses + Pricing (per active tab) ── */}
      <div style={{ width: 280, flexShrink: 0, overflowY: 'auto', padding: '24px 20px 24px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Lab Analyses */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MI name="biotech" size={16} color="#2563EB" />
              </div>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Lab Analyses</span>
                {sampleCount > 1 && <div style={{ fontSize: 10, color: '#9CA3AF' }}>Sample {activeTab + 1}</div>}
              </div>
            </div>
            <span style={{ fontSize: 11, background: '#EFF6FF', color: '#2563EB', borderRadius: 10, padding: '2px 8px', fontWeight: 600 }}>{f.selectedTests.length} {f.selectedTests.length === 1 ? 'analysis' : 'analyses'}</span>
          </div>

          {f.selectedTests.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #F3F4F6' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6B7280', width: 24 }}>#</th>
                  <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#6B7280' }}>Test / Analysis</th>
                  <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#6B7280' }}>Method</th>
                  <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: '#6B7280' }}>Price</th>
                  <th style={{ width: 28 }} />
                </tr>
              </thead>
              <tbody>
                {f.selectedTests.map((t, i) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                    <td style={{ padding: '8px 12px', color: '#9CA3AF', fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ padding: '8px 8px', color: '#111827', fontWeight: 500 }}>{t.name}</td>
                    <td style={{ padding: '8px 8px', color: '#6B7280' }}>{t.method_code || t.code}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: '#374151', fontWeight: 500 }}>{t.price ? `$${parseFloat(t.price).toFixed(2)}` : '—'}</td>
                    <td style={{ padding: '8px 6px' }}>
                      <button type="button" onClick={() => removeTest(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <MI name="delete_outline" size={16} color="#9CA3AF" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {f.selectedTests.length === 0 && <div style={{ padding: '20px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>No analyses added yet.</div>}

          <div style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
            {!showAddAnalysis ? (
              <button type="button" onClick={() => setShowAddAnalysis(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px', border: '1.5px dashed #D1D5DB', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#2563EB', fontWeight: 600, justifyContent: 'center' }}>
                <MI name="add" size={15} color="#2563EB" /> Add Analysis
              </button>
            ) : (
              <div>
                <input autoFocus value={analysisSearch} onChange={e => setAnalysisSearch(e.target.value)} placeholder="Search tests..."
                  style={{ ...inp, marginBottom: 6, fontSize: 12 }} />
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: 6 }}>
                  {filteredTests.length === 0
                    ? <div style={{ padding: '10px', fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>No tests found</div>
                    : filteredTests.slice(0, 20).map(t => (
                      <button key={t.id} type="button" onClick={() => addTest(t)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '8px 10px', border: 'none', borderBottom: '1px solid #F9FAFB', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{t.name}</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF' }}>{t.code}</div>
                        </div>
                        {t.price && <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>${parseFloat(t.price).toFixed(2)}</span>}
                      </button>
                    ))
                  }
                </div>
                <button type="button" onClick={() => { setShowAddAnalysis(false); setAnalysisSearch('') }}
                  style={{ marginTop: 6, fontSize: 11, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}>Cancel</button>
              </div>
            )}
          </div>
        </div>

        {/* Pricing Summary — active tab */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #0154FC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MI name="attach_money" size={16} color="#0154FC" />
            </div>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Pricing Summary</span>
              {sampleCount > 1 && <div style={{ fontSize: 10, color: '#9CA3AF' }}>Sample {activeTab + 1}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}>
              <span>Subtotal</span><span style={{ fontWeight: 600 }}>${subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}>
              <span>VAT (15%)</span><span style={{ fontWeight: 600 }}>${vat.toFixed(2)}</span>
            </div>
            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Total</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#2563EB' }}>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

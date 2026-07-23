'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSampleWithAnalyses, updateSampleWithAnalyses, type DjangoSampleType, type LabSample, type NewSamplePayload, type SelectedAnalysis } from '@/app/actions/lab-samples'
import { type DjangoClient } from '@/app/actions/clients'
import { type AnalysisSpecification } from '@/app/actions/specifications'
import { type AnalysisRequest } from '@/app/actions/analysis-requests'
import { type SenaiteBatch, type SenaiteSampleTemplate, type SenaiteRefOption, type SenaiteAnalysisService } from '@/app/lib/senaite'
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
  ccEmails: string[]; batchUid: string; batchSubGroup: string; sampleTemplateId: string
  analysisProfiles: string[]; suggestedContainer: string; dateSampled: string; sampleTypeId: string
  containerType: string; preservation: string; analysisSpec: string; samplePoint: string
  storageLocation: string; storageLabelCode: string; samplingDeviation: string; condition: string; priority: string
  envConditions: string; composite: boolean; internalUse: boolean; clientOrderNum: string
  clientReference: string; clientSampleId: string; remarks: string; selectedTests: SenaiteAnalysisService[]
}

type AttachmentEntry = { file: File; status: 'pending' | 'uploading' | 'failed' | 'done' }

function blankForm(): SampleForm {
  return {
    primarySample: 'yes', clientId: '', contactName: '', ccContact: '', ccEmails: [],
    batchUid: '', batchSubGroup: '', sampleTemplateId: '', analysisProfiles: [], suggestedContainer: '',
    dateSampled: '', sampleTypeId: '', containerType: '', preservation: '',
    analysisSpec: '', samplePoint: '', storageLocation: '', storageLabelCode: '', samplingDeviation: 'none',
    condition: 'good', priority: 'medium', envConditions: 'room_temp',
    composite: false, internalUse: false, clientOrderNum: '', clientReference: '',
    clientSampleId: '', remarks: '', selectedTests: [],
  }
}

type Props = {
  sampleTypes: DjangoSampleType[]; clients: DjangoClient[]; services: SenaiteAnalysisService[]
  sampleTemplates: SenaiteSampleTemplate[]; sampleContainers: SenaiteRefOption[]; batches: SenaiteBatch[]
  analysisSpecifications: AnalysisSpecification[]; preservations: SenaiteRefOption[]; samplingDeviations: SenaiteRefOption[]
  samplePoints: SenaiteRefOption[]; existingSamples: LabSample[]
  /** When present, the page edits this existing sample in place instead of creating new ones. */
  editSample?: LabSample | null
  editAnalysisRequest?: AnalysisRequest | null
  /** When present, renders as an in-page overlay instead of a full page — Back/Cancel
   * and the post-save redirect call this instead of navigating to another route. */
  onClose?: () => void
}

// Builds the single-sample edit form from an existing LabSample + its linked
// AnalysisRequest (if any) — the update-mode counterpart to blankForm().
// Sample Template / Analysis Profiles have no reverse mapping back from a
// saved sample, so those two stay blank in edit mode (they're create-time
// conveniences only, not stored fields on the sample itself).
function formFromSample(sample: LabSample, ar: AnalysisRequest | null, services: SenaiteAnalysisService[], batches: SenaiteBatch[]): SampleForm {
  const matchedBatch = sample.batch_id ? batches.find(b => String(b.id) === sample.batch_id) : undefined
  const selectedTests: SenaiteAnalysisService[] = (ar?.analyses ?? []).map(a => {
    const match = services.find(s => s.uid === a.senaite_service_uid)
    return match ?? ({ uid: a.senaite_service_uid, title: a.senaite_service_name, Keyword: '', Price: '' } as SenaiteAnalysisService)
  })
  return {
    primarySample: 'yes',
    clientId: sample.client ? String(sample.client) : '',
    contactName: sample.contact_name ?? '',
    ccContact: sample.cc_contact ?? '',
    ccEmails: (sample.cc_emails ?? '').split(',').map(s => s.trim()).filter(Boolean),
    batchUid: matchedBatch?.uid ?? '',
    batchSubGroup: sample.batch_sub_group ?? '',
    sampleTemplateId: '', analysisProfiles: [], suggestedContainer: '',
    dateSampled: sample.collection_date ? sample.collection_date.slice(0, 16) : '',
    sampleTypeId: sample.sample_type ? String(sample.sample_type) : '',
    containerType: sample.container_type ?? '',
    preservation: sample.preservation ?? '',
    analysisSpec: sample.analysis_specification ?? '',
    samplePoint: sample.sample_point ?? '',
    storageLocation: sample.preferred_storage_location ?? '',
    storageLabelCode: sample.preferred_storage_label_code ?? '',
    samplingDeviation: sample.sampling_deviation && sample.sampling_deviation !== 'none' ? sample.sampling_deviation : 'none',
    condition: sample.condition || 'good',
    priority: sample.priority || 'medium',
    envConditions: sample.environmental_conditions || 'room_temp',
    composite: sample.composite ?? false,
    internalUse: sample.internal_use ?? false,
    clientOrderNum: sample.client_order_number ?? '',
    clientReference: sample.client_reference ?? '',
    clientSampleId: sample.client_sample_id ?? '',
    remarks: sample.description ?? '',
    selectedTests,
  }
}

// A sample's analyses are only editable while it's still 'registered' —
// mirrors the guard in lims/serializers.py AnalysisRequestSerializer.update()
// so the UI never promises an edit the backend will reject.
function canEditAnalysesFor(sample: LabSample | null | undefined): boolean {
  return !sample || sample.status === 'registered'
}

// A sample counts as "complete" once it has the two fields handleSubmit itself
// requires — kept as one pure function so the tab-strip badges and the submit
// guard can never silently drift apart from each other.
function isFormComplete(form: SampleForm): boolean {
  return Boolean(form.clientId && form.sampleTypeId)
}

// Statuses that no longer represent an "open" sample — a cancelled/rejected
// sample shouldn't trigger a duplicate warning against a brand new one.
const CLOSED_STATUSES = ['cancelled', 'rejected', 'invalid']
const DUPLICATE_WINDOW_HOURS = 24

function findLikelyDuplicate(form: SampleForm, clients: DjangoClient[], sampleTypes: DjangoSampleType[], existingSamples: LabSample[]): LabSample | null {
  if (!form.clientId || !form.sampleTypeId) return null
  const client = clients.find(c => String(c.id) === form.clientId)
  if (!client) return null
  const targetTime = form.dateSampled ? new Date(form.dateSampled).getTime() : null
  return existingSamples.find(s => {
    if (CLOSED_STATUSES.includes(s.status)) return false
    if (s.client !== client.id) return false
    if (String(s.sample_type ?? '') !== form.sampleTypeId) return false
    if (targetTime === null || !s.collection_date) return true
    const diffHours = Math.abs(new Date(s.collection_date).getTime() - targetTime) / 3_600_000
    return diffHours <= DUPLICATE_WINDOW_HOURS
  }) ?? null
}

export default function NewSampleShell({ sampleTypes, clients, services, sampleTemplates, sampleContainers, batches, analysisSpecifications, preservations, samplingDeviations, samplePoints, existingSamples, editSample, editAnalysisRequest, onClose }: Props) {
  const router = useRouter()
  const isEditMode = Boolean(editSample)
  const canEditAnalyses = canEditAnalysesFor(editSample)
  // Pre-select a Batch when arriving from that batch's "New Sample" button
  // (/dashboard/samples-overview/new?batch=<uid>) — only applied to the first
  // sample tab, not every subsequent "Add Another Sample" tab.
  const initialBatchUid = useSearchParams().get('batch') ?? ''
  // Pre-select a Client when arriving from that client's Samples Overview
  // page "New Sample" button (/dashboard/samples-overview/new?client=<senaite-uid>)
  // — only applied to the first sample tab, same as initialBatchUid above.
  const initialClientUid = useSearchParams().get('client') ?? ''
  // Arrived via a Client's "New Sample" button — lock the Client field to a
  // permanent read-only display instead of a switchable dropdown, since every
  // sample created from this link is for that one client.
  const [clientLocked] = useState(isEditMode || (Boolean(initialClientUid) && !initialBatchUid))
  // Sample Type is locked in edit mode too — changing a sample's fundamental
  // type after creation isn't supported by SENAITE's own AR edit view either,
  // since Container/Preservation/AnalysisSpec options are all scoped to it.
  const sampleTypeLocked = isEditMode

  // Sample Types valid for a given template — filtered down to the one matching
  // the template's SENAITE sample type via senaite_uid. Falls back to the full
  // list when no template is selected (manual mode).
  function sampleTypeOptionsFor(templateId: string): DjangoSampleType[] {
    const active = sampleTypes.filter(st => st.is_active !== false)
    if (!templateId) return active
    const template = sampleTemplates.find(t => t.uid === templateId)
    if (!template?.sampleTypeUid) return active
    const matched = active.filter(st => st.senaite_uid === template.sampleTypeUid)
    return matched.length ? matched : active
  }

  // Batches offered for a given client — once a client is picked, only show
  // that client's own batches. A batch with no client assigned used to show
  // for every client as a fallback ("a batch isn't necessarily client-specific"),
  // but that read as "wrong client's batches showing up" in practice — a
  // client's batch list should only ever contain that client's own batches.
  // Before any client is picked, every open batch is shown so the field still
  // works standalone.
  function batchOptionsFor(clientId: string): SenaiteBatch[] {
    const open = batches.filter(b => b.review_state === 'open')
    if (!clientId) return open
    const client = clients.find(c => String(c.id) === clientId)
    if (!client?.senaite_uid) return []
    return open.filter(b => b.ClientUID === client.senaite_uid)
  }

  const [forms, setForms] = useState<SampleForm[]>(() =>
    editSample
      ? [formFromSample(editSample, editAnalysisRequest ?? null, services, batches)]
      : [{ ...blankForm(), batchUid: initialBatchUid }]
  )
  const [activeTab, setActiveTab] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitProgress, setSubmitProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAddAnalysis, setShowAddAnalysis] = useState(false)
  const [analysisSearch, setAnalysisSearch] = useState('')
  const [attachments, setAttachments] = useState<AttachmentEntry[]>([])
  const [toast, setToast] = useState('')
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // Ctrl+Left/Right to move between sample tabs — scoped to this component's
  // own keydown listener (not a page-wide shortcut) so it never fights other
  // pages' own key handling.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!e.ctrlKey) return
      if (e.key === 'ArrowRight') { e.preventDefault(); setActiveTab(t => Math.min(t + 1, forms.length - 1)) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setActiveTab(t => Math.max(t - 1, 0)) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [forms.length])
  // Date.now() is impure — capture it after mount rather than during render.
  const [nowLocal, setNowLocal] = useState<string | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowLocal(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16))
  }, [])

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

  async function handleUpdateSubmit() {
    if (!editSample) return
    if (!f.clientId || !f.sampleTypeId) {
      setError('Client and Sample Type are required.')
      return
    }
    if (f.dateSampled && new Date(f.dateSampled) > new Date()) {
      setError('Date Sampled cannot be in the future.')
      return
    }
    setError(''); setSubmitting(true)
    const client = clients.find(c => String(c.id) === f.clientId)
    const sampleType = sampleTypes.find(st => String(st.id) === f.sampleTypeId)
    const batch = batches.find(b => b.uid === f.batchUid)
    const payload: NewSamplePayload = {
      client: Number(f.clientId), sample_type: Number(f.sampleTypeId),
      priority: f.priority, condition: f.condition,
      collection_date: f.dateSampled ? new Date(f.dateSampled).toISOString() : undefined,
      description: f.remarks || undefined,
      preferred_storage_location: f.storageLocation || undefined,
      preferred_storage_label_code: f.storageLabelCode || undefined,
      contact_name: f.contactName || undefined, cc_contact: f.ccContact || undefined,
      cc_emails: f.ccEmails.join(',') || undefined, batch_id: batch?.id || undefined,
      batch_senaite_uid: f.batchUid || undefined,
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
      preservation_senaite_uid: preservations.find(p => p.title === f.preservation)?.uid || undefined,
      sample_point_senaite_uid: samplePoints.find(p => p.title === f.samplePoint)?.uid || undefined,
      sampling_deviation_senaite_uid: f.samplingDeviation !== 'none'
        ? samplingDeviations.find(d => d.title === f.samplingDeviation)?.uid || undefined
        : undefined,
    }
    const testsPayload: SelectedAnalysis[] = f.selectedTests.map(t => ({ uid: t.uid, name: t.title }))
    const result = await updateSampleWithAnalyses(
      editSample.id, editSample.senaite_uid ?? '', editAnalysisRequest?.id ?? null,
      payload, testsPayload, canEditAnalyses,
    )
    setSubmitting(false)
    if (!result.success) {
      setError(result.message)
      return
    }
    if (attachments.some(a => a.status !== 'done')) {
      await uploadAttachmentsTo([editSample.id])
    }
    setSuccess(result.message)
    setTimeout(() => { if (onClose) onClose(); else router.push(`/dashboard/samples-overview/${editSample.id}`) }, 1500)
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
      const batch = batches.find(b => b.uid === f.batchUid)
      return createSampleWithAnalyses(
        {
          client: Number(f.clientId), sample_type: Number(f.sampleTypeId),
          priority: f.priority, condition: f.condition,
          // f.dateSampled is a <input type="datetime-local"> value — a naive
          // wall-clock string with NO timezone offset (e.g. "2026-07-13T14:54").
          // Django has USE_TZ=True + TIME_ZONE="UTC", so sending that string
          // as-is gets misread as 14:54 UTC instead of the user's actual local
          // time — for any timezone ahead of UTC (e.g. IST, UTC+5:30) this
          // makes "just now" look like a future timestamp and the backend's
          // "cannot be in the future" guard rejects every submission. `new
          // Date(...)` parses the naive string using the browser's local
          // timezone, so `.toISOString()` converts it to true UTC correctly.
          collection_date: f.dateSampled ? new Date(f.dateSampled).toISOString() : undefined,
          description: f.remarks || undefined,
          preferred_storage_location: f.storageLocation || undefined,
          preferred_storage_label_code: f.storageLabelCode || undefined,
          contact_name: f.contactName || undefined, cc_contact: f.ccContact || undefined,
          cc_emails: f.ccEmails.join(',') || undefined, batch_id: batch?.id || undefined,
          batch_senaite_uid: f.batchUid || undefined,
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
          // These selects store the SENAITE object's title, not its uid — resolve
          // against the same live lists the options were rendered from.
          preservation_senaite_uid: preservations.find(p => p.title === f.preservation)?.uid || undefined,
          sample_point_senaite_uid: samplePoints.find(p => p.title === f.samplePoint)?.uid || undefined,
          sampling_deviation_senaite_uid: f.samplingDeviation !== 'none'
            ? samplingDeviations.find(d => d.title === f.samplingDeviation)?.uid || undefined
            : undefined,
        },
        asDraft ? [] : f.selectedTests.map(t => ({ uid: t.uid, name: t.title })),
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
      const createdIds = results.map(r => r.id).filter((id): id is number => Boolean(id))
      setCreatedSampleIds(createdIds)
      let anyFailed = false
      if (createdIds.length > 0 && attachments.length > 0) {
        anyFailed = await uploadAttachmentsTo(createdIds)
      }
      const ids = results.map(r => r.sample_id).filter(Boolean).join(', ')
      const uploadWarning = anyFailed
        ? ' — note: one or more attachments failed to upload; use Retry below.'
        : ''
      setSuccess(`${forms.length} sample${forms.length > 1 ? 's' : ''} logged: ${ids}${uploadWarning}`)
      // Only auto-navigate away when every attachment actually made it — if
      // something failed, the Retry UI needs the page to stay mounted.
      if (!anyFailed) setTimeout(() => router.push('/dashboard/samples-overview'), 1800)
    }
  }

  const [createdSampleIds, setCreatedSampleIds] = useState<number[]>([])

  // Uploads every 'pending'/'failed' attachment to all given sample ids,
  // updating each entry's own status so the UI can show exactly which file
  // failed instead of a single aggregate count. Returns whether anything failed.
  async function uploadAttachmentsTo(sampleIds: number[]): Promise<boolean> {
    const { uploadSampleAttachment } = await import('@/app/actions/lab-samples')
    let anyFailed = false
    for (let i = 0; i < attachments.length; i++) {
      if (attachments[i].status === 'done') continue
      setAttachments(prev => prev.map((a, j) => j === i ? { ...a, status: 'uploading' } : a))
      let ok = true
      for (const sid of sampleIds) {
        const fd = new FormData(); fd.append('attachment', attachments[i].file)
        const up = await uploadSampleAttachment(String(sid), fd)
        if (!up.ok) ok = false
      }
      if (!ok) anyFailed = true
      setAttachments(prev => prev.map((a, j) => j === i ? { ...a, status: ok ? 'done' : 'failed' } : a))
    }
    return anyFailed
  }

  async function retryAttachment(index: number) {
    if (createdSampleIds.length === 0) return
    setAttachments(prev => prev.map((a, j) => j === index ? { ...a, status: 'uploading' } : a))
    const { uploadSampleAttachment } = await import('@/app/actions/lab-samples')
    let ok = true
    for (const sid of createdSampleIds) {
      const fd = new FormData(); fd.append('attachment', attachments[index].file)
      const up = await uploadSampleAttachment(String(sid), fd)
      if (!up.ok) ok = false
    }
    setAttachments(prev => prev.map((a, j) => j === index ? { ...a, status: ok ? 'done' : 'failed' } : a))
    if (ok && attachments.every((a, j) => j === index || a.status === 'done')) {
      router.push('/dashboard/samples-overview')
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

  // Arrived via a Batch's "Add Samples" button with the Batch pre-selected
  // (see the useState initializer above) — if that Batch has its own Client,
  // auto-fill the Client (and its contact/CC cascade) too, exactly as if the
  // user had picked it manually. Runs once on mount only.
  useEffect(() => {
    if (!initialBatchUid) return
    const batch = batches.find(b => b.uid === initialBatchUid)
    if (!batch?.ClientUID) return
    const client = clients.find(c => c.senaite_uid === batch.ClientUID)
    if (client) handleClientChange(String(client.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Arrived via a Client's "Client ID" link on Samples Overview
  // (?client=<senaite-uid>) — auto-fill the Client (and its contact/CC
  // cascade) the same way. Skipped if a Batch already pre-filled the client.
  useEffect(() => {
    if (!initialClientUid || initialBatchUid) return
    const client = clients.find(c => c.senaite_uid === initialClientUid)
    if (client) handleClientChange(String(client.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Propagate ALL Section 1 fields from active tab to every other tab
  function applyClientToAll() {
    if (!f.clientId) return
    const otherCount = forms.length - 1
    setForms(prev => prev.map((form, i) => i === activeTab ? form : {
      ...form,
      primarySample: f.primarySample,
      clientId: f.clientId,
      contactName: f.contactName,
      ccContact: f.ccContact,
      ccEmails: f.ccEmails,
      batchUid: f.batchUid,
      batchSubGroup: f.batchSubGroup,
      sampleTemplateId: f.sampleTemplateId,
      analysisProfiles: f.analysisProfiles,
    }))
    if (otherCount > 0) showToast(`Applied to ${otherCount} other sample${otherCount > 1 ? 's' : ''}.`)
  }

  // Selecting a Sample Template auto-fills Sample Type, Container, and Lab Analyses
  // (matched via each Django record's senaite_uid — see Section 19 of CLAUDE.md:
  // never mix Django and SENAITE IDs directly).
  function handleTemplateChange(templateId: string) {
    const template = sampleTemplates.find(t => t.uid === templateId)
    const templateServices = template?.services ?? []
    const firstContainerUid = template?.partitions?.[0]?.containerUid
    const templateContainer = firstContainerUid
      ? sampleContainers.find(c => c.uid === firstContainerUid)?.title ?? ''
      : ''
    const matchedSampleType = template ? sampleTypes.find(st => st.senaite_uid === template.sampleTypeUid) : undefined
    const matchedServices = template
      ? services.filter(s => templateServices.some(a => a.uid === s.uid))
      : []
    const allowedContainers = template ? containerOptionsFor(templateContainer) : CONTAINER_OPTIONS
    setForms(prev => prev.map((form, i) => i === activeTab ? {
      ...form,
      sampleTemplateId: templateId,
      sampleTypeId: matchedSampleType ? String(matchedSampleType.id) : form.sampleTypeId,
      containerType: template ? (allowedContainers[0]?.value ?? '') : form.containerType,
      suggestedContainer: templateContainer,
      // Analyses are locked once a sample is no longer 'registered' — a
      // template must not silently smuggle a change past that guard.
      analysisProfiles: canEditAnalyses ? (template ? matchedServices.map(s => s.title) : form.analysisProfiles) : form.analysisProfiles,
      selectedTests: canEditAnalyses ? (matchedServices.length ? matchedServices : form.selectedTests) : form.selectedTests,
    } : form))
  }

  // Analysis Specifications valid for the currently selected Sample Type —
  // each spec has exactly one sample_type (see lims/models.py AnalysisSpecification).
  // Shows every spec until a sample type is chosen, same fallback as sampleTypeOptionsFor.
  function analysisSpecOptionsFor(sampleTypeId: string): AnalysisSpecification[] {
    if (!sampleTypeId) return analysisSpecifications
    const matched = analysisSpecifications.filter(s => String(s.sample_type) === sampleTypeId)
    return matched.length ? matched : analysisSpecifications
  }

  // Selecting an Analysis Specification auto-fills Lab Analyses from its rows —
  // rows store the SENAITE service uid directly, matched against the live
  // services list (same pattern as Sample Template above).
  function handleAnalysisSpecChange(specId: string) {
    const spec = analysisSpecifications.find(s => String(s.id) === specId)
    const matchedServices = spec
      ? services.filter(sv => spec.rows.some(r => r.senaite_service_uid === sv.uid))
      : []
    setForms(prev => prev.map((form, i) => i === activeTab ? {
      ...form,
      analysisSpec: specId,
      selectedTests: canEditAnalyses ? (matchedServices.length ? matchedServices : form.selectedTests) : form.selectedTests,
    } : form))
  }

  function addTest(s: SenaiteAnalysisService) {
    if (!f.selectedTests.find(x => x.uid === s.uid)) set('selectedTests', [...f.selectedTests, s])
    setShowAddAnalysis(false); setAnalysisSearch('')
  }
  function removeTest(uid: string) { set('selectedTests', f.selectedTests.filter(t => t.uid !== uid)) }

  const filteredTests = services.filter(s =>
    s.review_state !== 'inactive' &&
    !f.selectedTests.find(x => x.uid === s.uid) &&
    (s.title.toLowerCase().includes(analysisSearch.toLowerCase()) || s.Keyword.toLowerCase().includes(analysisSearch.toLowerCase()))
  )

  // Pricing — active tab only. Each test carries its own VAT rate from
  // SENAITE's own AnalysisService.VAT; only fall back to the 15% default when
  // a given test genuinely has none set, rather than assuming one flat rate
  // for every line.
  const DEFAULT_VAT_RATE = 0.15
  const subtotal = f.selectedTests.reduce((sum, t) => sum + parseFloat(t.Price || '0'), 0)
  const vat = f.selectedTests.reduce((sum, t) => {
    const rate = t.VAT ? parseFloat(t.VAT) / 100 : DEFAULT_VAT_RATE
    return sum + parseFloat(t.Price || '0') * rate
  }, 0)
  const total = subtotal + vat
  // Blended effective rate for the "VAT (X%)" label — falls back to the
  // default display percentage when nothing is selected yet.
  const vatDisplayPct = subtotal > 0 ? Math.round((vat / subtotal) * 100) : Math.round(DEFAULT_VAT_RATE * 100)

  const CONDITION_DOT: Record<string, string> = { good: '#0154FC', acceptable: '#3B82F6', compromised: '#EF4444', not_acceptable: '#EF4444' }
  const PRIORITY_DOT: Record<string, string> = { high: '#EF4444', medium: '#F59E0B', low: '#0154FC' }
  const section = { background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: '22px 24px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }
  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } as const
  const grid4 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 } as const
  const field = { display: 'flex', flexDirection: 'column' as const }

  const content = (
    <div style={{ display: 'flex', height: '100%', background: '#F9FAFB', overflow: 'hidden' }}>

      {/* ── Left: Form ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, minWidth: 0 }}>

        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <button onClick={() => onClose ? onClose() : router.push(isEditMode ? `/dashboard/samples-overview/${editSample!.id}` : '/dashboard/samples-overview')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, marginBottom: 4, padding: 0 }}>
              <MI name="arrow_back" size={16} /> {onClose ? 'Close' : 'Back'}
            </button>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#2563EB', margin: 0 }}>{isEditMode ? 'Edit Sample' : 'New Sample'}</h1>
            <p style={{ fontSize: 13, color: '#374151', margin: '4px 0 0' }}>
              {isEditMode ? `Editing ${editSample?.sample_id}.` : 'Register and receive incoming laboratory samples.'}
            </p>
          </div>
          {!isEditMode && (
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
          )}
        </div>

        {/* ── Sample tabs ── */}
        {!isEditMode && sampleCount > 1 && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap', borderBottom: '2px solid #E5E7EB', paddingBottom: 0 }}>
            {forms.map((_, idx) => {
              const isActive = idx === activeTab
              const hasData = forms[idx].clientId || forms[idx].sampleTypeId
              const incomplete = !isFormComplete(forms[idx])
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
                      color: isActive ? '#2563EB' : '#374151',
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
                      <span style={{ fontSize: 10, color: isActive ? '#2563EB' : '#374151', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {clients.find(c => String(c.id) === forms[idx].clientId)?.name ?? ''}
                      </span>
                    )}
                    {incomplete && (
                      <span title="Missing required fields" style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
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
                      fontSize: 11, color: isActive ? '#2563EB' : '#374151', fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >×</button>
                </div>
              )
            })}
          </div>
        )}
        {sampleCount > 1 && forms.some(form => !isFormComplete(form)) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: -12, marginBottom: 16, fontSize: 12, color: '#B45309' }}>
            <MI name="error_outline" size={14} color="#B45309" />
            {forms.filter(form => !isFormComplete(form)).length} of {sampleCount} samples incomplete (missing Client or Sample Type)
          </div>
        )}
        {toast && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: '8px 14px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: 12, color: '#166534' }}>
            <MI name="check_circle" size={14} color="#166534" /> {toast}
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
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: '1.5px solid #2563EB', background: f.clientId ? '#EFF6FF' : '#F9FAFB', color: f.clientId ? '#2563EB' : '#374151', fontSize: 12, fontWeight: 600, cursor: f.clientId ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
                <MI name="sync" size={14} color={f.clientId ? '#2563EB' : '#374151'} />
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
                <div style={field}><label style={lbl}>Client <span style={{ color: '#EF4444' }}>*</span></label>
                  {clientLocked ? (
                    <div style={{ ...inp, display: 'flex', alignItems: 'center', background: '#F9FAFB' }}>
                      <span style={{ fontWeight: 600, color: '#111827' }}>
                        {clients.find(c => String(c.id) === f.clientId)?.name ?? ''}
                      </span>
                    </div>
                  ) : (
                    <select value={f.clientId} onChange={e => handleClientChange(e.target.value)} style={{ ...inp, borderColor: !f.clientId && error ? '#EF4444' : '#D1D5DB' }}>
                      <option value="">— select —</option>
                      {clients.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}</div>
                <div style={field}><label style={lbl}>Contact <span style={{ color: '#EF4444' }}>*</span></label>
                  <input value={f.contactName} onChange={e => set('contactName', e.target.value)} placeholder="e.g. Jane Doe" style={inp} /></div>
                <div style={field}><label style={lbl}>CC Contact</label>
                  <input value={f.ccContact} onChange={e => set('ccContact', e.target.value)} placeholder="e.g. John Smith" style={inp} /></div>
              </div>
              <div style={{ ...grid2, marginBottom: 16 }}>
                <div style={field}><label style={lbl}>CC Emails</label>
                  <TagInput tags={f.ccEmails} onAdd={v => set('ccEmails', [...f.ccEmails, v])} onRemove={v => set('ccEmails', f.ccEmails.filter(x => x !== v))} placeholder="Type email and press Enter" /></div>
                <div style={grid2}>
                  <div style={field}><label style={lbl}>Batch</label>
                    <select value={f.batchUid} onChange={e => set('batchUid', e.target.value)} style={inp}>
                      <option value="">None</option>
                      {batchOptionsFor(f.clientId).map(b => (
                        <option key={b.uid} value={b.uid}>{b.id} — {b.title}</option>
                      ))}
                    </select>
                    {f.clientId && batchOptionsFor(f.clientId).length < batches.filter(b => b.review_state === 'open').length && (
                      <span style={{ fontSize: 11, color: '#374151', marginTop: 3 }}>Filtered to this client&apos;s batches only</span>
                    )}</div>
                  <div style={field}><label style={lbl}>Batch Sub-group</label>
                    <input value={f.batchSubGroup} onChange={e => set('batchSubGroup', e.target.value)} placeholder="e.g. Stability Study" style={inp} /></div>
                </div>
              </div>
              <div style={grid2}>
                <div style={field}><label style={lbl}>Sample Template</label>
                  <select value={f.sampleTemplateId} onChange={e => handleTemplateChange(e.target.value)} style={inp}>
                    <option value="">None — configure manually</option>
                    {sampleTemplates.map(t => <option key={t.uid} value={t.uid}>{t.title}</option>)}
                  </select>
                  {isEditMode && (
                    <span style={{ fontSize: 11, color: '#374151', marginTop: 3 }}>Applying a template here will overwrite Sample Type, Container{canEditAnalyses ? ' and Lab Analyses' : ''}.</span>
                  )}
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
                  <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>Select a client to see<br />auto-populated details</span>
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
                          <div style={{ fontSize: 10, color: '#374151', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{row.label}</div>
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
          {(() => {
            if (isEditMode) return null
            const dup = findLikelyDuplicate(f, clients, sampleTypes, existingSamples)
            if (!dup) return null
            return (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A', marginBottom: 16, fontSize: 12, color: '#92400E' }}>
                <MI name="warning_amber" size={16} color="#B45309" />
                <span>
                  Possible duplicate: <strong>{dup.sample_id}</strong> for this client and sample type
                  {dup.collection_date ? ` was sampled around ${new Date(dup.collection_date).toLocaleString()}` : ''} and is still {dup.status}. Double-check before logging this one.
                </span>
              </div>
            )
          })()}
          <div style={{ ...grid4, marginBottom: 16 }}>
            <div style={field}><label style={lbl}>Date Sampled <span style={{ color: '#EF4444' }}>*</span></label>
              <input type="datetime-local" value={f.dateSampled} max={nowLocal ?? undefined}
                onChange={e => set('dateSampled', e.target.value)} style={inp} /></div>
            <div style={field}><label style={lbl}>Sample Type <span style={{ color: '#EF4444' }}>*</span></label>
              {sampleTypeLocked ? (
                <div style={{ ...inp, display: 'flex', alignItems: 'center', background: '#F9FAFB' }}>
                  <span style={{ fontWeight: 600, color: '#111827' }}>
                    {sampleTypes.find(st => String(st.id) === f.sampleTypeId)?.name ?? ''}
                  </span>
                </div>
              ) : (
                <select value={f.sampleTypeId} onChange={e => set('sampleTypeId', e.target.value)} style={{ ...inp, borderColor: !f.sampleTypeId && error ? '#EF4444' : '#D1D5DB' }}>
                  {!f.sampleTemplateId && <option value="">— select —</option>}
                  {sampleTypeOptionsFor(f.sampleTemplateId).map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              )}
              {f.sampleTypeId && (() => {
                const st = sampleTypes.find(s => String(s.id) === f.sampleTypeId)
                if (!st?.prefix) return null
                return <span style={{ fontSize: 11, color: '#374151', marginTop: 3 }}>ID format: {st.prefix}-{new Date().getFullYear()}-### (assigned on save)</span>
              })()}
              {f.sampleTemplateId && (
                <span style={{ fontSize: 11, color: '#374151', marginTop: 3 }}>Filtered to the type set by this template</span>
              )}</div>
            <div style={field}><label style={lbl}>Container</label>
              <select value={f.containerType} onChange={e => set('containerType', e.target.value)} style={inp}>
                {!f.sampleTemplateId && <option value="">— select —</option>}
                {(f.sampleTemplateId ? containerOptionsFor(f.suggestedContainer) : CONTAINER_OPTIONS)
                  .map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {f.sampleTemplateId && (
                <span style={{ fontSize: 11, color: '#374151', marginTop: 3 }}>Filtered to containers suited for this template</span>
              )}</div>
            <div style={field}><label style={lbl}>Preservation</label>
              <select value={f.preservation} onChange={e => set('preservation', e.target.value)} style={inp}>
                <option value="">None</option>
                {preservations.filter(p => p.review_state !== 'inactive').map(p => <option key={p.uid} value={p.title}>{p.title}</option>)}
              </select></div>
          </div>
          <div style={{ ...grid4, marginBottom: 16 }}>
            <div style={field}><label style={lbl}>Analysis Specification</label>
              <select value={f.analysisSpec} onChange={e => handleAnalysisSpecChange(e.target.value)} style={inp}>
                <option value="">— select —</option>
                {analysisSpecOptionsFor(f.sampleTypeId).map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
              <span style={{ fontSize: 11, color: '#374151', marginTop: 3 }}>Selecting one auto-fills Lab Analyses from its rows</span></div>
            <div style={field}><label style={lbl}>Sample Point</label>
              <select value={f.samplePoint} onChange={e => set('samplePoint', e.target.value)} style={inp}>
                <option value="">— select —</option>
                {samplePoints.filter(p => p.review_state !== 'inactive').map(p => <option key={p.uid} value={p.title}>{p.title}</option>)}
              </select></div>
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
                {samplingDeviations.filter(d => d.review_state !== 'inactive').map(d => <option key={d.uid} value={d.title}>{d.title}</option>)}
              </select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: 16, alignItems: 'end' }}>
            <div style={field}><label style={lbl}>Sample Condition <span style={{ color: '#EF4444' }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 8, height: 8, borderRadius: '50%', background: CONDITION_DOT[f.condition] ?? '#374151', pointerEvents: 'none' }} />
                <select value={f.condition} onChange={e => set('condition', e.target.value)} style={{ ...inp, paddingLeft: 26 }}>
                  <option value="good">Good</option><option value="acceptable">Acceptable</option>
                  <option value="compromised">Compromised</option><option value="not_acceptable">Not Acceptable</option>
                </select>
              </div></div>
            <div style={field}><label style={lbl}>Priority <span style={{ color: '#EF4444' }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 8, height: 8, borderRadius: '50%', background: PRIORITY_DOT[f.priority] ?? '#374151', pointerEvents: 'none' }} />
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
              <MI name="info_outline" size={14} color="#374151" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
              <Toggle checked={f.internalUse} onChange={v => set('internalUse', v)} />
              <span style={{ fontSize: 12, color: '#374151' }}>Internal use</span>
              <MI name="info_outline" size={14} color="#374151" />
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
                  onChange={e => { if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!).map(file => ({ file, status: 'pending' as const }))]) }} />
                <MI name="cloud_upload" size={28} color={attachments.length ? '#2563EB' : '#D1D5DB'} />
                <p style={{ margin: '6px 0 3px', fontSize: 13, color: '#374151' }}>
                  {attachments.length ? `${attachments.length} file${attachments.length > 1 ? 's' : ''} selected` : <>Drag and drop files here<br /><span style={{ color: '#2563EB', fontWeight: 600 }}>or browse</span></>}
                </p>
                <p style={{ fontSize: 11, color: '#374151', margin: 0 }}>PDF, JPG, PNG · max 10 MB each</p>
              </label>
              {attachments.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {attachments.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', background: entry.status === 'failed' ? '#FEF2F2' : '#F0F7FF', borderRadius: 6, fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <MI name={entry.status === 'failed' ? 'error_outline' : entry.status === 'done' ? 'check_circle' : entry.status === 'uploading' ? 'hourglass_top' : 'description'}
                          size={14} color={entry.status === 'failed' ? '#DC2626' : entry.status === 'done' ? '#059669' : '#2563EB'} />
                        <span style={{ color: entry.status === 'failed' ? '#991B1B' : '#1D4ED8', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.file.name}</span>
                        <span style={{ color: '#374151', flexShrink: 0 }}>({(entry.file.size / 1024).toFixed(0)} KB)</span>
                        {entry.status === 'failed' && (
                          <button type="button" onClick={() => retryAttachment(i)}
                            style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                            Retry
                          </button>
                        )}
                      </div>
                      <button type="button" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', padding: 2 }}>
                        <MI name="close" size={14} color="#374151" />
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
                <span style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 11, color: '#374151' }}>{f.remarks.length} / 500</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, padding: '14px 0' }}>
          <span style={{ fontSize: 12, color: '#374151' }}>
            {submitting && submitProgress.total > 1
              ? `Logging sample ${Math.min(submitProgress.done + 1, submitProgress.total)} of ${submitProgress.total}…`
              : <><span style={{ color: '#EF4444' }}>*</span> Required fields</>}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            {isEditMode ? (
              <button type="button" onClick={handleUpdateSubmit} disabled={submitting}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 8, border: 'none', background: '#0154FC', color: '#fff', fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                <MI name="check_circle" size={16} color="#fff" />
                {submitting ? 'Saving…' : 'Save Changes'}
              </button>
            ) : (
              <>
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
              </>
            )}
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
                {sampleCount > 1 && <div style={{ fontSize: 10, color: '#374151' }}>Sample {activeTab + 1}</div>}
              </div>
            </div>
            <span style={{ fontSize: 11, background: '#EFF6FF', color: '#2563EB', borderRadius: 10, padding: '2px 8px', fontWeight: 600 }}>{f.selectedTests.length} {f.selectedTests.length === 1 ? 'analysis' : 'analyses'}</span>
          </div>

          {f.selectedTests.length > 0 && (
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 12 }}>
              <colgroup>
                <col style={{ width: 22 }} />
                <col />
                <col style={{ width: 62 }} />
                <col style={{ width: 46 }} />
                <col style={{ width: 26 }} />
              </colgroup>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #F3F4F6' }}>
                  <th style={{ padding: '8px 4px 8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>#</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Test / Analysis</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Method</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Price</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {f.selectedTests.map((t, i) => (
                  <tr key={t.uid} style={{ borderBottom: '1px solid #F9FAFB' }}>
                    <td style={{ padding: '8px 4px 8px 10px', color: '#374151', fontWeight: 600, verticalAlign: 'top' }}>{i + 1}</td>
                    <td style={{ padding: '8px 6px', color: '#111827', fontWeight: 500, verticalAlign: 'top', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{t.title}</td>
                    <td style={{ padding: '8px 6px', color: '#374151', verticalAlign: 'top', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{t.Keyword}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', color: '#374151', fontWeight: 500, verticalAlign: 'top', whiteSpace: 'nowrap' }}>{t.Price ? `$${parseFloat(t.Price).toFixed(2)}` : '—'}</td>
                    <td style={{ padding: '8px 2px', verticalAlign: 'top' }}>
                      {canEditAnalyses && (
                        <button type="button" onClick={() => removeTest(t.uid)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                          <MI name="delete_outline" size={16} color="#EF4444" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {f.selectedTests.length === 0 && <div style={{ padding: '20px 16px', textAlign: 'center', color: '#374151', fontSize: 12 }}>No analyses added yet.</div>}

          {!canEditAnalyses && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, margin: '0 16px 12px', padding: '8px 10px', borderRadius: 7, background: '#FFFBEB', border: '1px solid #FDE68A', fontSize: 11, color: '#92400E' }}>
              <MI name="lock" size={13} color="#B45309" />
              <span>Analyses can no longer be edited once a sample has been received. Contact a lab manager for corrections.</span>
            </div>
          )}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
            {!canEditAnalyses ? null : !showAddAnalysis ? (
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
                    ? <div style={{ padding: '10px', fontSize: 12, color: '#374151', textAlign: 'center' }}>No tests found</div>
                    : filteredTests.slice(0, 20).map(t => (
                      <button key={t.uid} type="button" onClick={() => addTest(t)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '8px 10px', border: 'none', borderBottom: '1px solid #F9FAFB', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{t.title}</div>
                          <div style={{ fontSize: 11, color: '#374151' }}>{t.Keyword}</div>
                        </div>
                        {t.Price && <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>${parseFloat(t.Price).toFixed(2)}</span>}
                      </button>
                    ))
                  }
                </div>
                <button type="button" onClick={() => { setShowAddAnalysis(false); setAnalysisSearch('') }}
                  style={{ marginTop: 6, fontSize: 11, color: '#374151', background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}>Cancel</button>
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
              {sampleCount > 1 && <div style={{ fontSize: 10, color: '#374151' }}>Sample {activeTab + 1}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}>
              <span>Subtotal</span><span style={{ fontWeight: 600 }}>${subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}>
              <span>VAT ({vatDisplayPct}%)</span><span style={{ fontWeight: 600 }}>${vat.toFixed(2)}</span>
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

  if (!onClose) return content

  // Drawer mode — rendered as an in-page overlay on top of the caller (e.g.
  // Sample Detail) instead of navigating to the standalone /new?edit= route.
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1000 }}>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', boxShadow: '0 -6px 32px rgba(0,0,0,0.15)', overflow: 'hidden', zIndex: 1001 }}>
        {content}
      </div>
    </div>
  )
}

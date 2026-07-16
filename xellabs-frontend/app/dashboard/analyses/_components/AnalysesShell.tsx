'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createAnalysis, updateAnalysis, type AnalysisFormState } from '@/app/actions/analyses'
import {
  type SenaiteAnalysisService,
  type SenaiteAnalysisCategory,
  type SenaiteDepartment,
  type SenaiteLabContact,
  type SenaiteRefOption,
  type SenaiteInstrument,
  type SenaiteUncertaintyRow,
  type SenaiteInterimFieldRow,
  type SenaiteConditionRow,
} from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({
  label, name, placeholder, required, error, hint, value, onChange, type = 'text',
}: {
  label: string; name: string; placeholder?: string; required?: boolean
  error?: string; hint?: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
        {hint && <span className="ml-1 font-normal" style={{ color: '#9CA3AF' }}>{hint}</span>}
      </label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
        style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
      />
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

function TextAreaField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{hint && <span className="ml-1 font-normal" style={{ color: '#9CA3AF' }}>{hint}</span>}
      </label>
      <textarea rows={3} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none"
        style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
    </div>
  )
}

function SelectField({
  label, name, required, error, value, onChange, children,
}: {
  label: string; name: string; required?: boolean; error?: string
  value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none bg-white"
        style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }}
      >
        {children}
      </select>
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

function CheckboxToggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5" />
      <div>
        <span className="text-xs font-medium" style={{ color: '#374151' }}>{label}</span>
        {hint && <p style={{ fontSize: 10, color: '#9CA3AF' }}>{hint}</p>}
      </div>
    </label>
  )
}

// Shared multi-select picker for Methods/Instruments — same shape as the
// CheckboxList already used on the Methods page for Instruments/Calculations.
function CheckboxList({ options, selected, onChange }: {
  options: { uid: string; title: string }[]; selected: string[]; onChange: (uids: string[]) => void
}) {
  function toggle(uid: string) {
    onChange(selected.includes(uid) ? selected.filter(x => x !== uid) : [...selected, uid])
  }
  return (
    <div className="rounded-lg overflow-y-auto" style={{ border: '1px solid #D1D5DB', maxHeight: 120 }}>
      {options.length === 0
        ? <p className="px-3 py-2 text-xs" style={{ color: '#9CA3AF' }}>None available</p>
        : options.map(o => (
            <label key={o.uid} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50" style={{ color: '#374151' }}>
              <input type="checkbox" checked={selected.includes(o.uid)} onChange={() => toggle(o.uid)} />
              {o.title}
            </label>
          ))}
    </div>
  )
}

const TABS = ['Description', 'Analysis', 'Limits', 'Method', 'Uncertainties', 'Result options', 'Advanced'] as const
type Tab = typeof TABS[number]

const RESULT_TYPES = [
  ['numeric', 'Numeric'], ['string', 'String'], ['text', 'Text'], ['select', 'Selection list'],
  ['multiselect', 'Multiple selection'], ['date', 'Date'], ['datetime', 'Datetime'],
] as const

type FV = {
  title: string; description: string; Keyword: string; Category: string; newCategoryTitle: string
  Department: string; newDepartmentTitle: string; newDepartmentId: string
  Manager: string; newContactFirstName: string; newContactLastName: string
  Unit: string; Price: string
  ShortTitle: string; SortKey: string; CommercialID: string; ProtocolID: string; ScientificName: string
  Accredited: boolean; PointOfCapture: string; BulkPrice: string; VAT: string
  LowerDetectionLimit: string; LowerLimitOfQuantification: string; UpperLimitOfQuantification: string; UpperDetectionLimit: string
  DetectionLimitSelector: boolean; AllowManualDetectionLimit: boolean
  MethodUids: string[]; DefaultMethodUid: string; InstrumentUids: string[]; DefaultInstrumentUid: string; CalculationUid: string
  Uncertainties: SenaiteUncertaintyRow[]; PrecisionFromUncertainty: boolean; AllowManualUncertainty: boolean
  ResultType: string; DefaultResult: string; InterimFields: SenaiteInterimFieldRow[]
  Precision: string; ExponentialFormatPrecision: string; AttachmentRequired: boolean
  MaxTimeAllowedDays: string; MaxTimeAllowedHours: string; MaxTimeAllowedMinutes: string
  MaxHoldingTimeDays: string; MaxHoldingTimeHours: string; MaxHoldingTimeMinutes: string
  DuplicateVariation: string; Hidden: boolean; SelfVerification: string; NumberOfRequiredVerifications: string
  Conditions: SenaiteConditionRow[]
}
const blank = (): FV => ({
  title: '', description: '', Keyword: '', Category: '', newCategoryTitle: '',
  Department: '', newDepartmentTitle: '', newDepartmentId: '',
  Manager: '', newContactFirstName: '', newContactLastName: '',
  Unit: '', Price: '',
  ShortTitle: '', SortKey: '', CommercialID: '', ProtocolID: '', ScientificName: '',
  Accredited: false, PointOfCapture: 'lab', BulkPrice: '', VAT: '',
  LowerDetectionLimit: '', LowerLimitOfQuantification: '', UpperLimitOfQuantification: '', UpperDetectionLimit: '',
  DetectionLimitSelector: false, AllowManualDetectionLimit: false,
  MethodUids: [], DefaultMethodUid: '', InstrumentUids: [], DefaultInstrumentUid: '', CalculationUid: '',
  Uncertainties: [], PrecisionFromUncertainty: false, AllowManualUncertainty: false,
  ResultType: 'numeric', DefaultResult: '', InterimFields: [],
  Precision: '', ExponentialFormatPrecision: '', AttachmentRequired: false,
  MaxTimeAllowedDays: '', MaxTimeAllowedHours: '', MaxTimeAllowedMinutes: '',
  MaxHoldingTimeDays: '', MaxHoldingTimeHours: '', MaxHoldingTimeMinutes: '',
  DuplicateVariation: '', Hidden: false, SelfVerification: '0', NumberOfRequiredVerifications: '1',
  Conditions: [],
})

function serviceToFV(s: SenaiteAnalysisService): FV {
  return {
    title: s.title, description: s.description, Keyword: s.Keyword, Category: s.CategoryUid, newCategoryTitle: '',
    Department: s.DepartmentUid, newDepartmentTitle: '', newDepartmentId: '',
    Manager: '', newContactFirstName: '', newContactLastName: '',
    Unit: s.Unit, Price: s.Price,
    ShortTitle: s.ShortTitle, SortKey: s.SortKey, CommercialID: s.CommercialID, ProtocolID: s.ProtocolID, ScientificName: s.ScientificName,
    Accredited: s.Accredited, PointOfCapture: s.PointOfCapture || 'lab', BulkPrice: s.BulkPrice, VAT: s.VAT,
    LowerDetectionLimit: s.LowerDetectionLimit, LowerLimitOfQuantification: s.LowerLimitOfQuantification,
    UpperLimitOfQuantification: s.UpperLimitOfQuantification, UpperDetectionLimit: s.UpperDetectionLimit,
    DetectionLimitSelector: s.DetectionLimitSelector, AllowManualDetectionLimit: s.AllowManualDetectionLimit,
    MethodUids: s.MethodUids, DefaultMethodUid: s.DefaultMethodUid, InstrumentUids: s.InstrumentUids,
    DefaultInstrumentUid: s.DefaultInstrumentUid, CalculationUid: s.CalculationUid,
    Uncertainties: s.Uncertainties, PrecisionFromUncertainty: s.PrecisionFromUncertainty, AllowManualUncertainty: s.AllowManualUncertainty,
    ResultType: s.ResultType || 'numeric', DefaultResult: s.DefaultResult, InterimFields: s.InterimFields,
    Precision: s.Precision, ExponentialFormatPrecision: s.ExponentialFormatPrecision, AttachmentRequired: s.AttachmentRequired,
    MaxTimeAllowedDays: s.MaxTimeAllowedDays, MaxTimeAllowedHours: s.MaxTimeAllowedHours, MaxTimeAllowedMinutes: s.MaxTimeAllowedMinutes,
    MaxHoldingTimeDays: s.MaxHoldingTimeDays, MaxHoldingTimeHours: s.MaxHoldingTimeHours, MaxHoldingTimeMinutes: s.MaxHoldingTimeMinutes,
    DuplicateVariation: s.DuplicateVariation, Hidden: s.Hidden, SelfVerification: s.SelfVerification || '0',
    NumberOfRequiredVerifications: s.NumberOfRequiredVerifications || '1',
    Conditions: s.Conditions,
  }
}

export default function AnalysesShell({
  initialServices, categories, departments, labContacts, methods, instruments,
}: {
  initialServices: SenaiteAnalysisService[]
  categories: SenaiteAnalysisCategory[]
  departments: SenaiteDepartment[]
  labContacts: SenaiteLabContact[]
  methods: SenaiteRefOption[]
  instruments: SenaiteInstrument[]
}) {
  const router = useRouter()
  const [showDrawer, setShowDrawer] = useState(false)
  const [editing, setEditing] = useState<SenaiteAnalysisService | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('Description')
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [vals, setVals] = useState<FV>(blank)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')

  const isEdit = editing !== null
  const creatingCategory = vals.Category === '__new__'
  const creatingDepartment = creatingCategory && vals.Department === '__new__'
  const creatingContact = creatingDepartment && vals.Manager === '__new__'

  function setVal<K extends keyof FV>(k: K, v: FV[K]) {
    setVals(prev => ({ ...prev, [k]: v }))
    if (fieldErrors[k as string]) setFieldErrors(prev => { const n = { ...prev }; delete n[k as string]; return n })
  }

  const [, action, pending] = useActionState(
    async (prev: AnalysisFormState, fd: FormData) => {
      const result = isEdit ? await updateAnalysis(editing.uid, prev, fd) : await createAnalysis(prev, fd)
      if (result.success) {
        setShowDrawer(false)
        setEditing(null)
        setVals(blank())
        setFieldErrors({})
        setToast({ ok: true, msg: result.message ?? (isEdit ? 'Analysis updated.' : 'Analysis created.') })
        setTimeout(() => setToast(null), 4000)
        router.refresh()
      } else if (result.errors) {
        const fe: Record<string, string> = {}
        for (const [k, msgs] of Object.entries(result.errors)) { if (msgs?.length) fe[k] = msgs[0] }
        setFieldErrors(fe)
      } else if (result.message) {
        setToast({ ok: false, msg: result.message })
        setTimeout(() => setToast(null), 6000)
      }
      return result
    },
    {}
  )

  function openCreate() { setEditing(null); setVals(blank()); setFieldErrors({}); setActiveTab('Description'); setShowDrawer(true) }
  function openEdit(s: SenaiteAnalysisService) { setEditing(s); setVals(serviceToFV(s)); setFieldErrors({}); setActiveTab('Description'); setShowDrawer(true) }
  function closeDrawer() { setShowDrawer(false); setEditing(null) }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const set = (name: string, value: unknown) => {
      const el = e.currentTarget.querySelector(`input[name="${name}"]`) as HTMLInputElement
      if (el) el.value = JSON.stringify(value)
    }
    set('MethodUids', vals.MethodUids)
    set('InstrumentUids', vals.InstrumentUids)
    set('Uncertainties', vals.Uncertainties)
    set('InterimFields', vals.InterimFields)
    set('Conditions', vals.Conditions)
  }

  const filtered = search.trim()
    ? initialServices.filter(s =>
        s.title.toLowerCase().includes(search.trim().toLowerCase()) ||
        s.Keyword.toLowerCase().includes(search.trim().toLowerCase()) ||
        s.Category.toLowerCase().includes(search.trim().toLowerCase()))
    : initialServices

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Analyses</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage the analyses (test services) available for samples and analysis profiles</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
          <MI name="add" size={15} color="#fff" /> New Analysis
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#93C5FD' : '#FECACA'}`, color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* Search */}
      {initialServices.length > 0 && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-white rounded-lg" style={{ border: '1px solid #E8EAF2', maxWidth: 340 }}>
          <MI name="search" size={15} color="#9CA3AF" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search analyses…"
            className="flex-1 text-xs outline-none"
            style={{ color: '#111827', border: 'none', background: 'transparent' }}
          />
        </div>
      )}

      {/* ── Right Drawer ── */}
      {showDrawer && (
        <div onClick={e => { if (e.currentTarget === e.target) closeDrawer() }}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1000 }}>
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 760, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>

            <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEdit ? '#EFF6FF' : '#DBEAFE' }}>
                  <MI name={isEdit ? 'edit' : 'add'} size={16} color={isEdit ? '#2563EB' : '#0154FC'} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEdit ? `Edit — ${editing.title}` : 'New Analysis'}</h2>
                  <p style={{ fontSize: 10, color: '#9CA3AF' }}>{isEdit ? 'Update this analysis (test service)' : 'Create a new analysis (test service)'}</p>
                </div>
              </div>
              <button onClick={closeDrawer} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
            </div>

            {/* Tab bar */}
            <div className="flex items-center gap-1 px-5 pt-2 shrink-0" style={{ borderBottom: '1px solid #F3F4F6', overflowX: 'auto' }}>
              {TABS.map(t => (
                <button key={t} type="button" onClick={() => setActiveTab(t)}
                  className="px-3 py-2 text-xs font-medium whitespace-nowrap"
                  style={{
                    border: 'none', background: 'none', cursor: 'pointer',
                    color: activeTab === t ? '#0154FC' : '#6B7280',
                    borderBottom: activeTab === t ? '2px solid #0154FC' : '2px solid transparent',
                  }}>
                  {t}
                </button>
              ))}
            </div>

            <form action={action} onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col min-h-0">
              <input type="hidden" name="MethodUids" />
              <input type="hidden" name="InstrumentUids" />
              <input type="hidden" name="Uncertainties" />
              <input type="hidden" name="InterimFields" />
              <input type="hidden" name="Conditions" />

              <div className="flex-1 px-5 py-4 flex flex-col gap-3">
                {/* Every tab's fields stay permanently mounted (display:none when
                    inactive, never unmounted) — FormData is built from the whole
                    <form> at submit time, so a conditionally-unmounted tab's inputs
                    would silently vanish from the submission the instant you're not
                    looking at that tab, even though its state (`vals`) is still held. */}
                <div style={{ display: activeTab === 'Description' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
                    <Field label="Analysis Name" name="title" placeholder="e.g. Total Protein" required
                      error={fieldErrors.title} value={vals.title} onChange={v => setVal('title', v)} />
                    <TextAreaField label="Description" hint="(used in item listings and search results)"
                      value={vals.description} onChange={v => setVal('description', v)} />
                    <Field label="Short Title" name="ShortTitle" hint="(optional — used instead of title in column headings)"
                      value={vals.ShortTitle} onChange={v => setVal('ShortTitle', v)} />
                    <Field label="Sort Key" name="SortKey" hint="(0.0 - 1000.0)"
                      value={vals.SortKey} onChange={v => setVal('SortKey', v)} />
                    <Field label="Commercial ID" name="CommercialID" hint="(optional — for accounting)"
                      value={vals.CommercialID} onChange={v => setVal('CommercialID', v)} />
                    <Field label="Protocol ID" name="ProtocolID" hint="(optional)"
                      value={vals.ProtocolID} onChange={v => setVal('ProtocolID', v)} />
                    <Field label="Scientific Name" name="ScientificName" hint="(optional)"
                      value={vals.ScientificName} onChange={v => setVal('ScientificName', v)} />
                </div>

                <div style={{ display: activeTab === 'Analysis' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
                    <Field label="Keyword" name="Keyword" placeholder="e.g. TotalProtein" required
                      hint="(unique code, no spaces)"
                      error={fieldErrors.Keyword} value={vals.Keyword} onChange={v => setVal('Keyword', v)} />
                    <SelectField label="Category" name="Category" required
                      error={fieldErrors.Category} value={vals.Category} onChange={v => setVal('Category', v)}>
                      <option value="">Select a category…</option>
                      {categories.map(c => <option key={c.uid} value={c.uid}>{c.title}</option>)}
                      <option value="__new__">+ Create new category…</option>
                    </SelectField>

                    {creatingCategory && (
                      <div className="flex flex-col gap-3 p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', border: '1px dashed #D1D5DB' }}>
                        <Field label="New Category Name" name="newCategoryTitle" placeholder="e.g. Clinical Chemistry" required
                          error={fieldErrors.newCategoryTitle} value={vals.newCategoryTitle} onChange={v => setVal('newCategoryTitle', v)} />
                        <SelectField label="Department" name="Department" required
                          error={fieldErrors.Department} value={vals.Department} onChange={v => setVal('Department', v)}>
                          <option value="">Select a department…</option>
                          {departments.map(d => <option key={d.uid} value={d.uid}>{d.title}</option>)}
                          <option value="__new__">+ Create new department…</option>
                        </SelectField>

                        {creatingDepartment && (
                          <div className="flex flex-col gap-3 p-3 rounded-lg" style={{ backgroundColor: '#F3F4F6', border: '1px dashed #D1D5DB' }}>
                            <Field label="New Department Name" name="newDepartmentTitle" placeholder="e.g. Microbiology" required
                              error={fieldErrors.newDepartmentTitle} value={vals.newDepartmentTitle} onChange={v => setVal('newDepartmentTitle', v)} />
                            <Field label="Department ID" name="newDepartmentId" placeholder="e.g. MICRO" required
                              hint="(short code, letters/numbers only)"
                              error={fieldErrors.newDepartmentId} value={vals.newDepartmentId} onChange={v => setVal('newDepartmentId', v)} />
                            <SelectField label="Manager" name="Manager" required
                              error={fieldErrors.Manager} value={vals.Manager} onChange={v => setVal('Manager', v)}>
                              <option value="">Select a manager…</option>
                              {labContacts.map(c => <option key={c.uid} value={c.uid}>{c.title}</option>)}
                              <option value="__new__">+ Create new contact…</option>
                            </SelectField>

                            {creatingContact && (
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <Field label="First Name" name="newContactFirstName" placeholder="e.g. Jane" required
                                    error={fieldErrors.newContactFirstName} value={vals.newContactFirstName} onChange={v => setVal('newContactFirstName', v)} />
                                </div>
                                <div className="flex-1">
                                  <Field label="Last Name" name="newContactLastName" placeholder="e.g. Doe" required
                                    error={fieldErrors.newContactLastName} value={vals.newContactLastName} onChange={v => setVal('newContactLastName', v)} />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {!creatingCategory && (
                      <SelectField label="Department" name="Department" value={vals.Department} onChange={v => setVal('Department', v)}>
                        <option value="">None</option>
                        {departments.map(d => <option key={d.uid} value={d.uid}>{d.title}</option>)}
                      </SelectField>
                    )}

                    <SelectField label="Point of Capture" name="PointOfCapture" value={vals.PointOfCapture} onChange={v => setVal('PointOfCapture', v)}>
                      <option value="lab">Lab</option>
                      <option value="field">Field</option>
                    </SelectField>
                    <CheckboxToggle label="Accredited" hint="Included in the laboratory's schedule of accredited analyses"
                      checked={vals.Accredited} onChange={v => setVal('Accredited', v)} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Unit" name="Unit" placeholder="e.g. mg/dL" hint="(optional)" value={vals.Unit} onChange={v => setVal('Unit', v)} />
                      <Field label="Price" name="Price" placeholder="e.g. 25.00" hint="(optional)" error={fieldErrors.Price} value={vals.Price} onChange={v => setVal('Price', v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Bulk Price" name="BulkPrice" placeholder="e.g. 20.00" hint="(optional)" value={vals.BulkPrice} onChange={v => setVal('BulkPrice', v)} />
                      <Field label="VAT %" name="VAT" placeholder="e.g. 15.00" hint="(optional)" value={vals.VAT} onChange={v => setVal('VAT', v)} />
                    </div>
                </div>

                <div style={{ display: activeTab === 'Limits' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Lower Limit of Detection (LLOD)" name="LowerDetectionLimit" value={vals.LowerDetectionLimit} onChange={v => setVal('LowerDetectionLimit', v)} />
                      <Field label="Lower Limit of Quantification (LLOQ)" name="LowerLimitOfQuantification" value={vals.LowerLimitOfQuantification} onChange={v => setVal('LowerLimitOfQuantification', v)} />
                      <Field label="Upper Limit of Quantification (ULOQ)" name="UpperLimitOfQuantification" value={vals.UpperLimitOfQuantification} onChange={v => setVal('UpperLimitOfQuantification', v)} />
                      <Field label="Upper Limit of Detection (ULOD)" name="UpperDetectionLimit" value={vals.UpperDetectionLimit} onChange={v => setVal('UpperDetectionLimit', v)} />
                    </div>
                    <CheckboxToggle label="Display a Detection Limit selector" checked={vals.DetectionLimitSelector} onChange={v => setVal('DetectionLimitSelector', v)} />
                    <CheckboxToggle label="Allow Manual Detection Limit input" checked={vals.AllowManualDetectionLimit} onChange={v => setVal('AllowManualDetectionLimit', v)} />
                </div>

                <div style={{ display: activeTab === 'Method' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Methods</label>
                      <CheckboxList options={methods} selected={vals.MethodUids} onChange={v => setVal('MethodUids', v)} />
                    </div>
                    <SelectField label="Default Method" name="DefaultMethodUid" value={vals.DefaultMethodUid} onChange={v => setVal('DefaultMethodUid', v)}>
                      <option value="">None</option>
                      {methods.filter(m => vals.MethodUids.includes(m.uid)).map(m => <option key={m.uid} value={m.uid}>{m.title}</option>)}
                    </SelectField>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Instruments</label>
                      <CheckboxList options={instruments.map(i => ({ uid: i.uid, title: i.title }))} selected={vals.InstrumentUids} onChange={v => setVal('InstrumentUids', v)} />
                    </div>
                    <SelectField label="Default Instrument" name="DefaultInstrumentUid" value={vals.DefaultInstrumentUid} onChange={v => setVal('DefaultInstrumentUid', v)}>
                      <option value="">None</option>
                      {instruments.filter(i => vals.InstrumentUids.includes(i.uid)).map(i => <option key={i.uid} value={i.uid}>{i.title}</option>)}
                    </SelectField>
                </div>

                <div style={{ display: activeTab === 'Uncertainties' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
                    <RowsTable
                      columns={['Range min', 'Range max', 'Uncertainty value']}
                      rows={vals.Uncertainties}
                      onChange={rows => setVal('Uncertainties', rows)}
                      blankRow={() => ({ intercept_min: '', intercept_max: '', errorvalue: '' })}
                      renderCell={(row, key, onCellChange) => (
                        <input value={row[key as keyof SenaiteUncertaintyRow]} onChange={e => onCellChange(key, e.target.value)}
                          className="w-full px-2 py-1 text-xs rounded outline-none" style={{ border: '1px solid #D1D5DB' }} />
                      )}
                      cellKeys={['intercept_min', 'intercept_max', 'errorvalue']}
                    />
                    <CheckboxToggle label="Calculate Precision from Uncertainties" checked={vals.PrecisionFromUncertainty} onChange={v => setVal('PrecisionFromUncertainty', v)} />
                    <CheckboxToggle label="Allow manual uncertainty value input" checked={vals.AllowManualUncertainty} onChange={v => setVal('AllowManualUncertainty', v)} />
                </div>

                <div style={{ display: activeTab === 'Result options' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
                    <SelectField label="Result Type" name="ResultType" value={vals.ResultType} onChange={v => setVal('ResultType', v)}>
                      {RESULT_TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                    </SelectField>
                    <Field label="Default Result" name="DefaultResult" hint="(optional)" value={vals.DefaultResult} onChange={v => setVal('DefaultResult', v)} />
                    <label className="block text-xs font-medium" style={{ color: '#374151' }}>Result Variables</label>
                    <InterimFieldsTable rows={vals.InterimFields} onChange={rows => setVal('InterimFields', rows)} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Precision (decimals)" name="Precision" value={vals.Precision} onChange={v => setVal('Precision', v)} />
                      <Field label="Exponential Format Precision" name="ExponentialFormatPrecision" value={vals.ExponentialFormatPrecision} onChange={v => setVal('ExponentialFormatPrecision', v)} />
                    </div>
                    <CheckboxToggle label="Attachment required for verification" checked={vals.AttachmentRequired} onChange={v => setVal('AttachmentRequired', v)} />
                    <label className="block text-xs font-medium" style={{ color: '#374151' }}>Maximum turn-around time</label>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Days" name="MaxTimeAllowedDays" value={vals.MaxTimeAllowedDays} onChange={v => setVal('MaxTimeAllowedDays', v)} />
                      <Field label="Hours" name="MaxTimeAllowedHours" value={vals.MaxTimeAllowedHours} onChange={v => setVal('MaxTimeAllowedHours', v)} />
                      <Field label="Minutes" name="MaxTimeAllowedMinutes" value={vals.MaxTimeAllowedMinutes} onChange={v => setVal('MaxTimeAllowedMinutes', v)} />
                    </div>
                    <label className="block text-xs font-medium" style={{ color: '#374151' }}>Maximum holding time</label>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Days" name="MaxHoldingTimeDays" value={vals.MaxHoldingTimeDays} onChange={v => setVal('MaxHoldingTimeDays', v)} />
                      <Field label="Hours" name="MaxHoldingTimeHours" value={vals.MaxHoldingTimeHours} onChange={v => setVal('MaxHoldingTimeHours', v)} />
                      <Field label="Minutes" name="MaxHoldingTimeMinutes" value={vals.MaxHoldingTimeMinutes} onChange={v => setVal('MaxHoldingTimeMinutes', v)} />
                    </div>
                    <Field label="Duplicate Variation %" name="DuplicateVariation" value={vals.DuplicateVariation} onChange={v => setVal('DuplicateVariation', v)} />
                    <CheckboxToggle label="Hidden" hint="Analysis and results won't be displayed by default in reports" checked={vals.Hidden} onChange={v => setVal('Hidden', v)} />
                    <SelectField label="Self-verification of results" name="SelfVerification" value={vals.SelfVerification} onChange={v => setVal('SelfVerification', v)}>
                      <option value="0">System default (No)</option>
                      <option value="1">Yes</option>
                      <option value="2">No</option>
                    </SelectField>
                    <SelectField label="Number of required verifications" name="NumberOfRequiredVerifications" value={vals.NumberOfRequiredVerifications} onChange={v => setVal('NumberOfRequiredVerifications', v)}>
                      {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                    </SelectField>
                </div>

                <div style={{ display: activeTab === 'Advanced' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
                    <label className="block text-xs font-medium" style={{ color: '#374151' }}>Analysis Conditions</label>
                    <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: -6 }}>
                      Conditions to ask for this analysis on sample registration
                    </p>
                    <ConditionsTable rows={vals.Conditions} onChange={rows => setVal('Conditions', rows)} />
                </div>
              </div>

              {/* Footer */}
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
      )}

      {/* Table / empty state */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="biotech" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>
            {initialServices.length === 0 ? 'No analyses yet' : 'No analyses match your search'}
          </p>
          {initialServices.length === 0 && (
            <>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create your first analysis to get started</p>
              <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
                <MI name="add" size={13} color="#fff" /> New Analysis
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '28%' }} /><col style={{ width: '16%' }} /><col style={{ width: '18%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} /><col style={{ width: '90px' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Name', 'Keyword', 'Category', 'Unit', 'Price', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.uid} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                        <MI name="biotech" size={13} color="#0154FC" />
                      </div>
                      <span className="text-xs font-medium" style={{ color: '#111827' }}>{s.title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>
                      {s.Keyword || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{s.Category || '—'}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{s.Unit || '—'}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#6B7280' }}>{s.Price && s.Price !== '0.00' ? s.Price : '—'}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => openEdit(s)} title="Edit"
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium hover:bg-gray-50"
                      style={{ border: '1px solid #E8EAF2', background: '#fff', color: '#374151', cursor: 'pointer' }}>
                      <MI name="edit" size={13} color="#6B7280" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{filtered.length} analys{filtered.length !== 1 ? 'es' : 'is'}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared dynamic-row table for the 3 repeating-row sections (Uncertainties,
// Result Variables, Analysis Conditions) — one component, three usages.
function RowsTable<T extends Record<string, string>>({
  columns, rows, onChange, blankRow, renderCell, cellKeys,
}: {
  columns: string[]; rows: T[]; onChange: (rows: T[]) => void; blankRow: () => T
  renderCell: (row: T, key: string, onCellChange: (key: string, value: string) => void) => React.ReactNode
  cellKeys: string[]
}) {
  function updateRow(i: number, key: string, value: string) {
    onChange(rows.map((r, idx) => idx === i ? { ...r, [key]: value } : r))
  }
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#FAFAFA' }}>
            {columns.map(c => <th key={c} className="px-2 py-1.5 text-left" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF' }}>{c}</th>)}
            <th style={{ width: 32 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: '1px solid #F3F4F6' }}>
              {cellKeys.map(key => (
                <td key={key} className="px-2 py-1.5">{renderCell(row, key, (k, v) => updateRow(i, k, v))}</td>
              ))}
              <td className="px-2 py-1.5 text-center">
                <button type="button" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                  style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                  <MI name="close" size={14} color="#DC2626" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={() => onChange([...rows, blankRow()])}
        className="w-full px-2 py-1.5 text-xs font-medium" style={{ border: 'none', borderTop: '1px solid #F3F4F6', background: '#fff', color: '#0154FC', cursor: 'pointer' }}>
        + Add row
      </button>
    </div>
  )
}

function InterimFieldsTable({ rows, onChange }: { rows: SenaiteInterimFieldRow[]; onChange: (rows: SenaiteInterimFieldRow[]) => void }) {
  function update(i: number, patch: Partial<SenaiteInterimFieldRow>) {
    onChange(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }
  const blank = (): SenaiteInterimFieldRow => ({
    keyword: '', title: '', value: '', choices: '', result_type: 'string', allow_empty: false, unit: '', report: false, hidden: false, wide: false,
  })
  return (
    <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid #E8EAF2' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: 620 }}>
        <thead>
          <tr style={{ backgroundColor: '#FAFAFA' }}>
            {['Keyword', 'Field Title', 'Default value', 'Choices', 'Control type', 'Unit', ''].map(c => (
              <th key={c} className="px-2 py-1.5 text-left" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: '1px solid #F3F4F6' }}>
              <td className="px-2 py-1.5"><input value={row.keyword} onChange={e => update(i, { keyword: e.target.value })} className="w-24 px-2 py-1 text-xs rounded outline-none" style={{ border: '1px solid #D1D5DB' }} /></td>
              <td className="px-2 py-1.5"><input value={row.title} onChange={e => update(i, { title: e.target.value })} className="w-28 px-2 py-1 text-xs rounded outline-none" style={{ border: '1px solid #D1D5DB' }} /></td>
              <td className="px-2 py-1.5"><input value={row.value} onChange={e => update(i, { value: e.target.value })} className="w-20 px-2 py-1 text-xs rounded outline-none" style={{ border: '1px solid #D1D5DB' }} /></td>
              <td className="px-2 py-1.5"><input value={row.choices} onChange={e => update(i, { choices: e.target.value })} placeholder="a|b|c" className="w-24 px-2 py-1 text-xs rounded outline-none" style={{ border: '1px solid #D1D5DB' }} /></td>
              <td className="px-2 py-1.5">
                <select value={row.result_type} onChange={e => update(i, { result_type: e.target.value })} className="px-1.5 py-1 text-xs rounded outline-none bg-white" style={{ border: '1px solid #D1D5DB' }}>
                  <option value="string">Text</option><option value="numeric">Numeric</option><option value="select">Selection</option>
                </select>
              </td>
              <td className="px-2 py-1.5"><input value={row.unit} onChange={e => update(i, { unit: e.target.value })} className="w-16 px-2 py-1 text-xs rounded outline-none" style={{ border: '1px solid #D1D5DB' }} /></td>
              <td className="px-2 py-1.5 text-center">
                <button type="button" onClick={() => onChange(rows.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                  <MI name="close" size={14} color="#DC2626" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={() => onChange([...rows, blank()])}
        className="w-full px-2 py-1.5 text-xs font-medium" style={{ border: 'none', borderTop: '1px solid #F3F4F6', background: '#fff', color: '#0154FC', cursor: 'pointer' }}>
        + Add row
      </button>
    </div>
  )
}

function ConditionsTable({ rows, onChange }: { rows: SenaiteConditionRow[]; onChange: (rows: SenaiteConditionRow[]) => void }) {
  function update(i: number, patch: Partial<SenaiteConditionRow>) {
    onChange(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }
  const blank = (): SenaiteConditionRow => ({ title: '', description: '', type: 'text', value: '', choices: '', required: false })
  return (
    <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid #E8EAF2' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: 620 }}>
        <thead>
          <tr style={{ backgroundColor: '#FAFAFA' }}>
            {['Title', 'Description', 'Control type', 'Default value', 'Required', ''].map(c => (
              <th key={c} className="px-2 py-1.5 text-left" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: '1px solid #F3F4F6' }}>
              <td className="px-2 py-1.5"><input value={row.title} onChange={e => update(i, { title: e.target.value })} className="w-28 px-2 py-1 text-xs rounded outline-none" style={{ border: '1px solid #D1D5DB' }} /></td>
              <td className="px-2 py-1.5"><input value={row.description} onChange={e => update(i, { description: e.target.value })} className="w-36 px-2 py-1 text-xs rounded outline-none" style={{ border: '1px solid #D1D5DB' }} /></td>
              <td className="px-2 py-1.5">
                <select value={row.type} onChange={e => update(i, { type: e.target.value })} className="px-1.5 py-1 text-xs rounded outline-none bg-white" style={{ border: '1px solid #D1D5DB' }}>
                  <option value="text">Text</option><option value="numeric">Numeric</option><option value="select">Selection</option><option value="boolean">Yes/No</option>
                </select>
              </td>
              <td className="px-2 py-1.5"><input value={row.value} onChange={e => update(i, { value: e.target.value })} className="w-20 px-2 py-1 text-xs rounded outline-none" style={{ border: '1px solid #D1D5DB' }} /></td>
              <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={row.required} onChange={e => update(i, { required: e.target.checked })} /></td>
              <td className="px-2 py-1.5 text-center">
                <button type="button" onClick={() => onChange(rows.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                  <MI name="close" size={14} color="#DC2626" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={() => onChange([...rows, blank()])}
        className="w-full px-2 py-1.5 text-xs font-medium" style={{ border: 'none', borderTop: '1px solid #F3F4F6', background: '#fff', color: '#0154FC', cursor: 'pointer' }}>
        + Add row
      </button>
    </div>
  )
}

'use client'
import { useState, useActionState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createCalculation, updateCalculation, toggleCalculationActive, testCalculation,
  type CalculationFormState,
} from '@/app/actions/calculations-senaite'
import type {
  SenaiteAnalysisService, SenaiteInterimControlType,
  SenaiteCalculation, SenaiteCalculationInterimField, SenaiteCalculationPythonImport,
  SenaiteCalculationTestParameter,
} from '@/app/lib/senaite'

// Exact vocabulary from SENAITE's own InterimFieldsField.result_type
// subfield_vocabularies (bika/lims/browser/fields/interimfieldsfield.py).
const CONTROL_TYPES: { value: SenaiteInterimControlType; label: string }[] = [
  { value: '', label: 'Numeric' },
  { value: 'string', label: 'String' },
  { value: 'datetime', label: 'Datetime' },
  { value: 'select', label: 'Selection list' },
  { value: 'multiselect', label: 'Multiple selection' },
  { value: 'multiselect_duplicates', label: 'Multiple selection (with duplicates)' },
  { value: 'multichoice', label: 'Multiple choices' },
  { value: 'multivalue', label: 'Multiple values' },
]

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({ label, children, required, error, hint }: {
  label: string; children: React.ReactNode; required?: boolean; error?: string; hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-0.5" style={{ fontSize: 10, color: '#9CA3AF' }}>{hint}</p>}
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 text-xs rounded-lg outline-none'
function inputStyle(error?: string) {
  return { border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }
}

function blankInterimField(): SenaiteCalculationInterimField {
  return {
    keyword: '', title: '', value: '', choices: '', resultType: '',
    allowEmpty: false, unit: '', report: false, hidden: false, wide: false,
  }
}

// ── Interim fields editor — mirrors SENAITE's own "Calculation Interim
// Fields" datagrid exactly (all 10 real subfields, confirmed against
// bika/lims/browser/fields/interimfieldsfield.py — the first pass here only
// had keyword/title/value/hidden and was missing the other 6 columns).
function InterimFieldsEditor({ rows, onChange }: {
  rows: SenaiteCalculationInterimField[]; onChange: (rows: SenaiteCalculationInterimField[]) => void
}) {
  function update(i: number, patch: Partial<SenaiteCalculationInterimField>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function addRow() {
    onChange([...rows, blankInterimField()])
  }
  function removeRow(i: number) {
    onChange(rows.filter((_, idx) => idx !== i))
  }

  const miniInput = { ...inputStyle(), padding: '5px 8px', fontSize: 11 }
  const miniLabel = { fontSize: 9, fontWeight: 600, color: '#9CA3AF', marginBottom: 2, display: 'block' as const }

  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Calculation Interim Fields</label>
      <p className="mb-2" style={{ fontSize: 10, color: '#9CA3AF' }}>
        Define interim fields such as vessel mass or dilution factors, should your calculation require them. Reference them in the formula as [Keyword].
      </p>

      {/* Stacked cards, not a wide table — a 10-column table can't fit inside
          the 560px drawer without clipping/hidden-scroll, which is exactly
          what happened the first time this was built as a <table>. */}
      {rows.length === 0 && (
        <p className="mb-2 px-3 py-2 rounded-lg" style={{ fontSize: 11, color: '#9CA3AF', backgroundColor: '#FAFAFA', border: '1px dashed #E5E7EB' }}>
          No interim fields defined yet.
        </p>
      )}
      <div className="flex flex-col gap-2 mb-2">
        {rows.map((row, i) => (
          <div key={i} className="rounded-lg p-3" style={{ border: '1px solid #E5E7EB', backgroundColor: '#FAFAFA' }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 10, fontWeight: 700, color: '#6B7280' }}>Interim Field {i + 1}</span>
              <button type="button" onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <MI name="delete_outline" size={15} color="#9CA3AF" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <span style={miniLabel}>Keyword *</span>
                <input value={row.keyword} onChange={e => update(i, { keyword: e.target.value.trim() })} placeholder="e.g. FACTOR" className={inputCls} style={miniInput} />
              </div>
              <div>
                <span style={miniLabel}>Field Title *</span>
                <input value={row.title} onChange={e => update(i, { title: e.target.value })} placeholder="e.g. Dilution Factor" className={inputCls} style={miniInput} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <span style={miniLabel}>Default Value</span>
                <input value={row.value} onChange={e => update(i, { value: e.target.value })} className={inputCls} style={miniInput} />
              </div>
              <div>
                <span style={miniLabel}>Unit</span>
                <input value={row.unit} onChange={e => update(i, { unit: e.target.value })} placeholder="e.g. mL" className={inputCls} style={miniInput} />
              </div>
            </div>
            <div className="mb-2">
              <span style={miniLabel}>Control Type</span>
              <select value={row.resultType} onChange={e => update(i, { resultType: e.target.value as SenaiteInterimControlType })} className={inputCls} style={{ ...miniInput, padding: '5px 6px' }}>
                {CONTROL_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
              </select>
            </div>
            {row.resultType && ['select', 'multiselect', 'multiselect_duplicates', 'multichoice', 'multivalue'].includes(row.resultType) && (
              <div className="mb-2">
                <span style={miniLabel}>Choices</span>
                <input value={row.choices} onChange={e => update(i, { choices: e.target.value })} placeholder="a|Option A|b|Option B" className={inputCls} style={miniInput} />
              </div>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1" style={{ fontSize: 10, color: '#374151' }}>
                <input type="checkbox" checked={row.allowEmpty} onChange={e => update(i, { allowEmpty: e.target.checked })} /> Allow empty
              </label>
              <label className="flex items-center gap-1" style={{ fontSize: 10, color: '#374151' }}>
                <input type="checkbox" checked={row.report} onChange={e => update(i, { report: e.target.checked })} /> Report
              </label>
              <label className="flex items-center gap-1" style={{ fontSize: 10, color: '#374151' }}>
                <input type="checkbox" checked={row.hidden} onChange={e => update(i, { hidden: e.target.checked })} /> Hidden
              </label>
              <label className="flex items-center gap-1" style={{ fontSize: 10, color: '#374151' }}>
                <input type="checkbox" checked={row.wide} onChange={e => update(i, { wide: e.target.checked })} /> Apply wide
              </label>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={addRow} className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer' }}>
        <MI name="add" size={13} color="#2563EB" /> Add Interim Field
      </button>
    </div>
  )
}

// ── Python Imports editor — mirrors SENAITE's "Additional Python Libraries"
// datagrid. Defaults to math.ceil/math.floor, same as a brand-new SENAITE
// calculation, so a formula can use e.g. floor([Ca] + [Mg]) out of the box.
function PythonImportsEditor({ rows, onChange }: {
  rows: SenaiteCalculationPythonImport[]; onChange: (rows: SenaiteCalculationPythonImport[]) => void
}) {
  function update(i: number, patch: Partial<SenaiteCalculationPythonImport>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function addRow() {
    onChange([...rows, { module: '', function: '' }])
  }
  function removeRow(i: number) {
    onChange(rows.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Additional Python Libraries</label>
      <p className="mb-2" style={{ fontSize: 10, color: '#9CA3AF' }}>
        Import a function from a Python module for use in the formula, e.g. module <code>math</code>, function <code>floor</code> lets you write <code>floor([Ca] + [Mg])</code>.
      </p>
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg mb-2" style={{ border: '1px solid #E5E7EB' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 320 }}>
            <thead>
              <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #E5E7EB' }}>
                {['Module', 'Function', ''].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td className="px-1 py-1"><input value={row.module} onChange={e => update(i, { module: e.target.value.trim() })} placeholder="e.g. math" className={inputCls} style={{ width: 130, padding: '5px 8px', ...inputStyle() }} /></td>
                  <td className="px-1 py-1"><input value={row.function} onChange={e => update(i, { function: e.target.value.trim() })} placeholder="e.g. floor" className={inputCls} style={{ width: 130, padding: '5px 8px', ...inputStyle() }} /></td>
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                      <MI name="delete_outline" size={15} color="#9CA3AF" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" onClick={addRow} className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer' }}>
        <MI name="add" size={13} color="#2563EB" /> Add Python Import
      </button>
    </div>
  )
}

// ── Test Calculation panel — mirrors SENAITE's own "Test Parameters" / "Test
// Result" section exactly, including that it's visible on the CREATE form
// too (as a disabled placeholder row) — the first version here only rendered
// once a calculation already existed, which read as "still missing".
const testPanelLabel = { fontSize: 10, fontWeight: 600, color: '#9CA3AF' }

function TestCalculationPanel({ calculation, services, onUpdated }: {
  calculation: SenaiteCalculation | null; services: SenaiteAnalysisService[]
  onUpdated: (params: SenaiteCalculationTestParameter[], result: string) => void
}) {
  // Derive the keyword list from the calculation's CURRENT interim fields +
  // dependent services, not from its server-side testParameters — a
  // calculation only gets testParameters refreshed when Formula/InterimFields
  // are re-saved (see calculation_views.py _refresh_test_parameters), so any
  // calc saved before this existed, or just opened without a re-save, has an
  // empty testParameters and the Value input stayed permanently disabled.
  const params: SenaiteCalculationTestParameter[] = calculation ? [
    ...calculation.interimFields.filter(f => f.keyword).map(f => {
      const existing = calculation.testParameters.find(p => p.keyword === f.keyword)
      return { keyword: f.keyword, value: existing?.value ?? f.value }
    }),
    ...calculation.dependentServiceUids.map(uid => {
      const keyword = services.find(s => s.uid === uid)?.Keyword ?? ''
      const existing = calculation.testParameters.find(p => p.keyword === keyword)
      return { keyword, value: existing?.value ?? '' }
    }).filter(p => p.keyword),
  ] : []

  // Only stores what the user has actually typed — everything else falls
  // back to the derived default below, so a changing param list (e.g. a new
  // interim field just added) never needs a sync effect.
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  function setValue(keyword: string, v: string) {
    setOverrides(prev => ({ ...prev, [keyword]: v }))
  }

  function run() {
    if (!calculation) return
    setRunning(true)
    setError('')
    const submitted = params.map(p => ({ keyword: p.keyword, value: overrides[p.keyword] ?? p.value }))
    testCalculation(calculation.uid, submitted).then(res => {
      setRunning(false)
      if (!res.success) { setError(res.message ?? 'Failed to run test.'); return }
      if (res.testParameters) setOverrides(Object.fromEntries(res.testParameters.map(p => [p.keyword, p.value])))
      onUpdated(res.testParameters ?? submitted, res.testResult ?? '')
    })
  }

  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Test Parameters</label>
      <p className="mb-2" style={{ fontSize: 10, color: '#9CA3AF' }}>
        To test the calculation, enter values here for all calculation parameters. This includes interim fields defined above, as well as any services that this calculation depends on to calculate results.
      </p>
      <div className="overflow-x-auto rounded-lg mb-2" style={{ border: '1px solid #E5E7EB' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #E5E7EB' }}>
              <th className="px-2 py-1.5 text-left" style={testPanelLabel}>Keyword</th>
              <th className="px-2 py-1.5 text-left" style={testPanelLabel}>Value</th>
            </tr>
          </thead>
          <tbody>
            {params.length === 0 ? (
              <tr>
                <td className="px-2 py-1.5"><input disabled placeholder="—" className={inputCls} style={{ padding: '5px 8px', backgroundColor: '#F3F4F6', ...inputStyle() }} /></td>
                <td className="px-2 py-1.5"><input disabled className={inputCls} style={{ padding: '5px 8px', ...inputStyle() }} /></td>
              </tr>
            ) : params.map(p => (
              <tr key={p.keyword} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td className="px-2 py-1.5 font-mono" style={{ fontSize: 11, color: '#374151' }}>{p.keyword}</td>
                <td className="px-2 py-1.5">
                  <input value={overrides[p.keyword] ?? p.value} onChange={e => setValue(p.keyword, e.target.value)}
                    className={inputCls} style={{ padding: '5px 8px', ...inputStyle() }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!calculation ? (
        <p style={{ fontSize: 10, color: '#9CA3AF' }}>Save the calculation first to test it with sample values.</p>
      ) : (
        <button type="button" onClick={run} disabled={running || params.length === 0} className="flex items-center gap-1.5"
          style={{ fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 6, backgroundColor: '#F3F4F6', color: '#374151', border: 'none', cursor: running ? 'not-allowed' : 'pointer' }}>
          <MI name={running ? 'hourglass_top' : 'play_arrow'} size={13} color="#374151" />
          {running ? 'Running…' : 'Run Test'}
        </button>
      )}
      {error && <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
      {calculation?.testResult && (
        <div className="mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <span style={{ fontSize: 10, color: '#166534', fontWeight: 600 }}>Result: </span>
          <span className="font-mono" style={{ fontSize: 12, color: '#166534' }}>{calculation.testResult}</span>
        </div>
      )}
    </div>
  )
}

type FV = {
  title: string; description: string; formula: string
  interimFields: SenaiteCalculationInterimField[]; pythonImports: SenaiteCalculationPythonImport[]
}
const blank = (): FV => ({ title: '', description: '', formula: '', interimFields: [], pythonImports: [{ module: 'math', function: 'ceil' }, { module: 'math', function: 'floor' }] })

function CalculationDrawer({ editing, services, onClose, onSaved }: {
  editing: SenaiteCalculation | null; services: SenaiteAnalysisService[]
  onClose: () => void; onSaved: (calc: SenaiteCalculation, message: string) => void
}) {
  const isEdit = editing !== null
  const [vals, setVals] = useState<FV>(() => editing
    ? {
        title: editing.title, description: editing.description, formula: editing.formula,
        interimFields: editing.interimFields, pythonImports: editing.pythonImports,
      }
    : blank())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  // Local mirror of test-run results so the panel updates without a full
  // drawer re-open (editing.testParameters/testResult only refresh on router.refresh()).
  const [testState, setTestState] = useState<{ params: SenaiteCalculationTestParameter[]; result: string } | null>(null)
  // The parent page's toast renders behind this drawer's full-screen overlay
  // (z-index 1000), so it was never actually visible on save — confirmed by
  // reproducing in a real browser and checking the DOM. Show confirmation
  // inside the drawer itself instead.
  const [savedMsg, setSavedMsg] = useState('')

  function setVal<K extends keyof FV>(k: K, v: FV[K]) {
    setVals(prev => ({ ...prev, [k]: v }))
    if (fieldErrors[k as string]) setFieldErrors(prev => { const n = { ...prev }; delete n[k as string]; return n })
  }

  // On success the drawer stays open and switches into edit mode against the
  // just-saved calculation — closing immediately meant Test Parameters was
  // never reachable without a manual reopen (Interim Fields/Formula/Python
  // Imports are also freshest right after a save, e.g. Dependent Services).
  const createAction = async (prev: CalculationFormState, fd: FormData) => {
    const result = await createCalculation(prev, fd)
    if (result.success && result.calculation) {
      setTestState(null)
      setSavedMsg(result.message ?? 'Calculation created.')
      setTimeout(() => setSavedMsg(''), 3000)
      onSaved(result.calculation, result.message ?? 'Calculation created.')
    }
    return result
  }
  const editAction = async (prev: CalculationFormState, fd: FormData) => {
    const result = await updateCalculation(editing!.uid, prev, fd)
    if (result.success && result.calculation) {
      setTestState(null)
      setSavedMsg(result.message ?? 'Calculation updated.')
      setTimeout(() => setSavedMsg(''), 3000)
      onSaved(result.calculation, result.message ?? 'Calculation updated.')
    }
    return result
  }
  const [state, action, pending] = useActionState(isEdit ? editAction : createAction, {})

  const errors = useMemo(() => {
    const fe: Record<string, string> = {}
    if (state.errors) for (const [k, msgs] of Object.entries(state.errors)) { if (msgs?.length) fe[k] = msgs[0] }
    return fe
  }, [state])

  const availableKeywords = [
    ...vals.interimFields.filter(f => f.keyword).map(f => f.keyword),
    ...services.map(s => s.Keyword).filter(Boolean),
  ]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const interimHidden = e.currentTarget.querySelector('input[name="interim_fields_json"]') as HTMLInputElement
    interimHidden.value = JSON.stringify(vals.interimFields.filter(f => f.keyword))
    const importsHidden = e.currentTarget.querySelector('input[name="python_imports_json"]') as HTMLInputElement
    importsHidden.value = JSON.stringify(vals.pythonImports.filter(p => p.module && p.function))
  }

  // Merge in any local test-run results so TestCalculationPanel reflects the
  // latest run without needing a full router.refresh().
  const displayedCalculation = editing && testState
    ? { ...editing, testParameters: testState.params, testResult: testState.result }
    : editing

  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1000 }}>
      <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', right: 0, bottom: 'var(--dashboard-footer-h)', width: 560, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEdit ? '#EFF6FF' : '#DBEAFE' }}>
              <MI name={isEdit ? 'edit' : 'add'} size={16} color={isEdit ? '#2563EB' : '#0154FC'} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEdit ? `Edit — ${editing!.title}` : 'New Calculation'}</h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>Define a formula used to derive a result from other analyses</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
        </div>
        <form action={action} onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-3">
          <input type="hidden" name="interim_fields_json" />
          <input type="hidden" name="python_imports_json" />
          <Field label="Title" required error={errors.title}>
            <input name="title" value={vals.title} onChange={e => setVal('title', e.target.value)}
              placeholder="e.g. Total Hardness" className={inputCls} style={inputStyle(errors.title)} />
          </Field>
          <Field label="Description">
            <textarea name="description" rows={2} value={vals.description} onChange={e => setVal('description', e.target.value)}
              placeholder="Used in listings and search results." className={inputCls + ' resize-none'} style={inputStyle()} />
          </Field>

          <InterimFieldsEditor rows={vals.interimFields} onChange={rows => setVal('interimFields', rows)} />

          <Field label="Formula" required error={errors.formula}
            hint={`Standard maths operators + - * / ( ). Reference any Analysis Service or Interim Field keyword in square brackets, e.g. [Ca] + [Mg].${availableKeywords.length ? ` Available: ${availableKeywords.slice(0, 12).join(', ')}${availableKeywords.length > 12 ? '…' : ''}` : ''}`}>
            <textarea name="formula" rows={3} value={vals.formula} onChange={e => setVal('formula', e.target.value)}
              placeholder="e.g. [Ca] + [Mg]" className={inputCls + ' resize-none font-mono'} style={inputStyle(errors.formula)} />
          </Field>

          <PythonImportsEditor rows={vals.pythonImports} onChange={rows => setVal('pythonImports', rows)} />

          {isEdit && editing!.dependentServiceUids.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Dependent Services</label>
              <div className="flex flex-wrap gap-1">
                {editing!.dependentServiceUids.map(uid => {
                  const svc = services.find(s => s.uid === uid)
                  return (
                    <span key={uid} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>
                      {svc?.title ?? uid}
                    </span>
                  )
                })}
              </div>
              <p className="mt-1" style={{ fontSize: 10, color: '#9CA3AF' }}>Derived automatically from real analysis-service keywords in the formula above.</p>
            </div>
          )}

          <TestCalculationPanel calculation={displayedCalculation} services={services}
            onUpdated={(params, result) => setTestState({ params, result })} />

          {state.message && !state.success && (
            <p className="text-xs" style={{ color: '#EF4444' }}>{state.message}</p>
          )}
          {savedMsg && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <MI name="check_circle" size={13} color="#166534" />
              <span style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>{savedMsg}</span>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-1 mt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button type="button" onClick={onClose} disabled={pending}
              style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
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
  )
}

export default function CalculationsShell({ initialCalculations, services }: {
  initialCalculations: SenaiteCalculation[]; services: SenaiteAnalysisService[]
}) {
  const router = useRouter()
  const [showDrawer, setShowDrawer] = useState(false)
  const [editing, setEditing] = useState<SenaiteCalculation | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [, startTransition] = useTransition()
  const [togglingUid, setTogglingUid] = useState<string | null>(null)

  function openCreate() { setEditing(null); setShowDrawer(true) }
  function openEdit(c: SenaiteCalculation) { setEditing(c); setShowDrawer(true) }
  function closeDrawer() { setShowDrawer(false); setEditing(null) }
  function handleSaved(calc: SenaiteCalculation, message: string) {
    setShowDrawer(false)
    setEditing(null)
    setToast({ ok: true, msg: message })
    setTimeout(() => setToast(null), 4000)
    router.refresh()
  }

  function toggle(c: SenaiteCalculation) {
    setTogglingUid(c.uid)
    startTransition(async () => {
      const r = await toggleCalculationActive(c.uid, !c.isActive)
      setToast({ ok: r.success, msg: r.message })
      setTimeout(() => setToast(null), 3000)
      if (r.success) router.refresh()
      setTogglingUid(null)
    })
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-5" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="arrow_back" size={16} color="#6B7280" />
          </Link>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Calculations</h1>
            <p className="mt-1" style={{ fontSize: 13, color: '#6B7280' }}>Formulas used to derive results from other analyses</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#2563EB', border: 'none', cursor: 'pointer' }}>
          <MI name="add" size={15} color="#fff" /> New Calculation
        </button>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? '#0154FC' : '#991B1B', flexShrink: 0 }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {showDrawer && <CalculationDrawer editing={editing} services={services} onClose={closeDrawer} onSaved={handleSaved} />}

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      {initialCalculations.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2', borderRadius: 14 }}>
          <MI name="functions" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No calculations yet</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Calculation
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
          <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '20%' }} /><col style={{ width: '32%' }} /><col style={{ width: '16%' }} /><col style={{ width: '20%' }} /><col style={{ width: '12%' }} /><col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                {['Title', 'Formula', 'Interim Fields', 'Dependent Services', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialCalculations.map((c, i) => (
                <tr key={c.uid} style={{ borderBottom: i < initialCalculations.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-xs font-medium" style={{ color: '#111827' }}>{c.title}</td>
                  <td className="px-3 py-2.5 text-xs font-mono truncate" style={{ color: '#6B7280' }}>{c.formula || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>
                      {c.interimFields.length}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs truncate" style={{ color: '#6B7280' }}>
                    {c.dependentServiceUids.length === 0 ? '—' : c.dependentServiceUids.map(uid => services.find(s => s.uid === uid)?.title ?? uid).join(', ')}
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => toggle(c)} disabled={togglingUid === c.uid}
                      className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, color: c.isActive ? '#0154FC' : '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: c.isActive ? '#0154FC' : '#9CA3AF', display: 'inline-block' }} />
                      {c.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => openEdit(c)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                      <MI name="edit" size={14} color="#9CA3AF" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{initialCalculations.length} calculation{initialCalculations.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

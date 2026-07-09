'use client'
import { useState, useCallback, useActionState, useEffect, useRef } from 'react'
import {
  saveTemplate, duplicateTemplate, deleteTemplate, setActiveTemplate,
  type TemplateField, type ReportTemplate, type ReportType, type TemplateSaveState,
} from '@/app/actions/reports'

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  coa: 'Certificate of Analysis',
  worksheet: 'Worksheet Report',
  qc: 'QC Report',
  inventory: 'Inventory Report',
  instrument: 'Instrument Report',
  custom: 'Custom Report',
}

const SECTION_ORDER = ['header', 'report_info', 'client', 'sample', 'results', 'qc', 'signature', 'footer']
const SECTION_LABELS: Record<string, string> = {
  header: 'Header',
  report_info: 'Report Information',
  client: 'Client Information',
  sample: 'Sample Information',
  results: 'Analysis Results',
  qc: 'QC Summary',
  signature: 'Authorisation / Signatures',
  footer: 'Footer',
}

interface Props {
  initialTemplates: ReportTemplate[]
  defaultFields: TemplateField[]
}

export default function ReportTemplateShell({ initialTemplates, defaultFields }: Props) {
  const [templates, setTemplates] = useState<ReportTemplate[]>(initialTemplates)
  const [selectedType, setSelectedType] = useState<ReportType>('coa')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [isNew, setIsNew] = useState(false)

  const [name, setName] = useState('')
  const [fields, setFields] = useState<TemplateField[]>(defaultFields)
  const [headerColor, setHeaderColor] = useState('#003366')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [delConfirm, setDelConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [state, formAction, pending] = useActionState<TemplateSaveState, FormData>(saveTemplate, {})

  // Filter templates for selected type
  const typeTemplates = templates.filter(t => t.report_type === selectedType)

  // Load a template into the editor
  function loadTemplate(tmpl: ReportTemplate) {
    setSelectedId(tmpl.id)
    setIsNew(false)
    setName(tmpl.name)
    setFields(tmpl.fields?.length ? tmpl.fields : defaultFields)
    setHeaderColor(tmpl.header_color || '#003366')
    setLogoUrl(tmpl.logo_url ?? null)
    setDelConfirm(false)
  }

  // When type changes, auto-load first template of that type
  useEffect(() => {
    const first = templates.find(t => t.report_type === selectedType)
    if (first) loadTemplate(first)
    else startNew()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType])

  function startNew() {
    setSelectedId(null)
    setIsNew(true)
    setName('')
    setFields(defaultFields)
    setHeaderColor('#003366')
    setLogoUrl(null)
    setDelConfirm(false)
  }

  // Toast handling
  useEffect(() => {
    if (state.success) {
      showToast(state.message ?? 'Saved.', true)
      if (state.template) {
        setSelectedId(state.template.id)
        setIsNew(false)
        setTemplates(prev => {
          const idx = prev.findIndex(t => t.id === state.template!.id)
          if (idx >= 0) { const n = [...prev]; n[idx] = state.template!; return n }
          return [...prev, state.template!]
        })
      }
    } else if (state.message) {
      showToast(state.message, false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleDuplicate() {
    if (!selectedId) return
    setBusy(true)
    const res = await duplicateTemplate(selectedId)
    setBusy(false)
    if (res.ok && res.template) {
      setTemplates(prev => [...prev, res.template!])
      loadTemplate(res.template!)
      showToast(`Duplicated as "${res.template.name}"`, true)
    } else showToast(res.message ?? 'Failed', false)
  }

  async function handleDelete() {
    if (!selectedId) return
    setBusy(true)
    const res = await deleteTemplate(selectedId)
    setBusy(false)
    if (res.ok) {
      const remaining = templates.filter(t => t.id !== selectedId)
      setTemplates(remaining)
      const next = remaining.find(t => t.report_type === selectedType)
      if (next) loadTemplate(next); else startNew()
      showToast('Template deleted.', true)
    } else showToast(res.message ?? 'Failed', false)
    setDelConfirm(false)
  }

  async function handleSetActive() {
    if (!selectedId) return
    setBusy(true)
    const res = await setActiveTemplate(selectedId)
    setBusy(false)
    if (res.ok) {
      setTemplates(prev => prev.map(t =>
        t.report_type === selectedType ? { ...t, is_active: t.id === selectedId } : t
      ))
      showToast('Set as active template.', true)
    } else showToast(res.message ?? 'Failed', false)
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedId) return
    // Optimistic local preview
    const localUrl = URL.createObjectURL(file)
    setLogoUrl(localUrl)
    setBusy(true)
    const fd = new FormData()
    fd.append('logo', file)
    // Upload via the Next.js API route (avoids importing server-only django lib)
    try {
      const res = await fetch(`/api/template-logo/${selectedId}`, {
        method: 'POST',
        body: fd,
      })
      if (res.ok) {
        const data = await res.json()
        setLogoUrl(data.logo_url ?? localUrl)
        showToast('Logo uploaded.', true)
      } else showToast('Logo upload failed.', false)
    } catch { showToast('Logo upload failed.', false) }
    setBusy(false)
  }

  function handlePreview() {
    if (!selectedId) { showToast('Save the template first to preview.', false); return }
    window.open(`/api/template-preview/${selectedId}`, '_blank')
  }

  const updateField = useCallback((key: string, patch: Partial<TemplateField>) => {
    setFields(prev => prev.map(f => f.key === key ? { ...f, ...patch } : f))
  }, [])

  const moveField = useCallback((key: string, dir: -1 | 1) => {
    setFields(prev => {
      const idx = prev.findIndex(f => f.key === key)
      if (idx < 0) return prev
      const next = [...prev]
      const swapIdx = idx + dir
      if (swapIdx < 0 || swapIdx >= next.length) return prev
      if (next[swapIdx].section !== next[idx].section) return prev
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })
  }, [])

  function addCustomField(section: string) {
    const key = `custom_${Date.now()}`
    setFields(prev => [...prev, { key, label: 'New Field', value: '', visible: true, section, editable_value: true }])
  }

  function removeCustomField(key: string) {
    setFields(prev => prev.filter(f => f.key !== key))
  }

  const grouped = SECTION_ORDER.map(sec => ({
    section: sec,
    label: SECTION_LABELS[sec] ?? sec,
    items: fields.filter(f => f.section === sec),
  })).filter(g => g.items.length > 0)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData()
    if (selectedId && !isNew) fd.set('id', String(selectedId))
    fd.set('name', name)
    fd.set('report_type', selectedType)
    fd.set('fields', JSON.stringify(fields))
    fd.set('header_color', headerColor)
    formAction(fd)
  }

  const currentTemplate = templates.find(t => t.id === selectedId)
  const isActive = currentTemplate?.is_active ?? false

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          backgroundColor: toast.ok ? '#dcfce7' : '#fee2e2',
          color: toast.ok ? '#166534' : '#991b1b',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        }}>{toast.msg}</div>
      )}

      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>Report Template Editor</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Customize every line of each report type — labels, values, visibility, order, logo and colour.
        </p>
      </div>

      {/* Top controls */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap',
        padding: '8px 10px', borderRadius: 10, backgroundColor: '#ffffff',
        border: '1px solid #e5e9f2', marginBottom: 20, overflowX: 'auto',
        boxShadow: '0 1px 3px rgba(16,24,40,0.04), 0 1px 2px rgba(16,24,40,0.03)',
      }}>
        {/* Selectors group */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', flexShrink: 0,
          padding: '4px 10px', borderRadius: 8, backgroundColor: '#f6f8fc',
          border: '1px solid #e8ecf5',
        }}>
          <SelectField
            label="Type"
            value={selectedType}
            onChange={v => setSelectedType(v as ReportType)}
            options={(Object.entries(REPORT_TYPE_LABELS) as [ReportType, string][]).map(([v, l]) => ({ value: v, label: l }))}
          />

          <div style={{ width: 1, alignSelf: 'stretch', backgroundColor: '#dde3ee' }} />

          <SelectField
            label="Template"
            value={selectedId != null ? String(selectedId) : ''}
            minWidth={140}
            onChange={v => {
              const id = parseInt(v, 10)
              const tmpl = templates.find(t => t.id === id)
              if (tmpl) loadTemplate(tmpl)
            }}
            options={
              typeTemplates.length === 0
                ? [{ value: '', label: '— no templates yet —' }]
                : typeTemplates.map(t => ({ value: String(t.id), label: `${t.name}${t.is_active ? ' ★' : ''}` }))
            }
          />
        </div>

        {/* Action buttons group */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap', flexShrink: 0, marginLeft: 'auto',
          padding: '4px 6px', borderRadius: 8, backgroundColor: '#fafbfd', border: '1px solid #edf0f7',
        }}>
          <CtrlBtn onClick={startNew} icon="add" label="New" color="#2563eb" compact />
          {selectedId && <CtrlBtn onClick={handleDuplicate} icon="content_copy" label="Duplicate" color="#7c3aed" disabled={busy} compact />}
          {selectedId && !isActive && <CtrlBtn onClick={handleSetActive} icon="star" label="Set Active" color="#d97706" disabled={busy} compact />}
          {selectedId && isActive && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 3, padding: '5px 9px', flexShrink: 0,
              borderRadius: 7, fontSize: 10.5, fontWeight: 700, backgroundColor: '#fef3c7', color: '#92400e',
              border: '1px solid #fde68a', whiteSpace: 'nowrap',
            }}>
              <span className="material-icons" style={{ fontSize: 13 }}>star</span>Active
            </span>
          )}
          {selectedId && (
            delConfirm
              ? <><CtrlBtn onClick={handleDelete} icon="check" label="Confirm" color="#dc2626" filled compact /><CtrlBtn onClick={() => setDelConfirm(false)} icon="close" label="Cancel" color="#6b7280" compact /></>
              : <CtrlBtn onClick={() => setDelConfirm(true)} icon="delete" label="Delete" color="#dc2626" disabled={busy} compact />
          )}
          {selectedId && <CtrlBtn onClick={handlePreview} icon="preview" label="Preview PDF" color="#059669" compact />}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Template name + color + logo row */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Template Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Default COA Template"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Header Colour</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={headerColor}
                onChange={e => setHeaderColor(e.target.value)}
                style={{ width: 36, height: 36, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', padding: 2 }}
              />
              <input
                value={headerColor}
                onChange={e => setHeaderColor(e.target.value)}
                style={{ width: 84, padding: '7px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {logoUrl && <img src={logoUrl} alt="logo" style={{ height: 32, maxWidth: 100, objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: 4 }} />}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={!selectedId}
                style={{
                  padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12,
                  cursor: selectedId ? 'pointer' : 'not-allowed', backgroundColor: '#f9fafb', color: '#374151',
                }}
                title={selectedId ? 'Upload logo' : 'Save template first, then upload logo'}
              >
                {logoUrl ? 'Change' : 'Upload'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
            </div>
          </div>
        </div>

        {/* Live colour preview bar */}
        <div style={{
          height: 6, borderRadius: 3, marginBottom: 20,
          background: `linear-gradient(90deg, ${headerColor} 0%, ${headerColor}88 100%)`,
        }} />

        {/* Field editor per section */}
        {grouped.map(group => (
          <div key={group.section} style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 8,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: '#6b7280' }}>
                {group.label}
              </span>
              <button
                type="button"
                onClick={() => addCustomField(group.section)}
                style={{ fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
              >
                + Add custom line
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr 60px 56px 28px',
              gap: 6, padding: '3px 6px', fontSize: 10, fontWeight: 600,
              color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <span /><span>Label</span><span>Value</span>
              <span style={{ textAlign: 'center' }}>Show</span>
              <span style={{ textAlign: 'center' }}>Move</span>
              <span />
            </div>

            {group.items.map((field, idx) => (
              <FieldRow
                key={field.key}
                field={field}
                isFirst={idx === 0}
                isLast={idx === group.items.length - 1}
                isCustom={field.key.startsWith('custom_')}
                onChange={updateField}
                onMove={moveField}
                onRemove={removeCustomField}
              />
            ))}
          </div>
        ))}

        {/* Save */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
          {isNew && <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>Creating new template</span>}
          <button
            type="submit"
            disabled={pending || busy}
            style={{
              padding: '9px 28px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              backgroundColor: pending || busy ? '#93c5fd' : '#2563eb',
              color: '#fff', border: 'none', cursor: pending || busy ? 'not-allowed' : 'pointer',
            }}
          >
            {pending ? 'Saving…' : isNew ? 'Create Template' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

function CtrlBtn({ onClick, icon, label, color, disabled, filled, compact }: {
  onClick: () => void; icon: string; label: string; color: string; disabled?: boolean; filled?: boolean; compact?: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
        padding: compact ? '5px 9px' : '7px 12px', borderRadius: 7,
        fontSize: compact ? 10.5 : 11.5, fontWeight: 700,
        border: filled ? 'none' : `1px solid ${color}30`,
        backgroundColor: filled ? color : (hover && !disabled ? `${color}1c` : `${color}0d`),
        color: filled ? '#fff' : color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'background-color 0.15s, transform 0.1s',
        transform: hover && !disabled ? 'translateY(-1px)' : 'none',
        boxShadow: filled ? `0 2px 6px ${color}55` : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span className="material-icons" style={{ fontSize: compact ? 13 : 14 }}>{icon}</span>
      {label}
    </button>
  )
}

function SelectField({ label, value, onChange, options, minWidth }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  minWidth?: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <label style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: '5px 26px 5px 9px', border: '1px solid #d7dce6', borderRadius: 7,
          fontSize: 11.5, fontWeight: 600, color: '#1e293b', backgroundColor: '#fff',
          minWidth, cursor: 'pointer', appearance: 'none',
          backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'><path d=\'M1 1l4 4 4-4\' stroke=\'%2364748b\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/></svg>")',
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 9px center',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function FieldRow({ field, isFirst, isLast, isCustom, onChange, onMove, onRemove }: {
  field: TemplateField
  isFirst: boolean
  isLast: boolean
  isCustom: boolean
  onChange: (key: string, patch: Partial<TemplateField>) => void
  onMove: (key: string, dir: -1 | 1) => void
  onRemove: (key: string) => void
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '24px 1fr 1fr 60px 56px 28px',
      gap: 6, alignItems: 'center', padding: '4px 6px',
      borderRadius: 6, backgroundColor: field.visible ? '#fff' : '#f9fafb',
      border: `1px solid ${isCustom ? '#e0d9ff' : '#e5e7eb'}`, marginBottom: 3,
      opacity: field.visible ? 1 : 0.5,
    }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%',
        backgroundColor: isCustom ? '#7c3aed' : '#d1d5db', margin: 'auto' }} />

      <input
        value={field.label}
        onChange={e => onChange(field.key, { label: e.target.value })}
        style={{ padding: '4px 7px', border: '1px solid #e5e7eb', borderRadius: 5,
          fontSize: 12, color: '#374151', outline: 'none', width: '100%',
          backgroundColor: field.visible ? '#fff' : '#f3f4f6' }}
        placeholder="Label"
      />

      {field.editable_value ? (
        <input
          value={field.value}
          onChange={e => onChange(field.key, { value: e.target.value })}
          style={{ padding: '4px 7px', border: '1px solid #e5e7eb', borderRadius: 5,
            fontSize: 12, color: '#374151', outline: 'none', width: '100%',
            backgroundColor: field.visible ? '#fff' : '#f3f4f6' }}
          placeholder="Value"
        />
      ) : (
        <span style={{ fontSize: 10, color: '#9ca3af', padding: '4px 7px' }}>auto from data</span>
      )}

      {/* Toggle */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => onChange(field.key, { visible: !field.visible })}
          style={{ width: 32, height: 18, borderRadius: 9,
            backgroundColor: field.visible ? '#2563eb' : '#d1d5db',
            border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
          title={field.visible ? 'Hide' : 'Show'}
        >
          <span style={{ position: 'absolute', top: 2, width: 14, height: 14, borderRadius: '50%',
            backgroundColor: '#fff', transition: 'left 0.2s', left: field.visible ? 16 : 2 }} />
        </button>
      </div>

      {/* Move */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        {(['▲', '▼'] as const).map((arrow, i) => (
          <button key={arrow} type="button"
            onClick={() => onMove(field.key, i === 0 ? -1 : 1)}
            disabled={i === 0 ? isFirst : isLast}
            style={{ width: 20, height: 14, border: '1px solid #d1d5db', borderRadius: 2,
              background: '#f9fafb', cursor: (i === 0 ? isFirst : isLast) ? 'default' : 'pointer',
              fontSize: 8, opacity: (i === 0 ? isFirst : isLast) ? 0.25 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >{arrow}</button>
        ))}
      </div>

      {/* Remove (custom fields only) */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {isCustom && (
          <button type="button" onClick={() => onRemove(field.key)}
            style={{ width: 20, height: 20, border: 'none', background: 'none',
              cursor: 'pointer', color: '#dc2626', fontSize: 14, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Remove custom field"
          >×</button>
        )}
      </div>
    </div>
  )
}

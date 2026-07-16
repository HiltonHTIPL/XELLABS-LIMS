'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { RecordRow } from '@/app/actions/instrument-workflows'
import {
  createCertification, createScheduledTask, createValidation,
  createCalibration, createMaintenance,
} from '@/app/actions/instrument-workflows'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, lineHeight: 1, color }}>{name}</span>
}

type Col = { key: string; header: string; kind?: 'date' | 'bool' | 'validity' }
type FieldType = 'text' | 'date' | 'number' | 'select' | 'checkbox' | 'textarea' | 'user' | 'file'
type FormField = { name: string; label: string; type: FieldType; options?: string[] }
type TabDef = {
  key: string; label: string; icon: string
  cols: Col[]; fields: FormField[]
  create: (fd: FormData) => Promise<{ ok: boolean; message: string }>
}

const TABS: TabDef[] = [
  {
    key: 'calibrations', label: 'Calibrations', icon: 'tune', create: createCalibration,
    cols: [{ key: 'calibration_date', header: 'Date', kind: 'date' }, { key: 'next_due', header: 'Next Due', kind: 'date' }, { key: 'status', header: 'Status' }],
    fields: [{ name: 'calibration_date', label: 'Calibration Date', type: 'date' }, { name: 'next_due', label: 'Next Due', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: ['pending', 'pass', 'fail'] }, { name: 'notes', label: 'Notes', type: 'textarea' }],
  },
  {
    key: 'certifications', label: 'Certifications', icon: 'verified', create: createCertification,
    cols: [{ key: 'task_id', header: 'Task ID' }, { key: 'agency', header: 'Agency' }, { key: 'valid_from', header: 'Valid From', kind: 'date' }, { key: 'valid_to', header: 'Valid To', kind: 'date' }, { key: 'is_valid', header: 'Status', kind: 'validity' }],
    fields: [
      { name: 'task_id', label: 'Task ID', type: 'text' },
      { name: 'agency', label: 'Agency', type: 'text' },
      { name: 'internal', label: 'Internal certification', type: 'checkbox' },
      { name: 'date', label: 'Date Granted', type: 'date' },
      { name: 'valid_from', label: 'Valid From', type: 'date' },
      { name: 'valid_to', label: 'Valid To', type: 'date' },
      { name: 'expiration_interval', label: 'Interval (days)', type: 'number' },
      { name: 'preparator', label: 'Preparator', type: 'user' },
      { name: 'validator', label: 'Validator', type: 'user' },
      { name: 'document', label: 'Certificate Document', type: 'file' },
      { name: 'remarks', label: 'Remarks', type: 'textarea' },
    ],
  },
  {
    key: 'maintenances', label: 'Maintenance', icon: 'build', create: createMaintenance,
    cols: [{ key: 'maintenance_date', header: 'Date', kind: 'date' }, { key: 'maintenance_type', header: 'Type' }, { key: 'next_due', header: 'Next Due', kind: 'date' }],
    fields: [{ name: 'maintenance_date', label: 'Maintenance Date', type: 'date' }, { name: 'maintenance_type', label: 'Type', type: 'select', options: ['routine', 'corrective', 'preventive'] }, { name: 'next_due', label: 'Next Due', type: 'date' }, { name: 'notes', label: 'Notes', type: 'textarea' }],
  },
  {
    key: 'scheduledTasks', label: 'Scheduled Tasks', icon: 'event_repeat', create: createScheduledTask,
    cols: [{ key: 'title', header: 'Title' }, { key: 'task_type', header: 'Type' }, { key: 'criteria', header: 'Criteria' }, { key: 'next_due', header: 'Next Due', kind: 'date' }],
    fields: [{ name: 'title', label: 'Title', type: 'text' }, { name: 'task_type', label: 'Type', type: 'select', options: ['maintenance', 'calibration', 'validation'] }, { name: 'criteria', label: 'Recurrence Criteria', type: 'text' }, { name: 'next_due', label: 'Next Due', type: 'date' }, { name: 'considerations', label: 'Considerations', type: 'textarea' }],
  },
  {
    key: 'validations', label: 'Validations', icon: 'fact_check', create: createValidation,
    cols: [{ key: 'report_id', header: 'Report ID' }, { key: 'date_issued', header: 'Issued', kind: 'date' }, { key: 'validator', header: 'Validator' }, { key: 'down_from', header: 'Down From', kind: 'date' }, { key: 'down_to', header: 'Down To', kind: 'date' }],
    fields: [
      { name: 'report_id', label: 'Report ID', type: 'text' },
      { name: 'date_issued', label: 'Date Issued', type: 'date' },
      { name: 'validator', label: 'Validator', type: 'text' },
      { name: 'worker', label: 'Worker', type: 'user' },
      { name: 'down_from', label: 'Out of Service From', type: 'date' },
      { name: 'down_to', label: 'Back in Service On', type: 'date' },
      { name: 'work_performed', label: 'Work Performed', type: 'textarea' },
      { name: 'considerations', label: 'Considerations', type: 'textarea' },
      { name: 'remarks', label: 'Remarks', type: 'textarea' },
    ],
  },
]

type Initial = Record<string, RecordRow[]>

export default function InstrumentDetailShell(
  { instrument, users, initial }:
  { instrument: Record<string, unknown>; users: { id: number; name: string }[]; initial: Initial }
) {
  const router = useRouter()
  const [active, setActive] = useState('calibrations')
  const [rowsByTab] = useState<Initial>(initial)
  const [drawer, setDrawer] = useState(false)
  const [form, setForm] = useState<Record<string, string | boolean>>({})
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  const tab = TABS.find(t => t.key === active)!
  const rows = rowsByTab[active] ?? []
  const iid = Number(instrument.id)
  const name = String(instrument.name ?? 'Instrument')

  function fmt(v: unknown, kind?: string) {
    if (v === null || v === undefined || v === '') return '—'
    if (kind === 'date') return String(v).slice(0, 10)
    if (kind === 'bool') return v ? 'Yes' : 'No'
    return String(v)
  }

  function openAdd() {
    const init: Record<string, string | boolean> = {}
    for (const f of tab.fields) init[f.name] = f.type === 'checkbox' ? false : ''
    setForm(init); setFiles({}); setDrawer(true)
  }

  async function submit() {
    setSaving(true)
    const fd = new FormData()
    fd.append('instrument', String(iid))
    for (const f of tab.fields) {
      if (f.type === 'file') { const file = files[f.name]; if (file) fd.append(f.name, file) }
      else if (f.type === 'checkbox') { fd.append(f.name, form[f.name] ? 'true' : 'false') }
      else { const v = form[f.name]; if (v !== '' && v !== undefined && v !== null) fd.append(f.name, String(v)) }
    }
    const res = await tab.create(fd)
    setSaving(false)
    setToast({ ok: res.ok, msg: res.message })
    setTimeout(() => setToast(null), 3500)
    if (res.ok) { setDrawer(false); router.refresh() }
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <Link href="/dashboard/instruments" className="inline-flex items-center gap-1 mb-3" style={{ fontSize: 12, color: '#6B7280' }}>
        <MI name="arrow_back" size={14} /> Instrument Register
      </Link>

      {/* Instrument header */}
      <div className="bg-white mb-4" style={{ border: '1px solid #E8EAF2', borderRadius: 12, padding: 18 }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {typeof instrument.photo === 'string' && instrument.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={instrument.photo} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid #E8EAF2' }} />
            ) : null}
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#14265E' }}>{name}</h1>
              <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                {String(instrument.instrument_id ?? '')} · {String(instrument.manufacturer_org_name || instrument.manufacturer || '—')} {String(instrument.model ?? '')}
              </p>
              {typeof instrument.installation_certificate === 'string' && instrument.installation_certificate ? (
                <a href={String(instrument.installation_certificate)} target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: '#0154FC', fontWeight: 600, display: 'inline-block', marginTop: 6 }}>
                  Installation certificate
                </a>
              ) : null}
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999, backgroundColor: '#ECFDF5', color: '#059669', textTransform: 'capitalize' }}>
            {String(instrument.status ?? 'active')}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-4 mt-3" style={{ fontSize: 12 }}>
          <Meta label="Type" value={String(instrument.instrument_type_name || '—')} />
          <Meta label="Location" value={String(instrument.instrument_location_name || instrument.location || '—')} />
          <Meta label="Supplier" value={String(instrument.supplier_org_name || instrument.supplier || '—')} />
          <Meta label="Asset No." value={String(instrument.asset_number || '—')} />
          <Meta label="Installed" value={instrument.installation_date ? String(instrument.installation_date).slice(0, 10) : '—'} />
          <Meta label="Import interface" value={String(instrument.import_data_interface || '—')} />
          <Meta label="Export interface" value={String(instrument.data_interface || '—')} />
          <Meta label="Locked until calib." value={instrument.dispose_until_next_calibration ? 'Yes' : 'No'} />
        </div>
      </div>

      {toast && (
        <div className="mb-3 px-3 py-2 rounded-lg" style={{ fontSize: 12, backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', color: toast.ok ? '#0154FC' : '#991B1B' }}>{toast.msg}</div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 mb-3" style={{ borderBottom: '1px solid #E8EAF2' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActive(t.key)}
            className="flex items-center gap-1.5 px-3 py-2" style={{ fontSize: 13, fontWeight: 600, color: active === t.key ? '#0154FC' : '#6B7280', borderBottom: active === t.key ? '2px solid #0154FC' : '2px solid transparent' }}>
            <MI name={t.icon} size={15} /> {t.label}
            <span style={{ fontSize: 10, backgroundColor: '#EEF2FF', color: '#4F46E5', borderRadius: 999, padding: '1px 6px' }}>{(rowsByTab[t.key] ?? []).length}</span>
          </button>
        ))}
      </div>

      {/* Active tab: table + add */}
      <div className="flex justify-end mb-2">
        <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white" style={{ fontSize: 13, fontWeight: 600, backgroundColor: '#0154FC' }}>
          <MI name="add" size={14} color="#fff" /> Add {tab.label.replace(/s$/, '')}
        </button>
      </div>
      <div className="bg-white" style={{ border: '1px solid #E8EAF2', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', textAlign: 'left', color: '#6B7280' }}>
              {tab.cols.map(c => <th key={c.key} style={{ padding: '9px 12px', fontWeight: 600 }}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={tab.cols.length} style={{ padding: 20, textAlign: 'center', color: '#9CA3AF' }}>No {tab.label.toLowerCase()} recorded.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid #F3F4F6', color: '#111827' }}>
                {tab.cols.map(c => (
                  <td key={c.key} style={{ padding: '9px 12px' }}>
                    {c.kind === 'validity'
                      ? <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, backgroundColor: r[c.key] ? '#ECFDF5' : '#FEF2F2', color: r[c.key] ? '#059669' : '#991B1B' }}>{r[c.key] ? 'Valid' : 'Expired'}</span>
                      : fmt(r[c.key], c.kind)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add drawer */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: drawer ? 'auto' : 'none' }}>
        <div onClick={() => setDrawer(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: drawer ? 1 : 0, transition: 'opacity 0.25s' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 440, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: drawer ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Add {tab.label.replace(/s$/, '')}</h2>
            <button onClick={() => setDrawer(false)}><MI name="close" size={16} color="#9CA3AF" /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
            {tab.fields.map(f => (
              <div key={f.name}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 4 }}>{f.label}</label>
                {f.type === 'textarea'
                  ? <textarea rows={2} value={String(form[f.name] ?? '')} onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))} className="w-full px-3 py-2 rounded-lg" style={{ fontSize: 12, border: '1px solid #D1D5DB', resize: 'none' }} />
                  : f.type === 'select'
                    ? <select value={String(form[f.name] ?? '')} onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))} className="w-full px-3 py-2 rounded-lg" style={{ fontSize: 12, border: '1px solid #D1D5DB' }}>
                        <option value="">Select…</option>
                        {f.options?.map(o => <option key={o} value={o} style={{ textTransform: 'capitalize' }}>{o}</option>)}
                      </select>
                    : f.type === 'user'
                      ? <select value={String(form[f.name] ?? '')} onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))} className="w-full px-3 py-2 rounded-lg" style={{ fontSize: 12, border: '1px solid #D1D5DB' }}>
                          <option value="">Select user…</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    : f.type === 'file'
                      ? <input type="file" onChange={e => setFiles(p => ({ ...p, [f.name]: e.target.files?.[0] ?? null }))} className="w-full text-xs" style={{ fontSize: 12 }} />
                    : f.type === 'checkbox'
                      ? <input type="checkbox" checked={Boolean(form[f.name])} onChange={e => setForm(p => ({ ...p, [f.name]: e.target.checked }))} />
                      : <input type={f.type} value={String(form[f.name] ?? '')} onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))} className="w-full px-3 py-2 rounded-lg" style={{ fontSize: 12, border: '1px solid #D1D5DB' }} />}
              </div>
            ))}
          </div>
          <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button onClick={() => setDrawer(false)} style={{ fontSize: 12, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151' }}>Cancel</button>
            <button onClick={submit} disabled={saving} style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginTop: 2 }}>{value}</div>
    </div>
  )
}

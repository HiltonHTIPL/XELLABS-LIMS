'use client'
import { useState, useActionState, useTransition, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCalibration, updateCalibration, deleteCalibration,
  createMaintenance, updateMaintenance, deleteMaintenance,
  createInstrumentRun, updateInstrumentRun, deleteInstrumentRun,
  createInstrumentResultImport, deleteInstrumentResultImport, processInstrumentResultImport,
  type InstrumentOption, type Calibration, type Maintenance, type InstrumentRun,
  type InstrumentResultImport, type FormState,
} from '@/app/actions/instrument-maintenance'
import {
  PageHeader, Card, Btn, IconBtn, StatusChip, ConfirmModal, EmptyState,
  thStyle, tdStyle, inputStyle, selectStyle, textareaStyle, Field, MI, T,
} from '@/app/dashboard/_components/ui'

type Tab = 'calibrations' | 'maintenances' | 'runs' | 'imports'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'calibrations', label: 'Calibrations', icon: 'verified' },
  { key: 'maintenances', label: 'Maintenance', icon: 'build' },
  { key: 'runs', label: 'Runs', icon: 'play_circle' },
  { key: 'imports', label: 'Result Imports', icon: 'upload_file' },
]

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return d.length > 10 ? new Date(d).toLocaleString() : d
}

function instrumentLabel(instruments: InstrumentOption[], id: number) {
  const inst = instruments.find(i => i.id === id)
  return inst ? `${inst.name} (${inst.instrument_id})` : `#${id}`
}

/* ------------------------------------------------------------------ */
/* Instrument filter select                                             */
/* ------------------------------------------------------------------ */

function InstrumentFilter({ instruments, value, onChange }: {
  instruments: InstrumentOption[]; value: string; onChange: (v: string) => void
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...selectStyle, width: 240 }}>
      <option value="">All instruments</option>
      {instruments.map(i => (
        <option key={i.id} value={i.id}>{i.name} ({i.instrument_id})</option>
      ))}
    </select>
  )
}

function InstrumentSelectField({ instruments, defaultValue, error }: {
  instruments: InstrumentOption[]; defaultValue?: number; error?: string
}) {
  return (
    <Field label="Instrument" required hint={error}>
      <select name="instrument" defaultValue={defaultValue ?? ''} required style={selectStyle}>
        <option value="" disabled>Select instrument…</option>
        {instruments.map(i => (
          <option key={i.id} value={i.id}>{i.name} ({i.instrument_id})</option>
        ))}
      </select>
    </Field>
  )
}

/* ------------------------------------------------------------------ */
/* Generic modal shell                                                  */
/* ------------------------------------------------------------------ */

function ModalShell({ title, subtitle, icon, onClose, children }: {
  title: string; subtitle: string; icon: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1000 }}>
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 460, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
              <MI name={icon} size={16} color={T.primary} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{title}</h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalActions({ onClose, pending, isEdit }: { onClose: () => void; pending: boolean; isEdit: boolean }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
      <button type="button" onClick={onClose} disabled={pending}
        style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
        Cancel
      </button>
      <button type="submit" disabled={pending} className="flex items-center gap-1.5"
        style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: T.primary, color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}>
        <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
        {pending ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save Changes' : 'Create'}
      </button>
    </div>
  )
}

function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
      <MI name="error" size={13} color="#DC2626" /> {message}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Calibration modal                                                    */
/* ------------------------------------------------------------------ */

function CalibrationModal({ instruments, editing, onClose, onDone }: {
  instruments: InstrumentOption[]; editing: Calibration | null; onClose: () => void; onDone: () => void
}) {
  const isEdit = editing !== null
  const create = async (prev: FormState, fd: FormData) => {
    const r = await createCalibration(prev, fd)
    if (r.success) { onDone(); onClose() }
    return r
  }
  const edit = async (prev: FormState, fd: FormData) => {
    const r = await updateCalibration(editing!.id, prev, fd)
    if (r.success) { onDone(); onClose() }
    return r
  }
  const [state, action, pending] = useActionState(isEdit ? edit : create, {})

  return (
    <ModalShell title={isEdit ? 'Edit Calibration' : 'New Calibration'} subtitle="Record an instrument calibration event" icon={isEdit ? 'edit' : 'verified'} onClose={onClose}>
      <form action={action} className="px-5 py-4 flex flex-col gap-3">
        <ErrorBanner message={state.message} />
        <InstrumentSelectField instruments={instruments} defaultValue={editing?.instrument} error={state.errors?.instrument?.[0]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calibration Date" required hint={state.errors?.calibration_date?.[0]}>
            <input type="date" name="calibration_date" required defaultValue={editing?.calibration_date} style={inputStyle} />
          </Field>
          <Field label="Next Due">
            <input type="date" name="next_due" defaultValue={editing?.next_due ?? ''} style={inputStyle} />
          </Field>
        </div>
        <Field label="Status" required>
          <select name="status" defaultValue={editing?.status ?? 'pending'} style={selectStyle}>
            <option value="pending">Pending</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
          </select>
        </Field>
        <Field label="Notes">
          <textarea name="notes" rows={3} defaultValue={editing?.notes} style={textareaStyle} placeholder="Calibration notes…" />
        </Field>
        <ModalActions onClose={onClose} pending={pending} isEdit={isEdit} />
      </form>
    </ModalShell>
  )
}

/* ------------------------------------------------------------------ */
/* Maintenance modal                                                    */
/* ------------------------------------------------------------------ */

function MaintenanceModal({ instruments, editing, onClose, onDone }: {
  instruments: InstrumentOption[]; editing: Maintenance | null; onClose: () => void; onDone: () => void
}) {
  const isEdit = editing !== null
  const create = async (prev: FormState, fd: FormData) => {
    const r = await createMaintenance(prev, fd)
    if (r.success) { onDone(); onClose() }
    return r
  }
  const edit = async (prev: FormState, fd: FormData) => {
    const r = await updateMaintenance(editing!.id, prev, fd)
    if (r.success) { onDone(); onClose() }
    return r
  }
  const [state, action, pending] = useActionState(isEdit ? edit : create, {})

  return (
    <ModalShell title={isEdit ? 'Edit Maintenance' : 'New Maintenance'} subtitle="Record a maintenance event" icon={isEdit ? 'edit' : 'build'} onClose={onClose}>
      <form action={action} className="px-5 py-4 flex flex-col gap-3">
        <ErrorBanner message={state.message} />
        <InstrumentSelectField instruments={instruments} defaultValue={editing?.instrument} error={state.errors?.instrument?.[0]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Maintenance Date" required hint={state.errors?.maintenance_date?.[0]}>
            <input type="date" name="maintenance_date" required defaultValue={editing?.maintenance_date} style={inputStyle} />
          </Field>
          <Field label="Next Due">
            <input type="date" name="next_due" defaultValue={editing?.next_due ?? ''} style={inputStyle} />
          </Field>
        </div>
        <Field label="Type" required>
          <select name="maintenance_type" defaultValue={editing?.maintenance_type ?? 'routine'} style={selectStyle}>
            <option value="routine">Routine</option>
            <option value="corrective">Corrective</option>
            <option value="preventive">Preventive</option>
          </select>
        </Field>
        <Field label="Notes">
          <textarea name="notes" rows={3} defaultValue={editing?.notes} style={textareaStyle} placeholder="Maintenance notes…" />
        </Field>
        <ModalActions onClose={onClose} pending={pending} isEdit={isEdit} />
      </form>
    </ModalShell>
  )
}

/* ------------------------------------------------------------------ */
/* Run modal                                                            */
/* ------------------------------------------------------------------ */

function RunModal({ instruments, editing, onClose, onDone }: {
  instruments: InstrumentOption[]; editing: InstrumentRun | null; onClose: () => void; onDone: () => void
}) {
  const isEdit = editing !== null
  const create = async (prev: FormState, fd: FormData) => {
    const r = await createInstrumentRun(prev, fd)
    if (r.success) { onDone(); onClose() }
    return r
  }
  const edit = async (prev: FormState, fd: FormData) => {
    const r = await updateInstrumentRun(editing!.id, prev, fd)
    if (r.success) { onDone(); onClose() }
    return r
  }
  const [state, action, pending] = useActionState(isEdit ? edit : create, {})
  const defaultRunDate = editing?.run_date ? editing.run_date.slice(0, 16) : ''

  return (
    <ModalShell title={isEdit ? 'Edit Run' : 'New Run'} subtitle="Record an instrument run" icon={isEdit ? 'edit' : 'play_circle'} onClose={onClose}>
      <form action={action} className="px-5 py-4 flex flex-col gap-3">
        <ErrorBanner message={state.message} />
        <InstrumentSelectField instruments={instruments} defaultValue={editing?.instrument} error={state.errors?.instrument?.[0]} />
        <Field label="Run Date/Time" required hint={state.errors?.run_date?.[0]}>
          <input type="datetime-local" name="run_date" required defaultValue={defaultRunDate} style={inputStyle} />
        </Field>
        <Field label="Notes">
          <textarea name="notes" rows={3} defaultValue={editing?.notes} style={textareaStyle} placeholder="Run notes…" />
        </Field>
        <ModalActions onClose={onClose} pending={pending} isEdit={isEdit} />
      </form>
    </ModalShell>
  )
}

/* ------------------------------------------------------------------ */
/* Result import modal (create only — no edit on backend)               */
/* ------------------------------------------------------------------ */

function ImportModal({ instruments, onClose, onDone }: {
  instruments: InstrumentOption[]; onClose: () => void; onDone: () => void
}) {
  const create = async (prev: FormState, fd: FormData) => {
    const r = await createInstrumentResultImport(prev, fd)
    if (r.success) { onDone(); onClose() }
    return r
  }
  const [state, action, pending] = useActionState(create, {})

  return (
    <ModalShell title="New Result Import" subtitle="Upload an instrument result file" icon="upload_file" onClose={onClose}>
      <form action={action} className="px-5 py-4 flex flex-col gap-3">
        <ErrorBanner message={state.message} />
        <InstrumentSelectField instruments={instruments} error={state.errors?.instrument?.[0]} />
        <Field label="File Format" required>
          <select name="file_format" defaultValue="csv" style={selectStyle}>
            <option value="csv">CSV</option>
            <option value="xml">XML</option>
            <option value="txt">Text</option>
          </select>
        </Field>
        <Field label="File" required>
          <input type="file" name="file" required style={{ fontSize: 13, color: T.text }} />
        </Field>
        <ModalActions onClose={onClose} pending={pending} isEdit={false} />
      </form>
    </ModalShell>
  )
}

/* ------------------------------------------------------------------ */
/* Toast                                                                */
/* ------------------------------------------------------------------ */

function Toast({ toast }: { toast: { ok: boolean; msg: string } | null }) {
  if (!toast) return null
  return (
    <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
      style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? T.primary : '#991B1B' }}>
      <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? T.primary : '#DC2626'} />
      {toast.msg}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main shell                                                           */
/* ------------------------------------------------------------------ */

export default function InstrumentMaintenanceShell({
  instruments, initialCalibrations, initialMaintenances, initialRuns, initialImports,
}: {
  instruments: InstrumentOption[]
  initialCalibrations: Calibration[]
  initialMaintenances: Maintenance[]
  initialRuns: InstrumentRun[]
  initialImports: InstrumentResultImport[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('calibrations')
  const [instrumentFilter, setInstrumentFilter] = useState('')
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [busy, startTransition] = useTransition()

  const [showCalModal, setShowCalModal] = useState(false)
  const [editingCal, setEditingCal] = useState<Calibration | null>(null)
  const [deleteCal, setDeleteCal] = useState<Calibration | null>(null)

  const [showMaintModal, setShowMaintModal] = useState(false)
  const [editingMaint, setEditingMaint] = useState<Maintenance | null>(null)
  const [deleteMaint, setDeleteMaint] = useState<Maintenance | null>(null)

  const [showRunModal, setShowRunModal] = useState(false)
  const [editingRun, setEditingRun] = useState<InstrumentRun | null>(null)
  const [deleteRun, setDeleteRun] = useState<InstrumentRun | null>(null)

  const [showImportModal, setShowImportModal] = useState(false)
  const [deleteImport, setDeleteImport] = useState<InstrumentResultImport | null>(null)

  // Reset the filter when switching tabs rather than carrying it over to an unrelated list.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setInstrumentFilter('') }, [tab])

  function notify(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const filteredCalibrations = useMemo(
    () => instrumentFilter ? initialCalibrations.filter(c => String(c.instrument) === instrumentFilter) : initialCalibrations,
    [initialCalibrations, instrumentFilter]
  )
  const filteredMaintenances = useMemo(
    () => instrumentFilter ? initialMaintenances.filter(m => String(m.instrument) === instrumentFilter) : initialMaintenances,
    [initialMaintenances, instrumentFilter]
  )
  const filteredRuns = useMemo(
    () => instrumentFilter ? initialRuns.filter(r => String(r.instrument) === instrumentFilter) : initialRuns,
    [initialRuns, instrumentFilter]
  )
  const filteredImports = useMemo(
    () => instrumentFilter ? initialImports.filter(i => String(i.instrument) === instrumentFilter) : initialImports,
    [initialImports, instrumentFilter]
  )

  function handleDone(msg: string) {
    notify(true, msg)
    router.refresh()
  }

  function confirmDeleteCal() {
    if (!deleteCal) return
    startTransition(async () => {
      const r = await deleteCalibration(deleteCal.id)
      notify(r.success, r.message)
      setDeleteCal(null)
      if (r.success) router.refresh()
    })
  }
  function confirmDeleteMaint() {
    if (!deleteMaint) return
    startTransition(async () => {
      const r = await deleteMaintenance(deleteMaint.id)
      notify(r.success, r.message)
      setDeleteMaint(null)
      if (r.success) router.refresh()
    })
  }
  function confirmDeleteRun() {
    if (!deleteRun) return
    startTransition(async () => {
      const r = await deleteInstrumentRun(deleteRun.id)
      notify(r.success, r.message)
      setDeleteRun(null)
      if (r.success) router.refresh()
    })
  }
  function confirmDeleteImport() {
    if (!deleteImport) return
    startTransition(async () => {
      const r = await deleteInstrumentResultImport(deleteImport.id)
      notify(r.success, r.message)
      setDeleteImport(null)
      if (r.success) router.refresh()
    })
  }
  function processImport(imp: InstrumentResultImport) {
    startTransition(async () => {
      const r = await processInstrumentResultImport(imp.id)
      notify(r.success, r.message)
      if (r.success) router.refresh()
    })
  }

  const newButtonLabel: Record<Tab, string> = {
    calibrations: 'New Calibration',
    maintenances: 'New Maintenance',
    runs: 'New Run',
    imports: 'New Import',
  }

  function openCreate() {
    if (tab === 'calibrations') { setEditingCal(null); setShowCalModal(true) }
    else if (tab === 'maintenances') { setEditingMaint(null); setShowMaintModal(true) }
    else if (tab === 'runs') { setEditingRun(null); setShowRunModal(true) }
    else setShowImportModal(true)
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <PageHeader
        title="Instrument Maintenance"
        subtitle="Calibrations, maintenance, runs and result imports for lab instruments"
        right={<Btn icon="add" onClick={openCreate}>{newButtonLabel[tab]}</Btn>}
      />

      <Toast toast={toast} />

      <div className="flex items-center gap-1 mb-4 flex-wrap" style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 px-3.5 py-2.5"
            style={{
              fontSize: 13, fontWeight: 600, background: 'none', cursor: 'pointer',
              border: 'none', borderBottom: tab === t.key ? `2px solid ${T.primary}` : '2px solid transparent',
              color: tab === t.key ? T.primary : T.muted, marginBottom: -1,
            }}>
            <MI name={t.icon} size={16} color={tab === t.key ? T.primary : T.faint} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-3">
        <InstrumentFilter instruments={instruments} value={instrumentFilter} onChange={setInstrumentFilter} />
      </div>

      {tab === 'calibrations' && (
        <Card pad={false}>
          {filteredCalibrations.length === 0 ? (
            <EmptyState icon="verified" title="No calibration records" sub="Create one to get started" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Instrument', 'Calibration Date', 'Next Due', 'Status', 'Notes', ''].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCalibrations.map(c => (
                    <tr key={c.id}>
                      <td style={tdStyle}>{instrumentLabel(instruments, c.instrument)}</td>
                      <td style={tdStyle}>{fmtDate(c.calibration_date)}</td>
                      <td style={tdStyle}>{fmtDate(c.next_due)}</td>
                      <td style={tdStyle}><StatusChip status={c.status} /></td>
                      <td style={{ ...tdStyle, maxWidth: 220 }} className="truncate">{c.notes || '—'}</td>
                      <td style={tdStyle}>
                        <div className="flex items-center gap-1">
                          <IconBtn icon="edit" title="Edit" onClick={() => { setEditingCal(c); setShowCalModal(true) }} />
                          <IconBtn icon="delete" title="Delete" color={T.danger} onClick={() => setDeleteCal(c)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'maintenances' && (
        <Card pad={false}>
          {filteredMaintenances.length === 0 ? (
            <EmptyState icon="build" title="No maintenance records" sub="Create one to get started" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Instrument', 'Maintenance Date', 'Next Due', 'Type', 'Notes', ''].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMaintenances.map(m => (
                    <tr key={m.id}>
                      <td style={tdStyle}>{instrumentLabel(instruments, m.instrument)}</td>
                      <td style={tdStyle}>{fmtDate(m.maintenance_date)}</td>
                      <td style={tdStyle}>{fmtDate(m.next_due)}</td>
                      <td style={tdStyle}><StatusChip status={m.maintenance_type} /></td>
                      <td style={{ ...tdStyle, maxWidth: 220 }} className="truncate">{m.notes || '—'}</td>
                      <td style={tdStyle}>
                        <div className="flex items-center gap-1">
                          <IconBtn icon="edit" title="Edit" onClick={() => { setEditingMaint(m); setShowMaintModal(true) }} />
                          <IconBtn icon="delete" title="Delete" color={T.danger} onClick={() => setDeleteMaint(m)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'runs' && (
        <Card pad={false}>
          {filteredRuns.length === 0 ? (
            <EmptyState icon="play_circle" title="No run records" sub="Create one to get started" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Instrument', 'Run Date', 'Notes', ''].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map(r => (
                    <tr key={r.id}>
                      <td style={tdStyle}>{instrumentLabel(instruments, r.instrument)}</td>
                      <td style={tdStyle}>{fmtDate(r.run_date)}</td>
                      <td style={{ ...tdStyle, maxWidth: 300 }} className="truncate">{r.notes || '—'}</td>
                      <td style={tdStyle}>
                        <div className="flex items-center gap-1">
                          <IconBtn icon="edit" title="Edit" onClick={() => { setEditingRun(r); setShowRunModal(true) }} />
                          <IconBtn icon="delete" title="Delete" color={T.danger} onClick={() => setDeleteRun(r)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'imports' && (
        <Card pad={false}>
          {filteredImports.length === 0 ? (
            <EmptyState icon="upload_file" title="No import records" sub="Upload a result file to get started" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Instrument', 'Format', 'Status', 'Created', ''].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredImports.map(i => (
                    <tr key={i.id}>
                      <td style={tdStyle}>{instrumentLabel(instruments, i.instrument)}</td>
                      <td style={tdStyle}>{i.file_format.toUpperCase()}</td>
                      <td style={tdStyle}><StatusChip status={i.status} /></td>
                      <td style={tdStyle}>{fmtDate(i.created_at)}</td>
                      <td style={tdStyle}>
                        <div className="flex items-center gap-1">
                          {i.status !== 'processed' && (
                            <IconBtn icon="play_arrow" title="Process" onClick={() => processImport(i)} disabled={busy} />
                          )}
                          <IconBtn icon="delete" title="Delete" color={T.danger} onClick={() => setDeleteImport(i)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {showCalModal && (
        <CalibrationModal instruments={instruments} editing={editingCal}
          onClose={() => { setShowCalModal(false); setEditingCal(null) }}
          onDone={() => handleDone(editingCal ? 'Calibration updated.' : 'Calibration created.')} />
      )}
      {showMaintModal && (
        <MaintenanceModal instruments={instruments} editing={editingMaint}
          onClose={() => { setShowMaintModal(false); setEditingMaint(null) }}
          onDone={() => handleDone(editingMaint ? 'Maintenance updated.' : 'Maintenance created.')} />
      )}
      {showRunModal && (
        <RunModal instruments={instruments} editing={editingRun}
          onClose={() => { setShowRunModal(false); setEditingRun(null) }}
          onDone={() => handleDone(editingRun ? 'Run updated.' : 'Run created.')} />
      )}
      {showImportModal && (
        <ImportModal instruments={instruments}
          onClose={() => setShowImportModal(false)}
          onDone={() => handleDone('Import record created.')} />
      )}

      {deleteCal && (
        <ConfirmModal title="Delete Calibration Record" message={`Delete this calibration record for ${instrumentLabel(instruments, deleteCal.instrument)}? This cannot be undone.`}
          confirmLabel="Delete" danger onConfirm={confirmDeleteCal} onCancel={() => setDeleteCal(null)} />
      )}
      {deleteMaint && (
        <ConfirmModal title="Delete Maintenance Record" message={`Delete this maintenance record for ${instrumentLabel(instruments, deleteMaint.instrument)}? This cannot be undone.`}
          confirmLabel="Delete" danger onConfirm={confirmDeleteMaint} onCancel={() => setDeleteMaint(null)} />
      )}
      {deleteRun && (
        <ConfirmModal title="Delete Run Record" message={`Delete this run record for ${instrumentLabel(instruments, deleteRun.instrument)}? This cannot be undone.`}
          confirmLabel="Delete" danger onConfirm={confirmDeleteRun} onCancel={() => setDeleteRun(null)} />
      )}
      {deleteImport && (
        <ConfirmModal title="Delete Import Record" message={`Delete this import record for ${instrumentLabel(instruments, deleteImport.instrument)}? This cannot be undone.`}
          confirmLabel="Delete" danger onConfirm={confirmDeleteImport} onCancel={() => setDeleteImport(null)} />
      )}
    </div>
  )
}

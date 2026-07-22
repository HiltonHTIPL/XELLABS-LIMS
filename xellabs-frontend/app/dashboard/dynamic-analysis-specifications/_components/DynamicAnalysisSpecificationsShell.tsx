'use client'
import { useState, useActionState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createDynamicAnalysisSpecification,
  deleteDynamicAnalysisSpecification,
  type DynamicAnalysisSpecification,
  type DynamicSpecFormState,
} from '@/app/actions/dynamic-analysis-specifications'
import { ConfirmModal } from '@/app/dashboard/_components/ui'
import DataTable, { type DataTableColumn } from '../../_components/DataTable'

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
      {hint && <p className="mb-1" style={{ fontSize: 10, color: '#374151' }}>{hint}</p>}
      {children}
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

function NewDynamicSpecModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const createAction = async (prev: DynamicSpecFormState, fd: FormData) => {
    const result = await createDynamicAnalysisSpecification(prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const [state, action, pending] = useActionState(createAction, {})

  useEffect(() => {
    if (state.errors) {
      const fe: Record<string, string> = {}
      for (const [k, msgs] of Object.entries(state.errors)) { if (msgs?.length) fe[k] = msgs[0] }
      setFieldErrors(fe)
    }
  }, [state])

  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1000 }}>
      <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', right: 0, bottom: 'var(--dashboard-footer-h)', width: 480, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.15)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
              <MI name="add" size={16} color="#0154FC" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>New Dynamic Analysis Specification</h2>
              <p style={{ fontSize: 12, color: '#1F2937', fontWeight: 500 }}>Upload an Excel file of spec ranges</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#374151" /></button>
        </div>
        <form action={action} className="px-5 py-4 flex flex-col gap-3">
          <Field label="Title" required error={fieldErrors.name}>
            <input name="name" type="text" placeholder="e.g. Water Quality Ranges Q3"
              className="w-full px-3 py-2 text-xs rounded-lg outline-none"
              style={{ border: `1px solid ${fieldErrors.name ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }} />
          </Field>
          <Field label="Summary" hint="Used in item listings and search results.">
            <textarea name="summary" rows={2} placeholder="Optional summary"
              className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-none"
              style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
          </Field>
          <Field label="Specification File" required error={fieldErrors.file} hint="Only Excel files supported (.xlsx, .xls) — must have Keyword, min, max columns.">
            <input name="file" type="file" accept=".xlsx,.xls"
              className="w-full text-xs"
              style={{ color: '#111827' }} />
          </Field>
          {state.message && !state.success && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>{state.message}</p>
          )}
          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button type="button" onClick={onClose} disabled={pending}
              style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className="flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}>
              <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
              {pending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function DynamicAnalysisSpecificationsShell({ initialSpecs }: {
  initialSpecs: DynamicAnalysisSpecification[]
}) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting] = useState<DynamicAnalysisSpecification | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [busy, startTransition] = useTransition()

  function openCreate() { setShowModal(true) }
  function closeModal() { setShowModal(false) }
  function handleDone() {
    setToast({ ok: true, msg: 'Dynamic analysis specification created.' })
    setTimeout(() => setToast(null), 4000)
    router.refresh()
  }
  function confirmDelete() {
    if (!deleting) return
    const target = deleting
    startTransition(async () => {
      const r = await deleteDynamicAnalysisSpecification(target.id)
      setToast({ ok: r.success, msg: r.message })
      setTimeout(() => setToast(null), 3000)
      setDeleting(null)
      if (r.success) router.refresh()
    })
  }

  const columns: DataTableColumn<DynamicAnalysisSpecification>[] = [
    {
      id: 'name', label: 'Title', sortable: true, minWidth: 220,
      render: s => (
        <span className="text-xs font-medium" style={{ color: '#111827' }}>
          {s.file
            ? <a href={s.file} target="_blank" rel="noopener noreferrer" style={{ color: '#0154FC' }}>{s.name}</a>
            : s.name}
        </span>
      ),
    },
    {
      id: 'summary', label: 'Summary', sortable: true, minWidth: 240,
      render: s => <span className="text-xs" style={{ color: '#374151' }}>{s.summary || '—'}</span>,
    },
    {
      id: 'created_at', label: 'Created', sortable: true, minWidth: 130,
      render: s => <span className="text-xs" style={{ color: '#374151' }}>{new Date(s.created_at).toLocaleDateString()}</span>,
    },
    {
      id: 'is_active', label: 'Status', sortable: true, minWidth: 120,
      render: s => (
        <span className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, color: s.is_active ? '#0154FC' : '#374151' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: s.is_active ? '#0154FC' : '#374151', display: 'inline-block' }} />
          {s.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ]

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-5" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="arrow_back" size={16} color="#374151" />
          </Link>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Dynamic Analysis Specifications</h1>
            <p className="mt-1" style={{ fontSize: 13, color: '#374151' }}>Upload Excel-based spec ranges — link them from a regular Specification</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#2563EB', border: 'none', cursor: 'pointer' }}>
          <MI name="add" size={15} color="#fff" /> New Dynamic Specification
        </button>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? '#0154FC' : '#991B1B', flexShrink: 0 }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {showModal && <NewDynamicSpecModal onClose={closeModal} onDone={handleDone} />}
      {deleting && (
        <ConfirmModal
          title="Delete Dynamic Analysis Specification"
          message={`Delete "${deleting.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {initialSpecs.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2', borderRadius: 14 }}>
          <MI name="dynamic_feed" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#374151' }}>No dynamic analysis specifications yet</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Dynamic Specification
          </button>
        </div>
      ) : (
        <DataTable<DynamicAnalysisSpecification>
          data={initialSpecs}
          columns={columns}
          searchable
          persistKey="dynamic-analysis-specifications"
          emptyMessage="No dynamic analysis specifications found."
          rowActions={s => (
            <button onClick={() => setDeleting(s)} disabled={busy} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
              <MI name="delete" size={14} color="#EF4444" />
            </button>
          )}
        />
      )}
      </div>
    </div>
  )
}

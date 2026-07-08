'use client'
import { useState, useMemo, useActionState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  createTask, updateTask, updateTaskStatus, deleteTask, assignTask,
  type Task, type TaskAssignment, type TaskFormState,
} from '@/app/actions/tasks'
import type { StaffUser } from '@/app/actions/users'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const PRIORITY_LABEL: Record<Task['priority'], string> = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' }
const PRIORITY_COLOR: Record<Task['priority'], { bg: string; text: string }> = {
  low: { bg: '#F3F4F6', text: '#4B5563' },
  normal: { bg: '#EFF6FF', text: '#2563EB' },
  high: { bg: '#FFF7ED', text: '#EA580C' },
  urgent: { bg: '#FEF2F2', text: '#DC2626' },
}
const STATUS_LABEL: Record<Task['status'], string> = { open: 'Open', in_progress: 'In Progress', done: 'Done', cancelled: 'Cancelled' }
const STATUS_COLOR: Record<Task['status'], { bg: string; text: string }> = {
  open: { bg: '#F3F4F6', text: '#4B5563' },
  in_progress: { bg: '#EFF6FF', text: '#2563EB' },
  done: { bg: '#ECFDF5', text: '#059669' },
  cancelled: { bg: '#FEF2F2', text: '#DC2626' },
}

function isOverdue(t: Task): boolean {
  if (!t.due_date) return false
  if (t.status === 'done' || t.status === 'cancelled') return false
  return new Date(t.due_date).getTime() < Date.now()
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatCard({ icon, iconColor, iconBg, label, value }: { icon: string; iconColor: string; iconBg: string; label: string; value: number }) {
  return (
    <div className="bg-white p-4" style={{ border: '1px solid #E8EAF2', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center shrink-0" style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: iconBg }}>
          <MI name={icon} size={20} color={iconColor} />
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>{label}</p>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#14265E' }}>{value}</span>
        </div>
      </div>
    </div>
  )
}

function Field({ label, name, placeholder, required, error, defaultValue, as, options, type, onClearError }: {
  label: string; name: string; placeholder?: string; required?: boolean
  error?: string; defaultValue?: string; as?: 'textarea' | 'select'; type?: string
  options?: { value: string; label: string }[]; onClearError?: () => void
}) {
  const base = 'w-full px-3 py-2 text-xs rounded-lg outline-none'
  const border = { border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}`, color: '#111827' }
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      {as === 'textarea' ? (
        <textarea name={name} rows={3} placeholder={placeholder} defaultValue={defaultValue} onChange={onClearError} className={base + ' resize-none'} style={border} />
      ) : as === 'select' ? (
        <select name={name} defaultValue={defaultValue} onChange={onClearError} className={base} style={border}>
          {options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input name={name} type={type ?? 'text'} placeholder={placeholder} required={required} defaultValue={defaultValue} onChange={onClearError} className={base} style={border} />
      )}
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function TaskModal({ editing, users, onClose, onDone }: {
  editing: Task | null; users: StaffUser[]; onClose: () => void; onDone: () => void
}) {
  const isEdit = editing !== null
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const createAction = async (prev: TaskFormState, fd: FormData) => {
    const result = await createTask(prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const editAction = async (prev: TaskFormState, fd: FormData) => {
    const result = await updateTask(editing!.id, prev, fd)
    if (result.success) { onDone(); onClose() }
    return result
  }
  const [state, action, pending] = useActionState(isEdit ? editAction : createAction, {})
  useEffect(() => {
    if (state.errors) {
      const fe: Record<string, string> = {}
      for (const [k, msgs] of Object.entries(state.errors)) { if (msgs?.length) fe[k] = msgs[0] }
      setFieldErrors(fe)
    }
  }, [state])

  return (
    <div onClick={e => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEdit ? '#EFF6FF' : '#DBEAFE' }}>
              <MI name={isEdit ? 'edit' : 'add'} size={16} color={isEdit ? '#2563EB' : '#0154FC'} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEdit ? `Edit — ${editing!.title}` : 'New Task'}</h2>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>{isEdit ? 'Update task details' : 'Create and assign a new task'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
        </div>
        <form action={action} className="px-5 py-4 flex flex-col gap-3">
          <Field label="Title" name="title" placeholder="e.g. Calibrate HPLC-01" required error={fieldErrors.title} defaultValue={editing?.title}
            onClearError={() => setFieldErrors(p => { const n = { ...p }; delete n.title; return n })} />
          <Field label="Description" name="description" as="textarea" placeholder="Describe this task…" defaultValue={editing?.description} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority" name="priority" as="select" defaultValue={editing?.priority ?? 'normal'}
              options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]} />
            <Field label="Due Date" name="due_date" type="datetime-local" defaultValue={toDatetimeLocal(editing?.due_date ?? null)} />
          </div>
          <Field label="Assign To" name="assigned_to" as="select"
            options={[{ value: '', label: '— Unassigned —' }, ...users.map(u => ({ value: String(u.id), label: u.full_name || u.username }))]} />
          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
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
          {state.message && !state.success && (
            <p className="text-xs" style={{ color: '#DC2626' }}>{state.message}</p>
          )}
        </form>
      </div>
    </div>
  )
}

function ConfirmModal({ title, message, onConfirm, onCancel }: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div onClick={e => { if (e.currentTarget === e.target) onCancel() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="px-5 pt-5 pb-4">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#14265E' }}>{title}</h3>
          <p className="mt-2" style={{ fontSize: 13.5, color: '#6B7280', lineHeight: 1.5 }}>{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button onClick={onCancel} style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 10, border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 10, border: 'none', color: '#fff', backgroundColor: '#DC2626', cursor: 'pointer' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

export default function TasksShell({ initialTasks, initialAssignments, users }: {
  initialTasks: Task[]; initialAssignments: TaskAssignment[]; users: StaffUser[]
}) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [busy, startTransition] = useTransition()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('')

  const userById = useMemo(() => new Map(users.map(u => [u.id, u])), [users])
  const assignmentsByTask = useMemo(() => {
    const m = new Map<number, TaskAssignment[]>()
    for (const a of initialAssignments) {
      const list = m.get(a.task) ?? []
      list.push(a)
      m.set(a.task, list)
    }
    return m
  }, [initialAssignments])

  const stats = useMemo(() => ({
    open: initialTasks.filter(t => t.status === 'open').length,
    in_progress: initialTasks.filter(t => t.status === 'in_progress').length,
    done: initialTasks.filter(t => t.status === 'done').length,
    overdue: initialTasks.filter(isOverdue).length,
  }), [initialTasks])

  const filtered = useMemo(() => initialTasks.filter(t => {
    if (statusFilter && t.status !== statusFilter) return false
    if (priorityFilter && t.priority !== priorityFilter) return false
    if (assigneeFilter) {
      const list = assignmentsByTask.get(t.id) ?? []
      if (!list.some(a => String(a.assigned_to) === assigneeFilter)) return false
    }
    return true
  }), [initialTasks, statusFilter, priorityFilter, assigneeFilter, assignmentsByTask])

  function openCreate() { setEditing(null); setShowModal(true) }
  function openEdit(t: Task) { setEditing(t); setShowModal(true) }
  function closeModal() { setShowModal(false); setEditing(null) }
  function handleDone() {
    setToast({ ok: true, msg: editing ? 'Task updated.' : 'Task created.' })
    setTimeout(() => setToast(null), 4000)
    router.refresh()
  }

  function markComplete(t: Task) {
    startTransition(async () => {
      const r = await updateTaskStatus(t.id, 'done')
      setToast({ ok: r.success, msg: r.message })
      setTimeout(() => setToast(null), 3000)
      if (r.success) router.refresh()
    })
  }

  function changeStatus(t: Task, status: Task['status']) {
    startTransition(async () => {
      const r = await updateTaskStatus(t.id, status)
      setToast({ ok: r.success, msg: r.message })
      setTimeout(() => setToast(null), 3000)
      if (r.success) router.refresh()
    })
  }

  function confirmDelete() {
    if (!deleting) return
    const t = deleting
    startTransition(async () => {
      const r = await deleteTask(t.id)
      setToast({ ok: r.success, msg: r.message })
      setTimeout(() => setToast(null), 3000)
      setDeleting(null)
      if (r.success) router.refresh()
    })
  }

  function quickAssign(t: Task, userId: string) {
    if (!userId) return
    startTransition(async () => {
      const r = await assignTask(t.id, Number(userId))
      setToast({ ok: r.success, msg: r.message })
      setTimeout(() => setToast(null), 3000)
      if (r.success) router.refresh()
    })
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Task Management</h1>
          <p className="mt-1" style={{ fontSize: 13, color: '#6B7280' }}>Create, assign, and track laboratory tasks</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#2563EB', border: 'none', cursor: 'pointer' }}>
          <MI name="add" size={15} color="#fff" /> New Task
        </button>
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatCard icon="radio_button_unchecked" iconColor="#4B5563" iconBg="#F3F4F6" label="Open" value={stats.open} />
        <StatCard icon="autorenew" iconColor="#2563EB" iconBg="#EFF6FF" label="In Progress" value={stats.in_progress} />
        <StatCard icon="check_circle" iconColor="#059669" iconBg="#ECFDF5" label="Completed" value={stats.done} />
        <StatCard icon="warning_amber" iconColor="#DC2626" iconBg="#FEF2F2" label="Overdue" value={stats.overdue} />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-xs px-3 py-2 rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#374151' }}>
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="text-xs px-3 py-2 rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#374151' }}>
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} className="text-xs px-3 py-2 rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#374151' }}>
          <option value="">All Assignees</option>
          {users.map(u => <option key={u.id} value={String(u.id)}>{u.full_name || u.username}</option>)}
        </select>
      </div>

      {showModal && <TaskModal editing={editing} users={users} onClose={closeModal} onDone={handleDone} />}
      {deleting && (
        <ConfirmModal
          title="Delete Task"
          message={`Are you sure you want to delete "${deleting.title}"? This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2', borderRadius: 14 }}>
          <MI name="checklist" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No tasks found</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC', border: 'none', cursor: 'pointer' }}>
            <MI name="add" size={13} color="#fff" /> New Task
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
                  {['Title', 'Priority', 'Status', 'Due Date', 'Assigned To', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left uppercase tracking-wide" style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const pc = PRIORITY_COLOR[t.priority]
                  const sc = STATUS_COLOR[t.status]
                  const overdue = isOverdue(t)
                  const assignments = assignmentsByTask.get(t.id) ?? []
                  return (
                    <tr key={t.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F9FAFB' : 'none' }} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5" style={{ maxWidth: 260 }}>
                        <p className="text-xs font-medium" style={{ color: '#111827' }}>{t.title}</p>
                        {t.description && <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{t.description}</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: pc.bg, color: pc.text }}>{PRIORITY_LABEL[t.priority]}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <select value={t.status} onChange={e => changeStatus(t, e.target.value as Task['status'])} disabled={busy}
                          className="text-xs px-2 py-1 rounded-full font-semibold outline-none" style={{ backgroundColor: sc.bg, color: sc.text, border: 'none', cursor: 'pointer' }}>
                          <option value="open">{STATUS_LABEL.open}</option>
                          <option value="in_progress">{STATUS_LABEL.in_progress}</option>
                          <option value="done">{STATUS_LABEL.done}</option>
                          <option value="cancelled">{STATUS_LABEL.cancelled}</option>
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: overdue ? '#DC2626' : '#6B7280', fontWeight: overdue ? 700 : 400 }}>
                        {fmtDate(t.due_date)}{overdue && ' (overdue)'}
                      </td>
                      <td className="px-3 py-2.5">
                        {assignments.length === 0 ? (
                          <select defaultValue="" onChange={e => quickAssign(t, e.target.value)} disabled={busy}
                            className="text-xs px-2 py-1 rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#6B7280' }}>
                            <option value="">Assign…</option>
                            {users.map(u => <option key={u.id} value={String(u.id)}>{u.full_name || u.username}</option>)}
                          </select>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {assignments.map(a => {
                              const u = userById.get(a.assigned_to)
                              return (
                                <span key={a.id} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F1F3F9', color: '#374151' }}>
                                  {u?.full_name || u?.username || `User #${a.assigned_to}`}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          {t.status !== 'done' && (
                            <button onClick={() => markComplete(t)} disabled={busy} title="Mark Complete"
                              className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                              <MI name="check_circle" size={16} color="#059669" />
                            </button>
                          )}
                          <button onClick={() => openEdit(t)} title="Edit"
                            className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                            <MI name="edit" size={14} color="#9CA3AF" />
                          </button>
                          <button onClick={() => setDeleting(t)} title="Delete"
                            className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                            <MI name="delete" size={14} color="#DC2626" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

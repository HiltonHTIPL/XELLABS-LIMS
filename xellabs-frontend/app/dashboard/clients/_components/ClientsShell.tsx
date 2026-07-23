'use client'
import { useState, useActionState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createSenaiteClient, updateSenaiteClient, toggleSenaiteClientActive, checkClientIdAvailable,
  type ClientFormState,
} from '@/app/actions/senaite-clients'
import { type SenaiteClientFull } from '@/app/lib/senaite'
import { StatCard, Pagination, EmptyState } from '@/app/dashboard/_components/ui'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

// ── Column config ─────────────────────────────────────────────────────────────
import DataTable, { type DataTableColumn } from '../../_components/DataTable'

const ALL_COLUMNS = [
  { key: 'client_id',   label: 'Client ID',       defaultVisible: true  },
  { key: 'name',        label: 'Client Name',     defaultVisible: true  },
  { key: 'contact',     label: 'Primary Contact', defaultVisible: true  },
  { key: 'phone',       label: 'Phone',           defaultVisible: true  },
  { key: 'email',       label: 'Email',           defaultVisible: true  },
  { key: 'status',      label: 'Status',          defaultVisible: true  },
  { key: 'tax_number',  label: 'Tax Number',      defaultVisible: false },
  { key: 'account_name', label: 'Account Name',   defaultVisible: false },
  { key: 'account_number', label: 'Account Number', defaultVisible: false },
  { key: 'physical_address', label: 'Physical Address', defaultVisible: false },
  { key: 'billing_address',  label: 'Billing Address',  defaultVisible: false },
] as const
type ColKey = typeof ALL_COLUMNS[number]['key']
const DEFAULT_VISIBLE = new Set<ColKey>(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
const COLS_LS_KEY = 'xl_clients_cols'
const SAVED_FILTERS_LS_KEY = 'xl_clients_saved_filters'

type ClientFilterSnapshot = { search: string; status: 'all' | 'active' | 'inactive'; contactsOnly: boolean }
type ClientSavedFilter = { name: string; filters: ClientFilterSnapshot }

type SortKey = 'name' | 'status'
type SortDir = 'asc' | 'desc'

function fmtAddress(a: { address: string; city: string; state: string; zip: string; country: string } | null): string {
  if (!a) return ''
  return [a.address, a.city, a.state, a.zip, a.country].filter(Boolean).join(', ')
}

function primaryContactNameOf(c: SenaiteClientFull): string {
  return [c.contact?.Salutation, c.contact?.Firstname, c.contact?.Surname].filter(Boolean).join(' ')
}

// Shared CSV export — used by both the toolbar "Export" (respects filters) and
// the bulk-actions "Export Selected" (only checked rows).
function exportClientsCsv(rows: SenaiteClientFull[], filenamePrefix: string) {
  const headers = ['Client ID', 'Client Name', 'Primary Contact', 'Phone', 'Email', 'Status']
  const csvRows = rows.map(c => [
    c.ClientID || '', c.title, primaryContactNameOf(c), c.Phone || '', c.EmailAddress || '',
    c.review_state === 'active' ? 'Active' : 'Inactive',
  ])
  const esc = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v)
  const csv = [headers.join(','), ...csvRows.map(r => r.map(esc).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

// ── Controlled field ──────────────────────────────────────────────────────────
function Field({ label, name, type = 'text', placeholder, required, error, as, value, onChange, onBlur }: {
  label: string; name: string; type?: string; placeholder?: string
  required?: boolean; error?: string; as?: 'textarea'
  value: string; onChange: (v: string) => void; onBlur?: (v: string) => void
}) {
  const base = 'w-full px-3 py-2 text-xs rounded-lg outline-none'
  const style = { border: `1px solid ${error ? '#FCA5A5' : '#D1D5DB'}`, color: '#111827' }
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      {as === 'textarea'
        ? <textarea name={name} rows={4} placeholder={placeholder} value={value}
            onChange={e => onChange(e.target.value)} onBlur={e => onBlur?.(e.target.value)} className={`${base} resize-none`} style={style} />
        // type="text" (not "email") — the browser's native email constraint
        // validation only surfaces at submit time via a blocking tooltip
        // ("Please enter a part following '@'"), which is exactly the
        // late/inline-elsewhere validation UX this was built to avoid. Format
        // checking instead runs onBlur below, showing the same inline error
        // style as every other field in this form.
        : <input name={name} type={type === 'email' ? 'text' : type} placeholder={placeholder} value={value}
            onChange={e => onChange(e.target.value)} onBlur={e => onBlur?.(e.target.value)} className={base} style={style} />}
      {error && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3">{children}</div>
}

// SENAITE-style "Copy from" — copies another address block's field values
// (street/city/state/zip/country) into this block's fields in one click.
function CopyFromMenu({ options, onCopy }: { options: { label: string; prefix: string }[]; onCopy: (prefix: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  if (!options.length) return null
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
        style={{ border: '1px solid #BFDBFE', color: '#2563EB', background: '#fff', cursor: 'pointer' }}>
        <MI name="content_copy" size={12} color="#2563EB" /> Copy from
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 20, backgroundColor: '#fff', border: '1px solid #E8EAF2', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 150, padding: '4px 0' }}>
          {options.map(o => (
            <button key={o.prefix} type="button" onClick={() => { onCopy(o.prefix); setOpen(false) }}
              className="flex items-center w-full px-3 py-1.5 text-xs hover:bg-gray-50" style={{ color: '#374151', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AddressBlock({ prefix, label, vals, set, copyOptions }: {
  prefix: string; label: string; vals: FV; set: (k: string, v: string) => void
  copyOptions?: { label: string; prefix: string }[]
}) {
  function copyFrom(sourcePrefix: string) {
    for (const suffix of ['street', 'city', 'state', 'zip', 'country']) {
      set(`${prefix}_${suffix}`, vals[`${sourcePrefix}_${suffix}`] ?? '')
    }
  }
  return (
    <div className="space-y-2.5 rounded-xl p-4" style={{ border: '1px solid #E8EAF2', backgroundColor: '#FAFAFA' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: '#374151' }}>{label}</p>
        <CopyFromMenu options={copyOptions ?? []} onCopy={copyFrom} />
      </div>
      <Field label="Street / Address" name={`${prefix}_street`} placeholder="123 Main Street" value={vals[`${prefix}_street`] ?? ''} onChange={v => set(`${prefix}_street`, v)} />
      <Row>
        <Field label="City" name={`${prefix}_city`} placeholder="City" value={vals[`${prefix}_city`] ?? ''} onChange={v => set(`${prefix}_city`, v)} />
        <Field label="State / Province" name={`${prefix}_state`} placeholder="State" value={vals[`${prefix}_state`] ?? ''} onChange={v => set(`${prefix}_state`, v)} />
      </Row>
      <Row>
        <Field label="ZIP / Postal" name={`${prefix}_zip`} placeholder="00000" value={vals[`${prefix}_zip`] ?? ''} onChange={v => set(`${prefix}_zip`, v)} />
        <Field label="Country" name={`${prefix}_country`} placeholder="Country" value={vals[`${prefix}_country`] ?? ''} onChange={v => set(`${prefix}_country`, v)} />
      </Row>
    </div>
  )
}

const STEPS = [
  { label: 'Basic Info', icon: 'business' },
  { label: 'Contact', icon: 'person' },
  { label: 'Addresses', icon: 'location_on' },
  { label: 'Financial', icon: 'account_balance' },
  { label: 'Notes', icon: 'notes' },
] as const

function StepBar({ step, onStepClick }: { step: number; onStepClick?: (i: number) => void }) {
  // Clickable only when editing (onStepClick passed) — matches SENAITE: an
  // existing object's tabs are freely navigable, but the one-pass Create
  // wizard only moves forward via Next, tab-by-tab.
  return (
    <div className="flex items-center gap-0 mb-5">
      {STEPS.map((s, i) => {
        const done = i < step; const active = i === step; const isLast = i === STEPS.length - 1
        const content = (
          <>
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: done ? '#0154FC' : active ? '#DBEAFE' : '#F3F4F6', border: (active || done) ? '2px solid #0154FC' : '2px solid #E5E7EB' }}>
              {done ? <MI name="check" size={14} color="#fff" /> : <MI name={s.icon} size={13} color={active ? '#0154FC' : '#9CA3AF'} />}
            </div>
            <span className="mt-1 text-center" style={{ fontSize: 9, fontWeight: active ? 600 : 400, color: (active || done) ? '#0154FC' : '#9CA3AF', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{s.label}</span>
          </>
        )
        return (
          <div key={s.label} className="flex items-center flex-1">
            {onStepClick ? (
              <button type="button" onClick={() => onStepClick(i)} className="flex flex-col items-center"
                style={{ minWidth: 56, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                {content}
              </button>
            ) : (
              <div className="flex flex-col items-center" style={{ minWidth: 56 }}>{content}</div>
            )}
            {!isLast && <div className="flex-1 h-px mx-1 mb-4" style={{ backgroundColor: done ? '#0154FC' : '#E5E7EB' }} />}
          </div>
        )
      })}
    </div>
  )
}

type FV = Record<string, string>

function blankFV(): FV {
  return {
    name: '', client_id: '', email: '', phone: '', fax: '', tax_number: '',
    salutation: '', contact_first_name: '', contact_last_name: '', contact_email: '',
    contact_phone: '', contact_mobile: '', contact_fax: '', contact_job_title: '', contact_department: '',
    physical_street: '', physical_city: '', physical_state: '', physical_zip: '', physical_country: '',
    postal_street: '', postal_city: '', postal_state: '', postal_zip: '', postal_country: '',
    billing_street: '', billing_city: '', billing_state: '', billing_zip: '', billing_country: '',
    account_name: '', account_number: '', account_type: '', bank_name: '', bank_branch: '',
    bulk_discount: '', member_discount: '', decimal_mark: '.', cc_emails: '', description: '',
  }
}

function clientToFV(c: SenaiteClientFull): FV {
  const phys = c.PhysicalAddress; const post = c.PostalAddress; const bill = c.BillingAddress
  const ct = c.contact
  return {
    name: c.title, client_id: c.ClientID, email: c.EmailAddress, phone: c.Phone, fax: c.Fax, tax_number: c.TaxNumber,
    salutation: ct?.Salutation ?? '', contact_first_name: ct?.Firstname ?? '', contact_last_name: ct?.Surname ?? '',
    contact_email: ct?.EmailAddress ?? '', contact_phone: ct?.BusinessPhone ?? '', contact_mobile: ct?.MobilePhone ?? '',
    contact_fax: ct?.Fax ?? '', contact_job_title: ct?.JobTitle ?? '', contact_department: ct?.Department ?? '',
    physical_street: phys?.address ?? '', physical_city: phys?.city ?? '', physical_state: phys?.state ?? '', physical_zip: phys?.zip ?? '', physical_country: phys?.country ?? '',
    postal_street: post?.address ?? '', postal_city: post?.city ?? '', postal_state: post?.state ?? '', postal_zip: post?.zip ?? '', postal_country: post?.country ?? '',
    billing_street: bill?.address ?? '', billing_city: bill?.city ?? '', billing_state: bill?.state ?? '', billing_zip: bill?.zip ?? '', billing_country: bill?.country ?? '',
    account_name: c.AccountName, account_number: c.AccountNumber, account_type: c.AccountType,
    bank_name: c.BankName, bank_branch: c.BankBranch,
    bulk_discount: c.BulkDiscount ? 'true' : '', member_discount: c.MemberDiscountApplies ? 'true' : '',
    decimal_mark: c.DecimalMark || '.', cc_emails: c.CCEmails, description: c.description,
  }
}

// ── Row actions menu ────────────────────────────────────────────────────────
function ActionsMenu({ client, onEdit, onDone }: { client: SenaiteClientFull; onEdit: (c: SenaiteClientFull) => void; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, startTransition] = useTransition()
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node) &&
          menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleOpen() {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setOpen(o => !o)
  }

  function toggle() {
    startTransition(async () => {
      await toggleSenaiteClientActive(client.uid, client.review_state !== 'active')
      onDone()
    })
    setOpen(false)
  }

  const isActive = client.review_state === 'active'
  return (
    <div style={{ display: 'inline-block' }}>
      <button ref={btnRef} onClick={handleOpen} disabled={busy} className="p-1 rounded hover:bg-gray-100" style={{ cursor: 'pointer', border: 'none', background: 'none' }}>
        <span className="material-icons" style={{ fontSize: 16, color: '#9CA3AF', lineHeight: 1 }}>more_vert</span>
      </button>
      {open && menuPos && (
        <div ref={menuRef} style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999, backgroundColor: '#fff', border: '1px solid #E8EAF2', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 170, padding: '4px 0' }}>
          <Link href={`/dashboard/clients/${client.uid}`} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50" style={{ color: '#374151', textDecoration: 'none' }} onClick={() => setOpen(false)}>
            <span className="material-icons" style={{ fontSize: 14, color: '#6B7280' }}>visibility</span>View Details
          </Link>
          <button onClick={() => { setOpen(false); onEdit(client) }} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50" style={{ color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <span className="material-icons" style={{ fontSize: 14, color: '#2563EB' }}>edit</span>Edit Client
          </button>
          <div style={{ borderTop: '1px solid #F3F4F6', margin: '2px 0' }} />
          <button onClick={toggle} disabled={busy} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50"
            style={{ color: isActive ? '#DC2626' : '#0154FC', background: 'none', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', textAlign: 'left' }}>
            <span className="material-icons" style={{ fontSize: 14 }}>{isActive ? 'block' : 'check_circle'}</span>
            {busy ? 'Updating…' : isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function ClientsShell({ initialClients }: { initialClients: SenaiteClientFull[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [step, setStep] = useState(0)
  const [editing, setEditing] = useState<SenaiteClientFull | null>(null)
  // Identity captured after the FIRST successful save of a brand-new client —
  // matches SENAITE's own progressive-save behavior: saving on an earlier tab
  // actually creates the record right then, and every subsequent tab save
  // updates that same record instead of creating a duplicate. Kept separate
  // from `editing` so button labels (Save Changes vs Create) still reflect
  // whether the drawer was opened via "New Client" vs "Edit".
  const [sessionIdentity, setSessionIdentity] = useState<{ uid: string; path: string; contactUid?: string } | null>(null)
  const [vals, setVals] = useState<FV>(blankFV)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [clientIdCheck, setClientIdCheck] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [contactsOnly, setContactsOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, startRefresh] = useTransition()
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  // ── Sorting ──
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  // ── Column chooser ──
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(() => {
    if (typeof window === 'undefined') return DEFAULT_VISIBLE
    try {
      const saved = localStorage.getItem(COLS_LS_KEY)
      if (saved) return new Set(JSON.parse(saved) as ColKey[])
    } catch { /* ignore */ }
    return DEFAULT_VISIBLE
  })
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const [colMenuPos, setColMenuPos] = useState<{ top: number; right: number } | null>(null)
  const colBtnRef = useRef<HTMLButtonElement>(null)
  function openColMenu() {
    const rect = colBtnRef.current!.getBoundingClientRect()
    setColMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setColMenuOpen(o => !o)
  }
  function toggleCol(key: ColKey) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      try { localStorage.setItem(COLS_LS_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }
  const vis = (key: ColKey) => visibleCols.has(key)

  // ── Saved filters ──
  const [savedFilters, setSavedFilters] = useState<ClientSavedFilter[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(SAVED_FILTERS_LS_KEY)
      return raw ? (JSON.parse(raw) as ClientSavedFilter[]) : []
    } catch { return [] }
  })
  const [savedFiltersOpen, setSavedFiltersOpen] = useState(false)
  const [savedFiltersPos, setSavedFiltersPos] = useState<{ top: number; right: number } | null>(null)
  const savedFiltersBtnRef = useRef<HTMLButtonElement>(null)
  // Slot the shared DataTable portals its layout controls (Reset layout + Views) into.
  const tableControlsRef = useRef<HTMLDivElement>(null)
  const [saveFilterModalOpen, setSaveFilterModalOpen] = useState(false)
  const [newFilterName, setNewFilterName] = useState('')

  function persistSavedFilters(next: ClientSavedFilter[]) {
    setSavedFilters(next)
    try { localStorage.setItem(SAVED_FILTERS_LS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }
  function openSavedFilters() {
    const rect = savedFiltersBtnRef.current!.getBoundingClientRect()
    setSavedFiltersPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setSavedFiltersOpen(o => !o)
  }
  function saveCurrentFilters() { setNewFilterName(''); setSaveFilterModalOpen(true) }
  function confirmSaveFilter() {
    const name = newFilterName.trim()
    if (!name) return
    const snapshot: ClientFilterSnapshot = { search, status: statusFilter, contactsOnly }
    const next = [...savedFilters.filter(f => f.name !== name), { name, filters: snapshot }]
    persistSavedFilters(next)
    setSaveFilterModalOpen(false)
    setSavedFiltersOpen(false)
  }
  function applySavedFilter(f: ClientSavedFilter) {
    setSearch(f.filters.search); setStatusFilter(f.filters.status); setContactsOnly(f.filters.contactsOnly)
    setPage(1)
    setSavedFiltersOpen(false)
  }
  function deleteSavedFilter(name: string) { persistSavedFilters(savedFilters.filter(f => f.name !== name)) }

  // ── Bulk actions ──
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false)
  const [bulkMenuPos, setBulkMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [bulkPending, setBulkPending] = useState(false)
  const bulkBtnRef = useRef<HTMLButtonElement>(null)
  function toggleRow(uid: string) {
    setSelected(prev => { const n = new Set(prev); n.has(uid) ? n.delete(uid) : n.add(uid); return n })
  }
  function openBulkMenu() {
    if (selected.size === 0) return
    const rect = bulkBtnRef.current!.getBoundingClientRect()
    setBulkMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setBulkMenuOpen(o => !o)
  }
  async function runBulkActivate(active: boolean) {
    setBulkPending(true)
    setBulkMenuOpen(false)
    try {
      await Promise.all([...selected].map(uid => toggleSenaiteClientActive(uid, active)))
      setSelected(new Set())
      router.refresh()
      showToast(true, `${active ? 'Activated' : 'Deactivated'} ${selected.size} client${selected.size !== 1 ? 's' : ''}.`)
    } finally {
      setBulkPending(false)
    }
  }
  function handleExportSelected() {
    exportClientsCsv(initialClients.filter(c => selected.has(c.uid)), 'clients-selected')
  }

  useEffect(() => { setLastUpdated(new Date()) }, [initialClients])

  const primaryContactName = primaryContactNameOf

  const filteredUnsorted = initialClients.filter(c => {
    const active = c.review_state === 'active'
    if (statusFilter === 'active' && !active) return false
    if (statusFilter === 'inactive' && active) return false
    if (contactsOnly && !(c.contact && (c.contact.Firstname || c.contact.Surname))) return false
    if (search) {
      const needle = search.toLowerCase()
      const hay = [c.title, c.ClientID, primaryContactName(c), c.EmailAddress].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })

  const filtered = sortKey
    ? [...filteredUnsorted].sort((a, b) => {
        const av = sortKey === 'name' ? a.title.toLowerCase() : a.review_state
        const bv = sortKey === 'name' ? b.title.toLowerCase() : b.review_state
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return sortDir === 'asc' ? cmp : -cmp
      })
    : filteredUnsorted

  const total = initialClients.length
  const activeCount = initialClients.filter(c => c.review_state === 'active').length
  const inactiveCount = total - activeCount
  const contactsCount = initialClients.filter(c => c.contact && (c.contact.Firstname || c.contact.Surname)).length
  // A filter is "active" only if something is actually set — used to stop users
  // saving an empty (no-op) filter that would look broken when applied.
  const hasActiveFilter = search.trim() !== '' || statusFilter !== 'all' || contactsOnly

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  function clearFilters() { setSearch(''); setStatusFilter('all'); setContactsOnly(false); setPage(1) }
  function handleRefresh() { startRefresh(() => { router.refresh(); setLastUpdated(new Date()) }) }

  // Export to CSV — respects the currently-applied search/status/contacts filters
  function handleExport() { exportClientsCsv(filtered, 'clients') }
  function showToast(ok: boolean, msg: string) { setToast({ ok, msg }); setTimeout(() => setToast(null), 4000) }

  function setVal(k: string, v: string) {
    setVals(prev => ({ ...prev, [k]: v }))
    if (fieldErrors[k]) setFieldErrors(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  const [, action, pending] = useActionState(
    async (prev: ClientFormState, fd: FormData) => {
      const identity = editing
        ? { uid: editing.uid, path: editing.path, contactUid: editing.contact?.uid }
        : sessionIdentity
      const result = identity
        ? await updateSenaiteClient(identity.uid, identity.path, identity.contactUid ?? null, prev, fd)
        : await createSenaiteClient(prev, fd)
      if (result.success) {
        const wasLastStep = step === STEPS.length - 1
        if (!editing && result.uid && result.path) {
          // First successful save of a brand-new client — remember its
          // identity so every save from here on updates this same record.
          setSessionIdentity({ uid: result.uid, path: result.path, contactUid: result.contactUid })
        }
        if (wasLastStep) {
          setShowForm(false); setStep(0); setEditing(null); setVals(blankFV()); setFieldErrors({}); setSessionIdentity(null)
          showToast(true, result.message ?? 'Saved.')
        } else {
          // Progressive save, SENAITE-style: persist what's filled in so far
          // and move to the next tab — the drawer stays open, nothing is lost.
          setStep(s => s + 1)
          showToast(true, result.message ?? 'Saved.')
        }
        router.refresh()
      } else if (result.errors) {
        const fe: Record<string, string> = {}
        for (const [k, msgs] of Object.entries(result.errors)) { if (msgs?.length) fe[k] = msgs[0] }
        setFieldErrors(fe)
        // Jump to whichever step actually owns the first errored field, instead
        // of always resetting to step 0 — the error must surface where the
        // field lives, not just on a step that may not even contain it.
        const step1Fields = ['name', 'client_id', 'email', 'phone', 'fax', 'tax_number']
        const step2Fields = ['salutation', 'contact_first_name', 'contact_last_name', 'contact_email', 'contact_phone', 'contact_mobile', 'contact_fax', 'contact_job_title', 'contact_department']
        const step4Fields = ['account_name', 'account_number', 'account_type', 'bank_name', 'bank_branch', 'bulk_discount', 'member_discount', 'decimal_mark']
        const errKeys = Object.keys(fe)
        if (errKeys.some(k => step1Fields.includes(k))) setStep(0)
        else if (errKeys.some(k => step2Fields.includes(k))) setStep(1)
        else if (errKeys.some(k => k.startsWith('physical_') || k.startsWith('postal_') || k.startsWith('billing_'))) setStep(2)
        else if (errKeys.some(k => step4Fields.includes(k))) setStep(3)
        else setStep(4)
      } else if (result.message) {
        showToast(false, result.message)
      }
      return result
    },
    {},
  )

  function openCreate() { setEditing(null); setSessionIdentity(null); setVals(blankFV()); setFieldErrors({}); setClientIdCheck('idle'); setStep(0); setShowForm(true) }
  function openEdit(c: SenaiteClientFull) { setEditing(c); setSessionIdentity(null); setVals(clientToFV(c)); setFieldErrors({}); setClientIdCheck('idle'); setStep(0); setShowForm(true) }
  function closeForm() { setShowForm(false); setStep(0); setEditing(null); setSessionIdentity(null); setFieldErrors({}); setClientIdCheck('idle') }

  const isFirst = step === 0
  const isLast = step === STEPS.length - 1
  const isEditing = editing !== null

  // Live duplicate check as the user leaves the Client ID field — SENAITE itself
  // does not enforce ClientID uniqueness (confirmed: it silently accepts a
  // duplicate), so this app owns the constraint and must catch it before the
  // user moves on, not just at final submit.
  async function handleClientIdBlur(value: string) {
    const trimmed = value.trim()
    if (!trimmed) { setClientIdCheck('idle'); return }
    setClientIdCheck('checking')
    const available = await checkClientIdAvailable(trimmed, editing?.uid)
    setClientIdCheck(available === false ? 'taken' : 'available')
    if (available === false) {
      setFieldErrors(prev => ({ ...prev, client_id: 'This Client ID is already in use — choose a different one.' }))
    }
  }

  function handleEmailBlur(field: 'email' | 'contact_email', value: string) {
    const trimmed = value.trim()
    setFieldErrors(prev => {
      const next = { ...prev }
      if (trimmed && !EMAIL_RE.test(trimmed)) next[field] = 'Enter a valid email address.'
      else delete next[field]
      return next
    })
  }


  // ── Adapt to shared DataTable ──────────────────────────────────────────────
  // Row adds `id` (uid) + one plain sortable value per column id. NOTE the
  // contact column's sort id is `contact_name`, NOT `contact` — `contact` is an
  // object field on SenaiteClientFull and must never be overwritten with a string.
  type ClientRow = SenaiteClientFull & {
    id: string; client_id: string; name: string; contact_name: string; phone: string
    email: string; status: string; tax_number: string; account_name: string
    account_number: string; physical_address: string; billing_address: string
  }
  const columnDefs: Record<ColKey, DataTableColumn<ClientRow>> = {
    client_id: {
      id: 'client_id', label: 'Client ID', sortable: true, minWidth: 120,
      render: c => <Link href={`/dashboard/samples-overview?client=${c.uid}`} className="font-mono text-xs font-medium" style={{ color: '#0154FC', textDecoration: 'none', whiteSpace: 'nowrap' }} title={`View samples logged under ${c.title}`}>{c.ClientID || '—'}</Link>,
    },
    name: {
      id: 'name', label: 'Client Name', sortable: true, minWidth: 200,
      render: c => (
        <Link href={`/dashboard/clients/${c.uid}`} className="flex items-center gap-2" title="View client details">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 10, backgroundColor: '#0154FC' }}>{c.title.slice(0, 1).toUpperCase()}</div>
          <span className="text-xs font-medium truncate" style={{ color: '#111827' }}>{c.title}</span>
        </Link>
      ),
    },
    contact: {
      id: 'contact_name', label: 'Primary Contact', sortable: true, minWidth: 160,
      render: c => <span className="text-xs" style={{ color: '#374151' }}>{primaryContactName(c) || '—'}</span>,
    },
    phone: {
      id: 'phone', label: 'Phone', sortable: true, minWidth: 130,
      render: c => <span className="text-xs" style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{c.Phone || '—'}</span>,
    },
    email: {
      id: 'email', label: 'Email', sortable: true, minWidth: 200,
      render: c => <span className="text-xs" style={{ color: '#6B7280' }}>{c.EmailAddress || '—'}</span>,
    },
    status: {
      id: 'status', label: 'Status', sortable: true, minWidth: 110,
      render: c => {
        const active = c.review_state === 'active'
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: active ? '#ECFDF5' : '#FFFBEB', color: active ? '#059669' : '#D97706' }}>{active ? 'Active' : 'Inactive'}</span>
      },
    },
    tax_number: {
      id: 'tax_number', label: 'Tax Number', sortable: true, minWidth: 130,
      render: c => <span className="text-xs" style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{c.TaxNumber || '—'}</span>,
    },
    account_name: {
      id: 'account_name', label: 'Account Name', sortable: true, minWidth: 160,
      render: c => <span className="text-xs" style={{ color: '#6B7280' }}>{c.AccountName || '—'}</span>,
    },
    account_number: {
      id: 'account_number', label: 'Account Number', sortable: true, minWidth: 150,
      render: c => <span className="text-xs" style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{c.AccountNumber || '—'}</span>,
    },
    physical_address: {
      id: 'physical_address', label: 'Physical Address', sortable: true, minWidth: 220,
      render: c => <span className="text-xs" style={{ color: '#6B7280' }} title={fmtAddress(c.PhysicalAddress)}>{fmtAddress(c.PhysicalAddress) || '—'}</span>,
    },
    billing_address: {
      id: 'billing_address', label: 'Billing Address', sortable: true, minWidth: 220,
      render: c => <span className="text-xs" style={{ color: '#6B7280' }} title={fmtAddress(c.BillingAddress)}>{fmtAddress(c.BillingAddress) || '—'}</span>,
    },
  }
  const columns: DataTableColumn<ClientRow>[] = ALL_COLUMNS.filter(col => vis(col.key)).map(col => columnDefs[col.key])
  const tableData: ClientRow[] = filtered.map(c => ({
    ...c,
    id: c.uid,
    client_id: c.ClientID || '',
    name: c.title,
    contact_name: primaryContactName(c),
    phone: c.Phone || '',
    email: c.EmailAddress || '',
    status: c.review_state,
    tax_number: c.TaxNumber || '',
    account_name: c.AccountName || '',
    account_number: c.AccountNumber || '',
    physical_address: fmtAddress(c.PhysicalAddress),
    billing_address: fmtAddress(c.BillingAddress),
  }))

  return (
    <div style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3" style={{ flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>Clients</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage all clients and their contact information.</p>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#9CA3AF' }}>
            Last updated: {lastUpdated.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            <button onClick={handleRefresh} disabled={refreshing} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: refreshing ? 'not-allowed' : 'pointer' }}>
              <MI name="refresh" size={14} color="#9CA3AF" />
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: toast.ok ? '#DBEAFE' : '#FEF2F2', border: toast.ok ? '1px solid #93C5FD' : '1px solid #FECACA', color: toast.ok ? '#0154FC' : '#991B1B' }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#0154FC' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* Stat cards — first 3 act as quick status filters */}
      <div className="grid grid-cols-4 gap-3 mb-2" style={{ flexShrink: 0 }}>
        <button onClick={() => { setStatusFilter('all'); setPage(1) }} className="text-left rounded-xl"
          style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0, outline: statusFilter === 'all' ? '2px solid #0154FC' : 'none' }}>
          <StatCard icon="groups" label="Total Clients" value={total} sub="All time" />
        </button>
        <button onClick={() => { setStatusFilter('active'); setPage(1) }} className="text-left rounded-xl"
          style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0, outline: statusFilter === 'active' ? '2px solid #059669' : 'none' }}>
          <StatCard icon="person" iconColor="#059669" iconBg="#ECFDF5" label="Active Clients" value={activeCount}
            sub={total ? `${((activeCount / total) * 100).toFixed(1)}% of total` : undefined} />
        </button>
        <button onClick={() => { setStatusFilter('inactive'); setPage(1) }} className="text-left rounded-xl"
          style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0, outline: statusFilter === 'inactive' ? '2px solid #D97706' : 'none' }}>
          <StatCard icon="person_off" iconColor="#D97706" iconBg="#FFFBEB" label="Inactive Clients" value={inactiveCount}
            sub={total ? `${((inactiveCount / total) * 100).toFixed(1)}% of total` : undefined} />
        </button>
        <button onClick={() => { setContactsOnly(v => !v); setPage(1) }} className="text-left rounded-xl"
          style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0, outline: contactsOnly ? '2px solid #7C3AED' : 'none' }}>
          <StatCard icon="contact_page" iconColor="#7C3AED" iconBg="#F5F3FF" label="Contacts" value={contactsCount} sub={contactsOnly ? 'Showing clients with contacts' : 'Across all clients'} />
        </button>
      </div>

      {/* Filter bar — bottom-aligned (items-end), not centered: Status/Export/
          Columns/Saved Filters each sit under a label (even an invisible one,
          for height-matching) while Search has none, so center-alignment made
          the buttons visibly sit lower than the search box. */}
      <div className="flex items-end gap-2 mb-3 flex-wrap" style={{ flexShrink: 0 }}>
        <div className="relative" style={{ flex: 1, minWidth: 260, maxWidth: 420 }}>
          <span className="absolute" style={{ left: 10, top: '50%', transform: 'translateY(-50%)' }}>
            <MI name="search" size={16} color="#9CA3AF" />
          </span>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search clients by name, ID, contact or email…"
            style={{ width: '100%', height: 36, borderRadius: 10, border: '1px solid #D1D5DB', fontSize: 13, padding: '0 12px 0 32px', outline: 'none' }} />
        </div>
        <div>
          <label className="block" style={{ fontSize: 10, color: 'transparent' }}>Status</label>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as 'all' | 'active' | 'inactive'); setPage(1) }}
            style={{ height: 36, borderRadius: 10, border: '1px solid #D1D5DB', fontSize: 13, padding: '0 10px', outline: 'none', color: '#374151' }}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className="block" style={{ fontSize: 10, color: 'transparent' }}>Export</label>
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium"
            style={{ height: 36, border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
            <MI name="download" size={14} color="#374151" /> Export
          </button>
        </div>
        <div>
          <label className="block" style={{ fontSize: 10, color: 'transparent' }}>Columns</label>
          <button ref={colBtnRef} onClick={openColMenu} className="flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium"
            style={{ height: 36, border: '1px solid #D1D5DB', color: '#374151', backgroundColor: colMenuOpen ? '#F3F4F6' : '#fff', cursor: 'pointer' }}>
            <MI name="view_column" size={14} color="#374151" /> Columns
          </button>
        </div>
        <div>
          <label className="block" style={{ fontSize: 10, color: 'transparent' }}>Saved Filters</label>
          <button ref={savedFiltersBtnRef} onClick={openSavedFilters} className="flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium"
            style={{ height: 36, border: '1px solid #D1D5DB', color: '#374151', backgroundColor: savedFiltersOpen ? '#F3F4F6' : '#fff', cursor: 'pointer' }}>
            <MI name="filter_list" size={14} color="#374151" /> Saved Filters
          </button>
        </div>
        {/* Slot for the DataTable's Reset layout + Views controls (portaled in). */}
        <div ref={tableControlsRef} className="flex items-center gap-2" style={{ height: 36 }} />
        {selected.size > 0 && (
          <div>
            <label className="block" style={{ fontSize: 10, color: 'transparent' }}>Bulk</label>
            <button ref={bulkBtnRef} onClick={openBulkMenu} disabled={bulkPending} className="flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium"
              style={{ height: 36, border: '1px solid #D1D5DB', color: '#374151', backgroundColor: bulkMenuOpen ? '#F3F4F6' : '#fff', cursor: bulkPending ? 'not-allowed' : 'pointer', opacity: bulkPending ? 0.6 : 1 }}>
              <MI name="checklist" size={14} color="#374151" /> Bulk Actions ({selected.size})
            </button>
          </div>
        )}
        <div className="flex-1" />
        <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium"
          style={{ height: 36, border: '1px solid #D1D5DB', color: '#374151', backgroundColor: '#fff' }}>
          Clear Filters
        </button>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium text-white" style={{ height: 36, backgroundColor: '#0154FC' }}>
          <MI name="add" size={14} color="#fff" /> New Client
        </button>
      </div>

      {/* ── Column chooser dropdown ── */}
      {colMenuOpen && colMenuPos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9990 }} onClick={() => setColMenuOpen(false)} />
          <div style={{ position: 'fixed', top: colMenuPos.top, right: colMenuPos.right, zIndex: 9999, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 200, padding: '8px 0', overflow: 'hidden' }}>
            <div style={{ padding: '6px 14px 8px', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Toggle Columns</span>
            </div>
            {ALL_COLUMNS.map(col => (
              <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                <input type="checkbox" checked={vis(col.key)} onChange={() => toggleCol(col.key)}
                  style={{ width: 14, height: 14, accentColor: '#2563EB', cursor: 'pointer' }} />
                {col.label}
              </label>
            ))}
          </div>
        </>
      )}

      {/* ── Bulk actions dropdown ── */}
      {bulkMenuOpen && bulkMenuPos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9990 }} onClick={() => setBulkMenuOpen(false)} />
          <div style={{ position: 'fixed', top: bulkMenuPos.top, right: bulkMenuPos.right, zIndex: 9999, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, padding: '8px 0', overflow: 'hidden' }}>
            <div style={{ padding: '6px 14px 8px', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{selected.size} Selected</span>
            </div>
            <button onClick={() => runBulkActivate(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#374151', textAlign: 'left' }}>
              <MI name="check_circle" size={15} color="#0154FC" /> Activate Selected
            </button>
            <button onClick={() => runBulkActivate(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#374151', textAlign: 'left' }}>
              <MI name="block" size={15} color="#DC2626" /> Deactivate Selected
            </button>
            <div style={{ borderTop: '1px solid #F3F4F6', margin: '4px 0' }} />
            <button onClick={() => { setBulkMenuOpen(false); handleExportSelected() }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#374151', textAlign: 'left' }}>
              <MI name="download" size={15} color="#6B7280" /> Export Selected
            </button>
          </div>
        </>
      )}

      {/* ── Saved filters dropdown ── */}
      {savedFiltersOpen && savedFiltersPos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9990 }} onClick={() => setSavedFiltersOpen(false)} />
          <div style={{ position: 'fixed', top: savedFiltersPos.top, right: savedFiltersPos.right, zIndex: 9999, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 240, padding: '8px 0', overflow: 'hidden' }}>
            <div style={{ padding: '6px 14px 8px', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Saved Filters</span>
            </div>
            {savedFilters.length === 0 ? (
              <p style={{ padding: '10px 14px', fontSize: 12, color: '#9CA3AF' }}>No saved filters yet.</p>
            ) : savedFilters.map(f => {
              const isActive = f.filters.search === search && f.filters.status === statusFilter && f.filters.contactsOnly === contactsOnly
              return (
              <div key={f.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 6px', backgroundColor: isActive ? '#EFF6FF' : 'transparent' }}>
                <button onClick={() => applySavedFilter(f)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, padding: '9px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: isActive ? '#2563EB' : '#374151', fontWeight: isActive ? 600 : 400, textAlign: 'left' }}>
                  <MI name="bookmark" size={15} color="#2563EB" /> {f.name}
                  {isActive && <MI name="check" size={14} color="#2563EB" />}
                </button>
                <button onClick={() => deleteSavedFilter(f.name)} title="Delete"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 6, borderRadius: 4, color: '#9CA3AF' }}>
                  <MI name="close" size={14} />
                </button>
              </div>
              )
            })}
            <div style={{ borderTop: '1px solid #F3F4F6', marginTop: 4 }}>
              <button onClick={saveCurrentFilters} disabled={!hasActiveFilter}
                title={hasActiveFilter ? 'Save the current search/status as a reusable filter' : 'Set a search or status filter first'}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: hasActiveFilter ? 'pointer' : 'not-allowed', fontSize: 13, color: hasActiveFilter ? '#2563EB' : '#9CA3AF', fontWeight: 600, textAlign: 'left' }}>
                <MI name="add" size={15} color={hasActiveFilter ? '#2563EB' : '#9CA3AF'} /> Save Current Filters
              </button>
              {!hasActiveFilter && <p style={{ padding: '0 14px 8px', fontSize: 11, color: '#9CA3AF' }}>Set a search or status filter first, then save it.</p>}
            </div>
          </div>
        </>
      )}

      {/* ── Save filter view modal ── */}
      {saveFilterModalOpen && (
        <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', left: 0, right: 0, bottom: 'var(--dashboard-footer-h)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setSaveFilterModalOpen(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} />
          <div style={{ position: 'relative', width: 360, backgroundColor: '#fff', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', padding: 20 }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Name this filter view</h3>
            <input
              autoFocus
              value={newFilterName}
              onChange={e => setNewFilterName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmSaveFilter() }}
              placeholder="e.g. Active Farms Clients"
              className="w-full px-3 py-2 text-sm rounded-lg outline-none mb-4"
              style={{ border: '1px solid #D1D5DB', color: '#111827' }}
            />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setSaveFilterModalOpen(false)}
                style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmSaveFilter} disabled={!newFilterName.trim()}
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: newFilterName.trim() ? 'pointer' : 'not-allowed', opacity: newFilterName.trim() ? 1 : 0.5 }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Drawer ── */}
      <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', bottom: 'var(--dashboard-footer-h)', left: 0, right: 0, zIndex: 200, pointerEvents: showForm ? 'auto' : 'none' }}>
        <div onClick={closeForm} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showForm ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 500, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showForm ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: isEditing ? '#EFF6FF' : '#DBEAFE' }}>
                <MI name={isEditing ? 'edit' : 'person_add'} size={16} color={isEditing ? '#2563EB' : '#0154FC'} />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>{isEditing ? `Edit — ${editing!.title}` : 'Create New Client'}</h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>{STEPS[step].label} — step {step + 1} of {STEPS.length}</p>
              </div>
            </div>
            <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100"><MI name="close" size={16} color="#9CA3AF" /></button>
          </div>

          <div className="px-6 pt-4 shrink-0"><StepBar step={step} onStepClick={setStep} /></div>

          <form
            action={action}
            className="flex flex-col flex-1 min-h-0"
            onKeyDown={e => {
              // The whole multi-step wizard is one <form>; without this, pressing
              // Enter in any text input triggers an implicit submit and creates the
              // client prematurely (e.g. while still filling an earlier step or
              // typing CC emails on the Notes step). Only the explicit Create/Save
              // button should submit. Textareas keep Enter for newlines.
              if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                e.preventDefault()
              }
            }}
          >
            {Object.entries(vals).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-1">
              {/* Step 1 — Basic */}
              <div style={{ display: step === 0 ? 'block' : 'none' }}>
                <div className="space-y-3">
                  <Row>
                    <Field label="Client Name" name="_name" placeholder="e.g. Green Valley Farms" required value={vals.name} onChange={v => setVal('name', v)} error={fieldErrors.name} />
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                        Client ID<span style={{ color: '#EF4444' }}> *</span>
                      </label>
                      <div className="relative">
                        <input
                          placeholder="e.g. CL-001" value={vals.client_id}
                          onChange={e => { setVal('client_id', e.target.value); setClientIdCheck('idle') }}
                          onBlur={e => handleClientIdBlur(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-lg outline-none"
                          style={{ border: `1px solid ${fieldErrors.client_id ? '#FCA5A5' : '#D1D5DB'}`, color: '#111827' }}
                        />
                        {clientIdCheck === 'checking' && (
                          <span className="absolute right-2.5" style={{ top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: '#9CA3AF' }}>checking…</span>
                        )}
                        {clientIdCheck === 'available' && (
                          <span className="absolute right-2.5" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                            <MI name="check_circle" size={13} color="#0154FC" />
                          </span>
                        )}
                      </div>
                      {fieldErrors.client_id && <p className="mt-0.5 text-xs" style={{ color: '#EF4444' }}>{fieldErrors.client_id}</p>}
                    </div>
                  </Row>
                  <Row>
                    <Field label="Email Address" name="_email" type="email" placeholder="contact@client.com" value={vals.email} onChange={v => setVal('email', v)} onBlur={v => handleEmailBlur('email', v)} error={fieldErrors.email} />
                    <Field label="Phone" name="_phone" placeholder="+1 555 000 0000" value={vals.phone} onChange={v => setVal('phone', v)} />
                  </Row>
                  <Row>
                    <Field label="Fax" name="_fax" placeholder="+1 555 000 0001" value={vals.fax} onChange={v => setVal('fax', v)} />
                    <Field label="Tax Number" name="_tax_number" placeholder="VAT / Tax registration" value={vals.tax_number} onChange={v => setVal('tax_number', v)} />
                  </Row>
                </div>
              </div>

              {/* Step 2 — Contact */}
              <div style={{ display: step === 1 ? 'block' : 'none' }}>
                <div className="space-y-3">
                  <Row>
                    <div style={{ width: 120, flexShrink: 0 }}>
                      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Salutation</label>
                      <select value={vals.salutation} onChange={e => setVal('salutation', e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                        <option value="">—</option><option value="Mr">Mr</option><option value="Mrs">Mrs</option>
                        <option value="Ms">Ms</option><option value="Dr">Dr</option><option value="Prof">Prof</option>
                      </select>
                    </div>
                    <Field label="First Name" name="_cf" placeholder="First name" value={vals.contact_first_name} onChange={v => setVal('contact_first_name', v)} />
                    <Field label="Last Name" name="_cl" placeholder="Last name" value={vals.contact_last_name} onChange={v => setVal('contact_last_name', v)} />
                  </Row>
                  <Row>
                    <Field label="Contact Email" name="_ce" type="email" placeholder="person@client.com" value={vals.contact_email} onChange={v => setVal('contact_email', v)} onBlur={v => handleEmailBlur('contact_email', v)} error={fieldErrors.contact_email} />
                    <Field label="Business Phone" name="_cp" placeholder="+1 555 000 0003" value={vals.contact_phone} onChange={v => setVal('contact_phone', v)} />
                  </Row>
                  <Row>
                    <Field label="Mobile" name="_cm" placeholder="+1 555 000 0004" value={vals.contact_mobile} onChange={v => setVal('contact_mobile', v)} />
                    <Field label="Contact Fax" name="_cfx" placeholder="+1 555 000 0005" value={vals.contact_fax} onChange={v => setVal('contact_fax', v)} />
                  </Row>
                  <Row>
                    <Field label="Job Title" name="_cjt" placeholder="e.g. Lab Director" value={vals.contact_job_title} onChange={v => setVal('contact_job_title', v)} />
                    <Field label="Department" name="_cd" placeholder="e.g. Quality Assurance" value={vals.contact_department} onChange={v => setVal('contact_department', v)} />
                  </Row>
                </div>
              </div>

              {/* Step 3 — Addresses */}
              <div style={{ display: step === 2 ? 'block' : 'none' }}>
                <div className="space-y-3">
                  <AddressBlock prefix="physical" label="Physical Address" vals={vals} set={setVal}
                    copyOptions={[{ label: 'Postal Address', prefix: 'postal' }, { label: 'Billing Address', prefix: 'billing' }]} />
                  <AddressBlock prefix="postal" label="Postal Address" vals={vals} set={setVal}
                    copyOptions={[{ label: 'Physical Address', prefix: 'physical' }, { label: 'Billing Address', prefix: 'billing' }]} />
                  <AddressBlock prefix="billing" label="Billing Address" vals={vals} set={setVal}
                    copyOptions={[{ label: 'Physical Address', prefix: 'physical' }, { label: 'Postal Address', prefix: 'postal' }]} />
                </div>
              </div>

              {/* Step 4 — Financial */}
              <div style={{ display: step === 3 ? 'block' : 'none' }}>
                <div className="space-y-3">
                  <Row>
                    <Field label="Account Name" name="_an" placeholder="Account name" value={vals.account_name} onChange={v => setVal('account_name', v)} />
                    <Field label="Account Number" name="_annum" placeholder="Billing account no." value={vals.account_number} onChange={v => setVal('account_number', v)} />
                  </Row>
                  <Row>
                    <Field label="Account Type" name="_at" placeholder="e.g. Corporate" value={vals.account_type} onChange={v => setVal('account_type', v)} />
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Decimal Mark</label>
                      <select value={vals.decimal_mark} onChange={e => setVal('decimal_mark', e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }}>
                        <option value=".">Period (.)</option><option value=",">Comma (,)</option>
                      </select>
                    </div>
                  </Row>
                  <Row>
                    <Field label="Bank Name" name="_bn" placeholder="Bank name" value={vals.bank_name} onChange={v => setVal('bank_name', v)} />
                    <Field label="Bank Branch" name="_bb" placeholder="Branch name" value={vals.bank_branch} onChange={v => setVal('bank_branch', v)} />
                  </Row>
                  <div className="flex flex-col gap-2 pt-1">
                    <label className="flex items-center gap-2 text-xs" style={{ color: '#374151' }}>
                      <input type="checkbox" checked={vals.bulk_discount === 'true'} onChange={e => setVal('bulk_discount', e.target.checked ? 'true' : '')} />
                      Apply bulk discount
                    </label>
                    <label className="flex items-center gap-2 text-xs" style={{ color: '#374151' }}>
                      <input type="checkbox" checked={vals.member_discount === 'true'} onChange={e => setVal('member_discount', e.target.checked ? 'true' : '')} />
                      Member discount applies
                    </label>
                  </div>
                </div>
              </div>

              {/* Step 5 — Notes */}
              <div style={{ display: step === 4 ? 'block' : 'none' }}>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>CC Emails</label>
                    <input value={vals.cc_emails} onChange={e => setVal('cc_emails', e.target.value)} placeholder="comma-separated emails"
                      className="w-full px-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D1D5DB', color: '#111827' }} />
                  </div>
                  <Field label="Description / Remarks" name="_desc" as="textarea" placeholder="Any additional notes about this client…" value={vals.description} onChange={v => setVal('description', v)} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#fff' }}>
              <button type="button" onClick={isFirst ? closeForm : () => setStep(s => s - 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium" style={{ border: '1px solid #D1D5DB', color: '#374151' }}>
                <MI name={isFirst ? 'close' : 'arrow_back'} size={13} color="#374151" />{isFirst ? 'Cancel' : 'Back'}
              </button>
              <div className="flex-1" />
              {/* Tabs above are always clickable (see StepBar) — no Next/Back
                  step navigation needed. A single Save button is always present:
                  "Save Changes" on every step, except the final Notes step on a
                  brand-new client, which reads "Create" since that's the first
                  time the record actually gets created. */}
              {/* Disabled whenever a field currently has a validation error (e.g. a
                  bad email left over from an onBlur check) — the error must be
                  fixed at the field that raised it, not discovered again after
                  a submit attempt. setVal() clears the entry for a field the
                  moment its value changes, so this re-enables immediately once
                  the user starts correcting it. */}
              <button type="submit" disabled={pending || Object.keys(fieldErrors).length > 0}
                className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-medium text-white"
                style={{
                  backgroundColor: pending || Object.keys(fieldErrors).length > 0 ? '#DBEAFE' : isEditing ? '#2563EB' : '#0154FC',
                  cursor: pending || Object.keys(fieldErrors).length > 0 ? 'not-allowed' : 'pointer',
                }}>
                <MI name={pending ? 'hourglass_top' : 'check'} size={13} color="#fff" />
                {pending
                  ? (isEditing ? 'Saving…' : isLast ? 'Creating…' : 'Saving…')
                  : (isEditing ? 'Save Changes' : isLast ? 'Create' : 'Save Changes')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Table — only this area scrolls; header/stat cards/filter bar above stay fixed. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {initialClients.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-12" style={{ border: '1px solid #E8EAF2' }}>
          <MI name="people" size={36} color="#D1D5DB" />
          <p className="mt-2 text-sm font-medium" style={{ color: '#6B7280' }}>No clients yet</p>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Create your first client to get started</p>
          <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="add" size={13} color="#fff" /> New Client
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl" style={{ border: '1px solid #E8EAF2' }}>
          <EmptyState icon="search_off" title="No clients match your filters" sub="Try a different search or clear the filters." />
        </div>
      ) : (
        <DataTable<ClientRow>
          data={tableData}
          columns={columns}
          persistKey="clients"
          selectable
          controlsTargetRef={tableControlsRef}
          onSelectionChange={ids => setSelected(new Set(ids as string[]))}
          emptyMessage="No clients match your filters."
          rowActions={c => <ActionsMenu client={c} onEdit={openEdit} onDone={() => router.refresh()} />}
        />
      )}
      </div>
    </div>
  )
}

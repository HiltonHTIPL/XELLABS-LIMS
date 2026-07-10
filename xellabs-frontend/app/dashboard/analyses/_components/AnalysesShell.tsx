'use client'
import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createAnalysis, type AnalysisFormState } from '@/app/actions/analyses'
import {
  type SenaiteAnalysisService,
  type SenaiteAnalysisCategory,
  type SenaiteDepartment,
} from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

function Field({
  label, name, placeholder, required, error, hint, value, onChange,
}: {
  label: string; name: string; placeholder?: string; required?: boolean
  error?: string; hint?: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
        {hint && <span className="ml-1 font-normal" style={{ color: '#9CA3AF' }}>{hint}</span>}
      </label>
      <input
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

type FV = { title: string; Keyword: string; Category: string; newCategoryTitle: string; Department: string; Unit: string; Price: string }
const blank = (): FV => ({ title: '', Keyword: '', Category: '', newCategoryTitle: '', Department: '', Unit: '', Price: '' })

export default function AnalysesShell({
  initialServices, categories, departments,
}: {
  initialServices: SenaiteAnalysisService[]
  categories: SenaiteAnalysisCategory[]
  departments: SenaiteDepartment[]
}) {
  const router = useRouter()
  const [showDrawer, setShowDrawer] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [vals, setVals] = useState<FV>(blank)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')

  const creatingCategory = vals.Category === '__new__'

  function setVal(k: keyof FV, v: string) {
    setVals(prev => ({ ...prev, [k]: v }))
    if (fieldErrors[k]) setFieldErrors(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  const [, action, pending] = useActionState(
    async (prev: AnalysisFormState, fd: FormData) => {
      const result = await createAnalysis(prev, fd)
      if (result.success) {
        setShowDrawer(false)
        setVals(blank())
        setFieldErrors({})
        setToast({ ok: true, msg: result.message ?? 'Analysis created.' })
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

  function openCreate() { setVals(blank()); setFieldErrors({}); setShowDrawer(true) }
  function closeDrawer() { setShowDrawer(false) }

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
      <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, zIndex: 200, pointerEvents: showDrawer ? 'auto' : 'none' }}>
        <div onClick={closeDrawer} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.30)', opacity: showDrawer ? 1 : 0, transition: 'opacity 0.25s ease' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 420, backgroundColor: '#fff', boxShadow: '-6px 0 32px rgba(0,0,0,0.12)', transform: showDrawer ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
                <MI name="add" size={16} color="#0154FC" />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>New Analysis</h2>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>Create a new analysis (test service)</p>
              </div>
            </div>
            <button onClick={closeDrawer} className="p-1.5 rounded-lg hover:bg-gray-100">
              <MI name="close" size={16} color="#9CA3AF" />
            </button>
          </div>

          {/* Form */}
          <form action={action} className="flex-1 overflow-y-auto flex flex-col min-h-0">
            <div className="flex-1 px-5 py-4 flex flex-col gap-3">
              <Field label="Analysis Name" name="title" placeholder="e.g. Total Protein" required
                error={fieldErrors.title} value={vals.title} onChange={v => setVal('title', v)} />
              <Field label="Keyword" name="Keyword" placeholder="e.g. TotalProtein" required
                hint="(unique code, no spaces)"
                error={fieldErrors.Keyword} value={vals.Keyword} onChange={v => setVal('Keyword', v)} />
              <SelectField label="Category" name="Category" required
                error={fieldErrors.Category} value={vals.Category} onChange={v => setVal('Category', v)}>
                <option value="">Select a category…</option>
                {categories.map(c => <option key={c.uid} value={c.uid}>{c.title}</option>)}
                {departments.length > 0 && <option value="__new__">+ Create new category…</option>}
              </SelectField>

              {creatingCategory && (
                <div className="flex flex-col gap-3 p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', border: '1px dashed #D1D5DB' }}>
                  <Field label="New Category Name" name="newCategoryTitle" placeholder="e.g. Clinical Chemistry" required
                    error={fieldErrors.newCategoryTitle} value={vals.newCategoryTitle} onChange={v => setVal('newCategoryTitle', v)} />
                  <SelectField label="Department" name="Department" required
                    error={fieldErrors.Department} value={vals.Department} onChange={v => setVal('Department', v)}>
                    <option value="">Select a department…</option>
                    {departments.map(d => <option key={d.uid} value={d.uid}>{d.title}</option>)}
                  </SelectField>
                </div>
              )}

              <Field label="Unit" name="Unit" placeholder="e.g. mg/dL"
                hint="(optional)" value={vals.Unit} onChange={v => setVal('Unit', v)} />
              <Field label="Price" name="Price" placeholder="e.g. 25.00"
                hint="(optional)" error={fieldErrors.Price} value={vals.Price} onChange={v => setVal('Price', v)} />
            </div>

            {/* Footer */}
            <div className="px-5 py-4 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#fff' }}>
              <button type="button" onClick={closeDrawer} disabled={pending}
                style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
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
              <col style={{ width: '30%' }} /><col style={{ width: '18%' }} /><col style={{ width: '20%' }} /><col style={{ width: '12%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} />
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
                  <td className="px-3 py-2.5 font-mono text-xs truncate" style={{ color: '#9CA3AF' }} title={s.uid}>{s.uid.slice(0, 8)}…</td>
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

'use client'
// Universal ⌘K / Ctrl+K search — flattens the existing Sidebar NAV + ADMIN_SECTIONS
// (both already role-filtered single sources of truth) into one searchable list.
// No new nav data is defined here — see CLAUDE.md Section 0e (sidebar lock rule).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { NAV, isGroup } from './Sidebar'
import { ADMIN_SECTIONS } from './adminNav'
import { T } from './tokens'

type ResultItem = { label: string; href: string; icon: string; group?: string }

interface Props {
  role?: string
  isSuperuser?: boolean
  open: boolean
  onClose: () => void
}

function isVisible(roles: string[] | null, role: string | undefined, superuserOnly: boolean | undefined, isSuperuser: boolean | undefined) {
  if (superuserOnly && !isSuperuser) return false
  return !roles || (!!role && roles.includes(role))
}

export default function CommandPalette({ role, isSuperuser, open, onClose }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const allItems = useMemo<ResultItem[]>(() => {
    const items: ResultItem[] = []
    for (const entry of NAV) {
      if (isGroup(entry)) {
        for (const child of entry.children) {
          if (isVisible(child.roles, role, child.superuserOnly, isSuperuser)) {
            items.push({ label: child.label, href: child.href, icon: child.icon, group: entry.group })
          }
        }
      } else if (isVisible(entry.roles, role, entry.superuserOnly, isSuperuser)) {
        items.push({ label: entry.label, href: entry.href, icon: entry.icon })
      }
    }
    for (const section of ADMIN_SECTIONS) {
      if (section.roles === null || (!!role && section.roles.includes(role))) {
        items.push({ label: section.label, href: section.href, icon: section.icon, group: 'Administration' })
      }
    }
    return items
  }, [role, isSuperuser])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allItems.slice(0, 8)
    return allItems.filter(item => item.label.toLowerCase().includes(q) || item.group?.toLowerCase().includes(q))
  }, [query, allItems])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  function select(item: ResultItem) {
    router.push(item.href)
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[activeIndex]) select(results[activeIndex])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 flex items-start justify-center"
      style={{ backgroundColor: 'rgba(15,23,42,0.35)', zIndex: 10000, paddingTop: '12vh' }}
      onClick={onClose}
    >
      <div
        className="w-full bg-white rounded-xl overflow-hidden"
        style={{ maxWidth: 560, boxShadow: '0 20px 48px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <span className="material-icons" style={{ fontSize: 18, color: '#374151' }}>search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search samples, IDs, projects, users..."
            className="flex-1 outline-none text-sm"
            style={{ color: '#111827' }}
          />
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#F3F4F6', color: '#374151' }}>Esc</span>
        </div>
        <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: '#374151' }}>No matching pages</div>
          ) : (
            results.map((item, i) => (
              <button
                key={item.href}
                onClick={() => select(item)}
                onMouseEnter={() => setActiveIndex(i)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-left"
                style={{
                  background: i === activeIndex ? '#EFF6FF' : 'transparent',
                  border: 'none', borderBottom: '1px solid #F9FAFB', cursor: 'pointer',
                }}
              >
                <span className="material-icons" style={{ fontSize: 18, color: T.primary }}>{item.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate" style={{ color: '#111827' }}>{item.label}</span>
                  {item.group && <span className="block text-xs" style={{ color: '#374151' }}>{item.group}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

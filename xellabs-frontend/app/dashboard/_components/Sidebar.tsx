'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
import { T } from './tokens'
import { ADMIN_SECTIONS } from './adminNav'

function MI({ name, size = 16 }: { name: string; size?: number }) {
  return <span className="material-icons" style={{ fontSize: size, lineHeight: 1 }}>{name}</span>
}

export type NavItem = { label: string; href: string; icon: string; roles: string[] | null; exact?: boolean; superuserOnly?: boolean }
// linkOnly groups (e.g. Administration) navigate straight to `href` on click
// instead of expanding an in-sidebar submenu — `children` is still used to
// compute the "any child active" highlight and by /dashboard/admin's own grid.
export type NavGroup = { group: string; icon: string; roles: string[] | null; children: NavItem[]; linkOnly?: boolean; href?: string }
export type NavEntry = NavItem | NavGroup

export function isGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry
}

export const NAV: NavEntry[] = [
  { label: 'Dashboard',        href: '/dashboard',                   icon: 'dashboard',               roles: null },
  { label: 'Clients',          href: '/dashboard/clients',           icon: 'business',                roles: ['admin', 'manager', 'lab_manager', 'lab_clerk'] },
  // Sample workflow — visible to every role that touches a sample
  {
    group: 'Samples',
    icon: 'format_list_bulleted',
    roles: ['admin', 'manager', 'lab_manager', 'lab_clerk', 'sampler', 'analyst', 'verifier', 'publisher'],
    children: [
      { label: 'Samples Overview', href: '/dashboard/samples-overview', icon: 'list_alt',      roles: ['admin', 'manager', 'lab_manager', 'lab_clerk', 'sampler', 'analyst', 'verifier', 'publisher'], exact: true },
      { label: 'New Samples',      href: '/dashboard/samples-overview/new', icon: 'add_circle', roles: ['admin', 'manager', 'lab_manager', 'lab_clerk'] },
    ],
  },
  { label: 'Methods',           href: '/dashboard/methods',           icon: 'biotech',     roles: ['admin', 'manager', 'lab_manager', 'analyst'] },
  { label: 'Batches',           href: '/dashboard/batches',           icon: 'layers',      roles: ['admin', 'manager', 'lab_manager', 'analyst'] },
  { label: 'Worksheet',         href: '/dashboard/worksheets',        icon: 'table_chart', roles: ['admin', 'manager', 'lab_manager', 'analyst', 'verifier'] },
  { label: 'Quality',           href: '/dashboard/quality',           icon: 'verified',    roles: ['admin', 'manager', 'lab_manager', 'analyst', 'verifier'] },
  { label: 'Storage Manager',   href: '/dashboard/storage',           icon: 'inventory_2', roles: ['admin', 'manager', 'lab_manager', 'lab_clerk', 'sampler', 'analyst'] },
  // Inventory
  {
    group: 'Instruments',
    icon: 'science',
    roles: ['admin', 'manager', 'lab_manager', 'analyst'],
    children: [
      { label: 'Test Schedule', href: '/dashboard/schedule', icon: 'event_note', roles: ['admin', 'manager', 'lab_manager', 'analyst'] },
      { label: 'Inventory Dashboard', href: '/dashboard/inventory-dashboard', icon: 'insert_chart', roles: ['admin', 'manager', 'lab_manager', 'analyst'] },
      { label: 'Reagents & Standards', href: '/dashboard/inventory-items', icon: 'biotech', roles: ['admin', 'manager', 'lab_manager', 'analyst'] },
      { label: 'Lots & Transactions', href: '/dashboard/inventory-lots', icon: 'inventory', roles: ['admin', 'manager', 'lab_manager', 'analyst'] },
      { label: 'Instrument Maintenance', href: '/dashboard/instrument-maintenance', icon: 'build', roles: ['admin', 'manager', 'lab_manager', 'analyst'] },
    ],
  },
  { label: 'Reports',          href: '/dashboard/reports',           icon: 'bar_chart',               roles: ['admin', 'manager', 'lab_manager', 'publisher', 'verifier', 'analyst'] },
  // Data Analytics and Compliance (Approvals, Audit Trail) intentionally not top-level —
  // reachable via the Administration group/grid instead, to keep the top-level
  // sidebar limited to: Dashboard, Clients, Samples, Methods, Batches, Worksheet,
  // Quality, Storage Manager, Instruments, Reports, Administration. Do not add a
  // new top-level entry here without asking first — see CLAUDE.md.
  // Administration is a single entry point (not a dropdown) — clicking it opens
  // the /dashboard/admin grid page, which renders ADMIN_SECTIONS as tiles from
  // the same single source (adminNav.ts). Visibility stays wide open (null)
  // because the grid page itself gates each tile per its own roles, and several
  // sections are visible to roles narrower than the classic admin/lab_manager
  // set — the grid page filters them, so the entry point must not pre-gate.
  { label: 'Administration', href: '/dashboard/admin', icon: 'admin_panel_settings', roles: null },
]

interface Props {
  onToggle?: () => void
  role?: string
  reportDraftCount?: number
  isSuperuser?: boolean
}

export default function Sidebar({ onToggle, role, reportDraftCount, isSuperuser }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // /dashboard/samples-overview/new doubles as the Edit Sample page
  // (?edit=<id>) — that's "editing an existing sample", not "New Samples",
  // so it should highlight Samples Overview instead of New Samples.
  const isEditingSample = pathname === '/dashboard/samples-overview/new' && Boolean(searchParams.get('edit'))

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const open = new Set<string>()
    if (['/dashboard/samples-overview', '/dashboard/samples/'].some(p => pathname.startsWith(p))) open.add('Samples')
    if (['/dashboard/inventory-items', '/dashboard/inventory-lots', '/dashboard/instrument-maintenance', '/dashboard/schedule', '/dashboard/inventory-dashboard'].some(p => pathname.startsWith(p))) open.add('Instruments')
    return open
  })

  const [adminQuery, setAdminQuery] = useState('')

  function toggleGroup(name: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function isVisible(roles: string[] | null, superuserOnly?: boolean) {
    if (superuserOnly && !isSuperuser) return false
    return !roles || (!!role && roles.includes(role))
  }

  const linkStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 12px',
    marginBottom: 2, borderRadius: 10, fontSize: 13, fontWeight: 500,
    textDecoration: 'none', transition: 'all 0.15s', lineHeight: 1.3,
    ...(active
      ? { backgroundColor: T.primary, color: '#fff', boxShadow: '0 4px 10px rgba(37,99,235,0.35)' }
      : { color: 'rgba(255,255,255,0.72)' }),
  })

  // Once you open an admin SECTION (a tile), the primary sidebar swaps its whole
  // nav to the admin sections (single source: ADMIN_SECTIONS) instead of the global
  // NAV, with an "Administration" back link to get back. The Administration GRID
  // page itself (/dashboard/admin) keeps the global menu — the swap is a
  // tile-click, not the Administration entry. Role-filtered by the same isVisible rule.
  const adminSections = ADMIN_SECTIONS.filter(s => isVisible(s.roles))
  const inAdmin = pathname.startsWith('/dashboard/admin/')
    || adminSections.some(s => pathname === s.href || pathname.startsWith(s.href + '/'))

  const adminQ = adminQuery.trim().toLowerCase()
  const shownAdminSections = adminQ
    ? adminSections.filter(s => s.label.toLowerCase().includes(adminQ))
    : adminSections

  return (
    <div className="flex flex-col h-full" style={{ width: 210, backgroundColor: T.navy }}>

      {/* Header */}
      <div className="flex items-center px-4" style={{ height: 56, backgroundColor: '#ffffff', borderBottom: `1px solid ${T.cardBorder}`, flexShrink: 0 }}>
        <Image src="/xellabs-logo.png" alt="XelLabs LIMS" width={110} height={32} style={{ objectFit: 'contain' }} />
      </div>

      {/* Nav — global menu, OR the Administration sections when inside admin */}
      <nav className="flex-1 min-h-0 overflow-y-auto py-3 px-2">
        {inAdmin ? (
          <>
            {/* Back link: if the search has text, first press just clears it (no
                navigation); once empty it goes to the Administration grid. */}
            <Link
              href="/dashboard/admin"
              style={linkStyle(false)}
              onClick={e => { if (adminQuery) { e.preventDefault(); setAdminQuery('') } }}
            >
              <MI name="arrow_back" size={16} />
              <span>Administration</span>
            </Link>
            {/* Filter the admin sections by name */}
            <div style={{ position: 'relative', margin: '10px 4px' }}>
              <span className="material-icons" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }}>search</span>
              <input
                value={adminQuery}
                onChange={e => setAdminQuery(e.target.value)}
                placeholder="Search settings"
                aria-label="Search administration settings"
                style={{
                  width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8,
                  fontSize: 12.5, color: '#fff', outline: 'none',
                  backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)',
                }}
              />
            </div>
            {shownAdminSections.map(s => {
              const active = pathname === s.href || pathname.startsWith(s.href + '/')
              return (
                <Link key={s.href} href={s.href} style={linkStyle(active)} title={s.description}>
                  <MI name={s.icon} size={16} />
                  <span>{s.label}</span>
                </Link>
              )
            })}
            {shownAdminSections.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>No settings match.</div>
            )}
          </>
        ) : NAV.map(entry => {
          if (!isVisible(entry.roles)) return null

          if (isGroup(entry)) {
            const anyChildActive = entry.children.some(c => c.exact ? pathname === c.href : (pathname === c.href || pathname.startsWith(c.href + '/')))

            if (entry.linkOnly && entry.href) {
              const active = anyChildActive || pathname === entry.href || pathname.startsWith(entry.href + '/')
              return (
                <Link key={entry.group} href={entry.href} style={linkStyle(active)}>
                  <span style={{ flexShrink: 0, display: 'flex' }}>
                    <MI name={entry.icon} size={16} />
                  </span>
                  <span>{entry.group}</span>
                </Link>
              )
            }

            const isOpen = openGroups.has(entry.group)
            return (
              <div key={entry.group}>
                {/* Group header button */}
                <button
                  type="button"
                  onClick={() => toggleGroup(entry.group)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '7px 12px', marginBottom: 2, borderRadius: 10,
                    fontSize: 13, fontWeight: 500, border: 'none',
                    cursor: 'pointer', transition: 'all 0.15s',
                    ...(anyChildActive
                      ? { backgroundColor: 'rgba(37,99,235,0.25)', color: '#fff' }
                      : { backgroundColor: 'transparent', color: 'rgba(255,255,255,0.72)' }),
                  }}
                >
                  <MI name={entry.icon} size={16} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{entry.group}</span>
                  <span className="material-icons" style={{ fontSize: 16, lineHeight: 1, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.7 }}>
                    expand_more
                  </span>
                </button>

                {/* Children */}
                {isOpen && (
                  <div style={{ marginLeft: 12, borderLeft: '1.5px solid rgba(255,255,255,0.15)', paddingLeft: 8, marginBottom: 4 }}>
                    {entry.children.filter(c => isVisible(c.roles, c.superuserOnly)).map(child => {
                      const rawActive = child.exact ? pathname === child.href : (pathname === child.href || pathname.startsWith(child.href + '/'))
                      const active = child.href === '/dashboard/samples-overview/new'
                        ? rawActive && !isEditingSample
                        : child.href === '/dashboard/samples-overview'
                          ? rawActive || isEditingSample
                          : rawActive
                      return (
                        <Link key={child.href} href={child.href} style={linkStyle(active)}>
                          <span style={{ flexShrink: 0, marginTop: 1, display: 'flex' }}>
                            <MI name={child.icon} size={15} />
                          </span>
                          <span>{child.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          // Regular flat item
          const active = entry.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === entry.href || pathname.startsWith(entry.href + '/')
          return (
            <Link key={entry.href} href={entry.href} style={linkStyle(active)}>
              <MI name={entry.icon} size={16} />
              <span>{entry.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Need Help */}
      <div className="mx-3 mb-2 p-3" style={{ borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}>
        <div className="flex items-center gap-2 mb-1" style={{ color: '#fff' }}>
          <MI name="support_agent" size={14} />
          <p className="text-xs font-semibold" style={{ color: '#fff' }}>Need Help?</p>
        </div>
        <p style={{ fontSize: 10.5, color: '#FFFFFF', lineHeight: 1.4 }}>Contact support for assistance.</p>
        <a href="mailto:support@xellabs.com" style={{ fontSize: 10.5, color: '#BFDBFE', marginTop: 3, display: 'inline-block', fontWeight: 700, textDecoration: 'underline' }}>support@xellabs.com</a>
      </div>

      {/* Collapse */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.10)', flexShrink: 0 }}>
        <button onClick={onToggle} className="flex items-center gap-2.5 w-full px-4 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
          <span className="flex items-center justify-center rounded-full shrink-0" style={{ width: 22, height: 22, border: '1px solid rgba(255,255,255,0.35)' }}>
            <MI name="chevron_left" size={14} />
          </span>
          Collapse
        </button>
      </div>
    </div>
  )
}

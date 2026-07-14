'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { T } from './tokens'

function MI({ name, size = 16 }: { name: string; size?: number }) {
  return <span className="material-icons" style={{ fontSize: size, lineHeight: 1 }}>{name}</span>
}

type NavItem = { label: string; href: string; icon: string; roles: string[] | null; exact?: boolean; superuserOnly?: boolean }
// linkOnly groups (e.g. Administration) navigate straight to `href` on click
// instead of expanding an in-sidebar submenu — `children` is still used to
// compute the "any child active" highlight and by /dashboard/admin's own grid.
type NavGroup = { group: string; icon: string; roles: string[] | null; children: NavItem[]; linkOnly?: boolean; href?: string }
type NavEntry = NavItem | NavGroup

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry
}

const NAV: NavEntry[] = [
  { label: 'Dashboard',        href: '/dashboard',                   icon: 'dashboard',               roles: null },
  { label: 'Clients',          href: '/dashboard/clients',           icon: 'business',                roles: ['admin', 'lab_manager', 'receptionist'] },
  // Sample workflow
  {
    group: 'Samples',
    icon: 'format_list_bulleted',
    roles: ['admin', 'lab_manager', 'receptionist', 'analyst', 'reviewer'],
    children: [
      { label: 'Samples Overview', href: '/dashboard/samples-overview', icon: 'list_alt',      roles: ['admin', 'lab_manager', 'receptionist', 'analyst', 'reviewer'], exact: true },
      { label: 'New Samples',      href: '/dashboard/samples-overview/new', icon: 'add_circle', roles: ['admin', 'lab_manager', 'receptionist'] },
    ],
  },
  { label: 'Methods',           href: '/dashboard/methods',           icon: 'biotech',     roles: ['admin', 'lab_manager', 'analyst'] },
  { label: 'Batches',           href: '/dashboard/batches',           icon: 'layers',      roles: ['admin', 'lab_manager', 'analyst'] },
  { label: 'Worksheet',         href: '/dashboard/worksheets',        icon: 'table_chart', roles: ['admin', 'lab_manager', 'analyst', 'reviewer'] },
  { label: 'Quality',           href: '/dashboard/quality',           icon: 'verified',    roles: ['admin', 'lab_manager', 'analyst', 'reviewer', 'client'] },
  { label: 'Storage Manager',   href: '/dashboard/storage',           icon: 'inventory_2', roles: ['admin', 'lab_manager', 'analyst', 'client'] },
  // Inventory
  {
    group: 'Instruments',
    icon: 'science',
    roles: ['admin', 'lab_manager', 'analyst'],
    children: [
      { label: 'Reagents & Standards', href: '/dashboard/inventory-items', icon: 'biotech', roles: ['admin', 'lab_manager', 'analyst'] },
      { label: 'Lots & Transactions', href: '/dashboard/inventory-lots', icon: 'inventory', roles: ['admin', 'lab_manager', 'analyst'] },
      { label: 'Instrument Maintenance', href: '/dashboard/instrument-maintenance', icon: 'build', roles: ['admin', 'lab_manager', 'analyst'] },
    ],
  },
  { label: 'Reports',          href: '/dashboard/reports',           icon: 'bar_chart',               roles: null },
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

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const open = new Set<string>()
    if (['/dashboard/samples-overview', '/dashboard/samples/new'].some(p => pathname.startsWith(p))) open.add('Samples')
    if (['/dashboard/inventory-items', '/dashboard/inventory-lots', '/dashboard/instrument-maintenance'].some(p => pathname.startsWith(p))) open.add('Instruments')
    return open
  })

  function toggleGroup(name: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function isVisible(roles: string[] | null, superuserOnly?: boolean) {
    if (superuserOnly && !isSuperuser) return false
    return !roles || (!!role && roles.includes(role))
  }

  const linkStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px',
    marginBottom: 2, borderRadius: 10, fontSize: 13, fontWeight: 500,
    textDecoration: 'none', transition: 'all 0.15s',
    ...(active
      ? { backgroundColor: T.primary, color: '#fff', boxShadow: '0 4px 10px rgba(37,99,235,0.35)' }
      : { color: 'rgba(255,255,255,0.72)' }),
  })

  return (
    <div className="flex flex-col h-full" style={{ width: 210, backgroundColor: T.navy }}>

      {/* Header */}
      <div className="flex items-center px-4" style={{ height: 56, backgroundColor: '#ffffff', borderBottom: `1px solid ${T.cardBorder}`, flexShrink: 0 }}>
        <Image src="/xellabs-logo.png" alt="XelLabs LIMS" width={110} height={32} style={{ objectFit: 'contain' }} />
      </div>

      {/* Nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto py-3 px-2">
        {NAV.map(entry => {
          if (!isVisible(entry.roles)) return null

          if (isGroup(entry)) {
            const anyChildActive = entry.children.some(c => c.exact ? pathname === c.href : (pathname === c.href || pathname.startsWith(c.href + '/')))

            if (entry.linkOnly && entry.href) {
              const active = anyChildActive || pathname === entry.href || pathname.startsWith(entry.href + '/')
              return (
                <Link key={entry.group} href={entry.href} style={linkStyle(active)}>
                  <MI name={entry.icon} size={16} />
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
                    fontSize: 13, fontWeight: 500, background: 'none', border: 'none',
                    cursor: 'pointer', transition: 'all 0.15s',
                    ...(anyChildActive
                      ? { backgroundColor: 'rgba(37,99,235,0.25)', color: '#fff' }
                      : { color: 'rgba(255,255,255,0.72)' }),
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
                      const active = child.exact ? pathname === child.href : (pathname === child.href || pathname.startsWith(child.href + '/'))
                      return (
                        <Link key={child.href} href={child.href} style={linkStyle(active)}>
                          <MI name={child.icon} size={15} />
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
      <div className="mx-3 mb-2 p-3" style={{ borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="flex items-center gap-2 mb-1" style={{ color: '#fff' }}>
          <MI name="support_agent" size={14} />
          <p className="text-xs font-semibold" style={{ color: '#fff' }}>Need Help?</p>
        </div>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>Contact support for assistance.</p>
        <p style={{ fontSize: 10, color: '#0154FC', marginTop: 3 }}>support@xellabs.com</p>
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

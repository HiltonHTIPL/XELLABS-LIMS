'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { T } from './tokens'

function MI({ name, size = 16 }: { name: string; size?: number }) {
  return <span className="material-icons" style={{ fontSize: size, lineHeight: 1 }}>{name}</span>
}

type NavItem = { label: string; href: string; icon: string; roles: string[] | null }
type NavGroup = { group: string; icon: string; roles: string[] | null; children: NavItem[] }
type NavEntry = NavItem | NavGroup

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry
}

const NAV: NavEntry[] = [
  { label: 'Dashboard',        href: '/dashboard',                   icon: 'dashboard',               roles: null },
  { label: 'Clients',          href: '/dashboard/clients',           icon: 'business',                roles: ['admin', 'lab_manager', 'receptionist'] },
  // Sample workflow
  { label: 'Samples',          href: '/dashboard/samples-overview',  icon: 'format_list_bulleted',    roles: ['admin', 'lab_manager', 'receptionist', 'analyst', 'reviewer'] },
  { label: 'Sample Receipt',   href: '/dashboard/sample-receipts',   icon: 'receipt_long',            roles: null },
  { label: 'Analysis Requests',href: '/dashboard/analysis-requests', icon: 'assignment_turned_in',    roles: ['admin', 'lab_manager', 'analyst', 'reviewer'] },
  { label: 'Worksheets',       href: '/dashboard/worksheets',        icon: 'table_chart',             roles: ['admin', 'lab_manager', 'analyst'] },
  // Storage & tracking
  { label: 'Storage',          href: '/dashboard/storage',           icon: 'inventory_2',             roles: ['admin', 'lab_manager', 'analyst', 'client'] },
  { label: 'Chain of Custody', href: '/dashboard/chain-of-custody',  icon: 'link',                    roles: ['admin', 'lab_manager', 'analyst', 'reviewer', 'client'] },
  // Lab operations
  { label: 'Instruments',      href: '/dashboard/instruments',       icon: 'precision_manufacturing', roles: ['admin', 'lab_manager', 'analyst', 'client'] },
  { label: 'Quality',          href: '/dashboard/quality',           icon: 'verified',                roles: ['admin', 'lab_manager', 'analyst', 'reviewer', 'client'] },
  { label: 'Reports',          href: '/dashboard/reports',           icon: 'bar_chart',               roles: null },
  // Administration group
  {
    group: 'Administration',
    icon: 'admin_panel_settings',
    roles: ['admin', 'lab_manager'],
    children: [
      { label: 'Sample Types', href: '/dashboard/sample-types', icon: 'category',   roles: ['admin', 'lab_manager'] },
      { label: 'Methods',      href: '/dashboard/methods',      icon: 'biotech',     roles: ['admin', 'lab_manager'] },
      { label: 'Tests',        href: '/dashboard/tests',        icon: 'assignment',  roles: ['admin', 'lab_manager', 'analyst'] },
    ],
  },
]

interface Props {
  onToggle?: () => void
  role?: string
}

export default function Sidebar({ onToggle, role }: Props) {
  const pathname = usePathname()

  // Auto-open Administration if current path is one of its children
  const adminPaths = ['/dashboard/sample-types', '/dashboard/methods', '/dashboard/tests']
  const [adminOpen, setAdminOpen] = useState(() => adminPaths.some(p => pathname.startsWith(p)))

  function isVisible(roles: string[] | null) {
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
            const anyChildActive = entry.children.some(c => pathname.startsWith(c.href))
            return (
              <div key={entry.group}>
                {/* Group header button */}
                <button
                  type="button"
                  onClick={() => setAdminOpen(o => !o)}
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
                  <span className="material-icons" style={{ fontSize: 16, lineHeight: 1, transition: 'transform 0.2s', transform: adminOpen ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.7 }}>
                    expand_more
                  </span>
                </button>

                {/* Children */}
                {adminOpen && (
                  <div style={{ marginLeft: 12, borderLeft: '1.5px solid rgba(255,255,255,0.15)', paddingLeft: 8, marginBottom: 4 }}>
                    {entry.children.filter(c => isVisible(c.roles)).map(child => {
                      const active = pathname.startsWith(child.href)
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
            : pathname.startsWith(entry.href)
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

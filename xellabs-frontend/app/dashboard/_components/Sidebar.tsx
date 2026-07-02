'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

function MI({ name, size = 16 }: { name: string; size?: number }) {
  return <span className="material-icons" style={{ fontSize: size, lineHeight: 1 }}>{name}</span>
}

const NAV = [
  { label: 'Dashboard',        href: '/dashboard',                  icon: 'dashboard',               roles: null },
  // Setup
  { label: 'Clients',          href: '/dashboard/clients',          icon: 'business',                roles: ['admin', 'lab_manager', 'receptionist'] },
  { label: 'Sample Types',     href: '/dashboard/sample-types',     icon: 'category',                roles: ['admin', 'lab_manager'] },
  { label: 'Methods',          href: '/dashboard/methods',          icon: 'biotech',                 roles: ['admin', 'lab_manager'] },
  { label: 'Tests',            href: '/dashboard/tests',            icon: 'assignment',              roles: ['admin', 'lab_manager', 'analyst'] },
  // Sample workflow
  { label: 'Sample Receipt',   href: '/dashboard/sample-receipts',  icon: 'receipt_long',            roles: null },
  { label: 'Samples',          href: '/dashboard/samples',          icon: 'science',                 roles: null },
  { label: 'Sample Register',  href: '/dashboard/lab-samples',      icon: 'colorize',                roles: ['admin', 'lab_manager', 'receptionist', 'analyst'] },
  { label: 'Analysis Requests',href: '/dashboard/analysis-requests',icon: 'assignment_turned_in',    roles: ['admin', 'lab_manager', 'analyst', 'reviewer'] },
  { label: 'Worksheets',       href: '/dashboard/worksheets',       icon: 'table_chart',             roles: ['admin', 'lab_manager', 'analyst'] },
  // Storage & tracking
  { label: 'Storage',          href: '/dashboard/storage',          icon: 'inventory_2',             roles: ['admin', 'lab_manager', 'analyst', 'client'] },
  { label: 'Chain of Custody', href: '/dashboard/chain-of-custody', icon: 'link',                    roles: ['admin', 'lab_manager', 'analyst', 'reviewer', 'client'] },
  // Lab operations
  { label: 'Instruments',      href: '/dashboard/instruments',      icon: 'precision_manufacturing', roles: ['admin', 'lab_manager', 'analyst', 'client'] },
  { label: 'Quality',          href: '/dashboard/quality',          icon: 'verified',                roles: ['admin', 'lab_manager', 'analyst', 'reviewer', 'client'] },
  { label: 'Reports',          href: '/dashboard/reports',          icon: 'bar_chart',               roles: null },
  { label: 'Administration',   href: '/dashboard/admin',            icon: 'admin_panel_settings',    roles: ['admin'] },
]

interface Props {
  onToggle?: () => void
  role?: string
}

export default function Sidebar({ onToggle, role }: Props) {
  const pathname = usePathname()
  const visibleNav = NAV.filter(item => !item.roles || (role && item.roles.includes(role)))

  return (
    <div className="flex flex-col h-full" style={{ width: 210, backgroundColor: '#0B1E47', borderRight: '1px solid #E5E7EB' }}>

      {/* Header: same height as topbar h-14 = 56px, white bg, bottom border matches topbar */}
      <div
        className="flex items-center px-4"
        style={{
          height: 56,
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #E5E7EB',
          flexShrink: 0,
        }}
      >
        <Image
          src="/xellabs-logo.png"
          alt="XelLabs LIMS"
          width={110}
          height={32}
          style={{ objectFit: 'contain' }}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto py-3 px-2">
        {visibleNav.map(item => {
          const active = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-xs font-medium transition-all"
              style={
                active
                  ? { backgroundColor: '#2563EB', color: '#fff' }
                  : { color: 'rgba(255,255,255,0.65)' }
              }
            >
              <MI name={item.icon} size={16} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Need Help */}
      <div className="mx-3 mb-2 rounded-xl p-3" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2 mb-1">
          <MI name="support_agent" size={14} />
          <p className="text-xs font-semibold" style={{ color: '#fff' }}>Need Help?</p>
        </div>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
          Contact support for assistance.
        </p>
        <p style={{ fontSize: 10, color: '#14B8A6', marginTop: 3 }}>support@xellabs.com</p>
      </div>

      {/* Collapse */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <button
          onClick={onToggle}
          className="flex items-center gap-2 w-full px-5 py-3 text-xs"
          style={{ color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}
        >
          <MI name="chevron_left" size={15} />
          Collapse
        </button>
      </div>
    </div>
  )
}

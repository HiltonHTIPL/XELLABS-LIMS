'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import CommandPalette from './CommandPalette'
import { logout } from '@/app/actions/auth'
import { ENV_OVERRIDE_EVENT, getEnvOverride, type EnvLabel } from '@/app/lib/envOverride'

// Simple list/table pages where short (or filtered/last-page) results should
// let the footer follow the content instead of being pinned to the viewport
// bottom, which otherwise leaves a large empty gap above it. Deliberately an
// allowlist, not the default — most pages (Storage Manager, Worksheet, etc.)
// rely on `main` being a fixed-height container to drive their own internal
// full-height split-pane/grid layouts, and switching that globally silently
// collapses those to near-zero height instead (confirmed regression, reverted
// once already — do not flip the default without re-checking every page that
// uses height:'100%'/similar inside `main`).
const NATURAL_HEIGHT_ROUTES = ['/dashboard/clients']

const ENV_BADGE_STYLE: Record<EnvLabel, { bg: string; border: string; dot: string; text: string }> = {
  Development: { bg: '#DCFCE7', border: '#86EFAC', dot: '#16A34A', text: '#16A34A' },
  QA:          { bg: '#FEF3C7', border: '#FCD34D', dot: '#B45309', text: '#B45309' },
  Staging:     { bg: '#FAF5FF', border: '#D8B4FE', dot: '#7C3AED', text: '#7C3AED' },
  Production:  { bg: '#DBEAFE', border: '#93C5FD', dot: '#0154FC', text: '#0154FC' },
}

export type NotificationItem = {
  id: number
  title: string
  priority?: string
  due_date?: string | null
}

interface Props {
  children: React.ReactNode
  initials: string
  displayName: string
  roleLabel: string
  role: string
  reportDraftCount?: number
  isSuperuser?: boolean
  /** Resolved server-side at request time — build-time NEXT_PUBLIC_* is stale in Docker */
  serverEnvLabel?: EnvLabel
  notifications?: NotificationItem[]
}

export default function DashboardShell({ children, initials, displayName, roleLabel, role, reportDraftCount, isSuperuser, serverEnvLabel, notifications = [] }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const naturalHeight = NATURAL_HEIGHT_ROUTES.some(p => pathname?.startsWith(p))
  const [open, setOpen] = useState(true)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifBtnRef = useRef<HTMLButtonElement>(null)
  const notifPanelRef = useRef<HTMLDivElement>(null)
  const [notifPos, setNotifPos] = useState<{ top: number; right: number } | null>(null)
  const helpBtnRef = useRef<HTMLButtonElement>(null)
  const helpPanelRef = useRef<HTMLDivElement>(null)
  const [helpPos, setHelpPos] = useState<{ top: number; right: number } | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const buildEnvLabel: EnvLabel = serverEnvLabel
    ?? ((process.env.NEXT_PUBLIC_APP_ENV ?? 'development').toLowerCase() === 'production' ? 'Production' : 'Development')
  const [envLabel, setEnvLabel] = useState<EnvLabel>(buildEnvLabel)

  useEffect(() => {
    function syncEnvOverride() {
      setEnvLabel(getEnvOverride() ?? buildEnvLabel)
    }
    syncEnvOverride()
    window.addEventListener(ENV_OVERRIDE_EVENT, syncEnvOverride)
    window.addEventListener('storage', syncEnvOverride)
    return () => {
      window.removeEventListener(ENV_OVERRIDE_EVENT, syncEnvOverride)
      window.removeEventListener('storage', syncEnvOverride)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
      if (
        notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node) &&
        notifBtnRef.current && !notifBtnRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false)
      }
      if (
        helpPanelRef.current && !helpPanelRef.current.contains(e.target as Node) &&
        helpBtnRef.current && !helpBtnRef.current.contains(e.target as Node)
      ) {
        setHelpPos(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggleNotifications() {
    if (!notifOpen && notifBtnRef.current) {
      const rect = notifBtnRef.current.getBoundingClientRect()
      setNotifPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
    }
    setNotifOpen(o => !o)
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Sidebar */}
      <div
        style={{
          width: open ? 210 : 0,
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.25s ease-in-out',
        }}
      >
        <div style={{ width: 210, height: '100%' }}>
          <Sidebar onToggle={() => setOpen(false)} role={role} reportDraftCount={reportDraftCount} isSuperuser={isSuperuser} />
        </div>
      </div>

      {/* Main column — most pages keep `main` as a fixed-height flex-1 scroll
          container (needed by split-pane pages like Storage Manager, whose
          internal panels fill it via height:'100%'). Pages listed in
          NATURAL_HEIGHT_ROUTES instead scroll as a single column so their
          footer follows short content instead of sitting pinned far below it. */}
      <div className={`flex-1 flex flex-col min-w-0 ${naturalHeight ? 'overflow-y-auto' : 'overflow-hidden'}`}>

        {/* Navbar */}
        <header
          className="flex items-center gap-3 px-4 h-14 shrink-0"
          style={{
            backgroundColor: '#fff', borderBottom: '1px solid #E8EAF2', zIndex: 10,
            ...(naturalHeight ? { position: 'sticky' as const, top: 0 } : {}),
          }}
        >
          {/* Hamburger */}
          <button
            className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0"
            style={{ cursor: 'pointer' }}
            onClick={() => setOpen(o => !o)}
          >
            <span className="material-icons" style={{ fontSize: 20, color: '#6B7280' }}>menu</span>
          </button>

          {/* Environment badge — defaults to build's NEXT_PUBLIC_APP_ENV, overridable in Account Settings */}
          {(() => {
            const style = ENV_BADGE_STYLE[envLabel]
            return (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0"
                style={{ backgroundColor: style.bg, border: `1px solid ${style.border}` }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
                <span className="text-xs font-semibold" style={{ color: style.text }}>
                  {envLabel.toUpperCase()}
                </span>
              </div>
            )
          })()}

          {/* Search — opens the universal command palette (⌘K / Ctrl+K) */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center flex-1 max-w-md gap-2 px-3 py-1.5 rounded-lg ml-1"
            style={{ backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB', cursor: 'pointer' }}
          >
            <span className="material-icons" style={{ fontSize: 16, color: '#9CA3AF' }}>search</span>
            <span className="flex-1 text-left text-sm" style={{ color: '#9CA3AF' }}>Search samples, IDs, projects, users...</span>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#E5E7EB', color: '#9CA3AF' }}>⌘ K</span>
          </button>
          <CommandPalette role={role} isSuperuser={isSuperuser} open={paletteOpen} onClose={() => setPaletteOpen(false)} />

          <div className="flex-1" />

          {/* Notifications — open workflow tasks */}
          <button ref={notifBtnRef} onClick={toggleNotifications} className="relative p-1.5 rounded-lg hover:bg-gray-100" style={{ cursor: 'pointer' }} title="Notifications">
            <span className="material-icons" style={{ fontSize: 20, color: '#6B7280' }}>notifications</span>
            {notifications.length > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
                style={{ backgroundColor: '#3B82F6', fontSize: 9 }}
              >
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>

          {/* Notifications dropdown — position:fixed so no overflow-hidden ancestor clips it */}
          {notifOpen && notifPos && (
            <div ref={notifPanelRef} className="rounded-xl overflow-hidden"
              style={{ position: 'fixed', top: notifPos.top, right: notifPos.right, width: 300, zIndex: 9999, backgroundColor: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
                <span className="text-sm font-semibold" style={{ color: '#111827' }}>Notifications</span>
                <span style={{ fontSize: 10, color: '#9CA3AF' }}>{notifications.length} open task{notifications.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center py-8">
                    <span className="material-icons" style={{ fontSize: 28, color: '#D1D5DB' }}>notifications_off</span>
                    <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>No open tasks — you're all caught up.</p>
                  </div>
                ) : (
                  notifications.slice(0, 8).map(n => (
                    <button key={n.id}
                      className="flex items-start gap-2.5 w-full px-4 py-2.5 text-left hover:bg-gray-50"
                      style={{ background: 'none', border: 'none', borderBottom: '1px solid #F9FAFB', cursor: 'pointer' }}
                      onClick={() => { setNotifOpen(false); router.push('/dashboard/tasks') }}>
                      <span className="material-icons" style={{ fontSize: 16, color: n.priority === 'urgent' || n.priority === 'high' ? '#EF4444' : '#0154FC', marginTop: 1 }}>assignment</span>
                      <span style={{ minWidth: 0 }}>
                        <span className="block text-xs font-medium truncate" style={{ color: '#111827' }}>{n.title}</span>
                        {n.due_date && <span style={{ fontSize: 10, color: '#9CA3AF' }}>Due {new Date(n.due_date).toLocaleDateString('en-GB')}</span>}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <button
                className="w-full py-2.5 text-xs font-semibold hover:bg-gray-50"
                style={{ color: '#0154FC', background: 'none', border: 'none', borderTop: '1px solid #F3F4F6', cursor: 'pointer' }}
                onClick={() => { setNotifOpen(false); router.push('/dashboard/tasks') }}>
                View all tasks
              </button>
            </div>
          )}

          {/* Help */}
          <button ref={helpBtnRef} title="Help & support"
            onClick={() => {
              if (helpPos) { setHelpPos(null); return }
              const rect = helpBtnRef.current!.getBoundingClientRect()
              setHelpPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100" style={{ cursor: 'pointer' }}>
            <span className="material-icons" style={{ fontSize: 20, color: '#6B7280' }}>help_outline</span>
          </button>
          {helpPos && (
            <div ref={helpPanelRef} className="rounded-xl"
              style={{ position: 'fixed', top: helpPos.top, right: helpPos.right, width: 260, zIndex: 9999, backgroundColor: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 14 }}>
              <p className="text-sm font-semibold" style={{ color: '#111827', margin: '0 0 4px' }}>Help & Support</p>
              <p className="text-xs" style={{ color: '#6B7280', margin: '0 0 10px', lineHeight: 1.5 }}>
                Questions or issues with XelLabs LIMS? Reach out to the support team.
              </p>
              <a href="mailto:support@hephzibahtech.com?subject=XelLabs%20LIMS%20Support"
                className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg hover:bg-gray-50"
                style={{ border: '1px solid #E5E7EB', color: '#0154FC', textDecoration: 'none' }}
                onClick={() => setHelpPos(null)}>
                <span className="material-icons" style={{ fontSize: 15 }}>mail_outline</span>
                Contact Support
              </a>
              <p style={{ fontSize: 10, color: '#9CA3AF', margin: '10px 0 0' }}>
                XelLabs LIMS · supported by Hephzibah Technologies
              </p>
            </div>
          )}

          {/* User dropdown */}
          <div ref={userMenuRef} className="relative pl-3" style={{ borderLeft: '1px solid #E5E7EB' }}>
            <button
              className="flex items-center gap-2"
              onClick={() => setUserMenuOpen(o => !o)}
            >
              <div className="text-right">
                <div className="flex items-center gap-0.5">
                  <p className="text-xs font-semibold" style={{ color: '#111827' }}>{displayName}</p>
                  <span
                    className="material-icons"
                    style={{
                      fontSize: 16,
                      color: '#9CA3AF',
                      transition: 'transform 0.2s',
                      transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  >
                    keyboard_arrow_down
                  </span>
                </div>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>{roleLabel}</p>
              </div>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: '#14265E' }}
              >
                {initials}
              </div>
            </button>

            {/* Dropdown */}
            {userMenuOpen && (
              <div
                className="absolute right-0 mt-2 rounded-xl overflow-hidden"
                style={{
                  top: '100%',
                  minWidth: 200,
                  backgroundColor: '#fff',
                  border: '1px solid #E5E7EB',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                  zIndex: 100,
                }}
              >
                <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: '#14265E' }}
                  >
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#111827' }}>{displayName}</p>
                    <p style={{ fontSize: 11, color: '#9CA3AF' }}>{roleLabel}</p>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-left hover:bg-gray-50"
                    style={{ color: '#374151' }}
                    onClick={() => { setUserMenuOpen(false); router.push('/dashboard/account-settings') }}
                  >
                    <span className="material-icons" style={{ fontSize: 16, color: '#9CA3AF' }}>person</span>
                    My Profile
                  </button>
                  <button
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-left hover:bg-gray-50"
                    style={{ color: '#374151' }}
                    onClick={() => { setUserMenuOpen(false); router.push('/dashboard/account-settings') }}
                  >
                    <span className="material-icons" style={{ fontSize: 16, color: '#9CA3AF' }}>settings</span>
                    Account Settings
                  </button>
                </div>

                <div style={{ borderTop: '1px solid #F3F4F6' }} className="py-1">
                  <form action={logout}>
                    <button
                      type="submit"
                      className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-left hover:bg-red-50"
                      style={{ color: '#EF4444' }}
                    >
                      <span className="material-icons" style={{ fontSize: 16, color: '#EF4444' }}>logout</span>
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className={naturalHeight ? '' : 'flex-1 overflow-y-auto'}>
          {children}
        </main>

        {/* Universal footer — full width of content area */}
        <div
          className="flex items-center justify-between shrink-0 px-5 py-2.5"
          style={{ borderTop: '1px solid #E8EAF2', backgroundColor: '#fff', fontSize: 11, color: '#9AA1B2' }}
        >
          <span>© 2026 XELLABS LIMS. All rights reserved.</span>
          <div className="flex items-center gap-3">
            <a href="mailto:support@hephzibahtech.com?subject=XelLabs%20LIMS%20Support" className="hover:text-gray-600">Contact Support</a>
            <span>|</span>
            <span>Secure. Compliant. Reliable.</span>
          </div>
        </div>
      </div>
    </div>
  )
}

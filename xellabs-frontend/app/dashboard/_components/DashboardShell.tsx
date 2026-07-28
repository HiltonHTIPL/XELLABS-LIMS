'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import CommandPalette from './CommandPalette'
import { logout } from '@/app/actions/auth'
import { ENV_OVERRIDE_EVENT, getEnvOverride, type EnvLabel } from '@/app/lib/envOverride'

// Reverted (2026-07-16): a "natural height" mode used to let the footer
// follow short content on this route instead of staying pinned to the
// viewport bottom. That left the footer floating mid-page with a mismatched
// blank strip BELOW it (the column wrapper still stretches to match the
// sidebar's full height, so shrinking header+content+footer to their own
// content height just relocates the empty space rather than removing it).
// The footer must always sit pinned at the true viewport bottom, matching
// every other page (Storage Manager, Worksheet, etc.) — short content
// leaving blank space ABOVE a bottom-pinned footer is normal, expected
// app-shell behavior, not a bug. Keep this empty rather than deleting the
// mechanism outright in case a genuine future page needs it.
const NATURAL_HEIGHT_ROUTES: string[] = []

const ENV_BADGE_STYLE: Record<EnvLabel, { bg: string; border: string; dot: string; text: string }> = {
  Development: { bg: '#DCFCE7', border: '#86EFAC', dot: '#16A34A', text: '#16A34A' },
  Testing:     { bg: '#FFEDD5', border: '#FDBA74', dot: '#EA580C', text: '#EA580C' },
  QA:          { bg: '#FEF3C7', border: '#FCD34D', dot: '#B45309', text: '#B45309' },
  Staging:     { bg: '#FAF5FF', border: '#D8B4FE', dot: '#7C3AED', text: '#7C3AED' },
  Production:  { bg: '#DBEAFE', border: '#93C5FD', dot: '#0154FC', text: '#0154FC' },
}

export type NotificationItem = {
  id: number
  title: string
  priority?: string
  due_date?: string | null
  status?: string
}

interface Props {
  children: React.ReactNode
  initials: string
  displayName: string
  roleLabel: string
  role: string
  // Raw SENAITE roles from login — nav/admin visibility honors ALL of these,
  // not just the single primary `role` (see mapSenaiteRolesAll in lib/roles.ts).
  senaiteRoles?: string[]
  reportDraftCount?: number
  isSuperuser?: boolean
  /** Resolved server-side at request time — build-time NEXT_PUBLIC_* is stale in Docker */
  serverEnvLabel?: EnvLabel
  notifications?: NotificationItem[]
}

export default function DashboardShell({ children, initials, displayName, roleLabel, role, senaiteRoles, reportDraftCount, isSuperuser, serverEnvLabel, notifications = [] }: Props) {
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
    <div
      className="flex flex-1 min-h-0 overflow-hidden"
      style={{ '--dashboard-header-h': '56px', '--dashboard-footer-h': '40px' } as React.CSSProperties}
    >
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
          <Sidebar onToggle={() => setOpen(false)} role={role} senaiteRoles={senaiteRoles} reportDraftCount={reportDraftCount} isSuperuser={isSuperuser} />
        </div>
      </div>

      {/* Main column — most pages keep `main` as a fixed-height flex-1 scroll
          container (needed by split-pane pages like Storage Manager, whose
          internal panels fill it via height:'100%'). Pages listed in
          NATURAL_HEIGHT_ROUTES instead scroll as a single column so their
          footer follows short content instead of sitting pinned far below it. */}
      <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${naturalHeight ? 'overflow-y-auto' : 'overflow-hidden'}`}>

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
            <span className="material-icons" style={{ fontSize: 20, color: '#374151' }}>menu</span>
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
            className="flex items-center flex-1 min-w-0 max-w-md gap-2 px-3 py-1.5 rounded-lg ml-1"
            style={{ backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB', cursor: 'pointer' }}
          >
            <span className="material-icons shrink-0" style={{ fontSize: 16, color: '#374151' }}>search</span>
            <span
              className="flex-1 min-w-0 text-left text-sm"
              style={{ color: '#374151', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
            >
              Search samples, IDs, projects, users...
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: '#E5E7EB', color: '#374151' }}>⌘ K</span>
          </button>
          <CommandPalette role={role} senaiteRoles={senaiteRoles} isSuperuser={isSuperuser} open={paletteOpen} onClose={() => setPaletteOpen(false)} />

          <div className="flex-1" />

          {/* Notifications — open workflow tasks */}
          {(() => {
            const hasOverdue = notifications.some(n => n.due_date && new Date(n.due_date) < new Date())
            return (
              <button ref={notifBtnRef} onClick={toggleNotifications} className="relative p-1.5 rounded-lg hover:bg-gray-100" style={{ cursor: 'pointer' }} title="Notifications">
                <span className="material-icons" style={{ fontSize: 20, color: '#374151' }}>notifications</span>
                {notifications.length > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
                    style={{ backgroundColor: hasOverdue ? '#EF4444' : '#3B82F6', fontSize: 9 }}
                  >
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
              </button>
            )
          })()}

          {/* Notifications dropdown — position:fixed so no overflow-hidden ancestor clips it */}
          {notifOpen && notifPos && (
            <div ref={notifPanelRef} className="rounded-xl overflow-hidden"
              style={{ position: 'fixed', top: notifPos.top, right: notifPos.right, width: 320, zIndex: 9999, backgroundColor: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
                <span className="text-sm font-semibold" style={{ color: '#111827' }}>Notifications</span>
                <span style={{ fontSize: 10, color: '#374151' }}>{notifications.length} open task{notifications.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center py-8">
                    <span className="material-icons" style={{ fontSize: 28, color: '#D1D5DB' }}>notifications_off</span>
                    <p className="text-xs mt-2" style={{ color: '#374151' }}>No open tasks — you're all caught up.</p>
                  </div>
                ) : (
                  notifications.slice(0, 8).map(n => {
                    const isOverdue = Boolean(n.due_date && new Date(n.due_date) < new Date())
                    return (
                      <button key={n.id}
                        className="flex items-start gap-2.5 w-full px-4 py-2.5 text-left hover:bg-gray-50"
                        style={{ background: 'none', border: 'none', borderBottom: '1px solid #F9FAFB', cursor: 'pointer' }}
                        onClick={() => { setNotifOpen(false); router.push('/dashboard/tasks') }}>
                        <span className="material-icons" style={{ fontSize: 16, color: isOverdue || n.priority === 'urgent' || n.priority === 'high' ? '#EF4444' : '#0154FC', marginTop: 1 }}>assignment</span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span className="block text-xs font-medium truncate" style={{ color: '#111827' }}>{n.title}</span>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {n.due_date && (
                              <span style={{ fontSize: 10, color: isOverdue ? '#EF4444' : '#6B7280', fontWeight: isOverdue ? 600 : 400 }}>
                                Due {new Date(n.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                {isOverdue && ' (Overdue)'}
                              </span>
                            )}
                            {n.status && (
                              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, backgroundColor: '#F3F4F6', color: '#4B5563', textTransform: 'capitalize' }}>
                                {n.status.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                        </span>
                      </button>
                    )
                  })
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
            <span className="material-icons" style={{ fontSize: 20, color: '#374151' }}>help_outline</span>
          </button>
          {helpPos && (
            <div ref={helpPanelRef} className="rounded-xl"
              style={{ position: 'fixed', top: helpPos.top, right: helpPos.right, width: 260, zIndex: 9999, backgroundColor: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 14 }}>
              <p className="text-sm font-semibold" style={{ color: '#111827', margin: '0 0 4px' }}>Help & Support</p>
              <p className="text-xs" style={{ color: '#374151', margin: '0 0 10px', lineHeight: 1.5 }}>
                Questions or issues with XelLabs LIMS? Reach out to the support team.
              </p>
              <a href="mailto:support@hephzibahtech.com?subject=XelLabs%20LIMS%20Support"
                className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg hover:bg-gray-50"
                style={{ border: '1px solid #E5E7EB', color: '#0154FC', textDecoration: 'none' }}
                onClick={() => setHelpPos(null)}>
                <span className="material-icons" style={{ fontSize: 15 }}>mail_outline</span>
                Contact Support
              </a>
              <p style={{ fontSize: 10, color: '#374151', margin: '10px 0 0' }}>
                XelLabs LIMS · supported by Hephzibah Technologies
              </p>
            </div>
          )}

          {/* User dropdown */}
          <div ref={userMenuRef} className="relative pl-3 shrink-0" style={{ borderLeft: '1px solid #E5E7EB' }}>
            <button
              className="flex items-center gap-2.5"
              onClick={() => setUserMenuOpen(o => !o)}
            >
              <div className="flex flex-col items-center justify-center" style={{ textAlign: 'center', gap: 1 }}>
                <div className="flex items-center gap-1">
                  <p className="text-xs font-semibold" style={{ color: '#111827', margin: 0, lineHeight: 1.2 }}>{displayName}</p>
                  <span
                    className="material-icons"
                    style={{
                      fontSize: 15,
                      color: '#374151',
                      lineHeight: 1,
                      transition: 'transform 0.2s',
                      transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  >
                    keyboard_arrow_down
                  </span>
                </div>
                <p style={{ fontSize: 10, color: '#374151', margin: 0, lineHeight: 1.2, textAlign: 'center' }}>{roleLabel}</p>
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
                    <p style={{ fontSize: 11, color: '#374151' }}>{roleLabel}</p>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-left hover:bg-gray-50"
                    style={{ color: '#374151' }}
                    onClick={() => { setUserMenuOpen(false); router.push('/dashboard/account-settings') }}
                  >
                    <span className="material-icons" style={{ fontSize: 16, color: '#374151' }}>person</span>
                    My Profile
                  </button>
                  <button
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-left hover:bg-gray-50"
                    style={{ color: '#374151' }}
                    onClick={() => { setUserMenuOpen(false); router.push('/dashboard/account-settings') }}
                  >
                    <span className="material-icons" style={{ fontSize: 16, color: '#374151' }}>settings</span>
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
        <main className={naturalHeight ? 'dashboard-main-scroll' : 'flex-1 overflow-auto dashboard-main-scroll'}>
          {children}
        </main>

        {/* Universal footer — full width of content area. Height is explicit
            (not just padding-derived) so it exactly matches --dashboard-footer-h,
            the value every drawer/modal overlay bounds itself against. */}
        <div
          className="flex items-center justify-between shrink-0 px-5"
          style={{ height: 40, borderTop: '1px solid #E8EAF2', backgroundColor: '#fff', fontSize: 11, color: '#374151' }}
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

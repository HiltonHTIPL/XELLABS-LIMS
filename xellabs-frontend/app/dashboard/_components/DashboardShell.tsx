'use client'
import { useState, useRef, useEffect } from 'react'
import Sidebar from './Sidebar'
import { logout } from '@/app/actions/auth'

interface Props {
  children: React.ReactNode
  initials: string
  displayName: string
  roleLabel: string
  role: string
}

export default function DashboardShell({ children, initials, displayName, roleLabel, role }: Props) {
  const [open, setOpen] = useState(true)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
          <Sidebar onToggle={() => setOpen(false)} role={role} />
        </div>
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Navbar */}
        <header
          className="flex items-center gap-3 px-4 h-14 shrink-0"
          style={{ backgroundColor: '#fff', borderBottom: '1px solid #E5E7EB', zIndex: 10 }}
        >
          {/* Hamburger */}
          <button
            className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0"
            style={{ cursor: 'pointer' }}
            onClick={() => setOpen(o => !o)}
          >
            <span className="material-icons" style={{ fontSize: 20, color: '#6B7280' }}>menu</span>
          </button>

          {/* PRODUCTION badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0"
            style={{ backgroundColor: '#DCFCE7', border: '1px solid #BBF7D0' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#16A34A' }} />
            <span className="text-xs font-semibold" style={{ color: '#15803D' }}>PRODUCTION</span>
          </div>

          {/* Search */}
          <div
            className="flex items-center flex-1 max-w-md gap-2 px-3 py-1.5 rounded-lg ml-1"
            style={{ backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB' }}
          >
            <span className="material-icons" style={{ fontSize: 16, color: '#9CA3AF' }}>search</span>
            <input
              type="text"
              placeholder="Search samples, IDs, projects, users..."
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: '#374151' }}
            />
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#E5E7EB', color: '#9CA3AF' }}>⌘ K</span>
          </div>

          <div className="flex-1" />

          {/* Notifications — blue badge */}
          <button className="relative p-1.5 rounded-lg hover:bg-gray-100">
            <span className="material-icons" style={{ fontSize: 20, color: '#6B7280' }}>notifications</span>
            <span
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
              style={{ backgroundColor: '#3B82F6', fontSize: 9 }}
            >
              3
            </span>
          </button>

          {/* Help */}
          <button className="p-1.5 rounded-lg hover:bg-gray-100">
            <span className="material-icons" style={{ fontSize: 20, color: '#6B7280' }}>help_outline</span>
          </button>

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
                style={{ backgroundColor: '#14B8A6' }}
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
                    style={{ backgroundColor: '#14B8A6' }}
                  >
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#111827' }}>{displayName}</p>
                    <p style={{ fontSize: 11, color: '#9CA3AF' }}>{roleLabel}</p>
                  </div>
                </div>

                <div className="py-1">
                  <button className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-left hover:bg-gray-50" style={{ color: '#374151' }}>
                    <span className="material-icons" style={{ fontSize: 16, color: '#9CA3AF' }}>person</span>
                    My Profile
                  </button>
                  <button className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-left hover:bg-gray-50" style={{ color: '#374151' }}>
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
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Universal footer — full width of content area */}
        <div
          className="flex items-center justify-between shrink-0 px-5 py-2.5"
          style={{ borderTop: '1px solid #E5E7EB', backgroundColor: '#fff', fontSize: 11, color: '#9CA3AF' }}
        >
          <span>© 2025 XELLABS LIMS. All rights reserved.</span>
          <div className="flex items-center gap-3">
            <a href="#" className="hover:text-gray-600">Privacy Policy</a>
            <span>|</span>
            <a href="#" className="hover:text-gray-600">Terms of Use</a>
            <span>|</span>
            <a href="#" className="hover:text-gray-600">Security</a>
          </div>
        </div>
      </div>
    </div>
  )
}

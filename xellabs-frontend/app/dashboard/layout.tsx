import { getSession } from '@/app/lib/session'
import { redirect } from 'next/navigation'
import DashboardShell from './_components/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const initials = session.username.slice(0, 2).toUpperCase()
  const displayName = session.username
    .split(/[_\s]/)
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  const roleLabel = session.role
    .replace(/_/g, ' ')
    .split(' ')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: '#F5F6FA' }}>
      <DashboardShell initials={initials} displayName={displayName} roleLabel={roleLabel} role={session.role}>
        {children}
      </DashboardShell>

      {/* Full-width footer — commented out
      <footer
        className="flex items-center justify-between px-6 py-3 text-xs flex-shrink-0"
        style={{ backgroundColor: '#0B1E47', color: 'rgba(255,255,255,0.55)' }}
      >
        <div className="flex items-center gap-2">
          <span className="material-icons" style={{ fontSize: 14, color: '#14B8A6' }}>security</span>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>Secure. Compliant. Reliable.</span>
          <span className="mx-1" style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
          <span>XelLabs LIMS is configured and supported by Hephzibah Technologies Inc.</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="#" style={{ color: 'rgba(255,255,255,0.45)' }}>Contact Us</a>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
          <a href="#" style={{ color: 'rgba(255,255,255,0.45)' }}>Privacy Policy</a>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
          <a href="#" style={{ color: 'rgba(255,255,255,0.45)' }}>Terms of Use</a>
        </div>
      </footer>
      */}
    </div>
  )
}

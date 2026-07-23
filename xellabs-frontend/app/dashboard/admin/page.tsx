import { getSession } from '@/app/lib/session'
import { PageHeader } from '../_components/ui'
import { ADMIN_SECTIONS } from '../_components/adminNav'
import { listEntity } from '@/app/lib/admin-crud'
import { mapSenaiteRolesAll } from '@/app/lib/roles'
import AdminGridShell from './_components/AdminGridShell'

export default async function AdminHomePage() {
  const session = await getSession()
  const role = session?.role ?? ''
  // Same "any granted role, not just the single primary one" rule as the
  // sidebar (Sidebar.tsx's isVisible) — a section visible to Verifier must
  // still show up for someone whose primary role is LabManager but who's
  // also checked as Verifier in the SENAITE role matrix.
  const allRoles = new Set([role, ...mapSenaiteRolesAll(session?.senaiteRoles)].filter(Boolean))
  const visible = ADMIN_SECTIONS.filter(s => s.roles === null || s.roles.some(r => allRoles.has(r)))

  const counted = visible.filter(s => s.countPortalType)
  const counts = await Promise.all(
    counted.map(s => listEntity(s.countPortalType!, () => null).then(items => items.length)),
  )
  const countsByLabel = Object.fromEntries(counted.map((s, i) => [s.label, counts[i]]))

  return (
    <div className="p-6">
      <PageHeader title="Administration" subtitle="Configure and manage lab setup, users, and reference data" />
      <AdminGridShell sections={visible} counts={countsByLabel} />
    </div>
  )
}

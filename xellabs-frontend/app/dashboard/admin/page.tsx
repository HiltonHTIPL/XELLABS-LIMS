import { getSession } from '@/app/lib/session'
import { PageHeader, LinkTile } from '../_components/ui'
import { ADMIN_SECTIONS } from '../_components/adminNav'

export default async function AdminHomePage() {
  const session = await getSession()
  const role = session?.role ?? ''
  const visible = ADMIN_SECTIONS.filter(s => s.roles === null || s.roles.includes(role))

  return (
    <div className="p-6">
      <PageHeader title="Administration" subtitle="Configure and manage lab setup, users, and reference data" />
      <div className="grid grid-cols-4 gap-4">
        {visible.map(section => (
          <LinkTile key={section.href} href={section.href} icon={section.icon} label={section.label} />
        ))}
      </div>
    </div>
  )
}

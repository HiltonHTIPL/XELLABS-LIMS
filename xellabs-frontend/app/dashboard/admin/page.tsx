import { getSession } from '@/app/lib/session'
import { PageHeader } from '../_components/ui'
import { ADMIN_SECTIONS } from '../_components/adminNav'
import AdminGridShell from './_components/AdminGridShell'

export default async function AdminHomePage() {
  const session = await getSession()
  const role = session?.role ?? ''
  const visible = ADMIN_SECTIONS.filter(s => s.roles === null || s.roles.includes(role))

  return (
    <div className="p-6">
      <PageHeader title="Administration" subtitle="Configure and manage lab setup, users, and reference data" />
      <AdminGridShell sections={visible} />
    </div>
  )
}

import { redirect } from 'next/navigation'
import { getSession } from '@/app/lib/session'
import { getTenants } from '@/app/actions/tenants'
import TenantManagementShell from './_components/TenantManagementShell'

export default async function TenantManagementPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.isSuperuser) redirect('/dashboard')

  const tenants = await getTenants()
  return <TenantManagementShell tenants={tenants} />
}

import { redirect } from 'next/navigation'
import { getSession } from '@/app/lib/session'
import { getTenants } from '@/app/actions/tenants'
import TenantManagementShell from './_components/TenantManagementShell'

export default async function TenantManagementPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.isSuperuser) redirect('/dashboard')

  const tenants = await getTenants()
  // The platform's own organisation — the schema all default (non-subdomain) traffic maps to
  const orgSchema = process.env.DEFAULT_TENANT_SCHEMA ?? ''
  return <TenantManagementShell tenants={tenants} orgSchema={orgSchema} />
}

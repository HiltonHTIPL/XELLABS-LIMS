import { getTenants } from '@/app/actions/tenants'
import TenantsShell from './_components/TenantsShell'

export default async function TenantsPage() {
  const tenants = await getTenants()
  return <TenantsShell initialTenants={tenants} />
}

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getClient } from '@/app/actions/clients'
import { getTenant, getTenantUsers } from '@/app/actions/tenants'
import ClientDetailShell from './_components/ClientDetailShell'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = await getClient(Number(id))
  if (!client) notFound()

  const [tenant, users] = await Promise.all([
    client.tenant ? getTenant(client.tenant as unknown as number) : Promise.resolve(null),
    client.tenant ? getTenantUsers(client.tenant as unknown as number) : Promise.resolve([]),
  ])

  return <ClientDetailShell client={client} tenant={tenant} users={users} />
}

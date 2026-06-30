import { getClients } from '@/app/actions/clients'
import ClientsShell from './_components/ClientsShell'

export default async function ClientsPage() {
  const clients = await getClients()
  return <ClientsShell initialClients={clients} />
}

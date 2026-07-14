import { getSenaiteClients } from '@/app/actions/senaite-clients'
import ClientsShell from './_components/ClientsShell'

export default async function ClientsPage() {
  const clients = await getSenaiteClients()
  return <ClientsShell initialClients={clients} />
}

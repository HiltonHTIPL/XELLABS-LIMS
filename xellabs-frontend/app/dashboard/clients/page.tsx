import { getSenaiteClients } from '@/app/actions/senaite-clients'
import ClientsShell from './_components/ClientsShell'

export default async function ClientsPage() {
  // Clients are SENAITE-native (full CRUD lives there). The SENAITE uid is the
  // single client identity used everywhere — the Client ID cell links straight
  // to that client's samples via /dashboard/samples-overview?client=<uid>.
  const clients = await getSenaiteClients()
  return <ClientsShell initialClients={clients} />
}

import { getSenaiteClients } from '@/app/actions/senaite-clients'
import { getClients } from '@/app/actions/clients'
import ClientsShell from './_components/ClientsShell'

export default async function ClientsPage() {
  const [clients, djangoClients] = await Promise.all([getSenaiteClients(), getClients()])
  // Clients here are SENAITE-sourced (full CRUD lives there); Samples Overview's
  // client filter matches Django's own Client.id instead — this map bridges the
  // two identifier spaces so "Client Name" can link straight to that client's
  // samples instead of duplicating the "View Details" action.
  const clientIdByUid: Record<string, number> = {}
  for (const c of djangoClients) {
    if (c.senaite_uid) clientIdByUid[c.senaite_uid] = c.id
  }
  return <ClientsShell initialClients={clients} clientIdByUid={clientIdByUid} />
}

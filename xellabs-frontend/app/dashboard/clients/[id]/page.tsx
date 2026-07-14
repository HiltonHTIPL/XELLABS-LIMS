import { notFound } from 'next/navigation'
import { getSenaiteClient } from '@/app/actions/senaite-clients'
import ClientDetailShell from './_components/ClientDetailShell'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = await getSenaiteClient(id)
  if (!client) notFound()
  return <ClientDetailShell client={client} />
}

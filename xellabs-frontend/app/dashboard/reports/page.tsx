import { getReports } from '@/app/actions/reports'
import { getLabSamples, type LabSample } from '@/app/actions/lab-samples'
import { getClients, type DjangoClient } from '@/app/actions/clients'
import ReportsShell from './_components/ReportsShell'

export default async function ReportsPage() {
  const [reports, samplesRaw, clientsRaw] = await Promise.all([
    getReports(),
    getLabSamples(),
    getClients(),
  ])

  const samples: LabSample[] = Array.isArray(samplesRaw)
    ? samplesRaw
    : ((samplesRaw as Record<string, unknown>).results as LabSample[]) ?? []

  const clients: DjangoClient[] = Array.isArray(clientsRaw)
    ? clientsRaw
    : ((clientsRaw as Record<string, unknown>).results as DjangoClient[]) ?? []

  return (
    <ReportsShell
      initialReports={Array.isArray(reports) ? reports : []}
      samples={samples}
      clients={clients}
    />
  )
}

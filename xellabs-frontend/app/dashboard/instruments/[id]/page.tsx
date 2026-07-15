import { notFound } from 'next/navigation'
import { djangoFetch } from '@/app/lib/django'
import {
  getCertifications, getScheduledTasks, getValidations, getCalibrations, getMaintenances,
} from '@/app/actions/instrument-workflows'
import { getStaffUsers } from '@/app/actions/users'
import InstrumentDetailShell from './_components/InstrumentDetailShell'

async function getInstrument(id: string) {
  try {
    const res = await djangoFetch(`/api/instruments/instruments/${id}/`)
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

export default async function InstrumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const instrument = await getInstrument(id)
  if (!instrument) notFound()

  const numId = Number(id)
  const [certifications, scheduledTasks, validations, calibrations, maintenances, users] = await Promise.all([
    getCertifications(numId), getScheduledTasks(numId), getValidations(numId),
    getCalibrations(numId), getMaintenances(numId), getStaffUsers(),
  ])

  return (
    <InstrumentDetailShell
      instrument={instrument}
      users={users.map(u => ({ id: u.id, name: u.full_name || u.username }))}
      initial={{ certifications, scheduledTasks, validations, calibrations, maintenances }}
    />
  )
}

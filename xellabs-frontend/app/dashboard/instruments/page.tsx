import { redirect } from 'next/navigation'
import { getSession } from '@/app/lib/session'
import { getInstruments } from '@/app/actions/instruments'
import {
  getInstrumentTypes, getInstrumentLocations, getManufacturers, getSuppliers,
} from '@/app/actions/instrument-workflows'
import InstrumentsShell from './_components/InstrumentsShell'

export default async function InstrumentsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/dashboard')

  const [instruments, types, locations, manufacturers, suppliers] = await Promise.all([
    getInstruments(), getInstrumentTypes(), getInstrumentLocations(),
    getManufacturers(), getSuppliers(),
  ])
  return (
    <InstrumentsShell
      initialInstruments={instruments}
      types={types}
      locations={locations}
      manufacturers={manufacturers}
      suppliers={suppliers}
    />
  )
}

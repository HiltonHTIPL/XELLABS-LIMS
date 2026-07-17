import { redirect } from 'next/navigation'
import { getSession } from '@/app/lib/session'
import { getInstruments } from '@/app/actions/instruments'
import {
  getInstrumentTypes, getInstrumentLocations, getManufacturers, getSuppliers,
} from '@/app/actions/instrument-workflows'
import { getMethods } from '@/app/actions/methods'
import InstrumentsShell from './_components/InstrumentsShell'

export default async function InstrumentsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/dashboard')

  const [instruments, types, locations, manufacturers, suppliers, methods] = await Promise.all([
    getInstruments(), getInstrumentTypes(), getInstrumentLocations(),
    getManufacturers(), getSuppliers(), getMethods(),
  ])
  return (
    <InstrumentsShell
      initialInstruments={instruments}
      types={types}
      locations={locations}
      manufacturers={manufacturers}
      suppliers={suppliers}
      methods={methods.map(m => ({ id: m.id, name: m.name, code: m.code }))}
    />
  )
}

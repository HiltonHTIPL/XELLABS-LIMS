import { redirect } from 'next/navigation'
import { getSession } from '@/app/lib/session'
import { getInstruments } from '@/app/actions/instruments'
import {
  getInstrumentTypes, getInstrumentLocations, getManufacturers, getSuppliers,
} from '@/app/actions/instrument-workflows'
import { getMethods } from '@/app/actions/methods'
import {
  listSenaiteInstrumentRows, listInstrumentTypeOptions, listManufacturerOptions, listSupplierOptions, listMethodOptions,
} from '@/app/actions/senaite-instruments'
import InstrumentsPageShell from './_components/InstrumentsPageShell'

export const dynamic = 'force-dynamic'

export default async function InstrumentsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/dashboard')

  const [
    instruments, types, locations, manufacturers, suppliers, methods,
    senaiteInstruments, senaiteInstrumentTypes, senaiteManufacturers, senaiteSuppliers, senaiteMethods,
  ] = await Promise.all([
    getInstruments(), getInstrumentTypes(), getInstrumentLocations(),
    getManufacturers(), getSuppliers(), getMethods(),
    listSenaiteInstrumentRows(), listInstrumentTypeOptions(), listManufacturerOptions(), listSupplierOptions(), listMethodOptions(),
  ])
  return (
    <InstrumentsPageShell
      initialInstruments={instruments}
      types={types}
      locations={locations}
      manufacturers={manufacturers}
      suppliers={suppliers}
      methods={methods.map(m => ({ id: m.id, name: m.name, code: m.code }))}
      senaiteInstruments={senaiteInstruments}
      senaiteInstrumentTypes={senaiteInstrumentTypes}
      senaiteManufacturers={senaiteManufacturers}
      senaiteSuppliers={senaiteSuppliers}
      senaiteMethods={senaiteMethods}
    />
  )
}

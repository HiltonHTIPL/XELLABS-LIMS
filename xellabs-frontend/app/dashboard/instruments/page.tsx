import { getInstruments } from '@/app/actions/instruments'
import { getInstrumentTypes, getInstrumentLocations } from '@/app/actions/instrument-workflows'
import InstrumentsShell from './_components/InstrumentsShell'

export default async function InstrumentsPage() {
  const [instruments, types, locations] = await Promise.all([
    getInstruments(), getInstrumentTypes(), getInstrumentLocations(),
  ])
  return <InstrumentsShell initialInstruments={instruments} types={types} locations={locations} />
}

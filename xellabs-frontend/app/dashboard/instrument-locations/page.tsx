import { listInstrumentLocations } from '@/app/actions/instrument-locations'
import InstrumentLocationsShell from './_components/InstrumentLocationsShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const rows = await listInstrumentLocations()
  return <InstrumentLocationsShell rows={rows} />
}

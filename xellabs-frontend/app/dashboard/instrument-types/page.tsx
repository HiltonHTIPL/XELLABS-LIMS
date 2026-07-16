import { listInstrumentTypes } from '@/app/actions/instrument-types'
import InstrumentTypesShell from './_components/InstrumentTypesShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const rows = await listInstrumentTypes()
  return <InstrumentTypesShell rows={rows} />
}

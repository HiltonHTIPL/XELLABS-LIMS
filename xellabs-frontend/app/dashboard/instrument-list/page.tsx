import InstrumentListShell from './_components/InstrumentListShell'
import { getInstrumentsList } from '@/app/actions/senaite-import'

export default async function InstrumentListPage() {
  const instruments = await getInstrumentsList()
  return <InstrumentListShell initialInstruments={instruments} />
}

import { getInstruments } from '@/app/actions/instruments'
import InstrumentsShell from './_components/InstrumentsShell'

export default async function InstrumentsPage() {
  const instruments = await getInstruments()
  return <InstrumentsShell initialInstruments={instruments} />
}

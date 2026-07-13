import { getInstrumentOptions, getInstrumentResultImports } from '@/app/actions/instrument-maintenance'
import InstrumentImportShell from './_components/InstrumentImportShell'

export default async function InstrumentImportPage() {
  const [instruments, history] = await Promise.all([
    getInstrumentOptions(),
    getInstrumentResultImports(),
  ])

  return <InstrumentImportShell instruments={instruments} history={history} />
}

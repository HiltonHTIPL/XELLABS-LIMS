import { getMethods } from '@/app/actions/methods'
import { getCalculations } from '@/app/actions/calculations'
import { getInstrumentOptions } from '@/app/actions/instrument-maintenance'
import MethodsShell from './_components/MethodsShell'

export default async function MethodsPage() {
  const [methods, calculations, instruments] = await Promise.all([
    getMethods(),
    getCalculations(),
    getInstrumentOptions(),
  ])
  return <MethodsShell initialMethods={methods} calculations={calculations} instruments={instruments} />
}

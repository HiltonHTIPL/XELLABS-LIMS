import { getMethods } from '@/app/actions/methods'
import { getCalculations } from '@/app/actions/calculations'
import { getInstrumentOptions } from '@/app/actions/instrument-maintenance'
import { listSenaiteMethods, listSenaiteInstrumentOptions } from '@/app/actions/senaite-methods'
import { getCalculations as getSenaiteCalculations } from '@/app/actions/calculations-senaite'
import MethodsShell from './_components/MethodsShell'

export const dynamic = 'force-dynamic'

export default async function MethodsPage() {
  const [methods, calculations, instruments, senaiteMethods, senaiteInstruments, senaiteCalculations] = await Promise.all([
    getMethods(),
    getCalculations(),
    getInstrumentOptions(),
    listSenaiteMethods(),
    listSenaiteInstrumentOptions(),
    getSenaiteCalculations(),
  ])
  return (
    <MethodsShell
      initialMethods={methods} calculations={calculations} instruments={instruments}
      senaiteMethods={senaiteMethods} senaiteInstruments={senaiteInstruments} senaiteCalculations={senaiteCalculations}
    />
  )
}

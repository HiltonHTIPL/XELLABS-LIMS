import { getMethods } from '@/app/actions/methods'
import { getInstrumentOptions } from '@/app/actions/instrument-maintenance'
import { listSenaiteMethods, listSenaiteInstrumentOptions } from '@/app/actions/senaite-methods'
import { getCalculations as getSenaiteCalculations } from '@/app/actions/calculations-senaite'
import MethodsShell from './_components/MethodsShell'

export const dynamic = 'force-dynamic'

export default async function MethodsPage() {
  const [methods, instruments, senaiteMethods, senaiteInstruments, senaiteCalculations] = await Promise.all([
    getMethods(),
    getInstrumentOptions(),
    listSenaiteMethods(),
    listSenaiteInstrumentOptions(),
    getSenaiteCalculations(),
  ])
  return (
    <MethodsShell
      initialMethods={methods} instruments={instruments}
      senaiteMethods={senaiteMethods} senaiteInstruments={senaiteInstruments} senaiteCalculations={senaiteCalculations}
    />
  )
}

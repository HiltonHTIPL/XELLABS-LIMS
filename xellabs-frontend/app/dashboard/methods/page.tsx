import { listSenaiteMethods, listSenaiteInstrumentOptions } from '@/app/actions/senaite-methods'
import { getCalculations as getSenaiteCalculations } from '@/app/actions/calculations-senaite'
import MethodsShell from './_components/MethodsShell'

export const dynamic = 'force-dynamic'

export default async function MethodsPage() {
  const [senaiteMethods, senaiteInstruments, senaiteCalculations] = await Promise.all([
    listSenaiteMethods(),
    listSenaiteInstrumentOptions(),
    getSenaiteCalculations(),
  ])
  return (
    <MethodsShell
      senaiteMethods={senaiteMethods} senaiteInstruments={senaiteInstruments} senaiteCalculations={senaiteCalculations}
    />
  )
}

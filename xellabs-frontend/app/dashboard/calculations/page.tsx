import { getCalculations, getCalculationServiceOptions } from '@/app/actions/calculations-senaite'
import CalculationsShell from './_components/CalculationsShell'

export default async function CalculationsPage() {
  const [calculations, services] = await Promise.all([
    getCalculations(),
    getCalculationServiceOptions(),
  ])
  return <CalculationsShell initialCalculations={calculations} services={services} />
}

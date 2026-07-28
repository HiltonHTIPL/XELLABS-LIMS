import {
  getInstrumentOptions,
  getCalibrations,
  getMaintenances,
  getInstrumentRuns,
  getInstrumentResultImports,
} from '@/app/actions/instrument-maintenance'
import InstrumentMaintenanceShell from './_components/InstrumentMaintenanceShell'

export default async function InstrumentMaintenancePage() {
  const [instruments, calibrations, maintenances, runs, imports] = await Promise.all([
    getInstrumentOptions(),
    getCalibrations(),
    getMaintenances(),
    getInstrumentRuns(),
    getInstrumentResultImports(),
  ])

  return (
    <InstrumentMaintenanceShell
      instruments={instruments}
      initialCalibrations={calibrations}
      initialMaintenances={maintenances}
      initialRuns={runs}
      initialImports={imports}
    />
  )
}

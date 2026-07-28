'use client'
import type { SenaiteMethodRow } from '@/app/actions/senaite-methods'
import type { SenaiteInstrument, SenaiteCalculation } from '@/app/lib/senaite'
import SenaiteMethodsShell from './SenaiteMethodsShell'

// The Django-local "Documentation Records" tab (accreditation/instructions
// paperwork disconnected from SENAITE) was removed — every field it captured
// (Code, Status, Accredited, Instructions) now lives directly on the
// SENAITE-native Method record below, which is the one Analysis Services and
// Worksheets actually read from. Single source of truth, no more duplicate
// per-method paperwork in two disconnected places.
export default function MethodsShell({ senaiteMethods, senaiteInstruments, senaiteCalculations }: {
  senaiteMethods: SenaiteMethodRow[]; senaiteInstruments: SenaiteInstrument[]; senaiteCalculations: SenaiteCalculation[]
}) {
  return (
    <div style={{ backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SenaiteMethodsShell rows={senaiteMethods} instruments={senaiteInstruments} calculations={senaiteCalculations} />
    </div>
  )
}

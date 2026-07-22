'use client'
import { useState } from 'react'
import { type Instrument } from '@/app/actions/instruments'
import { type NamedItem } from '@/app/actions/instrument-workflows'
import type { SenaiteInstrument } from '@/app/lib/senaite'
import type { RefOption } from '../../_components/AdminRefShell'
import InstrumentsShell from './InstrumentsShell'
import SenaiteInstrumentsShell from './SenaiteInstrumentsShell'

type MethodOption = { id: number; name: string; code?: string }

export default function InstrumentsPageShell({
  initialInstruments, types, locations, manufacturers, suppliers, methods,
  senaiteInstruments, senaiteInstrumentTypes, senaiteManufacturers, senaiteSuppliers, senaiteMethods,
}: {
  initialInstruments: Instrument[]
  types: NamedItem[]; locations: NamedItem[]; manufacturers: NamedItem[]; suppliers: NamedItem[]
  methods: MethodOption[]
  senaiteInstruments: SenaiteInstrument[]
  senaiteInstrumentTypes: RefOption[]; senaiteManufacturers: RefOption[]; senaiteSuppliers: RefOption[]; senaiteMethods: RefOption[]
}) {
  const [tab, setTab] = useState<'catalog' | 'calibration'>('catalog')

  const tabBar = (
    <div className="flex items-center gap-1 px-5 pt-4" style={{ flexShrink: 0, backgroundColor: '#F7F8FC', borderBottom: '1px solid #E8EAF2' }}>
      {([['catalog', 'Instruments'], ['calibration', 'Calibration & Maintenance']] as const).map(([key, label]) => (
        <button key={key} onClick={() => setTab(key)}
          className="px-4 py-2 text-sm font-semibold"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: tab === key ? '#0154FC' : '#6B7280',
            borderBottom: tab === key ? '2px solid #0154FC' : '2px solid transparent',
          }}>
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <div style={{ backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {tabBar}
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === 'catalog' ? (
          <SenaiteInstrumentsShell
            rows={senaiteInstruments}
            instrumentTypes={senaiteInstrumentTypes}
            manufacturers={senaiteManufacturers}
            suppliers={senaiteSuppliers}
            methods={senaiteMethods}
          />
        ) : (
          <InstrumentsShell
            initialInstruments={initialInstruments}
            types={types} locations={locations} manufacturers={manufacturers} suppliers={suppliers} methods={methods}
          />
        )}
      </div>
    </div>
  )
}

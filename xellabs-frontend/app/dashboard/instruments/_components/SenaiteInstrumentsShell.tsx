'use client'
import AdminRefShell, { type AdminRow, type RefOption } from '../../_components/AdminRefShell'
import { createSenaiteInstrumentRecord, updateSenaiteInstrumentRecord } from '@/app/actions/senaite-instruments'
import type { SenaiteInstrument } from '@/app/lib/senaite'

// The catalog Instrument — Analysis Services and Worksheets pick from this
// list (fetchSenaiteInstruments in senaite.ts), so an Instrument registered
// here is immediately usable for both, unlike the Django-local "Calibration &
// Maintenance" tab (compliance/paperwork tracking only, no SENAITE link).
export default function SenaiteInstrumentsShell({ rows, instrumentTypes, manufacturers, suppliers, methods }: {
  rows: SenaiteInstrument[]
  instrumentTypes: RefOption[]
  manufacturers: RefOption[]
  suppliers: RefOption[]
  methods: RefOption[]
}) {
  const adminRows: AdminRow[] = rows.map(r => ({
    uid: r.uid, title: r.title, InstrumentType: r.InstrumentType, Manufacturer: r.Manufacturer,
    Supplier: r.Supplier, Model: r.Model, SerialNo: r.SerialNo, review_state: r.review_state,
  }))

  return (
    <AdminRefShell
      title="Instruments"
      subtitle="Register lab instruments usable by Analysis Services and Worksheets"
      singularLabel="Instrument"
      icon="precision_manufacturing"
      columns={[
        { key: 'title', label: 'Name', width: '22%' },
        { key: 'InstrumentType', label: 'Type', width: '18%' },
        { key: 'Manufacturer', label: 'Manufacturer', width: '18%' },
        { key: 'Model', label: 'Model', width: '14%' },
        { key: 'SerialNo', label: 'Serial No', width: '16%' },
      ]}
      fields={[
        { name: 'title', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. pH Meter #2' },
        { name: 'instrumentType', label: 'Instrument Type', kind: 'select', required: true, options: instrumentTypes,
          help: instrumentTypes.length === 0 ? 'No instrument types yet — add one under Administration → Instrument Types.' : undefined },
        { name: 'manufacturer', label: 'Manufacturer', kind: 'select', required: true, options: manufacturers,
          help: manufacturers.length === 0 ? 'No manufacturers yet — add one under Administration → Manufacturers.' : undefined },
        { name: 'supplier', label: 'Supplier', kind: 'select', required: true, options: suppliers,
          help: suppliers.length === 0 ? 'No suppliers yet — add one under Administration → Suppliers.' : undefined },
        { name: 'model', label: 'Model', kind: 'text', placeholder: 'e.g. X-100' },
        { name: 'serialNo', label: 'Serial No', kind: 'text', placeholder: 'e.g. SN-0001' },
        { name: 'methodUids', label: 'Supported Methods', kind: 'multiselect', options: methods },
      ]}
      rows={adminRows}
      createAction={createSenaiteInstrumentRecord}
      updateAction={updateSenaiteInstrumentRecord}
    />
  )
}

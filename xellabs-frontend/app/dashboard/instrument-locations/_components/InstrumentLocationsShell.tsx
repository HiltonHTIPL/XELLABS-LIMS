'use client'
import AdminRefShell, { type AdminRow } from '../../_components/AdminRefShell'
import { createInstrumentLocation, updateInstrumentLocation } from '@/app/actions/instrument-locations'

export default function InstrumentLocationsShell({ rows }: { rows: AdminRow[] }) {
  return (
    <AdminRefShell
      title="Instrument Locations"
      subtitle="Manage physical locations where instruments are kept"
      singularLabel="Instrument Location"
      icon="place"
      columns={[
        { key: 'title', label: 'Name', width: '32%' },
        { key: 'description', label: 'Description', width: '60%' },
      ]}
      fields={[
        { name: 'title', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Lab Room 1' },
        { name: 'description', label: 'Description', kind: 'textarea', placeholder: 'Optional description' },
      ]}
      rows={rows}
      createAction={createInstrumentLocation}
      updateAction={updateInstrumentLocation}
    />
  )
}

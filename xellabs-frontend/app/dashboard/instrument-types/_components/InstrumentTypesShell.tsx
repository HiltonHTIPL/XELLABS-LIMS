'use client'
import AdminRefShell, { type AdminRow } from '../../_components/AdminRefShell'
import { createInstrumentType, updateInstrumentType } from '@/app/actions/instrument-types'

export default function InstrumentTypesShell({ rows }: { rows: AdminRow[] }) {
  return (
    <AdminRefShell
      title="Instrument Types"
      subtitle="Manage categories of laboratory instruments"
      singularLabel="Instrument Type"
      icon="category"
      columns={[
        { key: 'title', label: 'Name', width: '32%' },
        { key: 'description', label: 'Description', width: '60%' },
      ]}
      exportColumns={[
        { key: 'title', label: 'Title' },
        { key: 'description', label: 'Description' },
      ]}
      fields={[
        { name: 'title', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. HPLC' },
        { name: 'description', label: 'Description', kind: 'textarea', placeholder: 'Optional description' },
      ]}
      rows={rows}
      createAction={createInstrumentType}
      updateAction={updateInstrumentType}
    />
  )
}

'use client'
import AdminRefShell, { type AdminRow } from '../../_components/AdminRefShell'
import { createManufacturerRecord, updateManufacturerRecord } from '@/app/actions/manufacturers'

export default function ManufacturersShell({ rows }: { rows: AdminRow[] }) {
  return (
    <AdminRefShell
      title="Manufacturers"
      subtitle="Manage instrument manufacturers"
      singularLabel="Manufacturer"
      icon="precision_manufacturing"
      columns={[
        { key: 'title', label: 'Name', width: '32%' },
        { key: 'description', label: 'Description', width: '60%' },
      ]}
      fields={[
        { name: 'title', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Agilent' },
        { name: 'description', label: 'Description', kind: 'textarea', placeholder: 'Optional description' },
      ]}
      rows={rows}
      createAction={createManufacturerRecord}
      updateAction={updateManufacturerRecord}
    />
  )
}

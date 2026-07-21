'use client'
import AdminRefShell, { type AdminRow } from '../../_components/AdminRefShell'
import { createLabel, updateLabel } from '@/app/actions/labels'

export default function LabelsShell({ rows }: { rows: AdminRow[] }) {
  return (
    <AdminRefShell
      title="Labels"
      subtitle="Manage labels used to tag records across the lab"
      singularLabel="Label"
      icon="sell"
      columns={[
        { key: 'title', label: 'Name', width: '32%' },
        { key: 'description', label: 'Description', width: '60%' },
      ]}
      exportColumns={[
        { key: 'title', label: 'Title' },
        { key: 'description', label: 'Description' },
      ]}
      fields={[
        { name: 'title', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Urgent' },
        { name: 'description', label: 'Description', kind: 'textarea', placeholder: 'Optional description' },
      ]}
      rows={rows}
      createAction={createLabel}
      updateAction={updateLabel}
    />
  )
}

'use client'
import AdminRefShell, { type AdminRow } from '../../_components/AdminRefShell'
import { createBatchLabel, updateBatchLabel } from '@/app/actions/batch-labels'

export default function BatchLabelsShell({ rows }: { rows: AdminRow[] }) {
  return (
    <AdminRefShell
      title="Batch Labels"
      subtitle="Manage labels used to categorize batches"
      singularLabel="Batch Label"
      icon="label"
      columns={[{ key: 'title', label: 'Name', width: '92%' }]}
      exportColumns={[{ key: 'title', label: 'Title' }]}
      fields={[
        { name: 'title', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Priority' },
      ]}
      rows={rows}
      createAction={createBatchLabel}
      updateAction={updateBatchLabel}
    />
  )
}

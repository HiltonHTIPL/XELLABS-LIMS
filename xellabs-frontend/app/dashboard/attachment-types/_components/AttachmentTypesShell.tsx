'use client'
import AdminRefShell, { type AdminRow } from '../../_components/AdminRefShell'
import { createAttachmentType, updateAttachmentType } from '@/app/actions/attachment-types'

export default function AttachmentTypesShell({ rows }: { rows: AdminRow[] }) {
  return (
    <AdminRefShell
      title="Attachment Types"
      subtitle="Manage attachment types used for samples and analyses"
      singularLabel="Attachment Type"
      icon="attach_file"
      columns={[
        { key: 'title', label: 'Name', width: '32%' },
        { key: 'description', label: 'Description', width: '60%' },
      ]}
      fields={[
        { name: 'title', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Certificate of Analysis' },
        { name: 'description', label: 'Description', kind: 'textarea', placeholder: 'Optional description' },
      ]}
      rows={rows}
      createAction={createAttachmentType}
      updateAction={updateAttachmentType}
    />
  )
}

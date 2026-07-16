'use client'
import AdminRefShell, { type AdminRow, type RefOption } from '../../_components/AdminRefShell'
import { createLabDepartment, updateLabDepartment } from '@/app/actions/lab-departments'

export default function LabDepartmentsShell({ rows, managers }: { rows: AdminRow[]; managers: RefOption[] }) {
  const mgrTitle = (uid: string) => managers.find(m => m.uid === uid)?.title ?? ''
  return (
    <AdminRefShell
      title="Lab Departments"
      subtitle="Manage laboratory departments and their managers"
      singularLabel="Department"
      icon="corporate_fare"
      columns={[
        { key: 'title', label: 'Name', width: '30%' },
        { key: 'department_id', label: 'Department ID', width: '22%' },
        { key: 'manager', label: 'Manager', width: '26%', render: r => mgrTitle(String(r.manager ?? '')) },
      ]}
      fields={[
        { name: 'title', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Microbiology' },
        { name: 'department_id', label: 'Department ID', kind: 'text', required: true, placeholder: 'e.g. MICRO' },
        { name: 'manager', label: 'Manager', kind: 'select', required: true, options: managers, help: managers.length === 0 ? 'Create a Lab Contact first to assign as manager' : undefined },
        { name: 'description', label: 'Description', kind: 'textarea', placeholder: 'Optional description' },
      ]}
      rows={rows}
      createAction={createLabDepartment}
      updateAction={updateLabDepartment}
    />
  )
}

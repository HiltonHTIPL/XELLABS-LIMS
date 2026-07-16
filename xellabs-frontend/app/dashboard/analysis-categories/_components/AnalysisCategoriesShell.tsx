'use client'
import AdminRefShell, { type AdminRow, type RefOption } from '../../_components/AdminRefShell'
import { createAnalysisCategory, updateAnalysisCategory } from '@/app/actions/analysis-categories'

export default function AnalysisCategoriesShell({ rows, departments }: { rows: AdminRow[]; departments: RefOption[] }) {
  const deptTitle = (uid: string) => departments.find(d => d.uid === uid)?.title ?? ''
  return (
    <AdminRefShell
      title="Analysis Categories"
      subtitle="Group analysis services into categories"
      singularLabel="Analysis Category"
      icon="account_tree"
      columns={[
        { key: 'title', label: 'Name', width: '26%' },
        { key: 'department', label: 'Department', width: '24%', render: r => deptTitle(String(r.department ?? '')) },
        { key: 'sort_key', label: 'Sort Key', width: '14%' },
        { key: 'description', label: 'Description', width: '28%' },
      ]}
      fields={[
        { name: 'title', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Metals' },
        { name: 'department', label: 'Department', kind: 'select', required: true, options: departments },
        { name: 'sort_key', label: 'Sort Key', kind: 'number', placeholder: 'e.g. 10', help: 'Controls display order (lower shows first)' },
        { name: 'description', label: 'Description', kind: 'textarea', placeholder: 'Optional description' },
        { name: 'comments', label: 'Comments', kind: 'textarea', placeholder: 'Optional internal comments' },
      ]}
      rows={rows}
      createAction={createAnalysisCategory}
      updateAction={updateAnalysisCategory}
    />
  )
}

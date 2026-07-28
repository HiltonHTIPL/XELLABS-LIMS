'use client'
import AdminRefShell, { type AdminRow, type RefOption } from '../../_components/AdminRefShell'
import { createInterpretationTemplate, updateInterpretationTemplate } from '@/app/actions/interpretation-templates'

export default function InterpretationTemplatesShell({
  rows, sampleTypes, analysisTemplates,
}: { rows: AdminRow[]; sampleTypes: RefOption[]; analysisTemplates: RefOption[] }) {
  const countLabel = (arr: unknown) => {
    const n = Array.isArray(arr) ? arr.length : 0
    return n === 0 ? '—' : `${n} selected`
  }
  return (
    <AdminRefShell
      title="Interpretation Templates"
      subtitle="Reusable result-interpretation text for reports"
      singularLabel="Interpretation Template"
      icon="description"
      columns={[
        { key: 'title', label: 'Name', width: '30%' },
        { key: 'sample_types', label: 'Sample Types', width: '20%', render: r => countLabel(r.sample_types) },
        { key: 'analysis_templates', label: 'Sample Templates', width: '20%', render: r => countLabel(r.analysis_templates) },
        { key: 'description', label: 'Description', width: '22%' },
      ]}
      exportColumns={[
        { key: 'title', label: 'Title' },
        { key: 'description', label: 'Description' },
        { key: 'sample_types', label: 'Sample Types', render: r => countLabel(r.sample_types) },
      ]}
      fields={[
        { name: 'title', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Potable Water Interpretation' },
        { name: 'sample_types', label: 'Sample Types', kind: 'multiselect', options: sampleTypes, help: 'Limit this template to samples of these types (optional)' },
        { name: 'analysis_templates', label: 'Sample Templates', kind: 'multiselect', options: analysisTemplates, help: 'Limit to samples using these templates (optional)' },
        { name: 'text', label: 'Interpretation Text', kind: 'textarea', placeholder: 'Interpretation text shown on reports…' },
        { name: 'description', label: 'Description', kind: 'textarea', placeholder: 'Optional description' },
      ]}
      rows={rows}
      createAction={createInterpretationTemplate}
      updateAction={updateInterpretationTemplate}
    />
  )
}

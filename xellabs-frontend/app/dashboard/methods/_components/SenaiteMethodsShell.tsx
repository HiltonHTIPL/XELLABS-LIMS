'use client'
import AdminRefShell, { type AdminRow, type RefOption } from '../../_components/AdminRefShell'
import { createSenaiteMethodRecord, updateSenaiteMethodRecord, type SenaiteMethodRow } from '@/app/actions/senaite-methods'
import type { SenaiteInstrument } from '@/app/lib/senaite'
import type { SenaiteCalculation } from '@/app/lib/senaite'

// The catalog Method — Analysis Services pick MethodUids/InstrumentUids from
// this list (fetchSenaiteMethods in senaite.ts), so a Method created here is
// immediately usable when defining an Analysis Service, unlike the Django-local
// "Documentation Records" tab (accreditation/instructions paperwork only).
export default function SenaiteMethodsShell({ rows, instruments, calculations }: {
  rows: SenaiteMethodRow[]
  instruments: SenaiteInstrument[]
  calculations: SenaiteCalculation[]
}) {
  const adminRows: AdminRow[] = rows.map(r => ({
    uid: r.uid, path: r.path, title: r.title, description: r.description,
    methodId: r.methodId, accredited: r.accredited, instructions: r.instructions,
    reviewState: r.reviewState === 'active' ? 'active' : 'inactive',
    statusLabel: r.reviewState === 'active' ? 'Active' : 'Inactive',
    instrumentUids: r.instrumentUids, calculationUids: r.calculationUids,
    instrumentNames: r.instrumentUids.map(u => instruments.find(i => i.uid === u)?.title).filter(Boolean).join(', '),
  }))

  const instrumentOptions: RefOption[] = instruments.map(i => ({ uid: i.uid, title: i.title }))
  const calculationOptions: RefOption[] = calculations.map(c => ({ uid: c.uid, title: c.title }))
  const statusOptions: RefOption[] = [{ uid: 'active', title: 'Active' }, { uid: 'inactive', title: 'Inactive' }]

  return (
    <AdminRefShell
      title="Methods"
      subtitle="Analytical methods available to Analysis Services and Worksheets"
      singularLabel="Method"
      icon="biotech"
      columns={[
        { key: 'title', label: 'Name', width: '20%' },
        { key: 'methodId', label: 'Code', width: '12%' },
        { key: 'description', label: 'Description', width: '26%' },
        { key: 'statusLabel', label: 'Status', width: '12%' },
        { key: 'instrumentNames', label: 'Linked Instruments', width: '30%' },
      ]}
      fields={[
        { name: 'title', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Titrimetric Method' },
        { name: 'methodId', label: 'Method ID / Code', kind: 'text', placeholder: 'e.g. MTH-SOIL-PH-001' },
        { name: 'description', label: 'Description', kind: 'textarea', placeholder: 'Optional description' },
        { name: 'instructions', label: 'Instructions', kind: 'textarea', placeholder: 'Method instructions / procedure notes' },
        { name: 'accredited', label: 'Accredited', kind: 'checkbox' },
        { name: 'reviewState', label: 'Status', kind: 'select', options: statusOptions },
        { name: 'instrumentUids', label: 'Supported Instruments', kind: 'multiselect', options: instrumentOptions },
        { name: 'calculationUids', label: 'Supported Calculations', kind: 'multiselect', options: calculationOptions },
      ]}
      rows={adminRows}
      createAction={createSenaiteMethodRecord}
      updateAction={updateSenaiteMethodRecord}
    />
  )
}

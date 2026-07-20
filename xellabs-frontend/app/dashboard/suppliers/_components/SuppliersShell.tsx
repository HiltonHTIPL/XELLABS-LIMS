'use client'
import AdminRefShell, { type AdminRow } from '../../_components/AdminRefShell'
import { createSupplier, updateSupplier } from '@/app/actions/suppliers'

export default function SuppliersShell({ rows }: { rows: AdminRow[] }) {
  return (
    <AdminRefShell
      title="Suppliers"
      subtitle="Vendors that supply QC reference materials (control / blank samples)"
      singularLabel="Supplier"
      icon="local_shipping"
      columns={[
        { key: 'title', label: 'Name', width: '40%' },
        { key: 'email', label: 'Email', width: '32%' },
        { key: 'phone', label: 'Phone', width: '28%' },
      ]}
      fields={[
        { name: 'title', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Sigma-Aldrich', section: 'Details' },
        { name: 'email', label: 'Email', kind: 'text', placeholder: 'contact@supplier.com', section: 'Details' },
        { name: 'phone', label: 'Phone', kind: 'text', section: 'Details' },
        { name: 'fax', label: 'Fax', kind: 'text', section: 'Details' },
        { name: 'website', label: 'Website', kind: 'text', placeholder: 'https://', section: 'Details' },
        { name: 'tax_number', label: 'VAT / Tax Number', kind: 'text', section: 'Details' },

        { name: 'physical_address', label: 'Street', kind: 'text', section: 'Physical Address' },
        { name: 'physical_city', label: 'City', kind: 'text', section: 'Physical Address' },
        { name: 'physical_state', label: 'State / Province', kind: 'text', section: 'Physical Address' },
        { name: 'physical_district', label: 'District', kind: 'text', section: 'Physical Address' },
        { name: 'physical_zip', label: 'ZIP / Postal Code', kind: 'text', section: 'Physical Address' },
        { name: 'physical_country', label: 'Country', kind: 'text', section: 'Physical Address' },

        { name: 'postal_address', label: 'Street', kind: 'text', section: 'Postal Address' },
        { name: 'postal_city', label: 'City', kind: 'text', section: 'Postal Address' },
        { name: 'postal_state', label: 'State / Province', kind: 'text', section: 'Postal Address' },
        { name: 'postal_district', label: 'District', kind: 'text', section: 'Postal Address' },
        { name: 'postal_zip', label: 'ZIP / Postal Code', kind: 'text', section: 'Postal Address' },
        { name: 'postal_country', label: 'Country', kind: 'text', section: 'Postal Address' },

        { name: 'billing_address', label: 'Street', kind: 'text', section: 'Billing Address' },
        { name: 'billing_city', label: 'City', kind: 'text', section: 'Billing Address' },
        { name: 'billing_state', label: 'State / Province', kind: 'text', section: 'Billing Address' },
        { name: 'billing_district', label: 'District', kind: 'text', section: 'Billing Address' },
        { name: 'billing_zip', label: 'ZIP / Postal Code', kind: 'text', section: 'Billing Address' },
        { name: 'billing_country', label: 'Country', kind: 'text', section: 'Billing Address' },

        { name: 'account_type', label: 'Account Type', kind: 'text', section: 'Bank Details' },
        { name: 'account_name', label: 'Account Name', kind: 'text', section: 'Bank Details' },
        { name: 'account_number', label: 'Account Number', kind: 'text', section: 'Bank Details' },
        { name: 'bank_name', label: 'Bank Name', kind: 'text', section: 'Bank Details' },
        { name: 'bank_branch', label: 'Bank Branch', kind: 'text', section: 'Bank Details' },
        { name: 'nib', label: 'NIB', kind: 'text', help: 'National Identification Bank Account Number', section: 'Bank Details' },
        { name: 'iban', label: 'IBAN', kind: 'text', help: 'International Bank Account Number', section: 'Bank Details' },
        { name: 'swift_code', label: 'SWIFT Code', kind: 'text', section: 'Bank Details' },

        { name: 'lab_account_number', label: 'Lab Account Number', kind: 'text', section: 'Other' },
        { name: 'remarks', label: 'Remarks', kind: 'textarea', section: 'Other' },
      ]}
      rows={rows}
      createAction={createSupplier}
      updateAction={updateSupplier}
    />
  )
}

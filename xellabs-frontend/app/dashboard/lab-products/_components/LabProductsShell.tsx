'use client'
import AdminRefShell, { type AdminRow } from '../../_components/AdminRefShell'
import { createLabProduct, updateLabProduct } from '@/app/actions/lab-products'

export default function LabProductsShell({ rows }: { rows: AdminRow[] }) {
  return (
    <AdminRefShell
      title="Lab Products"
      subtitle="Manage products and consumables sold or used by the lab"
      singularLabel="Lab Product"
      icon="shopping_bag"
      columns={[
        { key: 'title', label: 'Name', width: '26%' },
        { key: 'labproduct_price', label: 'Price (ex VAT)', width: '16%' },
        { key: 'labproduct_vat', label: 'VAT %', width: '10%' },
        { key: 'labproduct_unit', label: 'Unit', width: '14%' },
        { key: 'labproduct_volume', label: 'Volume', width: '14%' },
      ]}
      fields={[
        { name: 'title', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Sampling Kit' },
        { name: 'labproduct_price', label: 'Price (excluding VAT)', kind: 'number', required: true, placeholder: 'e.g. 25.00' },
        { name: 'labproduct_vat', label: 'VAT %', kind: 'number', placeholder: 'e.g. 15.00' },
        { name: 'labproduct_unit', label: 'Unit', kind: 'text', placeholder: 'e.g. each' },
        { name: 'labproduct_volume', label: 'Volume', kind: 'text', placeholder: 'e.g. 500' },
        { name: 'description', label: 'Description', kind: 'textarea', placeholder: 'Optional description' },
      ]}
      rows={rows}
      createAction={createLabProduct}
      updateAction={updateLabProduct}
    />
  )
}

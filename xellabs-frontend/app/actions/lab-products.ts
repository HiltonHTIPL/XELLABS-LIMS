'use server'
import { createEntity, updateEntity, listEntity, str, type EntityConfig } from '@/app/lib/admin-crud'
import type { SetupRecord } from '@/app/lib/senaite-setup'
import type { AdminFormState } from '@/app/dashboard/_components/AdminRefShell'

// LabProduct price/vat/volume/unit are all TextLine fields in SENAITE (stored
// as strings), so they are passed through as strings; only client-side numeric
// validation is applied to price/vat.
const CFG: EntityConfig = {
  portalType: 'LabProduct',
  parentSubPath: 'setup/labproducts',
  revalidate: '/dashboard/lab-products',
  singular: 'Lab product',
  buildBody: (fd) => {
    const title = str(fd, 'title')
    const labproduct_price = str(fd, 'labproduct_price')
    const labproduct_vat = str(fd, 'labproduct_vat')
    const labproduct_unit = str(fd, 'labproduct_unit')
    const labproduct_volume = str(fd, 'labproduct_volume')
    const description = str(fd, 'description')
    const errors: Record<string, string[]> = {}
    if (!title) errors.title = ['Name is required']
    if (!labproduct_price) errors.labproduct_price = ['Price is required']
    else if (isNaN(Number(labproduct_price))) errors.labproduct_price = ['Price must be a number']
    if (labproduct_vat && isNaN(Number(labproduct_vat))) errors.labproduct_vat = ['VAT must be a number']
    const body: SetupRecord = {
      title, labproduct_price, labproduct_vat, labproduct_unit, labproduct_volume, description,
    }
    return { body, errors }
  },
}

export type LabProductRow = {
  uid: string; path: string; title: string; labproduct_price: string; labproduct_vat: string
  labproduct_unit: string; labproduct_volume: string; description: string
}

export async function listLabProducts(): Promise<LabProductRow[]> {
  return listEntity('LabProduct', d => ({
    uid: d.uid as string,
    path: (d.path as string) ?? '',
    title: d.title as string,
    labproduct_price: (d.labproduct_price as string) ?? '',
    labproduct_vat: (d.labproduct_vat as string) ?? '',
    labproduct_unit: (d.labproduct_unit as string) ?? '',
    labproduct_volume: (d.labproduct_volume as string) ?? '',
    description: (d.description as string) ?? '',
  }))
}
export async function createLabProduct(_p: AdminFormState, fd: FormData) { return createEntity(CFG, fd) }
export async function updateLabProduct(_uid: string, _p: AdminFormState, fd: FormData) { return updateEntity(CFG, fd) }

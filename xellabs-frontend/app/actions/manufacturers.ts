'use server'
import { createEntity, updateEntity, listEntity, str, type EntityConfig } from '@/app/lib/admin-crud'
import type { AdminFormState } from '@/app/dashboard/_components/AdminRefShell'

// SENAITE Manufacturer — a Dexterity type at setup/manufacturers, required by
// Instrument.Manufacturer (see senaite-instruments.ts). Confirmed live: plain
// restapi create/read/update works cleanly, same as Supplier/InstrumentType —
// no custom Zope view needed.
const CFG: EntityConfig = {
  portalType: 'Manufacturer',
  parentSubPath: 'setup/manufacturers',
  revalidate: '/dashboard/manufacturers',
  singular: 'Manufacturer',
  buildBody: (fd) => {
    const title = str(fd, 'title'); const description = str(fd, 'description')
    const errors: Record<string, string[]> = {}
    if (!title) errors.title = ['Name is required']
    return { body: { title, description }, errors }
  },
}

export type ManufacturerRow = { uid: string; path: string; title: string; description: string }

export async function listManufacturers(): Promise<ManufacturerRow[]> {
  return listEntity('Manufacturer', d => ({
    uid: d.uid as string, path: (d.path as string) ?? '', title: d.title as string, description: (d.description as string) ?? '',
  }))
}
export async function createManufacturerRecord(_p: AdminFormState, fd: FormData) { return createEntity(CFG, fd) }
export async function updateManufacturerRecord(_uid: string, _p: AdminFormState, fd: FormData) { return updateEntity(CFG, fd) }

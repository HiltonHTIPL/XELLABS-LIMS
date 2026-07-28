'use server'
import { createEntity, updateEntity, listEntity, str, type EntityConfig } from '@/app/lib/admin-crud'
import type { AdminFormState } from '@/app/dashboard/_components/AdminRefShell'

const CFG: EntityConfig = {
  portalType: 'InstrumentLocation',
  parentSubPath: 'setup/instrumentlocations',
  revalidate: '/dashboard/instrument-locations',
  singular: 'Instrument location',
  buildBody: (fd) => {
    const title = str(fd, 'title'); const description = str(fd, 'description')
    const errors: Record<string, string[]> = {}
    if (!title) errors.title = ['Name is required']
    return { body: { title, description }, errors }
  },
}

export type InstrumentLocationRow = { uid: string; path: string; title: string; description: string }

export async function listInstrumentLocations(): Promise<InstrumentLocationRow[]> {
  return listEntity('InstrumentLocation', d => ({
    uid: d.uid as string, path: (d.path as string) ?? '', title: d.title as string, description: (d.description as string) ?? '',
  }))
}
export async function createInstrumentLocation(_p: AdminFormState, fd: FormData) { return createEntity(CFG, fd) }
export async function updateInstrumentLocation(_uid: string, _p: AdminFormState, fd: FormData) { return updateEntity(CFG, fd) }

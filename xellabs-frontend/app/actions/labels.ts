'use server'
import { createEntity, updateEntity, listEntity, str, type EntityConfig } from '@/app/lib/admin-crud'
import type { AdminFormState } from '@/app/dashboard/_components/AdminRefShell'

const CFG: EntityConfig = {
  portalType: 'Label',
  parentSubPath: 'setup/labels',
  revalidate: '/dashboard/labels',
  singular: 'Label',
  buildBody: (fd) => {
    const title = str(fd, 'title'); const description = str(fd, 'description')
    const errors: Record<string, string[]> = {}
    if (!title) errors.title = ['Name is required']
    return { body: { title, description }, errors }
  },
}

export type LabelRow = { uid: string; path: string; title: string; description: string }

export async function listLabels(): Promise<LabelRow[]> {
  return listEntity('Label', d => ({
    uid: d.uid as string, path: (d.path as string) ?? '', title: d.title as string, description: (d.description as string) ?? '',
  }))
}
export async function createLabel(_p: AdminFormState, fd: FormData) { return createEntity(CFG, fd) }
export async function updateLabel(_uid: string, _p: AdminFormState, fd: FormData) { return updateEntity(CFG, fd) }

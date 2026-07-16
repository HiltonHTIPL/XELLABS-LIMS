'use server'
import { createEntity, updateEntity, listEntity, str, type EntityConfig } from '@/app/lib/admin-crud'
import type { AdminFormState } from '@/app/dashboard/_components/AdminRefShell'

const CFG: EntityConfig = {
  portalType: 'BatchLabel',
  parentSubPath: 'setup/batchlabels',
  revalidate: '/dashboard/batch-labels',
  singular: 'Batch label',
  buildBody: (fd) => {
    const title = str(fd, 'title')
    const errors: Record<string, string[]> = {}
    if (!title) errors.title = ['Name is required']
    return { body: { title }, errors }
  },
}

export type BatchLabelRow = { uid: string; path: string; title: string }

export async function listBatchLabels(): Promise<BatchLabelRow[]> {
  return listEntity('BatchLabel', d => ({ uid: d.uid as string, path: (d.path as string) ?? '', title: d.title as string }))
}
export async function createBatchLabel(_p: AdminFormState, fd: FormData) { return createEntity(CFG, fd) }
export async function updateBatchLabel(_uid: string, _p: AdminFormState, fd: FormData) { return updateEntity(CFG, fd) }

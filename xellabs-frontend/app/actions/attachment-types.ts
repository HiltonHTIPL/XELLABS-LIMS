'use server'
import { createEntity, updateEntity, listEntity, str, type EntityConfig } from '@/app/lib/admin-crud'
import type { AdminFormState } from '@/app/dashboard/_components/AdminRefShell'

const CFG: EntityConfig = {
  portalType: 'AttachmentType',
  parentSubPath: 'setup/attachmenttypes',
  revalidate: '/dashboard/attachment-types',
  singular: 'Attachment type',
  buildBody: (fd) => {
    const title = str(fd, 'title'); const description = str(fd, 'description')
    const errors: Record<string, string[]> = {}
    if (!title) errors.title = ['Name is required']
    return { body: { title, description }, errors }
  },
}

export type AttachmentTypeRow = { uid: string; path: string; title: string; description: string }

export async function listAttachmentTypes(): Promise<AttachmentTypeRow[]> {
  return listEntity('AttachmentType', d => ({
    uid: d.uid as string, path: (d.path as string) ?? '', title: d.title as string, description: (d.description as string) ?? '',
  }))
}
export async function createAttachmentType(_p: AdminFormState, fd: FormData) { return createEntity(CFG, fd) }
export async function updateAttachmentType(_uid: string, _p: AdminFormState, fd: FormData) { return updateEntity(CFG, fd) }

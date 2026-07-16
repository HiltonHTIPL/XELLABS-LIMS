'use server'
import { createEntity, updateEntity, listEntity, listOptions, str, type EntityConfig } from '@/app/lib/admin-crud'
import type { SetupRecord } from '@/app/lib/senaite-setup'
import type { AdminFormState } from '@/app/dashboard/_components/AdminRefShell'

function refUid(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return refUid(v[0])
  if (typeof v === 'object') return ((v as Record<string, unknown>).uid as string) ?? ''
  return ''
}

const CFG: EntityConfig = {
  portalType: 'Department',
  parentSubPath: 'setup/departments',
  revalidate: '/dashboard/lab-departments',
  singular: 'Department',
  buildBody: (fd) => {
    const title = str(fd, 'title')
    const department_id = str(fd, 'department_id')
    const manager = str(fd, 'manager')
    const description = str(fd, 'description')
    const errors: Record<string, string[]> = {}
    if (!title) errors.title = ['Name is required']
    if (!department_id) errors.department_id = ['Department ID is required']
    if (!manager) errors.manager = ['Manager is required']
    const body: SetupRecord = { title, department_id, manager, description }
    return { body, errors }
  },
}

export type DepartmentRow = {
  uid: string; path: string; title: string; department_id: string; manager: string; description: string
}

export async function listLabDepartments(): Promise<DepartmentRow[]> {
  return listEntity('Department', d => ({
    uid: d.uid as string,
    path: (d.path as string) ?? '',
    title: d.title as string,
    department_id: (d.department_id as string) ?? '',
    manager: refUid(d.manager),
    description: (d.description as string) ?? '',
  }))
}
export async function listManagerOptions() { return listOptions('LabContact') }
export async function createLabDepartment(_p: AdminFormState, fd: FormData) { return createEntity(CFG, fd) }
export async function updateLabDepartment(_uid: string, _p: AdminFormState, fd: FormData) { return updateEntity(CFG, fd) }

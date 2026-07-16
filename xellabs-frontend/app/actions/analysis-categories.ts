'use server'
import { createEntity, updateEntity, listEntity, listOptions, str, type EntityConfig } from '@/app/lib/admin-crud'
import type { SetupRecord } from '@/app/lib/senaite-setup'
import type { AdminFormState } from '@/app/dashboard/_components/AdminRefShell'

// Normalize a UIDReferenceField value (v1 may return uid string, {uid}, or a
// single-element array) to a plain uid string.
function refUid(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return refUid(v[0])
  if (typeof v === 'object') return ((v as Record<string, unknown>).uid as string) ?? ''
  return ''
}

const CFG: EntityConfig = {
  portalType: 'AnalysisCategory',
  parentSubPath: 'setup/analysiscategories',
  revalidate: '/dashboard/analysis-categories',
  singular: 'Analysis category',
  buildBody: (fd) => {
    const title = str(fd, 'title')
    const department = str(fd, 'department')
    const sortRaw = str(fd, 'sort_key')
    const description = str(fd, 'description')
    const comments = str(fd, 'comments')
    const errors: Record<string, string[]> = {}
    if (!title) errors.title = ['Name is required']
    if (!department) errors.department = ['Department is required']
    if (sortRaw && isNaN(Number(sortRaw))) errors.sort_key = ['Sort key must be a number']
    const body: SetupRecord = { title, department, description, comments }
    if (sortRaw) body.sort_key = Number(sortRaw)
    return { body, errors }
  },
}

export type AnalysisCategoryRow = {
  uid: string; path: string; title: string; department: string; sort_key: string; description: string; comments: string
}

export async function listAnalysisCategories(): Promise<AnalysisCategoryRow[]> {
  return listEntity('AnalysisCategory', d => ({
    uid: d.uid as string,
    path: (d.path as string) ?? '',
    title: d.title as string,
    department: refUid(d.department),
    sort_key: d.sort_key == null ? '' : String(d.sort_key),
    description: (d.description as string) ?? '',
    comments: (d.comments as string) ?? '',
  }))
}
export async function listDepartmentOptions() { return listOptions('Department') }
export async function createAnalysisCategory(_p: AdminFormState, fd: FormData) { return createEntity(CFG, fd) }
export async function updateAnalysisCategory(_uid: string, _p: AdminFormState, fd: FormData) { return updateEntity(CFG, fd) }

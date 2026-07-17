'use server'
import { revalidatePath } from 'next/cache'
import { serverToken } from '@/app/lib/senaite-auth'
import {
  fetchSetupList, createLabContactSafe, updateLabContactSafe, type SetupRecord,
} from '@/app/lib/senaite-setup'
import { listOptions } from '@/app/lib/admin-crud'

const REVALIDATE = '/dashboard/lab-contacts'

export type Address = {
  address: string; city: string; zip: string; state: string; district: string; country: string
}
const EMPTY_ADDR: Address = { address: '', city: '', zip: '', state: '', district: '', country: '' }

export type LabContactRow = {
  uid: string; path: string; title: string
  Salutation: string; Firstname: string; Middleinitial: string; Middlename: string; Surname: string
  EmailAddress: string; BusinessPhone: string; BusinessFax: string; HomePhone: string; MobilePhone: string
  JobTitle: string; Department: string
  Departments: string[]; DefaultDepartment: string
  Signature: string
  PhysicalAddress: Address; PostalAddress: Address
}

export type LabContactFormState = {
  success?: boolean; message?: string; errors?: Record<string, string[]>
  uid?: string; title?: string  // set on create success, so callers can auto-select the new record
}

function refUid(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return refUid(v[0])
  if (typeof v === 'object') return ((v as Record<string, unknown>).uid as string) ?? ''
  return ''
}
function refUids(v: unknown): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v.map(x => (typeof x === 'string' ? x : ((x as Record<string, unknown>)?.uid as string))).filter(Boolean)
  const u = refUid(v); return u ? [u] : []
}
function addr(v: unknown): Address {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ...EMPTY_ADDR }
  const o = v as Record<string, unknown>
  return {
    address: (o.address as string) ?? '', city: (o.city as string) ?? '', zip: (o.zip as string) ?? '',
    state: (o.state as string) ?? '', district: (o.district as string) ?? '', country: (o.country as string) ?? '',
  }
}
function hasSignature(v: unknown): boolean {
  if (!v) return false
  if (typeof v === 'object') { const o = v as Record<string, unknown>; return !!(o.download || o.data || o.filename) }
  return true
}

export async function listLabContacts(): Promise<LabContactRow[]> {
  const items = await fetchSetupList(serverToken(), 'LabContact')
  return items.map(d => ({
    uid: d.uid as string,
    path: (d.path as string) ?? '',
    title: (d.title as string) ?? '',
    Salutation: (d.Salutation as string) ?? '',
    Firstname: (d.Firstname as string) ?? '',
    Middleinitial: (d.Middleinitial as string) ?? '',
    Middlename: (d.Middlename as string) ?? '',
    Surname: (d.Surname as string) ?? '',
    EmailAddress: (d.EmailAddress as string) ?? '',
    BusinessPhone: (d.BusinessPhone as string) ?? '',
    BusinessFax: (d.BusinessFax as string) ?? '',
    HomePhone: (d.HomePhone as string) ?? '',
    MobilePhone: (d.MobilePhone as string) ?? '',
    JobTitle: (d.JobTitle as string) ?? '',
    Department: (d.Department as string) ?? '',
    Departments: refUids(d.Departments),
    DefaultDepartment: refUid(d.DefaultDepartment),
    Signature: hasSignature(d.Signature) ? 'present' : '',
    PhysicalAddress: addr(d.PhysicalAddress),
    PostalAddress: addr(d.PostalAddress),
  }))
}

export async function listLabContactDepartments() { return listOptions('Department') }

function readAddress(fd: FormData, prefix: string): Address {
  const g = (k: string) => ((fd.get(`${prefix}_${k}`) as string) ?? '').trim()
  return { address: g('address'), city: g('city'), zip: g('zip'), state: g('state'), district: g('district'), country: g('country') }
}
function addressEmpty(a: Address) { return !Object.values(a).some(v => v) }

function buildBody(fd: FormData): { body: SetupRecord; errors: Record<string, string[]> } {
  const g = (k: string) => ((fd.get(k) as string) ?? '').trim()
  const Firstname = g('Firstname'); const Surname = g('Surname')
  const errors: Record<string, string[]> = {}
  if (!Firstname) errors.Firstname = ['First name is required']
  if (!Surname) errors.Surname = ['Surname is required']

  const Departments = fd.getAll('Departments').map(v => String(v)).filter(Boolean)
  const DefaultDepartment = g('DefaultDepartment')
  const phys = readAddress(fd, 'physical')
  const post = readAddress(fd, 'postal')
  const signature = g('Signature') // base64 data-URI (empty = leave unchanged)

  const body: SetupRecord = {
    Salutation: g('Salutation'), Firstname, Middleinitial: g('Middleinitial'),
    Middlename: g('Middlename'), Surname, EmailAddress: g('EmailAddress'),
    BusinessPhone: g('BusinessPhone'), BusinessFax: g('BusinessFax'),
    HomePhone: g('HomePhone'), MobilePhone: g('MobilePhone'),
    JobTitle: g('JobTitle'), Department: g('Department'),
    Departments, DefaultDepartment,
    PhysicalAddress: addressEmpty(phys) ? {} : phys,
    PostalAddress: addressEmpty(post) ? {} : post,
  }
  if (signature) body.Signature = signature
  return { body, errors }
}

export async function createLabContact(_p: LabContactFormState, fd: FormData): Promise<LabContactFormState> {
  const { body, errors } = buildBody(fd)
  if (Object.keys(errors).length) return { errors }
  const r = await createLabContactSafe(serverToken(), body)
  if (!r.success || !r.uid) return { message: r.error ?? 'Failed to create lab contact.' }
  revalidatePath(REVALIDATE)
  const title = `${body.Firstname} ${body.Surname}`
  return { success: true, message: `Lab contact "${title}" created.`, uid: r.uid, title }
}

export async function updateLabContact(path: string, _p: LabContactFormState, fd: FormData): Promise<LabContactFormState> {
  const { body, errors } = buildBody(fd)
  if (Object.keys(errors).length) return { errors }
  const r = await updateLabContactSafe(serverToken(), path, body)
  if (!r.success) return { message: r.error ?? 'Failed to update lab contact.' }
  revalidatePath(REVALIDATE)
  return { success: true, message: `Lab contact "${body.Firstname} ${body.Surname}" updated.` }
}

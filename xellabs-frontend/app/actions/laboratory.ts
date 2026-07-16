'use server'
import { revalidatePath } from 'next/cache'
import { serverToken } from '@/app/lib/senaite-auth'
import { SENAITE_SITE_PATH } from '@/app/lib/senaite'
import { fetchLaboratory, updateLaboratorySafe, type SetupRecord } from '@/app/lib/senaite-setup'
import { listOptions } from '@/app/lib/admin-crud'

const LAB_PATH = `${SENAITE_SITE_PATH}/bika_setup/laboratory`
const REVALIDATE = '/dashboard/laboratory'

export type Address = {
  address: string; city: string; zip: string; state: string; district: string; country: string
}
const EMPTY_ADDR: Address = { address: '', city: '', zip: '', state: '', district: '', country: '' }

export type LaboratoryData = {
  path: string
  Name: string; TaxNumber: string; Phone: string; Fax: string; EmailAddress: string; AccountType: string
  AccountName: string; AccountNumber: string; BankName: string; BankBranch: string
  LabURL: string; Supervisor: string; Confidence: string
  LaboratoryAccredited: boolean
  AccreditationBody: string; AccreditationBodyURL: string; Accreditation: string
  AccreditationReference: string; AccreditationPageHeader: string
  hasLogo: boolean
  PhysicalAddress: Address; PostalAddress: Address; BillingAddress: Address
}

export type LaboratoryFormState = { success?: boolean; message?: string; errors?: Record<string, string[]> }

function refUid(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return refUid(v[0])
  if (typeof v === 'object') return ((v as Record<string, unknown>).uid as string) ?? ''
  return ''
}
function textVal(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object') return ((v as Record<string, unknown>).data as string) ?? ''
  return String(v)
}
function addr(v: unknown): Address {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ...EMPTY_ADDR }
  const o = v as Record<string, unknown>
  return {
    address: (o.address as string) ?? '', city: (o.city as string) ?? '', zip: (o.zip as string) ?? '',
    state: (o.state as string) ?? '', district: (o.district as string) ?? '', country: (o.country as string) ?? '',
  }
}

export async function getLaboratory(): Promise<LaboratoryData | null> {
  const d = await fetchLaboratory(serverToken())
  if (!d) return null
  return {
    path: LAB_PATH,
    Name: (d.Name as string) || (d.title as string) || '',
    TaxNumber: (d.TaxNumber as string) ?? '',
    Phone: (d.Phone as string) ?? '',
    Fax: (d.Fax as string) ?? '',
    EmailAddress: (d.EmailAddress as string) ?? '',
    AccountType: (d.AccountType as string) ?? '',
    AccountName: (d.AccountName as string) ?? '',
    AccountNumber: (d.AccountNumber as string) ?? '',
    BankName: (d.BankName as string) ?? '',
    BankBranch: (d.BankBranch as string) ?? '',
    LabURL: (d.LabURL as string) ?? '',
    Supervisor: refUid(d.Supervisor),
    Confidence: d.Confidence == null ? '' : String(d.Confidence),
    LaboratoryAccredited: !!d.LaboratoryAccredited,
    AccreditationBody: (d.AccreditationBody as string) ?? '',
    AccreditationBodyURL: (d.AccreditationBodyURL as string) ?? '',
    Accreditation: (d.Accreditation as string) ?? '',
    AccreditationReference: (d.AccreditationReference as string) ?? '',
    AccreditationPageHeader: textVal(d.AccreditationPageHeader),
    hasLogo: !!d.AccreditationBodyLogo,
    PhysicalAddress: addr(d.PhysicalAddress),
    PostalAddress: addr(d.PostalAddress),
    BillingAddress: addr(d.BillingAddress),
  }
}

export async function listLabSupervisors() { return listOptions('LabContact') }

function readAddress(fd: FormData, prefix: string): Address {
  const g = (k: string) => ((fd.get(`${prefix}_${k}`) as string) ?? '').trim()
  return { address: g('address'), city: g('city'), zip: g('zip'), state: g('state'), district: g('district'), country: g('country') }
}
function addressEmpty(a: Address) { return !Object.values(a).some(v => v) }

export async function updateLaboratory(path: string, _p: LaboratoryFormState, fd: FormData): Promise<LaboratoryFormState> {
  const g = (k: string) => ((fd.get(k) as string) ?? '').trim()
  const Name = g('Name')
  const errors: Record<string, string[]> = {}
  if (!Name) errors.Name = ['Laboratory name is required']
  const confidenceRaw = g('Confidence')
  if (confidenceRaw && isNaN(Number(confidenceRaw))) errors.Confidence = ['Confidence must be a number']
  if (Object.keys(errors).length) return { errors }

  const phys = readAddress(fd, 'physical')
  const post = readAddress(fd, 'postal')
  const bill = readAddress(fd, 'billing')
  const logo = g('AccreditationBodyLogo')

  const body: SetupRecord = {
    Name,
    TaxNumber: g('TaxNumber'), Phone: g('Phone'), Fax: g('Fax'), EmailAddress: g('EmailAddress'),
    AccountType: g('AccountType'), AccountName: g('AccountName'), AccountNumber: g('AccountNumber'),
    BankName: g('BankName'), BankBranch: g('BankBranch'),
    LabURL: g('LabURL'), Supervisor: g('Supervisor'),
    LaboratoryAccredited: fd.get('LaboratoryAccredited') === 'on' || fd.get('LaboratoryAccredited') === 'true',
    AccreditationBody: g('AccreditationBody'), AccreditationBodyURL: g('AccreditationBodyURL'),
    Accreditation: g('Accreditation'), AccreditationReference: g('AccreditationReference'),
    AccreditationPageHeader: g('AccreditationPageHeader'),
    PhysicalAddress: addressEmpty(phys) ? {} : phys,
    PostalAddress: addressEmpty(post) ? {} : post,
    BillingAddress: addressEmpty(bill) ? {} : bill,
  }
  if (confidenceRaw) body.Confidence = Number(confidenceRaw)
  if (logo) body.AccreditationBodyLogo = logo

  const r = await updateLaboratorySafe(serverToken(), path, body)
  if (!r.success) return { message: r.error ?? 'Failed to save laboratory information.' }
  revalidatePath(REVALIDATE)
  return { success: true, message: 'Laboratory information saved.' }
}

'use server'
import { revalidatePath } from 'next/cache'
import {
  fetchSenaiteAnalysisServices,
  fetchSenaiteAnalysisCategories,
  fetchSenaiteDepartments,
  fetchSenaiteLabContacts,
  fetchSenaiteMethods,
  fetchSenaiteInstruments,
  createSenaiteAnalysisCategory,
  createSenaiteAnalysisService,
  updateSenaiteAnalysisService,
  createSenaiteDepartment,
  createSenaiteLabContact,
  type SenaiteAnalysisService,
  type SenaiteAnalysisCategory,
  type SenaiteDepartment,
  type SenaiteLabContact,
  type SenaiteRefOption,
  type SenaiteInstrument,
  type AnalysisServicePayload,
  type SenaiteUncertaintyRow,
  type SenaiteInterimFieldRow,
  type SenaiteConditionRow,
} from '@/app/lib/senaite'

import { serverToken } from '@/app/lib/senaite-auth'

export type AnalysesPageData = {
  services: SenaiteAnalysisService[]
  categories: SenaiteAnalysisCategory[]
  departments: SenaiteDepartment[]
  labContacts: SenaiteLabContact[]
  methods: SenaiteRefOption[]
  instruments: SenaiteInstrument[]
}

export async function getAnalysesPageData(): Promise<AnalysesPageData> {
  const token = serverToken()
  const [services, categories, departments, labContacts, methods, instruments] = await Promise.all([
    fetchSenaiteAnalysisServices(token),
    fetchSenaiteAnalysisCategories(token),
    fetchSenaiteDepartments(token),
    fetchSenaiteLabContacts(token),
    fetchSenaiteMethods(token),
    fetchSenaiteInstruments(token),
  ])
  return { services, categories, departments, labContacts, methods, instruments }
}

export type AnalysisFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

function parseJsonArray<T>(formData: FormData, key: string): T[] {
  const raw = formData.get(key) as string | null
  if (!raw) return []
  try { return JSON.parse(raw) as T[] } catch { return [] }
}

// Shared across create/update — parses every tab's fields out of the same
// FormData shape the AnalysesShell drawer submits (scalars as plain fields,
// the three repeating-row tables and the two multi-selects as hidden
// JSON-stringified fields, same convention Specifications already uses).
function parseAnalysisFormData(formData: FormData): AnalysisServicePayload & { title: string; Keyword: string; CategoryUid: string } {
  const get = (k: string) => (formData.get(k) as string)?.trim() ?? ''
  return {
    title: get('title'),
    description: get('description'),
    Keyword: get('Keyword'),
    CategoryUid: get('Category'),
    Unit: get('Unit'),
    Price: get('Price'),
    ShortTitle: get('ShortTitle'),
    SortKey: get('SortKey'),
    CommercialID: get('CommercialID'),
    ProtocolID: get('ProtocolID'),
    ScientificName: get('ScientificName'),
    Accredited: formData.get('Accredited') === 'on',
    PointOfCapture: get('PointOfCapture') || 'lab',
    DepartmentUid: get('Department'),
    BulkPrice: get('BulkPrice'),
    VAT: get('VAT'),
    LowerDetectionLimit: get('LowerDetectionLimit'),
    LowerLimitOfQuantification: get('LowerLimitOfQuantification'),
    UpperLimitOfQuantification: get('UpperLimitOfQuantification'),
    UpperDetectionLimit: get('UpperDetectionLimit'),
    DetectionLimitSelector: formData.get('DetectionLimitSelector') === 'on',
    AllowManualDetectionLimit: formData.get('AllowManualDetectionLimit') === 'on',
    MethodUids: parseJsonArray<string>(formData, 'MethodUids'),
    DefaultMethodUid: get('DefaultMethodUid'),
    InstrumentUids: parseJsonArray<string>(formData, 'InstrumentUids'),
    DefaultInstrumentUid: get('DefaultInstrumentUid'),
    CalculationUid: get('CalculationUid'),
    Uncertainties: parseJsonArray<SenaiteUncertaintyRow>(formData, 'Uncertainties'),
    PrecisionFromUncertainty: formData.get('PrecisionFromUncertainty') === 'on',
    AllowManualUncertainty: formData.get('AllowManualUncertainty') === 'on',
    ResultType: get('ResultType') || 'numeric',
    DefaultResult: get('DefaultResult'),
    InterimFields: parseJsonArray<SenaiteInterimFieldRow>(formData, 'InterimFields'),
    Precision: get('Precision'),
    ExponentialFormatPrecision: get('ExponentialFormatPrecision'),
    AttachmentRequired: formData.get('AttachmentRequired') === 'on',
    MaxTimeAllowedDays: get('MaxTimeAllowedDays'),
    MaxTimeAllowedHours: get('MaxTimeAllowedHours'),
    MaxTimeAllowedMinutes: get('MaxTimeAllowedMinutes'),
    MaxHoldingTimeDays: get('MaxHoldingTimeDays'),
    MaxHoldingTimeHours: get('MaxHoldingTimeHours'),
    MaxHoldingTimeMinutes: get('MaxHoldingTimeMinutes'),
    DuplicateVariation: get('DuplicateVariation'),
    Hidden: formData.get('Hidden') === 'on',
    SelfVerification: get('SelfVerification') || '0',
    NumberOfRequiredVerifications: get('NumberOfRequiredVerifications') || '1',
    Conditions: parseJsonArray<SenaiteConditionRow>(formData, 'Conditions'),
  }
}

function validateAnalysisFields(payload: ReturnType<typeof parseAnalysisFormData>): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  if (!payload.title) errors.title = ['Analysis name is required']
  if (!payload.Keyword) errors.Keyword = ['Keyword is required']
  else if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(payload.Keyword)) {
    errors.Keyword = ['Keyword must start with a letter and contain only letters, numbers, hyphens or underscores (no spaces)']
  }
  if (payload.Price && !/^\d+(\.\d{1,2})?$/.test(payload.Price)) errors.Price = ['Price must be a number, e.g. 25.00']
  return errors
}

export async function createAnalysis(
  _state: AnalysisFormState,
  formData: FormData
): Promise<AnalysisFormState> {
  const newCategoryTitle = (formData.get('newCategoryTitle') as string)?.trim()
  const departmentUidRaw = (formData.get('Department') as string)?.trim()
  const newDepartmentTitle = (formData.get('newDepartmentTitle') as string)?.trim()
  const newDepartmentId    = (formData.get('newDepartmentId') as string)?.trim()
  const managerUid         = (formData.get('Manager') as string)?.trim()
  const newContactFirstName = (formData.get('newContactFirstName') as string)?.trim()
  const newContactLastName  = (formData.get('newContactLastName') as string)?.trim()
  const categoryUidRaw = (formData.get('Category') as string)?.trim()

  const creatingCategory   = categoryUidRaw === '__new__'
  const creatingDepartment = creatingCategory && departmentUidRaw === '__new__'
  const creatingContact    = creatingDepartment && managerUid === '__new__'

  const payload = parseAnalysisFormData(formData)
  // The lab system's headless create endpoint does NOT reject invalid payloads for
  // this content type — it creates broken orphan records instead. All validation
  // must therefore happen here, before anything is sent.
  const errors = validateAnalysisFields(payload)
  if (!categoryUidRaw) errors.Category = ['Category is required']
  if (creatingCategory) {
    if (!newCategoryTitle) errors.newCategoryTitle = ['New category name is required']
    if (!departmentUidRaw) errors.Department = ['Department is required for a new category']
    delete errors.Category
  }
  if (creatingDepartment) {
    if (!newDepartmentTitle) errors.newDepartmentTitle = ['New department name is required']
    if (!newDepartmentId) errors.newDepartmentId = ['Department ID is required']
    else if (!/^[A-Za-z0-9_-]+$/.test(newDepartmentId)) {
      errors.newDepartmentId = ['Department ID must contain only letters, numbers, hyphens or underscores']
    }
    if (!managerUid) errors.Manager = ['A manager is required for a new department']
  }
  if (creatingContact) {
    if (!newContactFirstName) errors.newContactFirstName = ['First name is required']
    if (!newContactLastName) errors.newContactLastName = ['Last name is required']
  }
  if (Object.keys(errors).length) return { errors }

  const token = serverToken()

  // Duplicate guard (create endpoint would silently accept a duplicate)
  const existing = await fetchSenaiteAnalysisServices(token)
  if (existing.some(s => s.title.trim().toLowerCase() === payload.title.toLowerCase())) {
    return { errors: { title: ['An analysis with this name already exists'] } }
  }
  if (existing.some(s => s.Keyword && s.Keyword.toLowerCase() === payload.Keyword.toLowerCase())) {
    return { errors: { Keyword: ['This keyword is already in use by another analysis'] } }
  }

  // Chain: LabContact (if needed) -> Department (if needed) -> Category (if needed) -> Service.
  // A Department requires a `manager` (LabContact) — without this step, a tenant
  // with zero departments had no way to create one from this screen at all.
  let finalManagerUid = managerUid
  if (creatingContact) {
    const contactResult = await createSenaiteLabContact(token, {
      firstName: newContactFirstName,
      lastName: newContactLastName,
    })
    if (!contactResult.success || !contactResult.uid) {
      return { message: contactResult.error ?? 'Failed to create the new contact.' }
    }
    finalManagerUid = contactResult.uid
  }

  let finalDepartmentUid = departmentUidRaw === '__new__' ? '' : departmentUidRaw
  if (creatingDepartment) {
    const deptResult = await createSenaiteDepartment(token, {
      title: newDepartmentTitle,
      departmentId: newDepartmentId,
      managerUid: finalManagerUid,
    })
    if (!deptResult.success || !deptResult.uid) {
      return { message: deptResult.error ?? 'Failed to create the new department.' }
    }
    finalDepartmentUid = deptResult.uid
  }

  let finalCategoryUid = categoryUidRaw
  if (creatingCategory) {
    const catResult = await createSenaiteAnalysisCategory(token, {
      title: newCategoryTitle,
      departmentUid: finalDepartmentUid,
    })
    if (!catResult.success || !catResult.uid) {
      return { message: catResult.error ?? 'Failed to create the new category.' }
    }
    finalCategoryUid = catResult.uid
  }

  const result = await createSenaiteAnalysisService(token, {
    ...payload,
    CategoryUid: finalCategoryUid,
    DepartmentUid: finalDepartmentUid || payload.DepartmentUid,
  })
  if (!result.success) {
    return { message: result.error ?? 'Failed to create the analysis.' }
  }

  revalidatePath('/dashboard/analyses')
  revalidatePath('/dashboard/analysis-profiles')
  revalidatePath('/dashboard/samples-overview/new')
  return { success: true, message: `Analysis "${payload.title}" created.` }
}

export async function updateAnalysis(
  uid: string,
  _state: AnalysisFormState,
  formData: FormData
): Promise<AnalysisFormState> {
  const payload = parseAnalysisFormData(formData)
  const errors = validateAnalysisFields(payload)
  if (!payload.CategoryUid) errors.Category = ['Category is required']
  if (Object.keys(errors).length) return { errors }

  const token = serverToken()
  const result = await updateSenaiteAnalysisService(token, uid, payload)
  if (!result.success) return { message: result.error ?? 'Failed to update the analysis.' }

  revalidatePath('/dashboard/analyses')
  revalidatePath('/dashboard/analysis-profiles')
  revalidatePath('/dashboard/samples-overview/new')
  return { success: true, message: `Analysis "${payload.title}" updated.` }
}

'use server'
import { revalidatePath } from 'next/cache'
import {
  fetchSenaiteAnalysisServices,
  fetchSenaiteAnalysisCategories,
  fetchSenaiteDepartments,
  fetchSenaiteLabContacts,
  createSenaiteAnalysisCategory,
  createSenaiteAnalysisService,
  createSenaiteDepartment,
  createSenaiteLabContact,
  SenaiteAnalysisService,
  SenaiteAnalysisCategory,
  SenaiteDepartment,
  SenaiteLabContact,
} from '@/app/lib/senaite'

import { serverToken } from '@/app/lib/senaite-auth'

export type AnalysesPageData = {
  services: SenaiteAnalysisService[]
  categories: SenaiteAnalysisCategory[]
  departments: SenaiteDepartment[]
  labContacts: SenaiteLabContact[]
}

export async function getAnalysesPageData(): Promise<AnalysesPageData> {
  const token = serverToken()
  const [services, categories, departments, labContacts] = await Promise.all([
    fetchSenaiteAnalysisServices(token),
    fetchSenaiteAnalysisCategories(token),
    fetchSenaiteDepartments(token),
    fetchSenaiteLabContacts(token),
  ])
  return { services, categories, departments, labContacts }
}

export type AnalysisFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function createAnalysis(
  _state: AnalysisFormState,
  formData: FormData
): Promise<AnalysisFormState> {
  const title            = (formData.get('title') as string)?.trim()
  const keyword          = (formData.get('Keyword') as string)?.trim()
  const categoryUid      = (formData.get('Category') as string)?.trim()
  const newCategoryTitle = (formData.get('newCategoryTitle') as string)?.trim()
  const departmentUid    = (formData.get('Department') as string)?.trim()
  const newDepartmentTitle = (formData.get('newDepartmentTitle') as string)?.trim()
  const newDepartmentId    = (formData.get('newDepartmentId') as string)?.trim()
  const managerUid         = (formData.get('Manager') as string)?.trim()
  const newContactFirstName = (formData.get('newContactFirstName') as string)?.trim()
  const newContactLastName  = (formData.get('newContactLastName') as string)?.trim()
  const unit             = (formData.get('Unit') as string)?.trim()
  const price            = (formData.get('Price') as string)?.trim()

  const creatingCategory   = categoryUid === '__new__'
  const creatingDepartment = creatingCategory && departmentUid === '__new__'
  const creatingContact    = creatingDepartment && managerUid === '__new__'

  // The lab system's headless create endpoint does NOT reject invalid payloads for
  // this content type — it creates broken orphan records instead. All validation
  // must therefore happen here, before anything is sent.
  const errors: Record<string, string[]> = {}
  if (!title) errors.title = ['Analysis name is required']
  if (!keyword) errors.Keyword = ['Keyword is required']
  else if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(keyword)) {
    errors.Keyword = ['Keyword must start with a letter and contain only letters, numbers, hyphens or underscores (no spaces)']
  }
  if (!categoryUid) errors.Category = ['Category is required']
  if (creatingCategory) {
    if (!newCategoryTitle) errors.newCategoryTitle = ['New category name is required']
    if (!departmentUid) errors.Department = ['Department is required for a new category']
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
  if (price && !/^\d+(\.\d{1,2})?$/.test(price)) errors.Price = ['Price must be a number, e.g. 25.00']
  if (Object.keys(errors).length) return { errors }

  const token = serverToken()

  // Duplicate guard (create endpoint would silently accept a duplicate)
  const existing = await fetchSenaiteAnalysisServices(token)
  if (existing.some(s => s.title.trim().toLowerCase() === title.toLowerCase())) {
    return { errors: { title: ['An analysis with this name already exists'] } }
  }
  if (existing.some(s => s.Keyword && s.Keyword.toLowerCase() === keyword.toLowerCase())) {
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

  let finalDepartmentUid = departmentUid
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

  let finalCategoryUid = categoryUid
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
    title,
    Keyword: keyword,
    CategoryUid: finalCategoryUid,
    ...(unit ? { Unit: unit } : {}),
    ...(price ? { Price: price } : {}),
  })
  if (!result.success) {
    return { message: result.error ?? 'Failed to create the analysis.' }
  }

  revalidatePath('/dashboard/analyses')
  revalidatePath('/dashboard/analysis-profiles')
  revalidatePath('/dashboard/samples/new')
  return { success: true, message: `Analysis "${title}" created.` }
}

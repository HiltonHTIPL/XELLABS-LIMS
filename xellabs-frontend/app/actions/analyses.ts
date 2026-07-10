'use server'
import { revalidatePath } from 'next/cache'
import {
  fetchSenaiteAnalysisServices,
  fetchSenaiteAnalysisCategories,
  fetchSenaiteDepartments,
  createSenaiteAnalysisCategory,
  createSenaiteAnalysisService,
  SenaiteAnalysisService,
  SenaiteAnalysisCategory,
  SenaiteDepartment,
} from '@/app/lib/senaite'

const SENAITE_USER = process.env.SENAITE_ADMIN_USER ?? 'admin'
const SENAITE_PASS = process.env.SENAITE_ADMIN_PASS ?? 'admin'

function serverToken(): string {
  return Buffer.from(`${SENAITE_USER}:${SENAITE_PASS}`).toString('base64')
}

export type AnalysesPageData = {
  services: SenaiteAnalysisService[]
  categories: SenaiteAnalysisCategory[]
  departments: SenaiteDepartment[]
}

export async function getAnalysesPageData(): Promise<AnalysesPageData> {
  const token = serverToken()
  const [services, categories, departments] = await Promise.all([
    fetchSenaiteAnalysisServices(token),
    fetchSenaiteAnalysisCategories(token),
    fetchSenaiteDepartments(token),
  ])
  return { services, categories, departments }
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
  const unit             = (formData.get('Unit') as string)?.trim()
  const price            = (formData.get('Price') as string)?.trim()

  const creatingCategory = categoryUid === '__new__'

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

  let finalCategoryUid = categoryUid
  if (creatingCategory) {
    const catResult = await createSenaiteAnalysisCategory(token, {
      title: newCategoryTitle,
      departmentUid,
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

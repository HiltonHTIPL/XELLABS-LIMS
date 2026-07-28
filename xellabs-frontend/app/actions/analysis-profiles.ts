'use server'
import { revalidatePath } from 'next/cache'
import { serverToken } from '@/app/lib/senaite-auth'
import {
  fetchSetupList, createSetupItem, updateSetupItem, deactivateSetupItem, fetchByPath, asArray, type SetupRecord,
} from '@/app/lib/senaite-setup'

// Backed by SENAITE's real AnalysisProfile Dexterity content type (setup/analysisprofiles) —
// this used to be a standalone Django model with no SENAITE counterpart at all;
// replaced so profiles actually exist in the one lab-setup source of truth,
// same v1-read/restapi-write split as every other setup-content entity (§16d).
const PORTAL_TYPE = 'AnalysisProfile'
const PARENT_SUB_PATH = 'setup/analysisprofiles'
const REVALIDATE_PATHS = ['/dashboard/analysis-profiles', '/dashboard/samples-overview', '/dashboard/samples-overview/new', '/dashboard/analyses']

export type ProfileServiceRef = { uid: string; hidden: boolean }

export type AnalysisProfile = {
  uid: string
  path: string
  name: string
  description: string
  profile_key: string
  sample_types: string[]
  analysis_services: ProfileServiceRef[]
  commercial_id: string
  use_analysis_profile_price: boolean
  analysis_profile_price: string
  analysis_profile_vat: string
}

function normalizeServiceRows(v: unknown): ProfileServiceRef[] {
  return asArray<Record<string, unknown>>(v)
    .map(row => ({ uid: (row.uid as string) ?? '', hidden: !!row.hidden }))
    .filter(r => r.uid)
}

function mapProfile(d: SetupRecord): AnalysisProfile {
  return {
    uid: (d.uid as string) ?? '',
    path: (d.path as string) ?? '',
    name: (d.title as string) ?? '',
    description: (d.description as string) ?? '',
    profile_key: (d.profile_key as string) ?? '',
    sample_types: asArray<string>(d.sample_types),
    analysis_services: normalizeServiceRows(d.services),
    commercial_id: (d.commercial_id as string) ?? '',
    use_analysis_profile_price: !!d.use_analysis_profile_price,
    analysis_profile_price: d.analysis_profile_price == null ? '' : String(d.analysis_profile_price),
    analysis_profile_vat: d.analysis_profile_vat == null ? '' : String(d.analysis_profile_vat),
  }
}

export async function getAnalysisProfiles(): Promise<AnalysisProfile[]> {
  const token = serverToken()
  const items = (await fetchSetupList(token, PORTAL_TYPE)).filter(d => d.review_state !== 'inactive')
  const profiles = await Promise.all(items.map(async d => {
    // v1's list read never returns sample_types/analysis_profile_price/vat
    // (same catalog-metadata gap as SampleType's retention_period, §16b) —
    // overlay them from a per-object restapi GET, same fix pattern.
    const extra = d.path ? await fetchByPath(token, d.path as string) : null
    return mapProfile(extra ? { ...d, ...extra } : d)
  }))
  return profiles.sort((a, b) => a.name.localeCompare(b.name))
}

export type AnalysisProfileFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

function parsePayload(formData: FormData) {
  const name = (formData.get('name') as string)?.trim() ?? ''
  const description = (formData.get('description') as string)?.trim() ?? ''
  const profileKey = (formData.get('profile_key') as string)?.trim() ?? ''
  const commercialId = (formData.get('commercial_id') as string)?.trim() ?? ''
  const usePrice = formData.get('use_analysis_profile_price') === 'on'
  const priceRaw = (formData.get('analysis_profile_price') as string)?.trim() ?? ''
  const vatRaw = (formData.get('analysis_profile_vat') as string)?.trim() ?? ''
  const sampleTypes = JSON.parse((formData.get('sample_types') as string) || '[]') as string[]
  const analysisServices = JSON.parse((formData.get('analysis_services') as string) || '[]') as ProfileServiceRef[]

  const errors: Record<string, string[]> = {}
  if (!name) errors.name = ['Profile name is required']
  if (!Array.isArray(analysisServices) || analysisServices.length === 0) {
    errors.analysis_services = ['Select at least one analysis']
  }

  const body: SetupRecord = {
    title: name,
    description,
    profile_key: profileKey,
    sample_types: Array.isArray(sampleTypes) ? sampleTypes : [],
    services: (analysisServices ?? []).map(a => ({ uid: a.uid, hidden: !!a.hidden })),
    commercial_id: commercialId,
    use_analysis_profile_price: usePrice,
  }
  if (usePrice) {
    // Sent as strings, not JS numbers — SENAITE's restapi deserializer for this
    // Float field rejects a bare JSON number ("Object is of wrong type"),
    // confirmed live against setup/analysisprofiles.
    if (priceRaw) body.analysis_profile_price = priceRaw
    if (vatRaw) body.analysis_profile_vat = vatRaw
  }

  return { errors, body, name }
}

export async function createAnalysisProfile(
  _state: AnalysisProfileFormState,
  formData: FormData,
): Promise<AnalysisProfileFormState> {
  const { errors, body, name } = parsePayload(formData)
  if (Object.keys(errors).length) return { errors }

  const res = await createSetupItem(serverToken(), PORTAL_TYPE, PARENT_SUB_PATH, body)
  if (!res.success) return { message: res.error ?? 'Failed to create analysis profile.' }
  REVALIDATE_PATHS.forEach(p => revalidatePath(p))
  return { success: true, message: `Analysis profile "${name}" created.` }
}

export async function updateAnalysisProfile(
  path: string,
  _state: AnalysisProfileFormState,
  formData: FormData,
): Promise<AnalysisProfileFormState> {
  const { errors, body, name } = parsePayload(formData)
  if (Object.keys(errors).length) return { errors }

  const res = await updateSetupItem(serverToken(), path, body)
  if (!res.success) return { message: res.error ?? 'Failed to update analysis profile.' }
  REVALIDATE_PATHS.forEach(p => revalidatePath(p))
  return { success: true, message: `Analysis profile "${name}" updated.` }
}

export async function deleteAnalysisProfile(path: string): Promise<{ success: boolean; message?: string }> {
  const res = await deactivateSetupItem(serverToken(), path)
  if (!res.success) return { success: false, message: res.error ?? 'Failed to deactivate analysis profile.' }
  REVALIDATE_PATHS.forEach(p => revalidatePath(p))
  return { success: true }
}

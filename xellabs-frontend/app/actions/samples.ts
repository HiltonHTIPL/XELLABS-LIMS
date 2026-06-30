'use server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/lib/session'
import {
  fetchSenaiteSamples,
  fetchSenaiteSample,
  createSenaiteSample,
  senaiteWorkflowAction,
  fetchSenaiteSampleTypes,
  fetchSenaiteAnalysisServices,
  SenaiteSample,
  SenaiteSampleType,
  SenaiteAnalysisService,
} from '@/app/lib/senaite'

const SENAITE_USER = process.env.SENAITE_ADMIN_USER ?? 'admin'
const SENAITE_PASS = process.env.SENAITE_ADMIN_PASS ?? 'admin'

function serverToken(): string {
  return Buffer.from(`${SENAITE_USER}:${SENAITE_PASS}`).toString('base64')
}

function sessionToken(session: { senaiteToken?: string } | null): string {
  return session?.senaiteToken ?? serverToken()
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function getSamples(): Promise<SenaiteSample[]> {
  const session = await getSession()
  return fetchSenaiteSamples(sessionToken(session))
}

export async function getSample(uid: string): Promise<SenaiteSample | null> {
  const session = await getSession()
  return fetchSenaiteSample(sessionToken(session), uid)
}

// ─── Reference data ───────────────────────────────────────────────────────────

export async function getSampleTypes(): Promise<SenaiteSampleType[]> {
  return fetchSenaiteSampleTypes(serverToken())
}

export async function getAnalysisServices(): Promise<SenaiteAnalysisService[]> {
  return fetchSenaiteAnalysisServices(serverToken())
}

// ─── Create ───────────────────────────────────────────────────────────────────

export type SampleFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
  sample?: SenaiteSample
}

export async function createSample(
  _state: SampleFormState,
  formData: FormData
): Promise<SampleFormState> {
  const session = await getSession()
  if (!session?.djangoToken) return { message: 'Not authenticated.' }

  const clientUID      = (formData.get('client_uid') as string)?.trim()
  const sampleTypeUID  = (formData.get('sample_type_uid') as string)?.trim()
  const dateSampled    = (formData.get('date_sampled') as string)?.trim()
  const priority       = (formData.get('priority') as string)?.trim() ?? '3'
  const clientSampleID = (formData.get('client_sample_id') as string)?.trim()
  const analysisUIDs   = formData.getAll('analyses') as string[]

  const errors: Record<string, string[]> = {}
  if (!clientUID)     errors.client_uid     = ['Client is required']
  if (!sampleTypeUID) errors.sample_type_uid = ['Sample type is required']
  if (!dateSampled)   errors.date_sampled   = ['Date sampled is required']
  if (Object.keys(errors).length > 0) return { errors }

  const result = await createSenaiteSample(sessionToken(session), {
    Client:        clientUID,
    SampleType:    sampleTypeUID,
    DateSampled:   dateSampled,
    Priority:      priority,
    ClientSampleID: clientSampleID || undefined,
    Analyses:      analysisUIDs.length > 0 ? analysisUIDs : undefined,
  })

  if (!result.success) return { message: result.error ?? 'Failed to create sample in SENAITE.' }

  revalidatePath('/dashboard/samples')
  return { success: true, message: `Sample ${result.sample?.id} created successfully.`, sample: result.sample }
}

// ─── Workflow transitions ─────────────────────────────────────────────────────

export type WorkflowResult = { success: boolean; message: string }

export async function receiveSample(uid: string): Promise<WorkflowResult> {
  const session = await getSession()
  const result = await senaiteWorkflowAction(sessionToken(session), uid, 'receive')
  revalidatePath('/dashboard/samples')
  return { success: result.success, message: result.success ? 'Sample received.' : (result.error ?? 'Failed to receive sample.') }
}

export async function verifySample(uid: string): Promise<WorkflowResult> {
  const session = await getSession()
  const result = await senaiteWorkflowAction(sessionToken(session), uid, 'verify')
  revalidatePath('/dashboard/samples')
  return { success: result.success, message: result.success ? 'Sample verified.' : (result.error ?? 'Failed to verify sample.') }
}

export async function publishSample(uid: string): Promise<WorkflowResult> {
  const session = await getSession()
  const result = await senaiteWorkflowAction(sessionToken(session), uid, 'publish')
  revalidatePath('/dashboard/samples')
  return { success: result.success, message: result.success ? 'Sample published.' : (result.error ?? 'Failed to publish sample.') }
}

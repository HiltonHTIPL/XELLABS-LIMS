'use server'
import { revalidatePath } from 'next/cache'
import {
  fetchSenaiteCalculations, createSenaiteCalculation, updateSenaiteCalculation,
  setSenaiteCalculationActive, fetchSenaiteAnalysisServices, runSenaiteCalculationTest,
  type SenaiteCalculation, type SenaiteCalculationInterimField, type SenaiteCalculationPythonImport,
  type SenaiteCalculationTestParameter, type SenaiteAnalysisService,
} from '@/app/lib/senaite'
import { serverToken } from '@/app/lib/senaite-auth'

export async function getCalculations(): Promise<SenaiteCalculation[]> {
  return fetchSenaiteCalculations(serverToken())
}

export async function getCalculationServiceOptions(): Promise<SenaiteAnalysisService[]> {
  return fetchSenaiteAnalysisServices(serverToken())
}

export type CalculationFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
  calculation?: SenaiteCalculation
}

function parseInterimFields(formData: FormData): SenaiteCalculationInterimField[] {
  try {
    return JSON.parse((formData.get('interim_fields_json') as string) || '[]')
  } catch { return [] }
}

function parsePythonImports(formData: FormData): SenaiteCalculationPythonImport[] {
  try {
    return JSON.parse((formData.get('python_imports_json') as string) || '[]')
  } catch { return [] }
}

function validate(
  title: string, formula: string,
  interimFields: SenaiteCalculationInterimField[], pythonImports: SenaiteCalculationPythonImport[]
): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  if (!title) errors.title = ['Title is required']
  if (!formula) errors.formula = ['Formula is required']
  const seen = new Set<string>()
  for (const f of interimFields) {
    if (!f.keyword) { errors.interim_fields = ['Every interim field needs a keyword']; break }
    if (seen.has(f.keyword)) { errors.interim_fields = [`Duplicate interim keyword: ${f.keyword}`]; break }
    seen.add(f.keyword)
  }
  for (const p of pythonImports) {
    if (!p.module || !p.function) { errors.python_imports = ['Every Python import needs both a module and a function']; break }
  }
  return errors
}

export async function createCalculation(_state: CalculationFormState, formData: FormData): Promise<CalculationFormState> {
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const formula = (formData.get('formula') as string)?.trim()
  const interimFields = parseInterimFields(formData)
  const pythonImports = parsePythonImports(formData)

  const errors = validate(title, formula, interimFields, pythonImports)
  if (Object.keys(errors).length) return { errors }

  const res = await createSenaiteCalculation(serverToken(), { title, description, formula, interimFields, pythonImports })
  if (!res.success) return { message: res.error ?? 'Failed to create calculation.' }
  revalidatePath('/dashboard/calculations')
  return { success: true, message: 'Calculation created.', calculation: res.calculation }
}

export async function updateCalculation(uid: string, _state: CalculationFormState, formData: FormData): Promise<CalculationFormState> {
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const formula = (formData.get('formula') as string)?.trim()
  const interimFields = parseInterimFields(formData)
  const pythonImports = parsePythonImports(formData)

  const errors = validate(title, formula, interimFields, pythonImports)
  if (Object.keys(errors).length) return { errors }

  const res = await updateSenaiteCalculation(serverToken(), uid, { title, description, formula, interimFields, pythonImports })
  if (!res.success) return { message: res.error ?? 'Failed to update calculation.' }
  revalidatePath('/dashboard/calculations')
  return { success: true, message: 'Calculation updated.', calculation: res.calculation }
}

export async function toggleCalculationActive(uid: string, active: boolean): Promise<{ success: boolean; message: string }> {
  const res = await setSenaiteCalculationActive(serverToken(), uid, active)
  if (!res.success) return { success: false, message: res.error ?? 'Failed to change status.' }
  revalidatePath('/dashboard/calculations')
  return { success: true, message: active ? 'Calculation activated.' : 'Calculation deactivated.' }
}

export async function testCalculation(
  uid: string, testParameters: SenaiteCalculationTestParameter[]
): Promise<{ success: boolean; testResult?: string; testParameters?: SenaiteCalculationTestParameter[]; message?: string }> {
  const res = await runSenaiteCalculationTest(serverToken(), uid, testParameters)
  if (!res.success || !res.calculation) return { success: false, message: res.error ?? 'Failed to run test.' }
  revalidatePath('/dashboard/calculations')
  return { success: true, testResult: res.calculation.testResult, testParameters: res.calculation.testParameters }
}

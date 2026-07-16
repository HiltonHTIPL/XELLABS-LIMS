'use server'
import { revalidatePath } from 'next/cache'
import {
  fetchSenaiteContainerTypesFull,
  createSenaiteContainerType,
  updateSenaiteContainerType,
  SenaiteContainerType,
} from '@/app/lib/senaite'
import { serverToken } from '@/app/lib/senaite-auth'

export async function getContainerTypesList(): Promise<SenaiteContainerType[]> {
  return fetchSenaiteContainerTypesFull(serverToken())
}

export type ContainerTypeFormState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

function parsePayload(formData: FormData): { title: string; description: string; errors: Record<string, string[]> } {
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() ?? ''
  const errors: Record<string, string[]> = {}
  if (!title) errors.title = ['Name is required']
  return { title, description, errors }
}

export async function createContainerType(
  _state: ContainerTypeFormState,
  formData: FormData
): Promise<ContainerTypeFormState> {
  const { title, description, errors } = parsePayload(formData)
  if (Object.keys(errors).length) return { errors }

  const result = await createSenaiteContainerType(serverToken(), { title, description })
  if (!result.success) return { message: result.error ?? 'Failed to create container type.' }

  revalidatePath('/dashboard/container-types')
  revalidatePath('/dashboard/sample-types')
  return { success: true, message: `Container type "${title}" created.` }
}

export async function updateContainerType(
  uid: string,
  _state: ContainerTypeFormState,
  formData: FormData
): Promise<ContainerTypeFormState> {
  const { title, description, errors } = parsePayload(formData)
  if (Object.keys(errors).length) return { errors }

  const result = await updateSenaiteContainerType(serverToken(), uid, { title, description })
  if (!result.success) return { message: result.error ?? 'Failed to update container type.' }

  revalidatePath('/dashboard/container-types')
  revalidatePath('/dashboard/sample-types')
  return { success: true, message: `Container type "${title}" updated.` }
}

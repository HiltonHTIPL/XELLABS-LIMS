'use server'
import { revalidatePath } from 'next/cache'
import { serverToken } from '@/app/lib/senaite-auth'
import {
  fetchSenaiteInstruments, createSenaiteInstrument, updateSenaiteInstrument, type SenaiteInstrument,
} from '@/app/lib/senaite'
import { listOptions } from '@/app/lib/admin-crud'

// Server-action layer for the SENAITE-native Instruments tab. All the
// v1-API-only quirks (restapi is completely broken for this type) live in
// senaite.ts's createSenaiteInstrument/updateSenaiteInstrument — this file is
// just the thin Next.js action wrapper, same split as every other SENAITE
// entity (e.g. senaite-methods.ts / senaite-worksheets.ts).
export async function listSenaiteInstrumentRows(): Promise<SenaiteInstrument[]> {
  return fetchSenaiteInstruments(serverToken())
}

export async function listInstrumentTypeOptions() { return listOptions('InstrumentType') }
export async function listManufacturerOptions() { return listOptions('Manufacturer') }
export async function listSupplierOptions() { return listOptions('Supplier') }
export async function listMethodOptions() { return listOptions('Method') }

export type SenaiteInstrumentFormState = { success?: boolean; message?: string; errors?: Record<string, string[]> }

function buildFields(fd: FormData) {
  const title = ((fd.get('title') as string) ?? '').trim()
  const instrumentType = ((fd.get('instrumentType') as string) ?? '').trim()
  const manufacturer = ((fd.get('manufacturer') as string) ?? '').trim()
  const supplier = ((fd.get('supplier') as string) ?? '').trim()
  const errors: Record<string, string[]> = {}
  if (!title) errors.title = ['Name is required']
  if (!instrumentType) errors.instrumentType = ['Instrument type is required']
  if (!manufacturer) errors.manufacturer = ['Manufacturer is required']
  if (!supplier) errors.supplier = ['Supplier is required']
  return {
    fields: {
      title,
      InstrumentType: instrumentType,
      Manufacturer: manufacturer,
      Supplier: supplier,
      Model: ((fd.get('model') as string) ?? '').trim(),
      SerialNo: ((fd.get('serialNo') as string) ?? '').trim(),
      Methods: fd.getAll('methodUids').map(String).filter(Boolean),
    },
    errors,
  }
}

export async function createSenaiteInstrumentRecord(_p: SenaiteInstrumentFormState, fd: FormData): Promise<SenaiteInstrumentFormState> {
  const { fields, errors } = buildFields(fd)
  if (Object.keys(errors).length) return { errors }
  const r = await createSenaiteInstrument(serverToken(), fields)
  if (!r.success) return { message: r.error ?? 'Failed to create instrument.' }
  revalidatePath('/dashboard/instruments')
  return { success: true, message: `Instrument "${fields.title}" created.` }
}

export async function updateSenaiteInstrumentRecord(uid: string, _p: SenaiteInstrumentFormState, fd: FormData): Promise<SenaiteInstrumentFormState> {
  const { fields, errors } = buildFields(fd)
  if (Object.keys(errors).length) return { errors }
  const r = await updateSenaiteInstrument(serverToken(), uid, fields)
  if (!r.success) return { message: r.error ?? 'Failed to update instrument.' }
  revalidatePath('/dashboard/instruments')
  return { success: true, message: `Instrument "${fields.title}" updated.` }
}

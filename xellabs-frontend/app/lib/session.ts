import 'server-only'
import { cookies } from 'next/headers'
import {
  SESSION_DURATION_MS,
  getSessionCookieOptions,
  encrypt,
  decrypt,
} from './session-edge'

export type { SessionPayload } from './session-edge'
export { SESSION_DURATION_MS, getSessionCookieOptions, encrypt, decrypt }

export async function createSession(payload: Omit<import('./session-edge').SessionPayload, 'expiresAt'>) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  const token = await encrypt({ ...payload, expiresAt })
  const cookieStore = await cookies()
  cookieStore.set('session', token, getSessionCookieOptions(expiresAt))
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

export async function getSession(): Promise<import('./session-edge').SessionPayload | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  return decrypt(session)
}

import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SESSION_SECRET = process.env.SESSION_SECRET!
const encodedKey = new TextEncoder().encode(SESSION_SECRET)

// 8 hours — HIPAA §164.312(a)(2)(iii) automatic logoff
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000

export type SessionPayload = {
  userId: string
  username: string
  role: string
  djangoToken: string
  senaiteToken?: string
  tenantSubdomain?: string   // e.g. "greenvalley" — empty/absent = public schema
  expiresAt: Date
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(encodedKey)
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function createSession(payload: Omit<SessionPayload, 'expiresAt'>) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  const token = await encrypt({ ...payload, expiresAt })
  const cookieStore = await cookies()

  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  return decrypt(session)
}

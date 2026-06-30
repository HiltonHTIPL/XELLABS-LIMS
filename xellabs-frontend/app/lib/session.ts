import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SESSION_SECRET = process.env.SESSION_SECRET ?? 'xellabs-lims-hipaa-jwt-secret-change-in-production-min32chars'
const key = new TextEncoder().encode(SESSION_SECRET)

export type SessionPayload = {
  userId: string
  username: string
  role: string
  djangoToken: string
  senaiteToken?: string
  tenantSubdomain?: string
  expiresAt: Date
}

export async function encrypt(payload: Omit<SessionPayload, 'expiresAt'>) {
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 hours
  return new SignJWT({ ...payload, expiresAt })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(key)
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function createSession(data: Omit<SessionPayload, 'expiresAt'>) {
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const token = await encrypt(data)
  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  return decrypt(token)
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

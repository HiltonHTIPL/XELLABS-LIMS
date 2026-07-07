import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

function getEncodedKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET env var must be set to a string of at least 32 characters')
  }
  return new TextEncoder().encode(secret)
}

// 8 hours — HIPAA §164.312(a)(2)(iii) automatic logoff
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000

// NODE_ENV=production doesn't imply HTTPS is actually available (e.g. a QA
// server reached by raw IP with no TLS termination) — browsers silently drop
// Secure cookies over plain HTTP, so default to NODE_ENV but allow an
// explicit override for HTTP-only deployments.
const COOKIE_SECURE = process.env.COOKIE_SECURE !== undefined
  ? process.env.COOKIE_SECURE === 'true'
  : process.env.NODE_ENV === 'production'

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
    .sign(getEncodedKey())
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, getEncodedKey(), {
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
    secure: COOKIE_SECURE,
    expires: expiresAt,
    sameSite: 'strict',
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

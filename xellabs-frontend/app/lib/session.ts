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
    // Secure requires HTTPS — this deployment serves plain HTTP behind Docker,
    // so gate on an explicit flag rather than NODE_ENV (which is always
    // 'production' here). Set FORCE_SECURE_COOKIES=true once TLS is in front.
    secure: process.env.FORCE_SECURE_COOKIES === 'true',
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

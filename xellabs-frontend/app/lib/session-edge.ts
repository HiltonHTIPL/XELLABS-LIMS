import { SignJWT, jwtVerify } from 'jose'

const SESSION_SECRET = process.env.SESSION_SECRET
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET env var must be set to a string of at least 32 characters')
}
export const encodedKey = new TextEncoder().encode(SESSION_SECRET)

// 8 hours — HIPAA §164.312(a)(2)(iii) automatic logoff; resets on each request (sliding window)
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000

// NODE_ENV=production doesn't imply HTTPS is actually available (e.g. a QA
// server reached by raw IP with no TLS termination) — browsers silently drop
// Secure cookies over plain HTTP, so default to NODE_ENV but allow an
// explicit override for HTTP-only deployments.
const COOKIE_SECURE = process.env.COOKIE_SECURE !== undefined
  ? process.env.COOKIE_SECURE === 'true'
  : process.env.NODE_ENV === 'production'

export function getSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    expires: expiresAt,
    sameSite: 'strict' as const,
    path: '/',
  }
}

export type SessionPayload = {
  userId: string
  username: string
  role: string
  isSuperuser?: boolean   // platform superadmin — gates Tenant Management
  djangoToken: string
  senaiteToken?: string
  tenantSubdomain?: string   // e.g. "greenvalley" — empty/absent = public schema
  expiresAt: Date
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(new Date(payload.expiresAt))
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

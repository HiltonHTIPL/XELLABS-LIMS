import { EncryptJWT, jwtDecrypt } from 'jose'

const SESSION_SECRET = process.env.SESSION_SECRET
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET env var must be set to a string of at least 32 characters')
}
// The session payload carries credentials (djangoToken, senaiteToken — the
// latter is base64 of the user's SENAITE password), so the cookie must be
// ENCRYPTED (JWE), not merely signed (JWS): a signed JWT's payload is readable
// by anyone who obtains the cookie. dir/A256GCM needs exactly 32 key bytes —
// derive them deterministically from SESSION_SECRET regardless of its length.
export const encodedKey = new TextEncoder().encode(SESSION_SECRET).slice(0, 32)

// 8 hours — HIPAA §164.312(a)(2)(iii) automatic logoff; resets on each request (sliding window)
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000

export function getSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production",
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
  return new EncryptJWT({ ...payload })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(new Date(payload.expiresAt))
    .encrypt(encodedKey)
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtDecrypt(session, encodedKey, {
      contentEncryptionAlgorithms: ['A256GCM'],
      keyManagementAlgorithms: ['dir'],
    })
    return payload as unknown as SessionPayload
  } catch {
    // Includes legacy signed (JWS) session cookies from before this change —
    // those users are simply logged out and log in again.
    return null
  }
}

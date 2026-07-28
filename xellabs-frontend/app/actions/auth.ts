'use server'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createSession, deleteSession } from '@/app/lib/session'
import { LoginSchema, type LoginFormState } from '@/app/lib/definitions'
import { senaiteLogin, mapSenaiteRole } from '@/app/lib/senaite'
import { djangoFetch } from '@/app/lib/django'

// Per-username limiter alone let an attacker enumerate/spray many different
// usernames (each gets its own untouched 5/min bucket) with no overall cap
// from one source — add a per-IP limiter as a second, coarser gate. Both are
// in-memory (per-process, resets on redeploy/restart) — acceptable for a
// single-instance deployment; if this frontend is ever scaled to multiple
// replicas, back these with Redis instead so the counts are shared.
const usernameLimiter = new RateLimiterMemory({ points: 5, duration: 60 })
const ipLimiter = new RateLimiterMemory({ points: 20, duration: 60 })

const DJANGO_API = process.env.DJANGO_API_URL ?? 'http://django:8001'

async function getDjangoToken(username: string, password: string): Promise<string> {
  try {
    const res = await fetch(`${DJANGO_API}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      cache: 'no-store',
    })
    if (!res.ok) return ''
    const data = await res.json()
    return data.token ?? ''
  } catch {
    return ''
  }
}

export async function login(
  state: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const validated = LoginSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { username, password } = validated.data

  // Read subdomain injected by proxy.ts middleware. Falls back to
  // DEFAULT_TENANT_SCHEMA (demo-phase only) when no subdomain is present, so
  // plain localhost:3000 access still resolves to a real tenant instead of
  // the public schema — unset that env var once real subdomain-based
  // multi-tenant login is rolled out.
  const headerStore = await headers()
  const tenantSubdomain = headerStore.get('x-tenant-subdomain') || process.env.DEFAULT_TENANT_SCHEMA || ''
  const ip = headerStore.get('x-forwarded-for')?.split(',')[0].trim()
    || headerStore.get('x-real-ip')
    || 'unknown'

  // Only FAILED attempts consume a point (checked via .get, not .consume, so a
  // successful first-try login is never penalized) — a legitimate user typing
  // their password correctly should never be blocked by their own past typos.
  const [usernameState, ipState] = await Promise.all([
    usernameLimiter.get(username),
    ipLimiter.get(ip),
  ])
  if ((usernameState?.remainingPoints ?? 5) <= 0) {
    return { message: 'Too many login attempts for this account. Please wait a minute.' }
  }
  if ((ipState?.remainingPoints ?? 20) <= 0) {
    return { message: 'Too many login attempts from this network. Please wait a minute.' }
  }

  async function recordFailure() {
    await Promise.all([
      usernameLimiter.consume(username).catch(() => {}),
      ipLimiter.consume(ip).catch(() => {}),
    ])
  }
  // Only the per-username bucket is cleared on success — NOT the per-IP one.
  // Clearing the IP bucket too would let an attacker behind a shared IP/NAT
  // reset the whole IP's counter by logging into any one legitimate account.
  async function clearAttempts() {
    await usernameLimiter.delete(username).catch(() => {})
  }

  // ── Try SENAITE first ─────────────────────────────────────────────────────
  const senaiteResult = await senaiteLogin(username, password)

  if (senaiteResult) {
    const { token: senaiteToken, user } = senaiteResult

    // Also get a Django token so the Client/Tenant API works.
    // IMPORTANT: Do NOT fall back to service token on auth failure — that would bypass authentication.
    // If this user doesn't exist in Django, the login fails (user is SENAITE-only, which is not supported).
    const djangoToken = await getDjangoToken(username, password)
    if (!djangoToken) {
      await recordFailure()
      return { message: 'User not found in Django. Please contact an administrator.' }
    }

    // Role and superuser flag both come from Django, not SENAITE — Django is the
    // system that actually enforces role-based permissions on our own API, so
    // the session must reflect its role or the UI and backend can disagree
    // (e.g. SENAITE 'Manager' mapped to 'admin' here while Django still has the
    // user as 'analyst' — the UI would show admin actions the backend rejects).
    let role = mapSenaiteRole(user.roles)
    let isSuperuser = false
    try {
      const meRes = await djangoFetch('/api/auth/me/', {
        headers: { Authorization: `Token ${djangoToken}` },
      })
      if (meRes.ok) {
        const me = await meRes.json()
        role = me.role || role
        isSuperuser = Boolean(me.is_superuser)
      }
    } catch { /* non-fatal — fall back to the SENAITE-derived role */ }

    await clearAttempts()
    await createSession({
      userId: user.userid,
      username: user.userid,
      role,
      senaiteRoles: user.roles,
      isSuperuser,
      djangoToken,
      senaiteToken,
      tenantSubdomain,
    })

    redirect('/dashboard')
  }

  // ── Fall back to Django ───────────────────────────────────────────────────
  const djangoToken = await getDjangoToken(username, password)
  if (!djangoToken) {
    await recordFailure()
    return { message: 'Invalid username or password.' }
  }

  let userProfile: {
    id: number; username: string; email: string
    first_name: string; last_name: string; role: string
    is_superuser?: boolean
  }

  try {
    // No session exists yet at this point in login, so djangoFetch can't read the
    // token from getSession() — pass the freshly obtained token explicitly. It still
    // picks up X-Tenant-Schema from the x-tenant-subdomain request header automatically.
    const meRes = await djangoFetch('/api/auth/me/', {
      headers: { Authorization: `Token ${djangoToken}` },
    })
    if (!meRes.ok) {
      await recordFailure()
      return { message: 'Failed to retrieve user profile.' }
    }
    userProfile = await meRes.json()
  } catch {
    await recordFailure()
    return { message: 'Invalid username or password.' }
  }

  await clearAttempts()
  await createSession({
    userId: String(userProfile.id),
    username: userProfile.username,
    role: userProfile.role,
    isSuperuser: Boolean(userProfile.is_superuser),
    djangoToken,
    tenantSubdomain,
  })

  redirect('/dashboard')
}

export async function logout() {
  await deleteSession()
  redirect('/login')
}


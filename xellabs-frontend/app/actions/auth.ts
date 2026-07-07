'use server'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createSession, deleteSession, getSession } from '@/app/lib/session'
import { LoginSchema, type LoginFormState } from '@/app/lib/definitions'
import { senaiteLogin, mapSenaiteRole } from '@/app/lib/senaite'
import { djangoFetch } from '@/app/lib/django'

const rateLimiter = new RateLimiterMemory({ points: 5, duration: 60 })

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

  try {
    await rateLimiter.consume(username)
  } catch {
    return { message: 'Too many login attempts. Please wait a minute.' }
  }

  // Read subdomain injected by proxy.ts middleware
  const headerStore = await headers()
  const tenantSubdomain = headerStore.get('x-tenant-subdomain') || ''

  // ── Try SENAITE first ─────────────────────────────────────────────────────
  const senaiteResult = await senaiteLogin(username, password)

  if (senaiteResult) {
    const { token: senaiteToken, user } = senaiteResult
    const role = mapSenaiteRole(user.roles)

    // Also get a Django token so the Client/Tenant API works.
    // Fall back to service token if this user doesn't exist in Django.
    const djangoToken = await getDjangoToken(username, password)
      || process.env.DJANGO_SERVICE_TOKEN
      || ''

    await createSession({
      userId: user.userid,
      username: user.userid,
      role,
      djangoToken,
      senaiteToken,
      tenantSubdomain,
    })

    redirect('/dashboard')
  }

  // ── Fall back to Django ───────────────────────────────────────────────────
  const djangoToken = await getDjangoToken(username, password)
  if (!djangoToken) {
    return { message: 'Invalid username or password.' }
  }

  let userProfile: {
    id: number; username: string; email: string
    first_name: string; last_name: string; role: string
  }

  try {
    // No session exists yet at this point in login, so djangoFetch can't read the
    // token from getSession() — pass the freshly obtained token explicitly. It still
    // picks up X-Tenant-Schema from the x-tenant-subdomain request header automatically.
    const meRes = await djangoFetch('/api/auth/me/', {
      headers: { Authorization: `Token ${djangoToken}` },
    })
    if (!meRes.ok) return { message: 'Failed to retrieve user profile.' }
    userProfile = await meRes.json()
  } catch {
    return { message: 'Invalid username or password.' }
  }

  await createSession({
    userId: String(userProfile.id),
    username: userProfile.username,
    role: userProfile.role,
    djangoToken,
    tenantSubdomain,
  })

  redirect('/dashboard')
}

export async function logout() {
  await deleteSession()
  redirect('/login')
}

export async function refreshSession() {
  const session = await getSession()
  if (!session) return
  await createSession({
    userId: session.userId,
    username: session.username,
    role: session.role,
    djangoToken: session.djangoToken,
    senaiteToken: session.senaiteToken,
    tenantSubdomain: session.tenantSubdomain,
  })
}

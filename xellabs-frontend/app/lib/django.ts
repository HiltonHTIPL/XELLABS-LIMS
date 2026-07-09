/**
 * Tenant-aware Django API fetch helper.
 *
 * Reads the tenant subdomain from either:
 *   1. The session (stored at login time)
 *   2. The x-tenant-subdomain request header (set by middleware)
 *
 * Sends it to Django as X-Tenant-Schema so the custom middleware can
 * activate the right PostgreSQL schema for every API call.
 */
import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession, deleteSession } from '@/app/lib/session'

const DJANGO_API = process.env.DJANGO_API_URL ?? 'http://django:8001'

export async function djangoFetch(
  path: string,
  init: RequestInit & { skipAuth?: boolean } = {}
): Promise<Response> {
  const [session, headerStore] = await Promise.all([getSession(), headers()])

  // Tenant: prefer session value (reliable after login), fall back to
  // middleware header (useful for unauthenticated requests like login itself)
  const tenantSubdomain =
    session?.tenantSubdomain ||
    headerStore.get('x-tenant-subdomain') ||
    process.env.DEFAULT_TENANT_SCHEMA ||
    ''

  const tenantHeaders: Record<string, string> = {}
  if (tenantSubdomain) {
    tenantHeaders['X-Tenant-Schema'] = tenantSubdomain
  }

  const token =
    session?.djangoToken ||
    process.env.DJANGO_SERVICE_TOKEN ||
    ''

  const authHeaders: Record<string, string> = {}
  if (!init.skipAuth && token) {
    authHeaders['Authorization'] = `Token ${token}`
  }

  const { skipAuth: _omit, ...fetchInit } = init

  // Don't set Content-Type for FormData bodies — fetch must set its own
  // multipart boundary, and a forced 'application/json' here would break uploads.
  const isFormData = typeof FormData !== 'undefined' && fetchInit.body instanceof FormData

  const res = await fetch(`${DJANGO_API}${path}`, {
    ...fetchInit,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeaders,
      ...tenantHeaders,
      ...(fetchInit.headers as Record<string, string> | undefined),
    },
    cache: fetchInit.cache ?? 'no-store',
  })

  // Only an *existing* session can go stale this way — a fresh/unauthenticated
  // request (e.g. the login form's own djangoFetch call) hitting this means
  // the tenant name itself was wrong, which the caller already handles as a
  // normal auth failure. Only clear+redirect when a logged-in session's
  // frozen tenantSubdomain no longer resolves in the DB (deleted tenant, or a
  // cookie issued before a tenant/DB reset) — otherwise every request made
  // with that cookie would silently 500 for the rest of its 8-hour lifetime.
  if (session && res.status === 401) {
    const probe = res.clone()
    let code: string | undefined
    try {
      code = (await probe.json())?.code
    } catch { /* not JSON — not our invalid_tenant signal */ }

    if (code === 'invalid_tenant') {
      await deleteSession()
      redirect('/login')
    }
  }

  return res
}

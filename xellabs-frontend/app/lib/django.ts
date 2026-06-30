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
import { getSession } from '@/app/lib/session'

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
    ''

  const tenantHeaders: Record<string, string> = {}
  if (tenantSubdomain) {
    tenantHeaders['X-Tenant-Schema'] = tenantSubdomain
  }

  const authHeaders: Record<string, string> = {}
  if (!init.skipAuth && session?.djangoToken) {
    authHeaders['Authorization'] = `Token ${session.djangoToken}`
  }

  const { skipAuth: _omit, ...fetchInit } = init

  return fetch(`${DJANGO_API}${path}`, {
    ...fetchInit,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...tenantHeaders,
      ...(fetchInit.headers as Record<string, string> | undefined),
    },
    cache: fetchInit.cache ?? 'no-store',
  })
}

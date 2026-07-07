import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/app/lib/session'

const protectedRoutes = ['/dashboard']
const publicRoutes = ['/login', '/']

const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/

function extractSubdomain(host: string): string {
  const hostname = host.split(':')[0]
  // A bare IPv4 address (e.g. accessing the site via its server IP directly)
  // also has multiple dot-separated parts — without this check, the first
  // octet gets misread as a tenant subdomain (e.g. "34.30.6.247" -> "34"),
  // routing every request to a tenant schema that doesn't exist and causing
  // every tenant-scoped API call to fail with a 500.
  if (IPV4_RE.test(hostname)) return ''
  const parts = hostname.split('.')
  if (parts.length === 1) return ''
  const sub = parts[0]
  if (['www', 'app', 'api', 'admin'].includes(sub)) return ''
  return sub
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isProtected = protectedRoutes.some(r => path.startsWith(r))
  const isPublic = publicRoutes.includes(path)

  const sessionCookie = req.cookies.get('session')?.value
  const session = await decrypt(sessionCookie)

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  if (isPublic && session && !path.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  // Inject tenant subdomain header for server components and actions
  const host = req.headers.get('host') ?? 'localhost'
  const subdomain = extractSubdomain(host)
  const requestHeaders = new Headers(req.headers)
  if (subdomain) {
    requestHeaders.set('x-tenant-subdomain', subdomain)
  } else {
    requestHeaders.delete('x-tenant-subdomain')
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}

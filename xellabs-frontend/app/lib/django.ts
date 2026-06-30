import { getSession } from './session'

const DJANGO_API = process.env.DJANGO_API_URL ?? 'http://django:8001'

export async function djangoFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const session = await getSession()
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (session?.djangoToken) {
    headers.set('Authorization', `Token ${session.djangoToken}`)
  }
  return fetch(`${DJANGO_API}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  })
}

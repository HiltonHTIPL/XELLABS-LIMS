import { djangoFetch } from '@/app/lib/django'

// Proxies the browser's upload to Django, attaching the session's auth token
// server-side (the browser can't see it — it lives in an httpOnly cookie), and
// streams Django's NDJSON progress response straight back to the client.
export async function POST(request: Request) {
  const formData = await request.formData()
  const res = await djangoFetch('/api/senaite-import/storage-locations/', {
    method: 'POST',
    body: formData,
  })
  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/x-ndjson' },
  })
}

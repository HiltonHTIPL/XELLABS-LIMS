import { djangoFetch } from '@/app/lib/django'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await djangoFetch(`/api/reports/${id}/stream/`)
  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/x-ndjson' },
  })
}

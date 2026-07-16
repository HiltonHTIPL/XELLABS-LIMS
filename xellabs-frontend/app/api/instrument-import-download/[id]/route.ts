import { djangoFetch } from '@/app/lib/django'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await djangoFetch(`/api/instruments/result-imports/${id}/download/`)

  if (!res.ok) {
    return new Response(JSON.stringify({ detail: 'Import file not found.' }), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const disposition = res.headers.get('Content-Disposition') ?? `attachment; filename="import-${id}"`
  const contentType = res.headers.get('Content-Type') ?? 'application/octet-stream'

  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': disposition,
    },
  })
}

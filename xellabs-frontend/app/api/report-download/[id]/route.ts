import { djangoFetch } from '@/app/lib/django'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await djangoFetch(`/api/reports/${id}/download/`)

  if (!res.ok) {
    return new Response(JSON.stringify({ detail: 'Report not found or not yet generated.' }), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ?inline=1 is used by the PDF viewer iframe — serves inline instead of attachment
  const url = new URL(_req.url)
  const inline = url.searchParams.get('inline') === '1'
  const filename = `report-${id}.pdf`
  const disposition = inline ? `inline; filename="${filename}"` : (res.headers.get('Content-Disposition') ?? `attachment; filename="${filename}"`)

  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
    },
  })
}

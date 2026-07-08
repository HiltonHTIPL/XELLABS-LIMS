import { djangoFetch } from '@/app/lib/django'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await djangoFetch(`/api/reports/templates/${id}/preview/`, { method: 'POST' })
  if (!res.ok) {
    return new Response('Preview generation failed', { status: 502 })
  }
  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="template_preview_${id}.pdf"`,
    },
  })
}

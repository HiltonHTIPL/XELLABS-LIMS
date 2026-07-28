import { djangoFetch } from '@/app/lib/django'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const formData = await req.formData()
  const res = await djangoFetch(`/api/reports/templates/${id}/`, {
    method: 'PATCH',
    body: formData,
    headers: {},
  })
  const data = await res.json().catch(() => ({}))
  return Response.json(data, { status: res.status })
}

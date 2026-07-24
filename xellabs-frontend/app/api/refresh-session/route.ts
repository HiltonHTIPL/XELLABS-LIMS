import { NextResponse } from 'next/server'
import { getSession, createSession } from '@/app/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false }, { status: 401 })

  await createSession({
    userId: session.userId,
    username: session.username,
    role: session.role,
    senaiteRoles: session.senaiteRoles,
    isSuperuser: session.isSuperuser,
    djangoToken: session.djangoToken,
    senaiteToken: session.senaiteToken,
    tenantSubdomain: session.tenantSubdomain,
  })

  return NextResponse.json({ ok: true })
}

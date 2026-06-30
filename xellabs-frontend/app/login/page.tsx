import Image from 'next/image'
import { headers } from 'next/headers'
import LoginForm from './_components/LoginForm'

const DJANGO_API = process.env.DJANGO_API_URL ?? 'http://django:8001'

async function getTenantInfo(subdomain: string): Promise<{ name?: string; logoDataUrl?: string }> {
  try {
    const res = await fetch(`${DJANGO_API}/api/tenants/?slug=${subdomain}`, { cache: 'no-store' })
    if (!res.ok) return {}
    const data = await res.json()
    const tenant = (data.results ?? data)[0]
    if (!tenant) return {}

    let logoDataUrl: string | undefined
    if (tenant.logo) {
      // tenant.logo may be an absolute URL (http://django:8001/media/...) or relative path
      const logoUrl = tenant.logo.startsWith('http')
        ? tenant.logo
        : `${DJANGO_API}${tenant.logo.startsWith('/') ? '' : '/'}${tenant.logo}`
      const logoRes = await fetch(logoUrl).catch(() => null)
      if (logoRes?.ok) {
        const buf = await logoRes.arrayBuffer()
        const b64 = Buffer.from(buf).toString('base64')
        const mime = logoRes.headers.get('content-type') || 'image/webp'
        logoDataUrl = `data:${mime};base64,${b64}`
      }
    }

    return { name: tenant.name as string, logoDataUrl }
  } catch {
    return {}
  }
}

export default async function LoginPage() {
  const headerStore = await headers()
  const tenantSubdomain = headerStore.get('x-tenant-subdomain') || ''
  const { name: tenantName, logoDataUrl: tenantLogo } =
    tenantSubdomain ? await getTenantInfo(tenantSubdomain) : {}

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 overflow-hidden"
        style={{ backgroundColor: '#0B1E47' }}
      >
        {/* Hex grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='104' viewBox='0 0 60 104'%3E%3Cpath d='M30 2 L58 18 L58 50 L30 66 L2 50 L2 18 Z' fill='none' stroke='rgba(255,255,255,0.055)' stroke-width='1'/%3E%3Cpath d='M30 70 L58 86 L58 118 L30 134 L2 118 L2 86 Z' fill='none' stroke='rgba(255,255,255,0.055)' stroke-width='1'/%3E%3C/svg%3E")`,
            backgroundSize: '60px 104px',
          }}
        />
        <div className="relative z-10">
          <Image
            src="/xellabs-logo.png"
            alt="XelLabs LIMS"
            width={140}
            height={40}
            style={{ objectFit: 'contain', objectPosition: 'left' }}
          />
          <div className="mt-4 h-px w-16" style={{ backgroundColor: 'rgba(147,197,253,0.4)' }} />
          <p className="mt-3 text-xs tracking-[0.3em] uppercase" style={{ color: 'rgba(147,197,253,0.6)', fontFamily: 'var(--font-geist-mono)' }}>
            LIMS · v1.0
          </p>
        </div>
        <div className="relative z-10">
          <p className="text-2xl font-light leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Laboratory Information<br />Management System
          </p>
          <p className="mt-4 text-sm leading-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Precision in every result.
          </p>
        </div>
        <div className="relative z-10">
          <div className="h-px w-full mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-geist-mono)' }}>
            provided by LSDATASYSTEMS
          </p>
          <p className="text-xs text-center mt-1" style={{ color: 'rgba(255,255,255,0.18)', fontFamily: 'var(--font-geist-mono)' }}>
            codeveloped by Hephzibah Technologies Inc
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12" style={{ backgroundColor: '#F7FAFF' }}>
        <LoginForm
          tenantSubdomain={tenantSubdomain || undefined}
          tenantName={tenantName}
          tenantLogo={tenantLogo}
        />
      </div>
    </div>
  )
}

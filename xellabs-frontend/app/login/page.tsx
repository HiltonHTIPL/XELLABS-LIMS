import { headers } from 'next/headers'
import { djangoFetch } from '@/app/lib/django'
import LoginForm from './_components/LoginForm'

async function getTenantName(subdomain: string): Promise<string | undefined> {
  try {
    // Look up tenant by slug (schema_name) via the public API
    const res = await djangoFetch(`/api/tenants/?slug=${subdomain}`, { skipAuth: true } as any)
    if (!res.ok) return undefined
    const data = await res.json()
    const results = data.results ?? data
    return results[0]?.name
  } catch {
    return undefined
  }
}

export default async function LoginPage() {
  const headerStore = await headers()
  const tenantSubdomain = headerStore.get('x-tenant-subdomain') || ''
  const tenantName = tenantSubdomain ? await getTenantName(tenantSubdomain) : undefined

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
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold tracking-widest" style={{ color: '#ffffff', fontFamily: 'var(--font-geist-sans)' }}>XEL</span>
            <span className="text-5xl font-light tracking-widest" style={{ color: '#93C5FD', fontFamily: 'var(--font-geist-sans)' }}>LABS</span>
          </div>
          <div className="mt-2 h-px w-16" style={{ backgroundColor: 'rgba(147,197,253,0.4)' }} />
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
        <LoginForm tenantSubdomain={tenantSubdomain || undefined} tenantName={tenantName} />
      </div>
    </div>
  )
}

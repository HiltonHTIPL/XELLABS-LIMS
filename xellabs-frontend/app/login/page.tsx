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

const FEATURES = [
  {
    title: '21 CFR Part 11',
    desc: 'Electronic records and signatures, compliant by design',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'GxP Readiness',
    desc: 'Built for GLP, GMP, GCP and ISO standards',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="4" width="12" height="17" rx="2" />
        <path d="M9 4V3h6v2H9z" />
        <path d="M9 10h6M9 13h6" />
        <path d="M9.5 17l1.5 1.5L14 15.5" />
      </svg>
    ),
  },
  {
    title: 'Audit Trails',
    desc: 'Complete traceability and immutable records',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="6" />
        <path d="M20 20l-4.5-4.5" />
        <path d="M11 8.5V11l1.8 1.2" />
      </svg>
    ),
  },
  {
    title: 'Cloud Security',
    desc: 'Enterprise-grade security and certified infrastructure',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 18a4.5 4.5 0 000-9 6 6 0 00-11.6 1.5A4 4 0 006.5 18h11z" />
        <rect x="9.5" y="11.5" width="5" height="4" rx="0.8" />
        <path d="M10.8 11.5v-1a1.2 1.2 0 012.4 0v1" />
      </svg>
    ),
  },
  {
    title: 'Seamless Integration',
    desc: 'Connect Instruments and third-party applications through standards-based integration.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6L4 12l5 6" />
        <path d="M15 6l5 6-5 6" />
      </svg>
    ),
  },
  {
    title: 'Configurable Laboratory Workflows',
    desc: 'Flexible sample, analysis, worksheet, review, and reporting workflows with configurable lifecycle states and role-based approvals.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <circle cx="12" cy="18" r="2.5" />
        <path d="M8.2 7.4L11 16M15.8 7.4L13 16M8.5 6h7" />
      </svg>
    ),
  },
]

export default async function LoginPage() {
  const headerStore = await headers()
  const tenantSubdomain = headerStore.get('x-tenant-subdomain') || ''
  const { name: tenantName, logoDataUrl: tenantLogo } =
    tenantSubdomain ? await getTenantInfo(tenantSubdomain) : {}

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* ── Top header ── */}
      <header className="bg-white shrink-0">
        <div className="w-full px-6 lg:px-12 py-3 flex items-center">
          <div className="flex items-center gap-2">
            <Image
              src="/xellabs-helix.png"
              alt=""
              width={34}
              height={52}
              style={{ objectFit: 'contain' }}
              priority
            />
            <div className="flex flex-col">
              <Image
                src="/xellabs-wordmark.png"
                alt="XELLABS"
                width={140}
                height={24}
                style={{ objectFit: 'contain', objectPosition: 'left' }}
                priority
              />
              <span
                className="font-bold select-none"
                style={{ color: '#0D9488', fontSize: 12, letterSpacing: '0.4em', marginTop: 2 }}
              >
                LIMS
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 relative overflow-hidden flex flex-col justify-center min-h-0">
        {/* Decorative DNA double helix — left edge (watermark, bleeds off-screen) */}
        <svg
          className="absolute top-0 h-full pointer-events-none hidden lg:block"
          style={{ left: -70, opacity: 0.75 }}
          width="260" viewBox="0 0 160 900" fill="none" aria-hidden
          preserveAspectRatio="xMidYMid slice"
        >
          {/* ladder rungs — slanted for a twisting look, shrinking toward each crossover */}
          {[0, 150, 300, 450, 600, 750].map(base => (
            <g key={base} stroke="#DCE9F6" strokeWidth="6" strokeLinecap="round">
              <path d={`M26 ${base + 14} L134 ${base + 6}`} />
              <path d={`M37 ${base + 34} L123 ${base + 26}`} />
              <path d={`M53 ${base + 54} L107 ${base + 46}`} />
              <path d={`M53 ${base + 104} L107 ${base + 96}`} />
              <path d={`M37 ${base + 124} L123 ${base + 116}`} />
              <path d={`M26 ${base + 144} L134 ${base + 136}`} />
            </g>
          ))}
          {/* strands */}
          <path
            d="M20 0 C20 75 140 75 140 150 C140 225 20 225 20 300 C20 375 140 375 140 450 C140 525 20 525 20 600 C20 675 140 675 140 750 C140 825 20 825 20 900"
            stroke="#CFE0F0" strokeWidth="13" strokeLinecap="round"
          />
          <path
            d="M140 0 C140 75 20 75 20 150 C20 225 140 225 140 300 C140 375 20 375 20 450 C20 525 140 525 140 600 C140 675 20 675 20 750 C20 825 140 825 140 900"
            stroke="#E4EEF8" strokeWidth="13" strokeLinecap="round"
          />
        </svg>
        {/* Decorative molecules — right edge */}
        <svg
          className="absolute right-0 bottom-0 pointer-events-none hidden lg:block"
          width="260" height="320" viewBox="0 0 260 320" fill="none" aria-hidden
        >
          <g stroke="#DCE8F5" strokeWidth="2">
            <circle cx="200" cy="80" r="10" fill="#E8F0F9" />
            <circle cx="250" cy="140" r="14" fill="#E8F0F9" />
            <circle cx="180" cy="180" r="8" fill="#E8F0F9" />
            <circle cx="240" cy="240" r="10" fill="#E8F0F9" />
            <circle cx="150" cy="280" r="12" fill="#E8F0F9" />
            <path d="M200 80 L250 140 L180 180 L240 240 L150 280" />
          </g>
        </svg>

        <div className="relative max-w-6xl mx-auto w-full min-h-0 px-6 lg:px-12 py-4 lg:py-6 grid lg:grid-cols-2 gap-8 lg:gap-14 items-center content-center">
          {/* ── Left marketing panel ── */}
          <div className="hidden lg:block">
            <h1 className="text-4xl font-bold leading-tight" style={{ color: '#0B1E47' }}>
              Secure access to<br />laboratory operations
            </h1>
            <p className="mt-4 text-base leading-7" style={{ color: '#334155' }}>
              XELLABS LIMS empowers regulated laboratories with data integrity,
              compliance, and visibility across every workflow.
            </p>

            <ul className="mt-6 space-y-4">
              {FEATURES.map(f => (
                <li key={f.title} className="flex items-start gap-3">
                  <span
                    className="flex items-center justify-center rounded-full shrink-0 bg-white"
                    style={{ width: 42, height: 42, border: '1px solid #D7E3F0', boxShadow: '0 1px 3px rgba(11,30,71,0.06)' }}
                  >
                    {f.icon}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold" style={{ color: '#0B1E47' }}>{f.title}</span>
                    <span className="block text-xs mt-0.5" style={{ color: '#64748B' }}>{f.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Right form card ── */}
          <div className="flex justify-center lg:justify-end">
            <div
              className="w-full max-w-md bg-white rounded-2xl px-8 py-7"
              style={{ boxShadow: '0 10px 40px rgba(11,30,71,0.10)' }}
            >
              <LoginForm
                tenantSubdomain={tenantSubdomain || undefined}
                tenantName={tenantName}
                tenantLogo={tenantLogo}
              />
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-white shrink-0">
        <div className="w-full px-6 lg:px-12 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ color: '#334155' }}>
          <p>© 2026 XELLABS LIMS. All rights reserved.</p>
          <nav className="flex items-center">
            <a href="#" className="hover:underline px-4">Security</a>
            <span style={{ color: '#CBD5E1' }}>|</span>
            <a href="#" className="hover:underline px-4">Privacy Policy</a>
            <span style={{ color: '#CBD5E1' }}>|</span>
            <a href="#" className="hover:underline pl-4">Support</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}

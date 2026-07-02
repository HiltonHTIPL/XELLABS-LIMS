import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        backgroundColor: '#F5F6FA',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid #E5E7EB',
          width: '100%',
          maxWidth: 500,
          boxShadow: '0 2px 16px rgba(11,30,71,0.06)',
        }}
      >
        <div style={{ height: 4, background: 'linear-gradient(90deg, #0B1E47 0%, #14B8A6 100%)' }} />

        <div
          style={{
            padding: '48px 40px 40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              backgroundColor: '#F0FDFA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 28,
              border: '2px dashed rgba(20,184,166,0.30)',
            }}
          >
            <span className="material-icons" style={{ fontSize: 34, color: '#14B8A6' }}>search_off</span>
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0B1E47', letterSpacing: '-0.3px', marginBottom: 10 }}>
            Page Not Found
          </h1>

          <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.65, maxWidth: 360, marginBottom: 28 }}>
            The page you are looking for doesn&apos;t exist or may have been moved.
          </p>

          <Link
            href="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              borderRadius: 8,
              backgroundColor: '#0B1E47',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              marginBottom: 32,
            }}
          >
            Go to Dashboard
          </Link>

          <div style={{ width: '100%', height: 1, backgroundColor: '#F3F4F6', marginBottom: 24 }} />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', fontWeight: 500 }}>
              Regards
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0B1E47' }}>
              Hephzibah{' '}
              <span style={{ color: '#14B8A6' }}>Technologies</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function UnderDevelopment({ title }: { title: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        backgroundColor: '#F5F6FA',
        minHeight: '100%',
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
        {/* Accent stripe */}
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
          {/* Icon */}
          <div style={{ position: 'relative', width: 88, height: 88, marginBottom: 28, flexShrink: 0 }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '2px dashed rgba(20,184,166,0.30)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 10,
                borderRadius: '50%',
                backgroundColor: '#F0FDFA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="material-icons" style={{ fontSize: 34, color: '#14B8A6' }}>build_circle</span>
            </div>
          </div>

          {/* Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              borderRadius: 99,
              backgroundColor: '#FFF7ED',
              border: '1px solid #FED7AA',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              color: '#C2410C',
              marginBottom: 16,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#FB923C', flexShrink: 0 }} />
            In Development
          </div>

          {/* Heading */}
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#0B1E47',
              letterSpacing: '-0.3px',
              marginBottom: 10,
              lineHeight: 1.25,
            }}
          >
            {title}
          </h1>

          {/* Subtext */}
          <p
            style={{
              fontSize: 13,
              color: '#6B7280',
              lineHeight: 1.65,
              maxWidth: 360,
              marginBottom: 32,
            }}
          >
            Our engineering team is actively working on this module.
            It will be available in an upcoming release of XelLabs LIMS.
          </p>

          {/* Divider */}
          <div style={{ width: '100%', height: 1, backgroundColor: '#F3F4F6', marginBottom: 24 }} />

          {/* Regards */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span
              style={{
                fontSize: 10,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.08em',
                color: '#9CA3AF',
                fontWeight: 500,
              }}
            >
              Regards
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0B1E47', letterSpacing: '-0.1px' }}>
              Hephzibah{' '}
              <span style={{ color: '#14B8A6' }}>Technologies</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

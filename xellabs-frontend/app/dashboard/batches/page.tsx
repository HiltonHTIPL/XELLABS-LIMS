function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export default function BatchesPage() {
  return (
    <div style={{ padding: 24, minHeight: '100%', backgroundColor: '#F9FAFB' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em', margin: 0 }}>Batches</h1>
      <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 24px' }}>Group and track samples by batch</p>

      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #E8EAF2', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        padding: '60px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MI name="construction" size={28} color="#2563EB" />
        </div>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#14265E', margin: 0 }}>Batches is under development</p>
        <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0, maxWidth: 380 }}>
          This page will let you group samples into batches for tracking and reporting. Check back soon.
        </p>
      </div>
    </div>
  )
}

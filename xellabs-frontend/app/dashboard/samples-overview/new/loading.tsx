export default function Loading() {
  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <div style={{ width: 220, height: 32, borderRadius: 8, background: '#E5E7EB', marginBottom: 16 }} className="animate-pulse" />
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8EAF2', padding: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ width: 90, height: 26, borderRadius: 8, background: '#E5E7EB' }} className="animate-pulse" />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <div style={{ width: 100, height: 10, borderRadius: 4, background: '#E5E7EB', marginBottom: 6 }} className="animate-pulse" />
              <div style={{ width: '100%', height: 34, borderRadius: 8, background: '#E5E7EB' }} className="animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

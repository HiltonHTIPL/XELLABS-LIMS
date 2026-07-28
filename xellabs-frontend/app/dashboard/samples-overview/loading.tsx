export default function Loading() {
  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ width: 220, height: 32, borderRadius: 8, background: '#E5E7EB' }} className="animate-pulse" />
        <div style={{ width: 120, height: 32, borderRadius: 8, background: '#E5E7EB' }} className="animate-pulse" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 16 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ height: 80, borderRadius: 12, background: '#E5E7EB' }} className="animate-pulse" />
        ))}
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8EAF2' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', gap: 12 }}>
            <div style={{ width: 80, height: 14, borderRadius: 4, background: '#E5E7EB' }} className="animate-pulse" />
            <div style={{ width: 120, height: 14, borderRadius: 4, background: '#E5E7EB' }} className="animate-pulse" />
            <div style={{ width: 80, height: 14, borderRadius: 4, background: '#E5E7EB' }} className="animate-pulse" />
            <div style={{ flex: 1, height: 14, borderRadius: 4, background: '#E5E7EB' }} className="animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

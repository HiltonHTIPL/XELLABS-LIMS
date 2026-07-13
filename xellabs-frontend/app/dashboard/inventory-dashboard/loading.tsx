export default function Loading() {
  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ width: 220, height: 32, borderRadius: 8, background: '#E5E7EB' }} className="animate-pulse" />
        <div style={{ width: 260, height: 32, borderRadius: 8, background: '#E5E7EB' }} className="animate-pulse" />
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 72, borderRadius: 14, background: '#fff', border: '1px solid #E8EAF2' }} className="animate-pulse" />
        ))}
      </div>
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E8EAF2' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid #F9FAFB', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, height: 13, borderRadius: 4, background: '#E5E7EB' }} className="animate-pulse" />
            <div style={{ width: 80, height: 13, borderRadius: 4, background: '#E5E7EB' }} className="animate-pulse" />
            <div style={{ width: 60, height: 13, borderRadius: 4, background: '#E5E7EB' }} className="animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

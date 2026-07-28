export default function Loading() {
  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ width: 220, height: 32, borderRadius: 8, background: '#E5E7EB' }} className="animate-pulse" />
        <div style={{ width: 170, height: 32, borderRadius: 8, background: '#E5E7EB' }} className="animate-pulse" />
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8EAF2' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 12, borderRadius: 4, background: '#E5E7EB' }} className="animate-pulse" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid #F9FAFB', display: 'flex', gap: 12, alignItems: 'center' }}>
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} style={{ flex: 1, height: 13, borderRadius: 4, background: '#E5E7EB' }} className="animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

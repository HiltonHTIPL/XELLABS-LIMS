export default function StorageListLoading() {
  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <div className="animate-pulse" style={{ height: 26, width: 200, borderRadius: 6, background: '#E5E7EB' }} />
        <div className="animate-pulse" style={{ height: 14, width: 340, borderRadius: 6, background: '#EEF0F3', marginTop: 8 }} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4" style={{ maxWidth: 480 }}>
        {[0, 1].map(i => (
          <div key={i} className="animate-pulse" style={{ height: 72, borderRadius: 12, background: '#fff', border: '1px solid #E8EAF2' }} />
        ))}
      </div>

      <div style={{ borderRadius: 12, background: '#fff', border: '1px solid #E8EAF2', padding: 16 }}>
        <div className="animate-pulse" style={{ height: 36, borderRadius: 10, background: '#F1F2F5', marginBottom: 16, maxWidth: 420 }} />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="animate-pulse" style={{ height: 18, borderRadius: 4, background: '#F1F2F5', marginBottom: 12, opacity: 1 - i * 0.05 }} />
        ))}
      </div>
    </div>
  )
}

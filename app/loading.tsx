// app/loading.tsx
// Next.js показва това МИГНОВЕНО докато server component зарежда данните
// Skeleton-ите премахват "бялата пауза" напълно

export default function Loading() {
  return (
    <div style={{ background: '#fafaf8', minHeight: '100vh' }}>
      {/* Urgency bar skeleton */}
      <div style={{ background: '#b91c1c', height: 38 }} />

      {/* Header skeleton */}
      <div style={{ height: 60, background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e5e7eb' }} />
        <div style={{ width: 120, height: 18, background: '#e5e7eb', borderRadius: 6 }} />
        <div style={{ flex: 1 }} />
        <div style={{ width: 100, height: 36, background: '#e5e7eb', borderRadius: 11 }} />
      </div>

      {/* Hero skeleton */}
      <div style={{ background: 'linear-gradient(145deg,#0c3a1c,#15803d)', padding: '52px 32px 60px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 40, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 360px' }}>
            <div style={{ width: 260, height: 28, background: 'rgba(255,255,255,0.15)', borderRadius: 20, marginBottom: 24 }} />
            <div style={{ width: '90%', height: 52, background: 'rgba(255,255,255,0.12)', borderRadius: 10, marginBottom: 12 }} />
            <div style={{ width: '70%', height: 52, background: 'rgba(255,255,255,0.08)', borderRadius: 10, marginBottom: 28 }} />
            {[1,2,3].map(i => (
              <div key={i} style={{ width: `${85 - i * 8}%`, height: 14, background: 'rgba(255,255,255,0.1)', borderRadius: 6, marginBottom: 10 }} />
            ))}
          </div>
          <div style={{ flex: '0 0 400px' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 24, padding: 28, height: 280 }}>
              <div style={{ width: '60%', height: 22, background: 'rgba(255,255,255,0.15)', borderRadius: 8, marginBottom: 16 }} />
              <div style={{ width: '100%', height: 70, background: 'rgba(255,255,255,0.08)', borderRadius: 14, marginBottom: 10 }} />
              <div style={{ width: '100%', height: 70, background: 'rgba(255,255,255,0.08)', borderRadius: 14 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Trust strip skeleton */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '12px 24px', display: 'flex', gap: 20 }}>
        {[140, 160, 130, 150, 120].map((w, i) => (
          <div key={i} style={{ width: w, height: 16, background: '#e5e7eb', borderRadius: 6, flexShrink: 0 }} />
        ))}
      </div>

      {/* Products skeleton */}
      <div style={{ maxWidth: 1100, margin: '60px auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 100, height: 14, background: '#e5e7eb', borderRadius: 6, margin: '0 auto 12px' }} />
          <div style={{ width: 280, height: 36, background: '#e5e7eb', borderRadius: 8, margin: '0 auto 10px' }} />
          <div style={{ width: 200, height: 16, background: '#e5e7eb', borderRadius: 6, margin: '0 auto' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1.5px solid #f0f0f0' }}>
              <div style={{ height: 200, background: '#f3f4f6' }} />
              <div style={{ padding: '18px 22px' }}>
                <div style={{ width: '80%', height: 20, background: '#e5e7eb', borderRadius: 6, marginBottom: 10 }} />
                <div style={{ width: '100%', height: 14, background: '#f3f4f6', borderRadius: 6, marginBottom: 6 }} />
                <div style={{ width: '90%', height: 14, background: '#f3f4f6', borderRadius: 6, marginBottom: 20 }} />
                <div style={{ width: '60%', height: 40, background: '#e5e7eb', borderRadius: 12 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

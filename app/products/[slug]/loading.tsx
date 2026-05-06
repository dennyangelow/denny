// app/products/[slug]/loading.tsx — v2
// ✅ Подобрен skeleton: mobile-first, матчира новия grid layout

export default function OwnProduktLoading() {
  const shimmer: React.CSSProperties = {
    backgroundImage: 'linear-gradient(90deg,#f1f5f9 25%,#e8edf2 50%,#f1f5f9 75%)',
    backgroundSize: '600px 100%',
    animation: 'shimmer 1.4s infinite linear',
    borderRadius: 8,
  }

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      background: '#f6f8fa',
      minHeight: '100vh',
      paddingBottom: 100,
      overflowX: 'hidden',
    }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position:  600px 0; }
        }
      `}</style>

      {/* Urgency bar */}
      <div style={{ height: 40, background: '#14532d' }} />

      {/* Header */}
      <div style={{ height: 60, background: '#fff', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,.04)' }} />

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 28px' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', gap: 8, padding: '18px 0 22px', alignItems: 'center' }}>
          {[60, 8, 80, 8, 160].map((w, i) =>
            i % 2 === 1
              ? <span key={i} style={{ color: '#cbd5e1', fontSize: 12 }}>›</span>
              : <div key={i} style={{ ...shimmer, height: 10, width: w }} />
          )}
        </div>

        {/* Main grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '360px 1fr',
          gap: 32,
          alignItems: 'start',
          marginBottom: 36,
        }}>

          {/* Left: image card */}
          <div style={{ background: '#fff', borderRadius: 22, border: '1.5px solid #e2e8f0', padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,.07)' }}>
            <div style={{ ...shimmer, height: 270, borderRadius: 16, marginBottom: 18,
              backgroundImage: 'linear-gradient(90deg,#f0fdf4 25%,#dcfce7 50%,#f0fdf4 75%)' }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[110, 95, 130].map((w, i) => (
                <div key={i} style={{ ...shimmer, height: 24, width: w, borderRadius: 20 }} />
              ))}
            </div>
          </div>

          {/* Right: info + buy */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Info card */}
            <div style={{ background: '#fff', borderRadius: 22, border: '1.5px solid #e2e8f0', padding: '24px 26px', boxShadow: '0 4px 20px rgba(0,0,0,.07)' }}>
              <div style={{ ...shimmer, height: 10, width: 130, marginBottom: 14 }} />
              <div style={{ ...shimmer, height: 32, width: '82%', marginBottom: 10 }} />
              <div style={{ ...shimmer, height: 14, width: '58%', marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                {[70, 90, 80].map((w, i) => (
                  <div key={i} style={{ ...shimmer, height: 10, width: w }} />
                ))}
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '16px 14px', textAlign: 'center' }}>
                  <div style={{ ...shimmer, height: 28, width: 70, borderRadius: 8, margin: '0 auto 8px' }} />
                  <div style={{ ...shimmer, height: 10, width: 80, margin: '0 auto 5px' }} />
                  <div style={{ ...shimmer, height: 9, width: 60, margin: '0 auto' }} />
                </div>
              ))}
            </div>

            {/* Buy card */}
            <div style={{ background: '#fff', borderRadius: 22, border: '1.5px solid #e2e8f0', padding: '22px 24px', boxShadow: '0 4px 20px rgba(0,0,0,.07)', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ ...shimmer, height: 10, width: 90 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[1, 2].map(i => (
                  <div key={i} style={{ ...shimmer, height: 82, borderRadius: 10 }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <div style={{ ...shimmer, height: 36, width: 120, borderRadius: 8 }} />
                <div style={{ ...shimmer, height: 16, width: 70, borderRadius: 6 }} />
              </div>
              <div style={{ ...shimmer, height: 52, borderRadius: 14,
                backgroundImage: 'linear-gradient(90deg,#d1fae5 25%,#a7f3d0 50%,#d1fae5 75%)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
                {[170, 130, 150].map((w, i) => (
                  <div key={i} style={{ ...shimmer, height: 10, width: w }} />
                ))}
              </div>
            </div>

            {/* Author card */}
            <div style={{ background: '#f0fdf4', borderRadius: 16, border: '1.5px solid #bbf7d0', padding: '16px 18px', display: 'flex', gap: 13 }}>
              <div style={{ ...shimmer, width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ ...shimmer, height: 12, width: 130 }} />
                <div style={{ ...shimmer, height: 10, width: 170 }} />
                <div style={{ ...shimmer, height: 10, width: '88%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Content cards */}
        {[260, 180, 220, 160, 200].map((h, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 22,
            border: '1.5px solid #e2e8f0', padding: '30px 34px',
            marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,.07)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ ...shimmer, height: 22, width: 200, borderRadius: 6 }} />
              <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
            </div>
            <div style={{ ...shimmer, height: h, borderRadius: 12 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

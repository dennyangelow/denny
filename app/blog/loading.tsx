// app/blog/loading.tsx
// ✅ НОВ файл — преди нямаше собствен loading.tsx за /blog, значи Next.js
//    падаше обратно на app/loading.tsx (homepage skeleton) при навигация
//    насам. Затова за миг се виждаше hero/продукти skeleton, преди
//    реалната блог листа да се появи — визуално объркващо, различен
//    layout от целта. Skeleton-ът тук пасва 1:1 на app/blog/page.tsx:
//    hero секция + категория чипове + грид от карти.

const SHIMMER = `
  @keyframes shimmer {
    0%   { background-position: -600px 0 }
    100% { background-position:  600px 0 }
  }
  .sk {
    background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
    background-size: 600px 100%;
    animation: shimmer 1.6s ease-in-out infinite;
    border-radius: 6px;
  }
`

export default function BlogListLoading() {
  return (
    <div style={{ background: '#fafaf8', minHeight: '100vh' }}>
      <style>{SHIMMER}</style>

      {/* ── Hero (пасва на .blog-hero) ── */}
      <div style={{
        background: 'linear-gradient(160deg,#f0fdf4 0%,#dcfce7 35%,#f0fdf8 65%,#ecfdf5 100%)',
        borderBottom: '1px solid #bbf7d0', padding: '40px 24px 32px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="sk" style={{ width: 120, height: 12, marginBottom: 14 }} />
          <div className="sk" style={{ width: '55%', height: 40, marginBottom: 10 }} />
          <div className="sk" style={{ width: '70%', height: 15, marginBottom: 18 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[80, 100, 90, 110, 85].map((w, i) => (
              <div key={i} className="sk" style={{ width: w, height: 30, borderRadius: 22 }} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Грид карти (пасва на .blog-grid / .blog-card) ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden' }}>
              <div className="sk" style={{ width: '100%', aspectRatio: '16/9', borderRadius: 0 }} />
              <div style={{ padding: '16px 16px 18px' }}>
                <div className="sk" style={{ width: '90%', height: 18, marginBottom: 10 }} />
                <div className="sk" style={{ width: '100%', height: 13, marginBottom: 6 }} />
                <div className="sk" style={{ width: '75%', height: 13, marginBottom: 14 }} />
                <div className="sk" style={{ width: 130, height: 12 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

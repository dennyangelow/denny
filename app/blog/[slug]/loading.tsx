// app/blog/[slug]/loading.tsx
// ✅ НОВ файл — по-специфичен от app/blog/loading.tsx, Next.js App Router
//    го предпочита автоматично за точно тази вложена страница (нищо
//    допълнително за конфигуриране, стига файлът да е в правилната папка).
//    Skeleton-ът пасва на BlogPostBody.tsx: breadcrumb, cover (16:9),
//    заглавие, мета ред, параграфи, product embed карта, FAQ accordion.

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

export default function BlogPostLoading() {
  return (
    <div style={{ background: '#fafaf8', minHeight: '100vh' }}>
      <style>{SHIMMER}</style>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 60px' }}>
        {/* Breadcrumb */}
        <div className="sk" style={{ width: 180, height: 12, marginBottom: 18 }} />

        {/* Cover (bp-cover, 16:9) */}
        <div className="sk" style={{ width: '100%', aspectRatio: '16/9', borderRadius: 16, marginBottom: 24 }} />

        {/* Заглавие */}
        <div className="sk" style={{ width: '92%', height: 34, marginBottom: 10 }} />
        <div className="sk" style={{ width: '65%', height: 34, marginBottom: 20 }} />

        {/* Мета ред */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {[100, 120, 90].map((w, i) => (
            <div key={i} className="sk" style={{ width: w, height: 13 }} />
          ))}
        </div>

        {/* Параграфи */}
        {[100, 95, 88, 100, 60].map((w, i) => (
          <div key={i} className="sk" style={{ width: `${w}%`, height: 15, marginBottom: 10 }} />
        ))}

        {/* Heading */}
        <div className="sk" style={{ width: '45%', height: 24, margin: '28px 0 14px' }} />
        {[100, 92, 97, 40].map((w, i) => (
          <div key={i} className="sk" style={{ width: `${w}%`, height: 15, marginBottom: 10 }} />
        ))}

        {/* Product embed карта */}
        <div style={{
          margin: '28px 0', border: '1.5px solid #e5e7eb', borderRadius: 16,
          padding: 18, display: 'flex', gap: 16, alignItems: 'center',
        }}>
          <div className="sk" style={{ width: 76, height: 76, borderRadius: 12, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="sk" style={{ width: '60%', height: 15, marginBottom: 8 }} />
            <div className="sk" style={{ width: '85%', height: 12, marginBottom: 10 }} />
            <div className="sk" style={{ width: 140, height: 30, borderRadius: 9 }} />
          </div>
        </div>

        {/* FAQ accordion редове */}
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 0', borderBottom: '1px solid #f1f5f9',
          }}>
            <div className="sk" style={{ width: `${70 - i * 8}%`, height: 16 }} />
            <div className="sk" style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

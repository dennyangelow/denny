// app/produkt/[slug]/loading.tsx — v1
// ✅ НОВО: собствен skeleton loader за affiliate продуктовата страница
//    (/produkt/[slug]). Преди липсваше — без него Next.js App Router
//    показваше най-близкия loading.tsx нагоре по дървото (loading-а на
//    началната страница), който не съвпада по оформление с тази страница
//    и за миг "просветва" грешен layout при презареждане/навигация.
//    Оформлението тук копира af-grid / af-left / af-right / af-card
//    структурата от AffiliateProduktClient.tsx, за да няма скок при смяна
//    със реалното съдържание.

export default function AffiliateProduktLoading() {
  const shimmer: React.CSSProperties = {
    backgroundImage: 'linear-gradient(90deg,#f1f5f9 25%,#e8edf2 50%,#f1f5f9 75%)',
    backgroundSize: '600px 100%',
    animation: 'shimmer 1.4s infinite linear',
    borderRadius: 8,
  }

  return (
    <div style={{
      fontFamily: "var(--font-dm-sans), sans-serif",
      background: '#fafaf8',
      minHeight: '100vh',
      overflowX: 'hidden',
    }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position:  600px 0; }
        }
        .af-sk-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 10px;
          max-width: 1080px;
          margin: 0 auto;
          padding: 10px 12px 100px;
          align-items: start;
        }
        @media (min-width: 821px) {
          .af-sk-grid {
            grid-template-columns: minmax(0, 340px) minmax(0, 1fr);
            gap: 24px;
            padding: 20px 20px 80px;
          }
        }
        .af-sk-thumbs { display: flex; gap: 8px; margin-top: 10px; }
        .af-sk-tabs { display: flex; gap: 6px; }
      `}</style>

      {/* Hero band (заменя af-hero-band) */}
      <div style={{
        background: 'linear-gradient(160deg,#f0fdf4 0%,#dcfce7 50%,#f0fdf8 100%)',
        borderBottom: '1px solid #bbf7d0', padding: '20px 0 16px',
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 20px', display: 'flex', gap: 8, alignItems: 'center' }}>
          {[50, 8, 70, 8, 150].map((w, i) =>
            i % 2 === 1
              ? <span key={i} style={{ color: '#86efac', fontSize: 12 }}>›</span>
              : <div key={i} style={{ ...shimmer, height: 10, width: w, backgroundImage: 'linear-gradient(90deg,#dcfce7 25%,#bbf7d0 50%,#dcfce7 75%)' }} />
          )}
        </div>
      </div>

      <div className="af-sk-grid">

        {/* LEFT: снимка + покупка */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #ece9e3', padding: 18 }}>
            <div style={{ ...shimmer, height: 260, borderRadius: 14 }} />
            <div className="af-sk-thumbs">
              {[1, 2, 3].map(i => (
                <div key={i} style={{ ...shimmer, width: 52, height: 52, borderRadius: 9, flexShrink: 0 }} />
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #ece9e3', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...shimmer, height: 30, width: '70%' }} />
            <div style={{ ...shimmer, height: 14, width: '45%' }} />
            <div style={{ ...shimmer, height: 52, borderRadius: 14,
              backgroundImage: 'linear-gradient(90deg,#d1fae5 25%,#a7f3d0 50%,#d1fae5 75%)' }} />
          </div>

          <div style={{ background: '#f0fdf4', border: '1px solid #d1fae5', borderRadius: 18, padding: '14px 18px', display: 'flex', gap: 10 }}>
            <div style={{ ...shimmer, width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ ...shimmer, height: 10, width: '60%' }} />
              <div style={{ ...shimmer, height: 9, width: '85%' }} />
            </div>
          </div>
        </div>

        {/* RIGHT: заглавие + табове + съдържание */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #ece9e3', padding: '20px 22px', marginBottom: 14 }}>
            <div style={{ ...shimmer, height: 10, width: 120, marginBottom: 12 }} />
            <div style={{ ...shimmer, height: 30, width: '85%', marginBottom: 10 }} />
            <div style={{ ...shimmer, height: 14, width: '55%' }} />
          </div>

          <div className="af-sk-tabs" style={{ marginBottom: 0 }}>
            {[95, 95, 95, 80].map((w, i) => (
              <div key={i} style={{ ...shimmer, height: 40, width: w, borderRadius: '12px 12px 0 0' }} />
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: '0 0 18px 18px', border: '1px solid #ece9e3', borderTop: 'none', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...shimmer, height: 14, width: '90%' }} />
            <div style={{ ...shimmer, height: 14, width: '75%' }} />
            <div style={{ ...shimmer, height: 14, width: '82%' }} />
            <div style={{ ...shimmer, height: 160, borderRadius: 12, marginTop: 6 }} />
          </div>
        </div>
      </div>
    </div>
  )
}

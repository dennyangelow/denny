// app/loading.tsx
// Skeleton точно пасва на реалната структура на homepage:
// urgency bar (червен) → header (бял) → hero светъл (зелен градиент)
// → trust strip → категории → продукти → atlas → special section → отзиви → FAQ → footer

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
  .sk-dark {
    background: linear-gradient(90deg, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 75%);
    background-size: 600px 100%;
    animation: shimmer 1.6s ease-in-out infinite;
    border-radius: 6px;
  }
`

export default function Loading() {
  return (
    <div style={{ background: '#fafaf8', minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{SHIMMER}</style>

      {/* ── URGENCY BAR ── */}
      <div style={{ background: 'linear-gradient(90deg,#dc2626,#b91c1c)', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '0 20px' }}>
        {[180, 160, 140].map((w, i) => (
          <div key={i} className="sk-dark" style={{ width: w, height: 14 }} />
        ))}
      </div>

      {/* ── HEADER ── */}
      <div style={{ height: 60, background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', position: 'sticky', top: 0, zIndex: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="sk" style={{ width: 34, height: 34, borderRadius: '50%' }} />
          <div>
            <div className="sk" style={{ width: 130, height: 16, marginBottom: 5 }} />
            <div className="sk" style={{ width: 80, height: 10 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[70, 80, 65, 70, 60].map((w, i) => (
            <div key={i} className="sk" style={{ width: w, height: 14, borderRadius: 4 }} />
          ))}
          <div className="sk" style={{ width: 110, height: 36, borderRadius: 11 }} />
        </div>
      </div>

      {/* ── HERO — светла зелена тема ── */}
      <section style={{
        background: 'linear-gradient(160deg,#f0fdf4 0%,#dcfce7 35%,#f0fdf8 65%,#ecfdf5 100%)',
        borderBottom: '1px solid #bbf7d0',
        padding: '52px 40px 60px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 52, alignItems: 'center' }}>

          {/* Ляво — текст */}
          <div>
            {/* Trust badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid #bbf7d0', borderRadius: 100, padding: '6px 14px', marginBottom: 20, boxShadow: '0 2px 12px rgba(22,163,74,0.08)' }}>
              <div className="sk" style={{ width: 34, height: 34, borderRadius: '50%' }} />
              <div>
                <div className="sk" style={{ width: 100, height: 13, marginBottom: 4 }} />
                <div className="sk" style={{ width: 70, height: 10 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                {[52, 48, 44].map((w, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div className="sk" style={{ width: w, height: 14 }} />
                    <div className="sk" style={{ width: 38, height: 9 }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Заглавие */}
            <div className="sk" style={{ width: '88%', height: 52, marginBottom: 10 }} />
            <div className="sk" style={{ width: '72%', height: 52, marginBottom: 20 }} />

            {/* Divider */}
            <div style={{ height: 2, background: '#d1fae5', width: '100%', marginBottom: 16, borderRadius: 2 }} />

            {/* Subtitle */}
            <div className="sk" style={{ width: '95%', height: 14, marginBottom: 8 }} />
            <div className="sk" style={{ width: '85%', height: 14, marginBottom: 8 }} />
            <div className="sk" style={{ width: '60%', height: 14, marginBottom: 20 }} />

            {/* Warning box */}
            <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 16 }}>⚠️</div>
              <div className="sk" style={{ flex: 1, height: 13 }} />
            </div>

            {/* "Ще научиш" grid */}
            <div style={{ background: 'rgba(22,163,74,0.04)', border: '1px solid #d1fae5', borderRadius: 14, padding: '14px 16px' }}>
              <div className="sk" style={{ width: 160, height: 13, marginBottom: 14 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[140,120,130,125,135,120].map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="sk" style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }} />
                    <div className="sk" style={{ width: w, height: 12 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Дясно — HandbooksPanel */}
          <div>
            <div style={{ background: '#fff', border: '1.5px solid #d1fae5', borderRadius: 20, padding: 22, boxShadow: '0 8px 32px rgba(22,163,74,0.10)' }}>
              {/* Хедър */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div className="sk" style={{ width: 200, height: 22, margin: '0 auto 8px' }} />
                <div className="sk" style={{ width: 150, height: 12, margin: '0 auto' }} />
              </div>
              <div style={{ height: 1.5, background: '#d1fae5', marginBottom: 14 }} />
              {/* Две карти наръчници */}
              {[
                { color: '#dc2626' },
                { color: '#16a34a' },
              ].map((hb, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', background: '#fafafa', border: `1.5px solid ${hb.color}22`, borderRadius: 14, overflow: 'hidden', marginBottom: 10, minHeight: 96 }}>
                  <div style={{ width: 80, height: 96, background: `${hb.color}12`, flexShrink: 0 }}>
                    <div className="sk" style={{ width: '100%', height: '100%', borderRadius: 0 }} />
                  </div>
                  <div style={{ flex: 1, padding: '12px 14px' }}>
                    <div className="sk" style={{ width: 70, height: 11, marginBottom: 8 }} />
                    <div className="sk" style={{ width: '85%', height: 16, marginBottom: 8 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <div className="sk" style={{ width: 55, height: 16, borderRadius: 4 }} />
                      <div className="sk" style={{ width: 65, height: 16, borderRadius: 4 }} />
                    </div>
                  </div>
                  <div style={{ width: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, paddingRight: 8 }}>
                    <div className="sk" style={{ width: 34, height: 34, borderRadius: '50%' }} />
                    <div className="sk" style={{ width: 30, height: 9 }} />
                  </div>
                </div>
              ))}
              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 10 }}>
                {[70, 80, 70].map((w, i) => (
                  <div key={i} className="sk" style={{ width: w, height: 11 }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '14px 28px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          {[150, 130, 160, 140, 145].map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="sk" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
              <div>
                <div className="sk" style={{ width: w * 0.7, height: 13, marginBottom: 4 }} />
                <div className="sk" style={{ width: w * 0.55, height: 10 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── КАТЕГОРИИ ── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '52px 24px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="sk" style={{ width: 60, height: 12, margin: '0 auto 12px' }} />
          <div className="sk" style={{ width: 260, height: 34, margin: '0 auto 10px' }} />
          <div className="sk" style={{ width: 180, height: 14, margin: '0 auto' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ background: '#fff', border: '1.5px solid #f0f0f0', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="sk" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
              <div className="sk" style={{ flex: 1, height: 15 }} />
              <div className="sk" style={{ width: 16, height: 16, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </section>

      {/* ── АФИЛИЕЙТ ПРОДУКТИ ── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 52px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div className="sk" style={{ width: 120, height: 12, margin: '0 auto 12px' }} />
          <div className="sk" style={{ width: 300, height: 36, margin: '0 auto 10px' }} />
          <div className="sk" style={{ width: 220, height: 14, margin: '0 auto' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1.5px solid #f0f0f0' }}>
              <div className="sk" style={{ height: 220, borderRadius: 0 }} />
              <div style={{ padding: '18px 20px 20px' }}>
                <div className="sk" style={{ width: 70, height: 11, marginBottom: 8 }} />
                <div className="sk" style={{ width: '80%', height: 22, marginBottom: 10 }} />
                <div className="sk" style={{ width: '100%', height: 13, marginBottom: 6 }} />
                <div className="sk" style={{ width: '90%', height: 13, marginBottom: 14 }} />
                {[1,2,3].map(j => (
                  <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid #f5f5f5', marginBottom: 8 }}>
                    <div className="sk" style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0 }} />
                    <div className="sk" style={{ flex: 1, height: 12 }} />
                  </div>
                ))}
                <div className="sk" style={{ width: '100%', height: 44, borderRadius: 12, marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ATLAS TERRA — светло ── */}
      <section style={{ background: 'linear-gradient(180deg,#f9fafb 0%,#fff 100%)', padding: '60px 24px', borderTop: '1px solid #f0f0f0' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div className="sk" style={{ width: 180, height: 28, margin: '0 auto 16px', borderRadius: 100 }} />
            <div className="sk" style={{ width: 360, height: 48, margin: '0 auto 14px' }} />
            <div className="sk" style={{ width: 440, height: 15, margin: '0 auto 8px' }} />
            <div className="sk" style={{ width: 360, height: 15, margin: '0 auto 20px' }} />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              {[160, 140, 160, 180].map((w, i) => (
                <div key={i} className="sk" style={{ width: w, height: 30, borderRadius: 100 }} />
              ))}
            </div>
          </div>
          {/* Atlas продукти */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 28px rgba(0,0,0,0.06)', border: '1.5px solid #f0f0f0' }}>
                <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="sk" style={{ width: 130, height: 160, borderRadius: 12 }} />
                </div>
                <div style={{ padding: '20px 22px 22px' }}>
                  <div className="sk" style={{ width: 90, height: 12, marginBottom: 10 }} />
                  <div className="sk" style={{ width: '75%', height: 24, marginBottom: 12 }} />
                  <div className="sk" style={{ width: '100%', height: 13, marginBottom: 6 }} />
                  <div className="sk" style={{ width: '85%', height: 13, marginBottom: 16 }} />
                  {/* Variant buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                    {[1,2].map(j => (
                      <div key={j} className="sk" style={{ height: 64, borderRadius: 12 }} />
                    ))}
                  </div>
                  <div className="sk" style={{ width: '100%', height: 48, borderRadius: 12 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── СПЕЦИАЛНА СЕКЦИЯ (Ginegar тъмна) ── */}
      <section style={{ background: 'linear-gradient(135deg,#0a1f10,#0f2d18,#0a1f10)', padding: '60px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'center' }}>
            <div>
              <div className="sk-dark" style={{ width: 100, height: 28, borderRadius: 30, marginBottom: 16 }} />
              <div className="sk-dark" style={{ width: '80%', height: 40, marginBottom: 12 }} />
              <div className="sk-dark" style={{ width: '60%', height: 14, marginBottom: 20 }} />
              <div className="sk-dark" style={{ width: '95%', height: 14, marginBottom: 8 }} />
              <div className="sk-dark" style={{ width: '85%', height: 14, marginBottom: 8 }} />
              <div className="sk-dark" style={{ width: '70%', height: 14, marginBottom: 28 }} />
              {[1,2,3,4].map(j => (
                <div key={j} style={{ display: 'flex', gap: 10, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 10, alignItems: 'center' }}>
                  <div className="sk-dark" style={{ width: 17, height: 17, borderRadius: 5, flexShrink: 0 }} />
                  <div className="sk-dark" style={{ flex: 1, height: 12 }} />
                </div>
              ))}
              <div className="sk-dark" style={{ width: 180, height: 46, borderRadius: 12, marginTop: 8 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div className="sk-dark" style={{ width: 200, height: 260, borderRadius: 18 }} />
              <div style={{ background: '#fff', borderRadius: 16, padding: '14px 28px' }}>
                <div className="sk" style={{ width: 140, height: 44, borderRadius: 6 }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ОТЗИВИ ── */}
      <section style={{ background: '#f7f7f5', padding: '60px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div className="sk" style={{ width: 60, height: 12, margin: '0 auto 12px' }} />
            <div className="sk" style={{ width: 280, height: 34, margin: '0 auto 10px' }} />
            <div className="sk" style={{ width: 200, height: 14, margin: '0 auto 16px' }} />
            <div className="sk" style={{ width: 280, height: 40, margin: '0 auto', borderRadius: 100 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background: '#fff', borderRadius: 18, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', position: 'relative' }}>
                <div className="sk" style={{ width: 28, height: 28, marginBottom: 14 }} />
                <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
                  {[1,2,3,4,5].map(j => <div key={j} className="sk" style={{ width: 14, height: 14 }} />)}
                  <div className="sk" style={{ width: 70, height: 14, marginLeft: 8 }} />
                </div>
                <div className="sk" style={{ width: '100%', height: 14, marginBottom: 6 }} />
                <div className="sk" style={{ width: '95%', height: 14, marginBottom: 6 }} />
                <div className="sk" style={{ width: '80%', height: 14, marginBottom: 20 }} />
                <div className="sk" style={{ width: 90, height: 22, borderRadius: 30, marginBottom: 18 }} />
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div className="sk" style={{ width: 40, height: 40, borderRadius: '50%' }} />
                  <div>
                    <div className="sk" style={{ width: 100, height: 14, marginBottom: 5 }} />
                    <div className="sk" style={{ width: 70, height: 11 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ background: '#f9fafb', padding: '60px 24px' }}>
        <div style={{ maxWidth: 850, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div className="sk" style={{ width: 140, height: 12, margin: '0 auto 12px' }} />
            <div className="sk" style={{ width: 300, height: 34, margin: '0 auto 10px' }} />
            <div className="sk" style={{ width: 220, height: 14, margin: '0 auto 24px' }} />
            {/* Tab бутони */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              {[130, 160, 140].map((w, i) => (
                <div key={i} className="sk" style={{ width: w, height: 44, borderRadius: 100 }} />
              ))}
            </div>
          </div>
          {/* Accordion редове */}
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 14, marginBottom: 10, padding: '18px 22px', border: '1.5px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="sk" style={{ width: `${75 - i * 4}%`, height: 16 }} />
              <div className="sk" style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: 'linear-gradient(135deg,#0a1a0e,#0f2d18)', padding: '52px 24px 28px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 28, marginBottom: 36 }}>
            {[1,2,3,4].map(col => (
              <div key={col}>
                {col === 1 && <div className="sk-dark" style={{ width: 36, height: 36, borderRadius: '50%', marginBottom: 10 }} />}
                <div className="sk-dark" style={{ width: col === 1 ? 130 : 80, height: col === 1 ? 18 : 11, marginBottom: 12 }} />
                {[100, 85, 90, 75].map((w, j) => (
                  <div key={j} className="sk-dark" style={{ width: w, height: 12, marginBottom: 8 }} />
                ))}
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 18 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="sk-dark" style={{ width: 240, height: 12 }} />
            <div className="sk-dark" style={{ width: 40, height: 12 }} />
          </div>
        </div>
      </footer>
    </div>
  )
}

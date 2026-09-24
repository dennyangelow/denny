// app/produkti/loading.tsx — v1
// ✅ НОВО: собствен skeleton за /produkti вместо наследения от app/loading.tsx
//    (който е копие на HOMEPAGE структурата — червен urgency bar, hero с
//    HandbooksPanel, Atlas/Ginegar секции — нищо от това не съществува на
//    /produkti, оттам видимото разминаване при първо зареждане).
//    Skeleton-ът тук пресъздава РЕАЛНАТА структура на ProduktCatalogClient:
//    header (без urgency bar) → зелен hero (breadcrumb/tag/title/desc) →
//    search+sort ред → filter chips → 3-колонна grid с продуктови карти.
//    Self-contained (inline стилове + вграден shimmer <style>) — по същия
//    модел като app/loading.tsx, за да не чака зареждане на produkti.css.

const SHIMMER = `
  @keyframes shimmer {
    0%   { background-position: -600px 0 }
    100% { background-position:  600px 0 }
  }
  .pl-sk {
    background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
    background-size: 600px 100%;
    animation: shimmer 1.6s ease-in-out infinite;
    border-radius: 6px;
  }
`

function SkeletonCard() {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 18,
      border: '1.5px solid #f0f0f0',
      boxShadow: '0 4px 24px rgba(0,0,0,.07)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Image area — съответства на .pk-card-img-wrap (min-height:210px) */}
      <div style={{
        background: '#f8f9fa',
        minHeight: 210,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 20px 0',
      }}>
        <div className="pl-sk" style={{ width: '70%', height: 160, borderRadius: 10 }} />
      </div>

      {/* Body — съответства на .pk-card-body */}
      <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="pl-sk" style={{ width: '40%', height: 11 }} />
        <div className="pl-sk" style={{ width: '78%', height: 20 }} />
        <div className="pl-sk" style={{ width: '92%', height: 13 }} />
        <div className="pl-sk" style={{ width: '55%', height: 13, marginBottom: 4 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <div className="pl-sk" style={{ width: 90, height: 20, borderRadius: 20 }} />
          <div className="pl-sk" style={{ width: 70, height: 20, borderRadius: 20 }} />
        </div>
        <div className="pl-sk" style={{ width: '100%', height: 44, borderRadius: 12, marginTop: 8 }} />
      </div>
    </div>
  )
}

export default function ProduktiLoading() {
  return (
    <div style={{ background: '#fafaf8', minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{SHIMMER}</style>

      {/* ── HEADER — бял, БЕЗ urgency bar (produkti няма такъв) ── */}
      <div style={{
        height: 66, background: '#fff', borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', position: 'sticky', top: 0, zIndex: 200,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="pl-sk" style={{ width: 36, height: 36, borderRadius: '50%' }} />
          <div>
            <div className="pl-sk" style={{ width: 130, height: 16, marginBottom: 5 }} />
            <div className="pl-sk" style={{ width: 90, height: 10 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          {[70, 80, 75, 65, 65, 60].map((w, i) => (
            <div key={i} className="pl-sk" style={{ width: w, height: 13, borderRadius: 4 }} />
          ))}
          <div className="pl-sk" style={{ width: 110, height: 38, borderRadius: 11 }} />
        </div>
      </div>

      {/* ── HERO — зелен градиент, съответства на .pk-hero ── */}
      <div style={{
        background: 'linear-gradient(160deg, #f0fdf4 0%, #dcfce7 55%, #f0fdf8 100%)',
        borderBottom: '1px solid #bbf7d0',
        padding: '28px 0 0',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: 'linear-gradient(90deg, transparent 5%, #86efac 40%, #16a34a 50%, #86efac 60%, transparent 95%)',
        }} />
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 28px' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
            <div className="pl-sk" style={{ width: 50, height: 11 }} />
            <span style={{ opacity: .4, fontSize: 12, color: '#6b7280' }}>›</span>
            <div className="pl-sk" style={{ width: 70, height: 11 }} />
          </div>
          {/* Tag / Title / Desc — центрирани */}
          <div style={{ textAlign: 'center', paddingBottom: 8 }}>
            <div className="pl-sk" style={{ width: 160, height: 11, margin: '0 auto 10px' }} />
            <div className="pl-sk" style={{ width: 320, height: 40, margin: '0 auto 12px' }} />
            <div className="pl-sk" style={{ width: 300, height: 14, margin: '0 auto' }} />
          </div>
        </div>
      </div>

      {/* ── СЪДЪРЖАНИЕ — съответства на .pk-content ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' }}>

        {/* Search + Sort ред */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="pl-sk" style={{ flex: '1 1 260px', maxWidth: 540, height: 46, borderRadius: 14 }} />
          <div className="pl-sk" style={{ width: 150, height: 46, borderRadius: 14, flexShrink: 0 }} />
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 24 }}>
          {[110, 150, 190, 110, 130, 160, 150].map((w, i) => (
            <div key={i} className="pl-sk" style={{ width: w, height: 36, borderRadius: 100 }} />
          ))}
        </div>

        {/* Product grid — 3 колони, съответства на .pk-grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
        }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

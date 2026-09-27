// app/naruchnik/[slug]/loading.tsx — v1
// ✅ НОВ файл. Преди нямаше собствен loading.tsx в тази route папка —
//    Next.js App Router пада нагоре до най-близкия родителски loading.tsx,
//    в случая app/loading.tsx (skeleton на НАЧАЛНАТА страница) — грешен
//    layout за миг при всяка навигация към /naruchnik/[slug]. Skeleton-ът
//    тук огледално следва реалния NaruchnikClient.tsx layout (nh-header
//    hero + n-page двуколонен блок), за да няма скок/разминаване, когато
//    истинското съдържание се появи.
//
// Само inline стилове (без класове от app/homepage.css) — тази CSS се
// импортва вътре в NaruchnikClient.tsx, а loading.tsx трябва да рендва
// коректно дори ако route бъндъл кешът все още не я е приложил.

const pulse: React.CSSProperties = {
  background: 'linear-gradient(90deg, #eef2f0 25%, #e4ebe7 37%, #eef2f0 63%)',
  backgroundSize: '400% 100%',
  animation: 'nh-skel-pulse 1.4s ease infinite',
  borderRadius: 8,
}

export default function NaruchnikLoading() {
  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <style>{`@keyframes nh-skel-pulse { 0% { background-position: 100% 50% } 100% { background-position: 0 50% } }`}</style>

      {/* Breadcrumb ивица */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f1f5f9', padding: '14px 24px' }}>
        <div style={{ ...pulse, width: 220, height: 14 }} />
      </div>

      {/* Hero — огледава .nh-header/.nh-inner/.nh-img-wrap/.nh-meta/.nh-stats */}
      <div style={{ background: 'linear-gradient(135deg,#0f1f16,#1b4332)', padding: '40px 24px 56px' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ ...pulse, width: 180, height: 240, flexShrink: 0, background: 'rgba(255,255,255,0.12)', backgroundImage: 'none', animation: 'none' }} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ ...pulse, width: 120, height: 20, marginBottom: 14, background: 'rgba(255,255,255,0.15)', backgroundImage: 'none', animation: 'none' }} />
            <div style={{ ...pulse, width: '80%', height: 34, marginBottom: 10, background: 'rgba(255,255,255,0.18)', backgroundImage: 'none', animation: 'none' }} />
            <div style={{ ...pulse, width: '60%', height: 34, marginBottom: 18, background: 'rgba(255,255,255,0.18)', backgroundImage: 'none', animation: 'none' }} />
            <div style={{ ...pulse, width: '90%', height: 16, marginBottom: 24, background: 'rgba(255,255,255,0.12)', backgroundImage: 'none', animation: 'none' }} />
            <div style={{ display: 'flex', gap: 24 }}>
              {[1, 2, 3].map(i => (
                <div key={i}>
                  <div style={{ ...pulse, width: 54, height: 20, marginBottom: 6, background: 'rgba(255,255,255,0.18)', backgroundImage: 'none', animation: 'none' }} />
                  <div style={{ ...pulse, width: 60, height: 10, background: 'rgba(255,255,255,0.1)', backgroundImage: 'none', animation: 'none' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main двуколонен блок — огледава .n-page/.n-left/.n-right */}
      <main style={{ maxWidth: 1060, margin: '0 auto', padding: '28px 24px 80px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ ...pulse, width: '40%', height: 22 }} />
          <div style={{ ...pulse, width: '100%', height: 16 }} />
          <div style={{ ...pulse, width: '95%', height: 16 }} />
          <div style={{ ...pulse, width: '88%', height: 16 }} />
          <div style={{ ...pulse, width: '100%', height: 220, marginTop: 8 }} />
          <div style={{ ...pulse, width: '92%', height: 16 }} />
          <div style={{ ...pulse, width: '80%', height: 16 }} />
        </div>

        {/* Sidebar форма — огледава .n-right карта */}
        <aside>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
            <div style={{ ...pulse, width: 44, height: 44, borderRadius: 12, margin: '0 auto 14px' }} />
            <div style={{ ...pulse, width: '70%', height: 18, margin: '0 auto 20px' }} />
            <div style={{ ...pulse, width: '100%', height: 44, marginBottom: 10 }} />
            <div style={{ ...pulse, width: '100%', height: 44, marginBottom: 10 }} />
            <div style={{ ...pulse, width: '100%', height: 44, marginBottom: 16 }} />
            <div style={{ ...pulse, width: '100%', height: 48, borderRadius: 12 }} />
          </div>
        </aside>
      </main>
    </div>
  )
}
